"""
Cleo Supply Chain Intelligence — FastAPI backend

Exposes the RAG pipeline as a REST API so any frontend (React, Next.js, etc.)
can call it over HTTP. Streamlit is kept as a quick-access dev UI; this API
is the production interface.

Run:
    uvicorn app.api:app --reload --port 8000

Endpoints:
    POST /api/query          — ask a question, get an answer
    POST /api/ingest         — upload and ingest a document
    GET  /api/stats          — collection chunk counts
    GET  /api/health         — model + DB status
    GET  /api/collections    — list available collections
"""
import os
import tempfile
from pathlib import Path
from typing import Optional
import json

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.generation.generator import AnswerGenerator
from app.ingestion.pipeline import IngestionPipeline
from app.database.chroma import ChromaClient
from app.database.sqlite import (
    init_db, create_chat, list_chats, get_chat, delete_chat,
    add_message, get_messages, update_chat_title,
)
from app.database import sqlite as sql_db
from app.config import COLLECTIONS
from loguru import logger


# ── App init ─────────────────────────────────────────────────────────────────
init_db()  # ensure tables exist before any request

app = FastAPI(
    title="Cleo Supply Chain Intelligence API",
    description="RAG-powered EDI and supply chain knowledge assistant",
    version="1.0.0",
)

# CORS — allow all local dev origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",   # FastAPI self (frontend served here)
        "http://localhost:3000",   # Next.js / Create React App
        "http://localhost:5173",   # Vite dev server
        "http://localhost:8501",   # Streamlit
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Serve the React frontend as static files ──────────────────────────────────
_frontend_dir = Path(__file__).parent.parent / "frontend"
if _frontend_dir.exists():
    app.mount("/ui", StaticFiles(directory=str(_frontend_dir), html=True), name="frontend")

@app.get("/", include_in_schema=False)
async def root():
    """Redirect / → /ui/ so opening localhost:8000 shows the UI."""
    if _frontend_dir.exists():
        return RedirectResponse(url="/ui/index.html")
    return {"message": "Cleo Supply Chain Intelligence API", "docs": "/docs"}

# ── Singletons — loaded once at startup ──────────────────────────────────────
_generator: Optional[AnswerGenerator] = None
_pipeline:  Optional[IngestionPipeline] = None


def get_generator() -> AnswerGenerator:
    global _generator
    if _generator is None:
        _generator = AnswerGenerator()
    return _generator


def get_pipeline() -> IngestionPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline


# ── Request / Response schemas ────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000,
                       description="The question to ask the knowledge base")


class ChunkInfo(BaseModel):
    text:        str
    source:      str
    collection:  str
    chunk_index: int
    rrf_score:   float
    confidence:  float


class QueryResponse(BaseModel):
    answer:               str
    sources:              list[str]
    confidence:           float
    confident:            bool
    collections_searched: list[str]
    chunks_used:          int
    chunks:               list[dict]  # raw for transparency panel


class IngestResponse(BaseModel):
    status:         str
    source:         str
    collection:     str
    docs_loaded:    Optional[int] = None
    chunks_created: Optional[int] = None
    chunks_stored:  Optional[int] = None
    error:          Optional[str] = None


class StatsResponse(BaseModel):
    collections: dict[str, int]
    total_chunks: int


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}

    status:          str
    model_available: bool
    model_name:      str
    db_path:         str
    total_chunks:    int


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """
    Ask the RAG system a question.

    Returns the answer, source citations, confidence score, and the raw
    context chunks used — everything needed to build a rich UI response.
    """
    logger.info(f"API query: {request.query[:60]}")
    try:
        result = get_generator().answer(request.query)
        return QueryResponse(**result)
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    collection_name: str = Form(...),
):
    """
    Upload and ingest a document into the specified collection.

    Accepts: PDF, DOCX, TXT, MD, XLSX, XLS, CSV
    Max file size: 50MB
    """
    MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50MB

    if collection_name not in COLLECTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown collection '{collection_name}'. "
                   f"Valid options: {list(COLLECTIONS.keys())}"
        )

    # Read file and enforce size limit
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(content) / 1024 / 1024:.1f}MB). Max 50MB."
        )

    suffix = Path(file.filename).suffix.lower()
    allowed = {".pdf", ".docx", ".txt", ".md", ".xlsx", ".xls", ".csv"}
    if suffix not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{suffix}'. Allowed: {allowed}"
        )

    # Write to temp file — loader needs a real path
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = get_pipeline().ingest(
            source=tmp_path,
            collection_name=collection_name,
            extra_metadata={
                "source":      file.filename,
                "source_type": suffix.lstrip("."),
            },
        )
    finally:
        os.unlink(tmp_path)

    if result["status"] == "error":
        raise HTTPException(status_code=422, detail=result.get("error"))

    return IngestResponse(**result)


@app.get("/api/stats", response_model=StatsResponse)
async def stats():
    """Return chunk counts per collection."""
    try:
        collection_stats = ChromaClient.get_collection_stats()
        return StatsResponse(
            collections=collection_stats,
            total_chunks=sum(collection_stats.values()),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health", response_model=HealthResponse)
async def health():
    """Check if the model and database are available."""
    from app.config import OLLAMA_MODEL, CHROMA_DIR
    gen = get_generator()
    try:
        collection_stats = ChromaClient.get_collection_stats()
        total = sum(collection_stats.values())
    except Exception:
        total = -1

    return HealthResponse(
        status="ok",
        model_available=gen.llm.is_available(),
        model_name=OLLAMA_MODEL,
        db_path=str(CHROMA_DIR),
        total_chunks=total,
    )


@app.get("/api/collections")
async def collections():
    """List available collections with their descriptions."""
    return {
        "collections": [
            {"name": name, "description": desc}
            for name, desc in COLLECTIONS.items()
        ]
    }


@app.get("/api/documents/search")
async def search_documents(id_type: str, id_value: str):
    """Find documents by an identifier (e.g., po, invoice, st)."""
    try:
        matches = sql_db.find_docs_by_identifier(id_type, id_value)
        return {"matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/by_source")
async def document_by_source(source: str):
    """Find a document record by its source filename."""
    try:
        conn = sql_db.get_conn()
        row = conn.execute("SELECT * FROM documents WHERE source = ?", (source,)).fetchone()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail="Document not found")
        doc = dict(row)
        try:
            doc['metadata'] = json.loads(doc.get('metadata') or '{}')
        except Exception:
            doc['metadata'] = {}
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transactions/{id_type}/{id_value}")
async def transaction_trace(id_type: str, id_value: str):
    """Return all documents and relations for a given transaction identifier.

    id_type: 'po'|'invoice'|'st' etc.
    """
    try:
        # find matching doc ids
        doc_ids = sql_db.find_docs_by_identifier(id_type, id_value)
        conn = sql_db.get_conn()
        nodes = []
        for d in doc_ids:
            row = conn.execute("SELECT * FROM documents WHERE id = ?", (d,)).fetchone()
            if row:
                doc = dict(row)
                try:
                    doc['metadata'] = json.loads(doc.get('metadata') or '{}')
                except Exception:
                    doc['metadata'] = {}
                nodes.append(doc)

        # gather relations for these docs
        rows = conn.execute(
            "SELECT * FROM doc_relations WHERE from_doc IN ({seq}) OR to_doc IN ({seq})".format(seq=','.join('?' * len(doc_ids))),
            tuple(doc_ids + doc_ids) if doc_ids else (),
        ).fetchall() if doc_ids else []
        conn.close()
        edges = [dict(r) for r in rows]
        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/documents/{doc_id}/relations")
async def document_relations(doc_id: str):
    """Return relations for a given document id."""
    try:
        conn = sql_db.get_conn()
        rows = conn.execute(
            "SELECT * FROM doc_relations WHERE from_doc = ? OR to_doc = ?",
            (doc_id, doc_id),
        ).fetchall()
        conn.close()
        return {"relations": [dict(r) for r in rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Chat session endpoints ────────────────────────────────────────────────────

class ChatMessageRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)


@app.get("/api/chats")
async def get_chats():
    """Return recent chat sessions, newest first."""
    return list_chats()


@app.post("/api/chats", status_code=201)
async def new_chat():
    """Create a new empty chat session."""
    return create_chat()


@app.delete("/api/chats/{chat_id}")
async def remove_chat(chat_id: str):
    """Delete a chat and all its messages."""
    if not get_chat(chat_id):
        raise HTTPException(status_code=404, detail="Chat not found")
    delete_chat(chat_id)
    return {"ok": True}


@app.get("/api/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: str):
    """Return all messages for a chat session."""
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return {"chat": chat, "messages": get_messages(chat_id)}


@app.post("/api/chats/{chat_id}/messages")
async def send_chat_message(chat_id: str, request: ChatMessageRequest):
    """
    Send a message in a chat session and get a RAG-grounded response.
    Conversation history from the session is passed to the LLM for memory.
    """
    chat = get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    query = request.query.strip()

    # Load conversation history for memory
    prior_messages = get_messages(chat_id)
    history = [{"role": m["role"], "content": m["content"]} for m in prior_messages]

    # Auto-title from first user message
    if not prior_messages and chat["title"] == "New Chat":
        title = query[:60] + ("..." if len(query) > 60 else "")
        update_chat_title(chat_id, title)

    # Save user message
    add_message(chat_id, "user", query)

    # Generate answer with history for in-chat memory
    try:
        result = get_generator().answer(query, history=history)
    except Exception as e:
        logger.error(f"Chat message generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Save assistant message
    add_message(
        chat_id, "assistant", result["answer"],
        sources=result.get("sources", []),
        confidence=result.get("confidence", 0),
    )

    return {
        "answer":               result["answer"],
        "sources":              result.get("sources", []),
        "confidence":           result.get("confidence", 0),
        "confident":            result.get("confident", False),
        "collections_searched": result.get("collections_searched", []),
        "chunks_used":          result.get("chunks_used", 0),
        "chunks":               result.get("chunks", []),
    }

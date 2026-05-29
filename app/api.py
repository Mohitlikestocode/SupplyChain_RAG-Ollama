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

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.generation.generator import AnswerGenerator
from app.ingestion.pipeline import IngestionPipeline
from app.database.chroma import ChromaClient
from app.config import COLLECTIONS
from loguru import logger


# ── App init ─────────────────────────────────────────────────────────────────
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

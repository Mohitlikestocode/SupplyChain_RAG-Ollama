import sqlite3
import uuid
import json
from datetime import datetime
from pathlib import Path
from app.config import BASE_DIR

DB_PATH = BASE_DIR / "chats.db"


def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS chats (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL DEFAULT 'New Chat',
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id          TEXT PRIMARY KEY,
            chat_id     TEXT NOT NULL,
            role        TEXT NOT NULL,
            content     TEXT NOT NULL,
            sources     TEXT,
            confidence  REAL,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS documents (
            id          TEXT PRIMARY KEY,
            source      TEXT NOT NULL,
            collection  TEXT NOT NULL,
            metadata    TEXT,
            created_at  TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS doc_identifiers (
            doc_id      TEXT NOT NULL,
            id_type     TEXT NOT NULL,
            id_value    TEXT NOT NULL,
            FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS doc_relations (
            id          TEXT PRIMARY KEY,
            from_doc    TEXT NOT NULL,
            to_doc      TEXT NOT NULL,
            relation    TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            FOREIGN KEY (from_doc) REFERENCES documents(id) ON DELETE CASCADE,
            FOREIGN KEY (to_doc)   REFERENCES documents(id) ON DELETE CASCADE
        );
    """)
    conn.commit()
    conn.close()


def _now():
    return datetime.utcnow().isoformat()


def create_chat(title="New Chat") -> dict:
    conn = get_conn()
    chat_id = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO chats (id, title, created_at, updated_at) VALUES (?,?,?,?)",
        (chat_id, title, now, now),
    )
    conn.commit()
    conn.close()
    return {"id": chat_id, "title": title, "created_at": now, "updated_at": now, "message_count": 0}


def list_chats(limit: int = 50) -> list:
    conn = get_conn()
    rows = conn.execute(
        """SELECT c.id, c.title, c.created_at, c.updated_at,
                  COUNT(m.id) as message_count
           FROM chats c
           LEFT JOIN messages m ON m.chat_id = c.id
           GROUP BY c.id
           ORDER BY c.updated_at DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_chat(chat_id: str) -> dict | None:
    conn = get_conn()
    row = conn.execute("SELECT * FROM chats WHERE id = ?", (chat_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_chat(chat_id: str):
    conn = get_conn()
    conn.execute("DELETE FROM messages WHERE chat_id = ?", (chat_id,))
    conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
    conn.commit()
    conn.close()


def update_chat_title(chat_id: str, title: str):
    conn = get_conn()
    conn.execute("UPDATE chats SET title = ? WHERE id = ?", (title, chat_id))
    conn.commit()
    conn.close()


def add_message(chat_id: str, role: str, content: str,
                sources=None, confidence: float = None) -> dict:
    conn = get_conn()
    msg_id = str(uuid.uuid4())
    now = _now()
    sources_json = json.dumps(sources) if sources is not None else None
    conn.execute(
        "INSERT INTO messages (id, chat_id, role, content, sources, confidence, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (msg_id, chat_id, role, content, sources_json, confidence, now),
    )
    conn.execute("UPDATE chats SET updated_at = ? WHERE id = ?", (now, chat_id))
    conn.commit()
    conn.close()
    return {
        "id": msg_id, "chat_id": chat_id, "role": role,
        "content": content, "sources": sources or [],
        "confidence": confidence, "created_at": now,
    }


def add_document(source: str, collection: str, metadata: dict | None = None) -> dict:
    conn = get_conn()
    doc_id = str(uuid.uuid4())
    now = _now()
    meta_json = json.dumps(metadata or {})
    conn.execute(
        "INSERT INTO documents (id, source, collection, metadata, created_at) VALUES (?,?,?,?,?)",
        (doc_id, source, collection, meta_json, now),
    )
    conn.commit()
    conn.close()
    return {"id": doc_id, "source": source, "collection": collection, "metadata": metadata or {}, "created_at": now}


def add_doc_identifier(doc_id: str, id_type: str, id_value: str):
    conn = get_conn()
    conn.execute(
        "INSERT INTO doc_identifiers (doc_id, id_type, id_value) VALUES (?,?,?)",
        (doc_id, id_type, id_value),
    )
    conn.commit()
    conn.close()


def find_docs_by_identifier(id_type: str, id_value: str) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT doc_id FROM doc_identifiers WHERE id_type = ? AND id_value = ?",
        (id_type, id_value),
    ).fetchall()
    conn.close()
    return [r[0] for r in rows]


def add_doc_relation(from_doc: str, to_doc: str, relation: str) -> dict:
    conn = get_conn()
    rid = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO doc_relations (id, from_doc, to_doc, relation, created_at) VALUES (?,?,?,?,?)",
        (rid, from_doc, to_doc, relation, now),
    )
    conn.commit()
    conn.close()
    return {"id": rid, "from_doc": from_doc, "to_doc": to_doc, "relation": relation, "created_at": now}


def get_messages(chat_id: str) -> list:
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
        (chat_id,),
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        msg = dict(r)
        if msg.get("sources"):
            try:
                msg["sources"] = json.loads(msg["sources"])
            except Exception:
                msg["sources"] = []
        else:
            msg["sources"] = []
        result.append(msg)
    return result

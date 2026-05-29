"""
Reset the ChromaDB and BM25 indexes — wipes ALL stored chunks.

Use this to clean up test data written during development before
loading production documents. After running this, re-ingest with:

    python scripts/ingest_corpus.py

Usage:
    python scripts/reset_db.py           (asks for confirmation)
    python scripts/reset_db.py --yes     (no prompt, for scripting)
"""
import sys
import shutil
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import CHROMA_DIR, DATA_DIR


def reset(confirmed: bool = False):
    chroma_path = CHROMA_DIR
    bm25_files  = list(chroma_path.glob("bm25_*.pkl")) if chroma_path.exists() else []

    print(f"\nThis will delete:")
    print(f"  ChromaDB:   {chroma_path}")
    print(f"  BM25 files: {len(bm25_files)} index file(s)")

    if not confirmed:
        answer = input("\nAre you sure? Type 'yes' to confirm: ").strip().lower()
        if answer != "yes":
            print("Aborted.")
            return

    if chroma_path.exists():
        shutil.rmtree(chroma_path)
        print(f"  ✓ Deleted {chroma_path}")
    else:
        print(f"  — ChromaDB directory not found (already clean)")

    print(f"\nDatabase reset complete.")
    print(f"Re-ingest your documents with:")
    print(f"  python scripts/ingest_corpus.py\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Wipe ChromaDB and BM25 indexes")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation prompt")
    args = parser.parse_args()
    reset(confirmed=args.yes)

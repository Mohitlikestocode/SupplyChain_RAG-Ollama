import re
from typing import Dict, Any, List
from app.generation.llm import OllamaLLM
from app.generation.prompts import SYSTEM_PROMPT, build_user_message, NO_CONTEXT_RESPONSE, sanitize_query
from app.retrieval.context import ContextAssembler
from app.config import SIMILARITY_THRESHOLD, TOP_K_FINAL
from loguru import logger


def _clean_response(text: str) -> str:
    """Strip internal retrieval metadata that small LLMs leak into their output."""
    # Pattern: [Chunk N | Source: X | Collection: Y | Chunk index: N | Relevance: Z]
    # → (Source: X)
    text = re.sub(
        r'\[Chunk\s+\d+\s*\|\s*Source:\s*([^|]+?)\s*\|[^\]]*\]',
        lambda m: f'(Source: {m.group(1).strip()})',
        text
    )
    # Pattern: [Source: X, Chunk index: N] → (Source: X)
    text = re.sub(
        r'\[Source:\s*([^,\]]+?),\s*[Cc]hunk\s+index[^\]]*\]',
        lambda m: f'(Source: {m.group(1).strip()})',
        text
    )
    # Remaining "Chunk index: N" anywhere
    text = re.sub(r'[,|]?\s*[Cc]hunk\s+index[:\s]*\d+', '', text)
    # Remaining "Chunk N" standalone
    text = re.sub(r'\bChunk\s+\d+\b', '', text)
    # Clean up leftover artefacts
    text = re.sub(r'\[\s*\|\s*', '[', text)
    text = re.sub(r'\[\s*\]', '', text)
    text = re.sub(r'\s{2,}', ' ', text)
    return text.strip()


def _is_rewrite_followup(query: str) -> bool:
    """Return True for format-only follow-ups that should rewrite prior answer.

    Examples: "answer in 1 line", "say that in 2 sentences", "shorter".
    """
    normalized = query.strip().lower()
    patterns = (
        r'^(say|answer|rewrite|summarize|make it|put it)\b',
        r'\b(one|1)\s+line\b',
        r'\b(two|2)\s+sentences?\b',
        r'\b(shorter|briefly|brief|concise|simpler|simplify)\b',
        r'\b(in\s+one\s+line|in\s+1\s+line|in\s+two\s+sentences?)\b',
    )
    return any(re.search(pattern, normalized) for pattern in patterns)


def _last_assistant_message(history: List[Dict[str, str]]) -> str:
    for message in reversed(history):
        if message.get("role") == "assistant" and message.get("content"):
            return message["content"]
    return ""


def _last_user_message(history: List[Dict[str, str]]) -> str:
    for message in reversed(history):
        if message.get("role") == "user" and message.get("content"):
            return message["content"]
    return ""


def _is_contextual_followup(query: str) -> bool:
    """Best-effort detection for follow-ups that depend on prior turns.

    This catches references like "that", "it", "same issue", "why",
    "what about", etc. Standalone domain questions should continue to retrieve
    on their own text only.
    """
    normalized = query.strip().lower()
    if not normalized:
        return False

    contextual_patterns = (
        r'^(and|also|so|then)\b',
        r'^(what about|how about|why|how so|how come)\b',
        r'\b(this|that|it|they|them|these|those|previous|above|same)\b',
        r'\b(explain that|tell me more|more on that|expand on that)\b',
        r'\b(based on that|from that|from this|in that case)\b',
    )
    return any(re.search(pattern, normalized) for pattern in contextual_patterns)


def _build_retrieval_query(query: str, history: List[Dict[str, str]]) -> str:
    """Enrich retrieval for contextual follow-ups using prior question/answer.

    For standalone queries, preserve the raw user query so unrelated questions
    do not get polluted by history.
    """
    if not history or not _is_contextual_followup(query):
        return query

    prior_question = _last_user_message(history)
    prior_answer = _last_assistant_message(history)
    parts = [f"Current follow-up: {query}"]
    if prior_question:
        parts.append(f"Previous user question: {prior_question}")
    if prior_answer:
        parts.append(f"Previous assistant answer: {prior_answer}")
    return "\n".join(parts)


class AnswerGenerator:
    """
    Runs the full RAG pipeline: retrieve → assemble → generate → cite.

    answer(query) returns a dict with everything the UI needs:
      answer              : the generated text (or NO_CONTEXT_RESPONSE)
      sources             : list of source document names cited
      confidence          : max retrieval similarity score (0-1)
      confident           : bool — did we exceed SIMILARITY_THRESHOLD?
      collections_searched: which ChromaDB collections were queried
      chunks_used         : how many context chunks fed to the LLM
      chunks              : the raw chunk dicts (for UI debug / transparency panel)
    """

    def __init__(self):
        self.llm       = OllamaLLM()
        self.assembler = ContextAssembler()

    def answer(self, query: str, history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """
        Full RAG pipeline for one query.

        Step 1 — Retrieve: ContextAssembler classifies, embeds, hybrid-retrieves,
                 deduplicates, and returns the best context chunks.

        Step 2 — Gate: if max similarity < SIMILARITY_THRESHOLD, the retrieved
                 context is too weak to ground an answer. Return the honest
                 "I don't know" response WITHOUT calling the LLM at all.
                 This saves ~2-5 seconds of inference time and prevents the
                 LLM from trying to answer from noise chunks.

        Step 3 — Generate: build the prompt (system + user message with injected
                 context), call Ollama, get the answer.

        Step 4 — Extract sources: deduplicate source names from all used chunks.
        """
        if history is None:
            history = []
        query = sanitize_query(query)
        if not query:
            return {
                "answer": "Please enter a question.",
                "sources": [], "confidence": 0.0, "confident": False,
                "collections_searched": [], "chunks_used": 0, "chunks": [],
            }

        logger.info(f"Query: {query[:80]}")

        if history and _is_rewrite_followup(query):
            prior_answer = _last_assistant_message(history)
            if prior_answer:
                logger.info("Format-only follow-up detected — rewriting previous assistant answer")
                rewrite_msgs = [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": (
                            f"Rewrite the following answer to satisfy this instruction: {query}\n\n"
                            f"Previous answer:\n{prior_answer}\n\n"
                            "Keep the meaning identical, do not add new facts, do not mention sources, "
                            "and only use information already present in the previous answer."
                        ),
                    },
                ]
                answer_text = _clean_response(self.llm.generate(rewrite_msgs))
                return {
                    "answer":               answer_text,
                    "sources":              [],
                    "confidence":           1.0,
                    "confident":            True,
                    "collections_searched": [],
                    "chunks_used":          0,
                    "chunks":               [],
                }

        retrieval_query = _build_retrieval_query(query, history)
        if retrieval_query != query:
            logger.info("Contextual follow-up detected — enriching retrieval query from chat history")

        # ── Step 1: Retrieve ──────────────────────────────────────────────
        chunks, confidence, collections_searched = self.assembler.assemble(retrieval_query)

        # ── Step 2: Confidence gate ───────────────────────────────────────
        if confidence < SIMILARITY_THRESHOLD or not chunks:
            # If we have conversation history, let the LLM answer from it
            # (handles follow-up questions like "explain in 2 lines")
            if history:
                logger.info(f"Low confidence ({confidence:.3f}) but history present — "
                            f"answering from conversation context")
                prior = history[-6:]
                fallback_msgs = [{"role": "system", "content": SYSTEM_PROMPT}]
                fallback_msgs.extend(prior)
                fallback_msgs.append({
                    "role": "user",
                    "content": (
                        f"QUESTION: {query}\n\n"
                        f"No new documentation was found for this specific query. "
                        f"Answer using our conversation history only if it directly supports the answer. "
                        f"If it does not, respond in at most two sentences saying you do not have enough verified information and what document or identifier would help."
                    )
                })
                answer_text = _clean_response(self.llm.generate(fallback_msgs))
                return {
                    "answer":               answer_text,
                    "sources":              [],
                    "confidence":           confidence,
                    "confident":            False,
                    "collections_searched": collections_searched,
                    "chunks_used":          0,
                    "chunks":               [],
                }
            logger.info(f"Below threshold ({confidence:.3f} < {SIMILARITY_THRESHOLD}) — abstaining")
            return {
                "answer":               NO_CONTEXT_RESPONSE,
                "sources":              [],
                "confidence":           confidence,
                "confident":            False,
                "collections_searched": collections_searched,
                "chunks_used":          0,
                "chunks":               [],
            }

        # Use only the top TOP_K_FINAL chunks for the LLM context window
        top_chunks = chunks[:TOP_K_FINAL]

        # ── Step 3: Generate ──────────────────────────────────────────────
        # Include conversation history (last 6 turns) for in-chat memory
        prior = (history or [])[-6:]
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(prior)
        messages.append({"role": "user", "content": build_user_message(query, top_chunks)})

        logger.info(f"Generating answer from {len(top_chunks)} chunks "
                    f"(confidence={confidence:.3f})")
        answer_text = _clean_response(self.llm.generate(messages))

        # ── Step 4: Extract sources ───────────────────────────────────────
        sources = []
        for chunk in top_chunks:
            source = chunk.get("metadata", {}).get("source", "Unknown")
            if source not in sources:
                sources.append(source)

        return {
            "answer":               answer_text,
            "sources":              sources,
            "confidence":           confidence,
            "confident":            True,
            "collections_searched": collections_searched,
            "chunks_used":          len(top_chunks),
            "chunks":               top_chunks,
        }

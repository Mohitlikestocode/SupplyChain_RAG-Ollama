/* Cleo SCI — Live API client
   All calls go to the FastAPI backend at API_BASE.
   Responses are mapped to the shape the React components expect. */
(function () {
  const API_BASE = "http://localhost:8000";

  /* Map a raw chunk from the backend into the shape panel.jsx expects:
     { n, score, source, collection, text } */
  function mapChunk(c, index) {
    const meta = c.metadata || {};
    return {
      n:          index + 1,
      score:      c.rrf_score || c.dense_score || c.score || 0,
      source:     meta.source || "unknown",
      collection: c.collection || meta.collection || "unknown",
      text:       c.text || "",
    };
  }

  /* POST /api/query — returns answer shaped for app.jsx */
  async function queryAPI(question) {
    const res = await fetch(API_BASE + "/api/query", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ query: question }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Query failed (" + res.status + ")");
    }
    const d = await res.json();
    const mappedChunks = (d.chunks || []).map(mapChunk);
    return {
      text:             d.answer,
      confidence:       d.confidence,
      noMatch:          !d.confident,
      sources:          d.sources || [],
      collections:      d.collections_searched || [],
      chunksUsed:       d.chunks_used || 0,
      chunksRetrieved:  mappedChunks.length * 2, // estimate; actual not exposed yet
      chunks:           mappedChunks,
      time:             null, // set by caller after measuring elapsed
    };
  }

  /* POST /api/ingest — multipart file upload */
  async function ingestFile(file, collectionId) {
    const form = new FormData();
    form.append("file",            file);
    form.append("collection_name", collectionId);
    const res = await fetch(API_BASE + "/api/ingest", {
      method: "POST",
      body:   form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Ingest failed (" + res.status + ")");
    }
    return await res.json(); // { status, chunks_stored, ... }
  }

  /* GET /api/stats — { collections: { id: count }, total_chunks } */
  async function getStats() {
    const res = await fetch(API_BASE + "/api/stats");
    if (!res.ok) throw new Error("Stats unavailable");
    return await res.json();
  }

  /* GET /api/health — { model_available, model_name, ... } */
  async function getHealth() {
    const res = await fetch(API_BASE + "/api/health");
    if (!res.ok) return { model_available: false };
    return await res.json();
  }

  window.CleoAPI = { queryAPI, ingestFile, getStats, getHealth };
})();

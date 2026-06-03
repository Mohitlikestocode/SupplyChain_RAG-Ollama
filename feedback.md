- There must be coherent memory in the same chat. 
- There must be a proper understanding of EDI lifecyle while answering the questions. So I should be able to backtrack the life cycle at any stage. For example, if an EDI lifecyle is giving involving 2 invoices and stuff...I should be able to backtrack to it's purchase order.
- Don't mention chunks in the answer, it's annoying. 
- I should be able to upload documents through the upload option, and it should be used as a reference. I should not have to open data on vs code and manually add raw data and stuff. 
- Make sure entier ui ux is functioning and working. The CHAT application, the new chat...and everything else shuld actually be working. Including recent and stuff. Nothing should be static and fake, it shuld be real.
- this rag applicaiton will be used for ONLY EDI stuff...so it should be specially trailed on EDI lifescyles, EDI stuff. We're not making a general RAG
- Don't mention "⚠ No relevant documents found in the knowledge base." Just mention I don't know or a formal llm kind of version of it. 
- It should be mobile friendly, so make sure it doesn't get fked up if I open on mobile.
- And other essential RAG stuff, should actually be working. This is a RAG which will actually be used by million people. So make sure it works properly

Implemented features (status updates):

- Coherent in-chat memory: messages are persisted per chat session (`/api/chats` endpoints, DB storage in `app/database/sqlite.py`).
- EDI lifecycle awareness: added `edi_parser.py` to extract ISA/GS/ST/BEG/BIG/N1/DTM/N9/IT1 segments during ingestion; identifiers stored in DB.
- Upload UI & ingestion: frontend upload (drag/drop and file input) wired to `/api/ingest` and ingestion pipeline (`app/ingestion/pipeline.py`).
- No inline source citations: system prompts updated to avoid inline citations; UI shows a separate "Show sources" action.
- Sources panel: right panel lists source documents and allows clicking to view document relations.
- Resizable sidebar: added drag handle to adjust sidebar width.
- EDI tagging: ingestion sets `metadata['edi'] = True` for EDI-like documents.
- Document/provenance DB: added `documents`, `doc_identifiers`, and `doc_relations` tables and helper functions to track documents and relations.
- Transaction tracing API and UI: `/api/transactions/{id_type}/{id_value}` implemented and a basic "Trace" box in Sources tab to show nodes and relations.

Next items (planned):

- Verify chat features end-to-end (new chat, recent, persistence) and fix any UX issues.
- Build a graphical lifecycle view (graph visualization) for transactions in the right panel.
- Add end-to-end tests and a sample EDI corpus for QA.
- Provide production hardening checklist and deployment manifests (k8s, Terraform, CI/CD guidance).

Notes:
- The current implementation stores relations and identifiers in SQLite for prototyping; for production we'll migrate to Postgres/Neo4j and a scalable vector store.
- Answers are intentionally kept source-free; users can open the Sources panel to inspect provenance and PDFs.

Lifecycle Graph UI (implemented - prototype):

- What it does:
	- Provides a visual trace of all documents and relations discovered for a given transaction identifier (PO, Invoice, ST control number).
	- Uses the ingestion-extracted identifiers (PO numbers, invoice numbers, ST control numbers) to find matching documents and the relation edges recorded during ingestion.
	- Renders an interactive graph (SVG) inside the Sources tab using Mermaid.js. Nodes represent documents (file names) and edges represent relationships (e.g., related_po, related_invoice).

- How it works (technical):
	1. During ingestion, `app/ingestion/edi_parser.py` extracts EDI segments (ISA/GS/ST/BEG/BIG/N1/DTM/N9/IT1) and the ingestion pipeline registers identifiers via `app/database/sqlite.py` helper functions: `add_document`, `add_doc_identifier`, and `add_doc_relation`.
	2. The API endpoint `/api/transactions/{id_type}/{id_value}` aggregates all document nodes matching the identifier and any relations referencing those documents; it returns a JSON object with `nodes` and `edges`.
	3. In the frontend, the Sources tab has a Trace box where you enter an identifier and press "Trace"; the app calls the API, receives `nodes` and `edges`, constructs a Mermaid graph definition, and renders it using `mermaid.mermaidAPI.render()` into the right-panel.

- Why this matters (real-world significance):
	- Visibility: For supply-chain/EDI use-cases, it's crucial to trace an invoice back to its originating PO or see which ASN corresponds to a shipment — the graph gives immediate provenance.
	- Auditability: Operations teams can visually inspect which documents were linked, speed up root-cause analysis, and validate partner exchanges quickly.
	- Automation: The relations recorded can be used to auto-detect missing downstream documents (e.g., PO present, but no ASN or no Invoice yet) and trigger alerts/workflow.

- Limitations of prototype and next steps:
	- The prototype stores relations in SQLite; for production we should move identifiers and relations to Postgres and/or a graph DB (Neo4j) for efficient graph traversals and queries at scale.
	- Mermaid is used for quick visualization; for very large graphs consider a dedicated graph UI (Cytoscape, D3 force layout, or Vis.js) with pan/zoom and node filtering.
	- Relation semantics are heuristic-based. We should extend the parser rules and add confidence/weights to edges for better accuracy.

	Latest UX and answer-quality improvements:

	- Source action layout fixed:
		- The previous "Show sources" control reused the small square icon button styling, which made the text wrap and look cramped in the metadata row.
		- It now uses a dedicated inline text-button style (`.source-btn`) that keeps the label on one line, matches the chat metadata visually, and stays readable beside confidence and collection labels.
		- Significance: small UI friction matters in production. If provenance controls look broken or cramped, users lose trust in the product even when retrieval is correct.

	- Cleo logo enlarged in top navigation:
		- The top nav logo was increased significantly for stronger brand presence on desktop.
		- Mobile-specific overrides were also added so the larger desktop logo does not break the layout on smaller screens.
		- Significance: stronger visual branding makes the application feel closer to a real enterprise product rather than a prototype, but responsive overrides are necessary so branding does not damage usability.

	- Assistant avatar replaced with robot image:
		- The plain "C" circle used for assistant responses and typing state has been replaced with the `assets/robo.png` image.
		- This applies both to completed assistant messages and to the typing indicator state.
		- Significance: a consistent assistant identity improves perceived polish and makes the conversational surface feel deliberate rather than placeholder-driven.

	- Low-confidence/fallback answers tightened:
		- The earlier fallback behavior could become overly verbose when a follow-up prompt like "say that in 2 sentences" was asked after a low-confidence retrieval. The model would sometimes rely on chat history loosely and produce an apology-heavy answer.
		- The generation logic now explicitly instructs the model to answer from conversation history only when that history directly supports the answer. Otherwise it must respond in at most two sentences, clearly stating that there is not enough verified information and what document or identifier would help.
		- The default no-context response was also rewritten into a concise two-sentence enterprise-style fallback.
		- Significance: this makes the assistant feel more reliable. In real enterprise RAG, a short and honest abstention is better than a long speculative answer because it protects trust, reduces hallucination risk, and keeps workflows efficient.

	- Prompt consistency fixed:
		- Earlier prompt instructions still contained one outdated rule telling the model to cite sources inline, which conflicted with the newer source-separation design.
		- That contradiction was removed so the model instructions now align with the product behavior: answer body stays clean, provenance is inspected separately in the UI.
		- Significance: prompt consistency is critical. Contradictory instructions are a common cause of unstable output in LLM systems and must be removed to get predictable behavior.

	- Format-only follow-up prompts now use conversation memory instead of retrieval:
		- Problem: prompts like "answer in 1 line" or "say that in 2 sentences" were previously treated like brand-new retrieval queries. Because those prompts contain almost no domain content, retrieval confidence dropped and the assistant could fall back to an unhelpful low-confidence answer.
		- Fix: the generator now detects rewrite/formatting-style follow-ups and rewrites the most recent assistant answer directly from chat history.
		- How it works:
		  1. The generator checks whether the user query looks like a rewrite instruction (`answer in 1 line`, `shorter`, `rewrite`, `2 sentences`, etc.).
		  2. If it does, it finds the last assistant message in the current conversation.
		  3. It asks the model to rewrite that exact answer only, preserving meaning, adding no new facts, and keeping provenance outside the answer body.
		- Significance: this is an important real-world agentic pattern. Not every follow-up should trigger retrieval. Some turns are transformations of already-grounded content, and handling them as memory-driven rewrites makes the system feel much more intelligent and dependable.

	- Context-dependent follow-up questions now enrich retrieval with prior chat state:
		- Problem: many real follow-up questions are neither full rewrites nor fully standalone. Examples include prompts like "How come?", "Why?", "What about that rejection?", or "And what should I do next?". These questions depend on the earlier question and answer, but the raw text itself does not contain enough retrieval signal.
		- Fix: the generator now distinguishes between:
		  1. standalone questions that should retrieve on their own text only, and
		  2. contextual follow-ups that should retrieve using the previous user question and the previous assistant answer as supporting context.
		- How it works:
		  1. A lightweight heuristic checks for context-dependent phrasing like `how come`, `what about`, `that`, `it`, `same`, `then`, `also`, and similar references.
		  2. If the new query appears context-dependent, retrieval is run on an enriched query that includes:
		     - the current follow-up,
		     - the previous user question,
		     - and the previous assistant answer.
		  3. If the new query appears standalone (for example, `What is AS2?`), retrieval uses only the current question so unrelated topics are not polluted by earlier conversation.
		- Significance: this is a core production RAG behavior. In real enterprise usage, users naturally ask compressed follow-ups. If the system cannot decide when to carry context forward and when to treat a turn as new, it feels brittle. This change makes the chatbot behave more like a real analyst who remembers the thread but can also pivot cleanly to a new topic.
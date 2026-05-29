/* Main App — real FastAPI integration
   Keeps all design layout/animation exactly as designed.
   Replaces mock data.answerFor() with CleoAPI.queryAPI(). */
const { useState: useS, useRef: useR, useEffect: useE } = React;

let MID = 0;
const nextId = () => "m" + (++MID);

function Toast({ toast, onClose }) {
  const Ic = window.Icons;
  if (!toast) return null;
  return (
    <div className="toast">
      <span className="toast-check"><Ic.Check size={16} /></span>
      <div className="toast-body">
        Ingested <b>"{toast.file}"</b> → {toast.collection} · {toast.chunks} chunks added
      </div>
      <button className="toast-x" onClick={onClose} aria-label="Dismiss"><Ic.X size={14} /></button>
    </div>
  );
}

function App() {
  const staticData = window.CleoData;

  // collections holds live chunk counts (refreshed from /api/stats)
  const [collections, setCollections] = useS(staticData.COLLECTIONS);
  const [messages,    setMessages]    = useS([]);
  const [typing,      setTyping]      = useS(false);
  const [streamId,    setStreamId]    = useS(null);
  const [input,       setInput]       = useS("");
  const [ctx,         setCtx]         = useS(null);
  const [collapsed,   setCollapsed]   = useS(false);
  const [drawer,      setDrawer]      = useS(false);
  const [toast,       setToast]       = useS(null);
  const [ingesting,   setIngesting]   = useS(false);
  const [online,      setOnline]      = useS(false);
  const [pendingCol,  setPendingCol]  = useS("edi_standards");

  const timers     = useR([]);
  const toastTimer = useR(null);
  const fileInput  = useR(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // ── Merge live stats into the collections array ───────────────────────────
  const refreshStats = () => {
    CleoAPI.getStats()
      .then((stats) => {
        setCollections((prev) =>
          prev.map((c) => ({ ...c, chunks: stats.collections[c.id] || 0 }))
        );
      })
      .catch(() => {}); // silently ignore if API is not up yet
  };

  // ── Bootstrap: load health + stats once on mount, then poll health ────────
  useE(() => {
    CleoAPI.getHealth().then((h) => setOnline(h.model_available)).catch(() => {});
    refreshStats();

    const healthInterval = setInterval(() => {
      CleoAPI.getHealth().then((h) => setOnline(h.model_available)).catch(() => {});
    }, 30000);

    return () => clearInterval(healthInterval);
  }, []);

  // ── Send a query ──────────────────────────────────────────────────────────
  const ask = async (text) => {
    if (!text.trim() || typing) return;
    setDrawer(false);

    setMessages((m) => [...m, { id: nextId(), role: "user", text: text.trim() }]);
    setInput("");
    setTyping(true);

    const t0 = Date.now();

    try {
      const ans = await CleoAPI.queryAPI(text);
      ans.time  = ((Date.now() - t0) / 1000).toFixed(1) + "s";

      setTyping(false);
      setCtx({
        chunks:          ans.chunks,
        collections:     ans.collections,
        sources:         ans.sources,
        chunksUsed:      ans.chunksUsed,
        chunksRetrieved: ans.chunksRetrieved,
        time:            ans.time,
        queryLen:        text.trim().length,
      });

      const id   = nextId();
      const full = ans.text;
      setMessages((m) => [...m, {
        id, role: "assistant", text: "",
        confidence: ans.confidence, noMatch: ans.noMatch,
        sources: ans.sources, collections: ans.collections, chunksUsed: ans.chunksUsed,
      }]);
      setStreamId(id);

      // Simulate token-by-token streaming for smooth UX
      const tokens = full.match(/\S+\s*|\s+/g) || [full];
      let i = 0;
      const step = () => {
        i++;
        const partial = tokens.slice(0, i).join("");
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: partial } : x)));
        if (i < tokens.length) {
          const t = setTimeout(step, 8 + Math.random() * 16);
          timers.current.push(t);
        } else {
          setStreamId(null);
        }
      };
      const t1 = setTimeout(step, 60);
      timers.current.push(t1);

    } catch (err) {
      setTyping(false);
      setMessages((m) => [...m, {
        id: nextId(), role: "assistant",
        text: "Failed to reach the knowledge base. Make sure the API server is running:\n\n`uvicorn app.api:app --port 8000`",
        confidence: 0, noMatch: true, sources: [], collections: [], chunksUsed: 0,
      }]);
    }
  };

  // ── New conversation ──────────────────────────────────────────────────────
  const newChat = () => {
    clearTimers();
    setMessages([]); setTyping(false); setStreamId(null); setCtx(null); setInput("");
  };

  // ── Ingest a file ─────────────────────────────────────────────────────────
  // Called from Sidebar with (colObject, file|null).
  // If file is null → trigger the hidden file input.
  const ingest = async (col, file) => {
    if (ingesting) return;
    if (!file) {
      // Sidebar clicked the dropzone without a dragged file → open file picker
      setPendingCol(col.id);
      if (fileInput.current) fileInput.current.click();
      return;
    }

    setIngesting(true);
    try {
      const result = await CleoAPI.ingestFile(file, col.id);
      setIngesting(false);
      const chunks = result.chunks_stored || 0;
      setToast({ file: file.name, collection: col.id, chunks });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4200);
      refreshStats(); // update sidebar chunk counts
    } catch (err) {
      setIngesting(false);
      setToast({ file: file.name, collection: col.id, chunks: "error: " + err.message });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  };

  // Hidden file input change → kick off real ingest
  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const col = collections.find((c) => c.id === pendingCol) || collections[0];
    ingest(col, file);
    e.target.value = ""; // reset so same file can be re-selected
  };

  // Live data object passed to components (merges static + live)
  const liveData = { ...staticData, COLLECTIONS: collections };

  return (
    <div className="app">
      {ingesting && <div className="ingest-bar"><span className="ingest-fill" /></div>}

      <TopNav online={online} onMenu={() => setDrawer(true)} />

      {/* Hidden file input — triggered by Sidebar dropzone click */}
      <input
        ref={fileInput}
        type="file"
        style={{ display: "none" }}
        accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
        onChange={onFileSelected}
      />

      <div className="body">
        <div className={"drawer-scrim" + (drawer ? " show" : "")} onClick={() => setDrawer(false)} />
        <div className={"sidebar-host" + (drawer ? " open" : "")}>
          <Sidebar
            data={liveData}
            onNewChat={newChat}
            onUpload={ingest}
            onPickSuggestion={ask}
          />
        </div>

        <ChatArea
          data={liveData}
          messages={messages}
          typing={typing}
          streamId={streamId}
          input={input}
          setInput={setInput}
          onSend={() => ask(input)}
          onPick={ask}
        />

        <RightPanel
          ctx={ctx}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
        />
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

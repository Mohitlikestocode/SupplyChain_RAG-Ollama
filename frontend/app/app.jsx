/* Main App — persistent chat sessions via FastAPI */
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
        Ingested <b>"{toast.file}"</b> → {toast.collection} · {toast.chunks} passages added
      </div>
      <button className="toast-x" onClick={onClose} aria-label="Dismiss"><Ic.X size={14} /></button>
    </div>
  );
}

function App() {
  const staticData = window.CleoData;

  const [collections,    setCollections]    = useS(staticData.COLLECTIONS);
  const [chats,          setChats]          = useS([]);
  const [currentChatId,  setCurrentChatId]  = useS(null);
  const [messages,       setMessages]       = useS([]);
  const [typing,         setTyping]         = useS(false);
  const [streamId,       setStreamId]       = useS(null);
  const [input,          setInput]          = useS("");
  const [ctx,            setCtx]            = useS(null);
  const [collapsed,      setCollapsed]      = useS(false);
  const [rpTab,          setRpTab]          = useS(null);
  const [drawer,         setDrawer]         = useS(false);
  const [toast,          setToast]          = useS(null);
  const [ingesting,      setIngesting]      = useS(false);
  const [sidebarWidth,   setSidebarWidth]   = useS(240);
  const [online,         setOnline]         = useS(false);
  const [pendingCol,     setPendingCol]     = useS("edi_standards");

  const timers     = useR([]);
  const toastTimer = useR(null);
  const fileInput  = useR(null);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const refreshStats = () => {
    CleoAPI.getStats()
      .then((stats) => setCollections((prev) => prev.map((c) => ({ ...c, chunks: stats.collections[c.id] || 0 }))))
      .catch(() => {});
  };

  const refreshChats = () => {
    CleoAPI.listChats().then(setChats).catch(() => {});
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useE(() => {
    CleoAPI.getHealth().then((h) => setOnline(h.model_available)).catch(() => {});
    refreshStats();
    refreshChats();

    const healthInterval = setInterval(() => {
      CleoAPI.getHealth().then((h) => setOnline(h.model_available)).catch(() => {});
    }, 30000);

    return () => clearInterval(healthInterval);
  }, []);

  // ── Open an existing chat ─────────────────────────────────────────────────
  const openChat = async (chatId) => {
    clearTimers();
    setCurrentChatId(chatId);
    setMessages([]);
    setTyping(false);
    setStreamId(null);
    setCtx(null);
    setDrawer(false);
    try {
      const data = await CleoAPI.getChatMessages(chatId);
      const msgs = (data.messages || []).map((m) => ({
        id:          "m" + m.id,
        role:        m.role,
        text:        m.content,
        confidence:  m.confidence || 0,
        noMatch:     false,
        sources:     m.sources || [],
        collections: [],
        chunksUsed:  0,
      }));
      setMessages(msgs);
    } catch (e) {}
  };

  // ── New conversation ──────────────────────────────────────────────────────
  const newChat = async () => {
    clearTimers();
    try {
      const chat = await CleoAPI.createChat();
      setChats((prev) => [chat, ...prev]);
      setCurrentChatId(chat.id);
    } catch (e) {
      // Fall back to local-only reset if API is down
      setCurrentChatId(null);
    }
    setMessages([]); setTyping(false); setStreamId(null); setCtx(null); setInput("");
    setDrawer(false);
  };

  // ── Delete a chat ─────────────────────────────────────────────────────────
  const deleteChat = async (chatId) => {
    await CleoAPI.deleteChat(chatId).catch(() => {});
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
      setMessages([]);
      setCtx(null);
    }
  };

  // ── Send a message ────────────────────────────────────────────────────────
  const ask = async (text) => {
    if (!text.trim() || typing) return;
    setDrawer(false);

    // Create a chat session if none is active
    let chatId = currentChatId;
    if (!chatId) {
      try {
        const chat = await CleoAPI.createChat();
        chatId = chat.id;
        setCurrentChatId(chatId);
        setChats((prev) => [chat, ...prev]);
      } catch (e) {
        // continue without persistence
      }
    }

    setMessages((m) => [...m, { id: nextId(), role: "user", text: text.trim() }]);
    setInput("");
    setTyping(true);
    const t0 = Date.now();

    try {
      // Use chat endpoint (with memory) if we have a chatId, else fallback
      const ans = chatId
        ? await CleoAPI.sendChatMessage(chatId, text)
        : await CleoAPI.queryAPI(text);
      ans.time = ((Date.now() - t0) / 1000).toFixed(1) + "s";

      setTyping(false);
      setCtx({
        chunks: ans.chunks, collections: ans.collections, sources: ans.sources,
        chunksUsed: ans.chunksUsed, chunksRetrieved: ans.chunksRetrieved,
        time: ans.time, queryLen: text.trim().length,
      });

      const id   = nextId();
      const full = ans.text;
      setMessages((m) => [...m, {
        id, role: "assistant", text: "",
        confidence: ans.confidence, noMatch: ans.noMatch,
        sources: ans.sources, collections: ans.collections, chunksUsed: ans.chunksUsed,
      }]);
      setStreamId(id);

      const tokens = full.match(/\S+\s*|\s+/g) || [full];
      let i = 0;
      const step = () => {
        i++;
        setMessages((m) => m.map((x) => (x.id === id ? { ...x, text: tokens.slice(0, i).join("") } : x)));
        if (i < tokens.length) {
          timers.current.push(setTimeout(step, 8 + Math.random() * 16));
        } else {
          setStreamId(null);
          // Refresh chat list so title updates
          if (chatId) refreshChats();
        }
      };
      timers.current.push(setTimeout(step, 60));

    } catch (err) {
      setTyping(false);
      setMessages((m) => [...m, {
        id: nextId(), role: "assistant",
        text: "Unable to reach the knowledge base. Make sure the API server is running.",
        confidence: 0, noMatch: true, sources: [], collections: [], chunksUsed: 0,
      }]);
    }
  };

  // ── Ingest a file ─────────────────────────────────────────────────────────
  const ingest = async (col, file) => {
    if (ingesting) return;
    if (!file) {
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
      refreshStats();
    } catch (err) {
      setIngesting(false);
      setToast({ file: file.name, collection: col.id, chunks: "error: " + err.message });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
  };

  const onFileSelected = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const col = collections.find((c) => c.id === pendingCol) || collections[0];
    ingest(col, file);
    e.target.value = "";
  };

  const liveData = { ...staticData, COLLECTIONS: collections };

  return (
    <div className="app">
      {ingesting && <div className="ingest-bar"><span className="ingest-fill" /></div>}

      <TopNav online={online} onMenu={() => setDrawer(true)} />

      <input
        ref={fileInput}
        type="file"
        style={{ display: "none" }}
        accept=".pdf,.docx,.txt,.md,.xlsx,.xls,.csv"
        onChange={onFileSelected}
      />

      <div className="body">
        <div className={"drawer-scrim" + (drawer ? " show" : "")} onClick={() => setDrawer(false)} />
        <div className={"sidebar-host" + (drawer ? " open" : "")} style={{ width: sidebarWidth }}>
          <Sidebar
            data={liveData}
            chats={chats}
            currentChatId={currentChatId}
            onNewChat={newChat}
            onOpenChat={openChat}
            onDeleteChat={deleteChat}
            onUpload={ingest}
          />
          <div
            className="sidebar-resize"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = sidebarWidth;
              function onMove(ev) {
                const nw = Math.max(180, Math.min(720, startW + (ev.clientX - startX)));
                setSidebarWidth(nw);
              }
              function onUp() { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); }
              document.addEventListener('mousemove', onMove);
              document.addEventListener('mouseup', onUp);
            }}
            title="Drag to resize sidebar"
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
          onShowSources={() => { setCollapsed(false); setRpTab('sources'); setTimeout(() => setRpTab(null), 800); }}
        />

        <RightPanel
          ctx={ctx}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          initTab={rpTab}
        />
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);

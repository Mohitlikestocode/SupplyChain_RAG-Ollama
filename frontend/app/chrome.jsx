/* TopNav + LeftSidebar — real file upload wired in */
const { useState } = React;

function TopNav({ online, onMenu }) {
  const Ic = window.Icons;
  return (
    <header className="topnav">
      <div className="topnav-left">
        <button className="icon-btn only-mobile" onClick={onMenu} aria-label="Menu">
          <Ic.Menu size={20} />
        </button>
        <img className="topnav-logo" src="assets/cleo-logo.png" alt="Cleo" />
        <span className="topnav-divider" />
        <span className="topnav-title">Supply Chain Intelligence</span>
        <span className="beta-pill">BETA</span>
      </div>
      <div className="topnav-right">
        <div className="model-status" title={online ? "Ollama online" : "Ollama offline — run `ollama serve`"}>
          <span className={"status-dot " + (online ? "on" : "off")} />
          <span className="model-name">phi3:mini</span>
        </div>
        <button className="icon-btn" aria-label="Settings"><Ic.Gear size={18} /></button>
        <img className="avatar-image" src="assets/robo.png" alt="Assistant" />
      </div>
    </header>
  );
}

function CollectionRow({ c, max }) {
  const empty = c.chunks === 0;
  const pct   = max ? Math.round((c.chunks / max) * 100) : 0;
  return (
    <div className={"kb-row" + (empty ? " empty" : "")}>
      <div className="kb-row-main">
        <span className="kb-swatch" style={{ background: empty ? "#CBD5E1" : c.color }} />
        <span className="kb-name">{c.name}</span>
        {empty ? (
          <span className="kb-empty-tag">Empty</span>
        ) : (
          <span className="kb-badge">{c.chunks}</span>
        )}
      </div>
      <div className="kb-bar">
        <span className="kb-bar-fill" style={{ width: pct + "%", background: empty ? "#E2E6EA" : c.color }} />
      </div>
    </div>
  );
}

function formatChatTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60)     return "Just now";
  if (diff < 3600)   return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)  return Math.floor(diff / 3600) + "h ago";
  if (diff < 172800) return "Yesterday";
  return d.toLocaleDateString();
}

function Sidebar({ data, chats, currentChatId, onNewChat, onOpenChat, onDeleteChat, onUpload }) {
  const Ic = window.Icons;
  const [uploadCol, setUploadCol] = useState("edi_standards");
  const [dragging,  setDragging]  = useState(false);
  const max = Math.max(...data.COLLECTIONS.map((c) => c.chunks), 1);

  const colObj = () => data.COLLECTIONS.find((c) => c.id === uploadCol) || data.COLLECTIONS[0];
  const handleClick = () => onUpload(colObj(), null);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(colObj(), file);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">
        <button className="new-chat-btn" onClick={onNewChat}>
          <Ic.Plus size={16} /> New Conversation
        </button>

        <section className="side-section">
          <div className="side-label">Recent Conversations</div>
          <div className="recent-list">
            {chats.length === 0 ? (
              <div className="recent-empty">No conversations yet</div>
            ) : chats.map((c) => (
              <div
                key={c.id}
                className={"recent-item" + (c.id === currentChatId ? " active" : "")}
              >
                <button
                  className="recent-item-btn"
                  onClick={() => onOpenChat(c.id)}
                >
                  <span className="recent-title">{c.title}</span>
                  <span className="recent-time">{formatChatTime(c.updated_at)}</span>
                </button>
                <button
                  className="recent-delete"
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(c.id); }}
                  aria-label="Delete chat"
                  title="Delete"
                >×</button>
              </div>
            ))}
          </div>
        </section>

        <section className="side-section">
          <div className="side-label">Knowledge Base</div>
          <div className="kb-list">
            {data.COLLECTIONS.map((c) => <CollectionRow key={c.id} c={c} max={max} />)}
          </div>
        </section>

        <section className="side-section">
          <div className="side-label">Add Knowledge</div>
          <div
            className={"dropzone" + (dragging ? " drag" : "")}
            onClick={handleClick}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <Ic.Upload size={20} />
            <span className="dz-main">Drop file or click to browse</span>
            <span className="dz-sub">PDF, DOCX, Excel, TXT</span>
          </div>
          <label className="col-select-wrap">
            <select className="col-select" value={uploadCol} onChange={(e) => setUploadCol(e.target.value)}>
              {data.COLLECTIONS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </section>
      </div>
    </aside>
  );
}

Object.assign(window, { TopNav, Sidebar });

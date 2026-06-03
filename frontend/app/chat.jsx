/* ChatArea: empty state, message bubbles, metadata, typing, input bar */
const { useRef, useEffect } = React;

function confColor(c) {
  if (c >= 0.7) return "#16A34A";
  if (c >= 0.5) return "#CA8A04";
  if (c >= 0.35) return "#D97706";
  return "#DC2626";
}

/* Markdown renderer: bold, italic, code, bullets, numbered lists, headers */
function renderRich(text) {
  const blocks = text.split("\n");
  const out = [];
  let list = null;
  let listType = null;

  const flush = () => {
    if (list) {
      out.push(React.createElement(listType, { key: "list" + out.length, className: "md-list" }, list));
      list = null; listType = null;
    }
  };

  blocks.forEach((line, i) => {
    const t = line.trim();
    if (!t) { flush(); return; }

    // Headers
    if (t.startsWith("### ")) { flush(); out.push(<h4 key={i} className="md-h4" dangerouslySetInnerHTML={{ __html: inline(t.slice(4)) }} />); return; }
    if (t.startsWith("## "))  { flush(); out.push(<h3 key={i} className="md-h3" dangerouslySetInnerHTML={{ __html: inline(t.slice(3)) }} />); return; }
    if (t.startsWith("# "))   { flush(); out.push(<h2 key={i} className="md-h2" dangerouslySetInnerHTML={{ __html: inline(t.slice(2)) }} />); return; }

    // Bullet lists (•, -, *)
    const bulletMatch = t.match(/^([•\-\*]) (.+)/);
    if (bulletMatch) {
      if (listType !== "ul") { flush(); listType = "ul"; }
      (list = list || []).push(<li key={i} dangerouslySetInnerHTML={{ __html: inline(bulletMatch[2]) }} />);
      return;
    }

    // Numbered lists
    const numMatch = t.match(/^(\d+)\. (.+)/);
    if (numMatch) {
      if (listType !== "ol") { flush(); listType = "ol"; }
      (list = list || []).push(<li key={i} dangerouslySetInnerHTML={{ __html: inline(numMatch[2]) }} />);
      return;
    }

    flush();
    out.push(<p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: inline(t) }} />);
  });
  flush();
  return out;
}

function inline(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,         "<em>$1</em>")
    .replace(/`(.+?)`/g,           '<code>$1</code>');
}

function UserMsg({ text }) {
  return <div className="msg-row user"><div className="bubble-user">{text}</div></div>;
}

function MetaRow({ m, onShowSources }) {
  const hasSources = m.sources && m.sources.length > 0;
  return (
    <div className="meta-row">
      <span className="meta-conf"><span className="meta-dot" style={{ background: confColor(m.confidence) }} />{Math.round(m.confidence * 100)}% confidence</span>
      {hasSources && (
        <>
          <span className="meta-sep">·</span>
          <button className="source-btn" onClick={() => onShowSources && onShowSources()} title="Check sources">Show sources</button>
        </>
      )}
      {m.collections && m.collections.length > 0 && (
        <>
          <span className="meta-sep">·</span>
          <span>{m.collections.join(", ")}</span>
        </>
      )}
    </div>
  );
}

function AssistantMsg({ m, streaming, onShowSources }) {
  return (
    <div className="msg-row assistant">
      <img className="assistant-avatar-image" src="assets/robo.png" alt="Assistant" />
      <div className="assistant-col">
        <div className={"bubble-assistant" + (m.noMatch ? " nomatch" : "")}>
          <div className="md">{renderRich(m.text)}{streaming && <span className="caret" />}</div>
        </div>
        {!streaming && m.confidence !== undefined && m.text && <MetaRow m={m} onShowSources={onShowSources} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="msg-row assistant">
      <img className="assistant-avatar-image" src="assets/robo.png" alt="Assistant" />
      <div className="bubble-assistant typing"><span className="dot" /><span className="dot" /><span className="dot" /></div>
    </div>
  );
}

function EmptyState({ data, onPick }) {
  return (
    <div className="empty-state">
      <img className="empty-logo" src="assets/cleo-logo.png" alt="" />
      <h1 className="empty-h1">Ask me anything about EDI &amp; Supply Chain</h1>
      <p className="empty-sub">Powered by your private knowledge base. Answers are grounded in your documents only.</p>
      <div className="suggest-grid">
        {data.SUGGESTIONS.map((s, i) => (
          <button key={i} className="suggest-card" onClick={() => onPick(s)}>{s}</button>
        ))}
      </div>
    </div>
  );
}

function InputBar({ value, onChange, onSend, disabled }) {
  const Ic = window.Icons;
  const taRef = useRef(null);
  useEffect(() => {
    const el = taRef.current; if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [value]);
  const key = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (value.trim() && !disabled) onSend(); }
  };
  const can = value.trim() && !disabled;
  return (
    <div className="input-wrap">
      <div className="input-bar">
        <button className="attach-btn" aria-label="Attach"><Ic.Paperclip size={18} /></button>
        <textarea
          ref={taRef} rows={1} className="input-ta"
          placeholder="Ask about EDI standards, supply chain, compliance..."
          value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={key}
        />
        <button className={"send-btn" + (can ? " active" : "")} disabled={!can} onClick={onSend} aria-label="Send">
          <Ic.Send size={17} />
        </button>
      </div>
      <div className="input-hint">Cleo SCI answers only from your ingested documents. Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline.</div>
    </div>
  );
}

function ChatArea({ data, messages, typing, streamId, input, setInput, onSend, onPick, onShowSources }) {
  const scroller = useRef(null);
  useEffect(() => {
    const el = scroller.current; if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  const empty = messages.length === 0 && !typing;
  return (
    <main className="chat-area">
      <div className="chat-scroll" ref={scroller}>
        {empty ? (
          <EmptyState data={data} onPick={onPick} />
        ) : (
          <div className="msg-stream">
            {messages.map((m) =>
              m.role === "user"
                ? <UserMsg key={m.id} text={m.text} />
                : <AssistantMsg key={m.id} m={m} streaming={m.id === streamId} onShowSources={onShowSources} />
            )}
            {typing && <TypingDots />}
          </div>
        )}
      </div>
      <InputBar value={input} onChange={setInput} onSend={onSend} disabled={typing} />
    </main>
  );
}

Object.assign(window, { ChatArea, confColor });

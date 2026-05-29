/* ChatArea: empty state, message bubbles, metadata, typing, input bar */
const { useRef, useEffect } = React;

function confColor(c) {
  if (c >= 0.7) return "#16A34A";
  if (c >= 0.5) return "#CA8A04";
  if (c >= 0.35) return "#D97706";
  return "#DC2626";
}

/* Light markdown: **bold** + bullet lines + paragraphs */
function renderRich(text) {
  const blocks = text.split("\n");
  const out = [];
  let list = null;
  const flush = () => { if (list) { out.push(React.createElement("ul", { key: "ul" + out.length, className: "md-list" }, list)); list = null; } };
  blocks.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("•")) {
      (list = list || []).push(<li key={i} dangerouslySetInnerHTML={{ __html: inline(t.slice(1).trim()) }} />);
    } else if (t === "") {
      flush();
    } else {
      flush();
      out.push(<p key={i} className="md-p" dangerouslySetInnerHTML={{ __html: inline(t) }} />);
    }
  });
  flush();
  return out;
}
function inline(s) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function UserMsg({ text }) {
  return <div className="msg-row user"><div className="bubble-user">{text}</div></div>;
}

function MetaRow({ m }) {
  return (
    <div className="meta-row">
      <span className="meta-conf"><span className="meta-dot" style={{ background: confColor(m.confidence) }} />{Math.round(m.confidence * 100)}% confidence</span>
      <span className="meta-sep">·</span>
      <span>Sources: <b>{m.sources.join(", ")}</b></span>
      <span className="meta-sep">·</span>
      <span>Collections: {m.collections.join(", ")}</span>
      <span className="meta-sep">·</span>
      <span>{m.chunksUsed} chunks</span>
    </div>
  );
}

function AssistantMsg({ m, streaming }) {
  return (
    <div className="msg-row assistant">
      <div className="assistant-avatar">C</div>
      <div className="assistant-col">
        <div className={"bubble-assistant" + (m.noMatch ? " nomatch" : "")}>
          {m.noMatch && (
            <div className="nomatch-banner">⚠ No relevant documents found in the knowledge base.</div>
          )}
          <div className="md">{renderRich(m.text)}{streaming && <span className="caret" />}</div>
        </div>
        {!streaming && m.confidence !== undefined && m.text && <MetaRow m={m} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="msg-row assistant">
      <div className="assistant-avatar">C</div>
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

function ChatArea({ data, messages, typing, streamId, input, setInput, onSend, onPick }) {
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
                : <AssistantMsg key={m.id} m={m} streaming={m.id === streamId} />
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

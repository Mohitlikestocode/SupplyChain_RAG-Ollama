/* RightPanel — Retrieved Context (Chunks / Sources / Metadata) */
const { useState: useStateP } = React;

function scoreColor(s) {
  if (s >= 0.7) return "#16A34A";
  if (s >= 0.5) return "#CA8A04";
  return "#D97706";
}

function ChunkCard({ c, openDefault }) {
  const [open, setOpen] = useStateP(openDefault);
  const col = window.CleoData.COLLECTIONS.find((x) => x.id === c.collection);
  return (
    <div className="chunk-card">
      <div className="chunk-head">
        <span className="chunk-n">Chunk {c.n}</span>
        <span className="score-pill" style={{ background: scoreColor(c.score) + "1a", color: scoreColor(c.score) }}>Score: {c.score.toFixed(3)}</span>
      </div>
      <div className="chunk-source">{c.source}</div>
      <span className="col-pill" style={{ background: (col?.color || "#6B7280") + "14", color: col?.color || "#6B7280" }}>
        <span className="col-pill-dot" style={{ background: col?.color || "#6B7280" }} />{c.collection}
      </span>
      <div className="chunk-divider" />
      <p className={"chunk-text" + (open ? " open" : "")}>{c.text}</p>
      <button className="chunk-toggle" onClick={() => setOpen(!open)}>{open ? "Show less" : "Show more"}</button>
    </div>
  );
}

function SourcesTab({ ctx }) {
  const Ic = window.Icons;
  const map = {};
  ctx.chunks.forEach((c) => { map[c.source] = map[c.source] || { source: c.source, collection: c.collection, n: 0 }; map[c.source].n++; });
  const rows = Object.values(map);
  return (
    <div className="src-list">
      {rows.map((r, i) => {
        const col = window.CleoData.COLLECTIONS.find((x) => x.id === r.collection);
        return (
          <div className="src-row" key={i}>
            <span className="src-icon" style={{ color: col?.color || "#6B7280" }}><Ic.Doc size={18} /></span>
            <div className="src-meta">
              <div className="src-name">{r.source}</div>
              <span className="col-pill sm" style={{ background: (col?.color || "#6B7280") + "14", color: col?.color || "#6B7280" }}>{r.collection}</span>
            </div>
            <span className="src-count">{r.n} chunk{r.n > 1 ? "s" : ""} used</span>
          </div>
        );
      })}
    </div>
  );
}

function MetaTab({ ctx }) {
  const rows = [
    ["Query length", ctx.queryLen + " chars"],
    ["Collections searched", ctx.collections.length || "—"],
    ["Chunks retrieved", ctx.chunksRetrieved],
    ["Chunks used", ctx.chunksUsed],
    ["Max confidence", ctx.chunks.length ? ctx.chunks[0].score.toFixed(3) : "—"],
    ["Response time", ctx.time || "—"],
  ];
  return (
    <table className="meta-table">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}><td className="mt-k">{r[0]}</td><td className="mt-v">{r[1]}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function RightPanel({ ctx, collapsed, onToggle }) {
  const Ic = window.Icons;
  const [tab, setTab] = useStateP("chunks");

  if (collapsed) {
    return (
      <aside className="rightpanel collapsed">
        <button className="rp-expand" onClick={onToggle} aria-label="Expand panel"><Ic.Chevron size={16} style={{ transform: "rotate(180deg)" }} /></button>
        <div className="rp-strip-icon" title="Retrieved context"><Ic.Layers size={18} /></div>
        <div className="rp-strip-icon" title="Sources"><Ic.Doc size={18} /></div>
        <div className="rp-strip-icon" title="Metadata"><Ic.Database size={18} /></div>
      </aside>
    );
  }

  return (
    <aside className="rightpanel">
      <div className="rp-header">
        <div className="rp-title">Retrieved Context
          <span className="rp-info" title="Shows the document chunks the assistant retrieved and used to ground its last answer."><Ic.Info size={14} /></span>
        </div>
        <button className="icon-btn small" onClick={onToggle} aria-label="Collapse"><Ic.Chevron size={16} /></button>
      </div>

      <div className="rp-tabs">
        {["chunks", "sources", "metadata"].map((t) => (
          <button key={t} className={"rp-tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="rp-body">
        {!ctx ? (
          <div className="rp-empty">
            <div className="rp-empty-art"><Ic.Search size={26} /></div>
            <p>Ask a question to see retrieved context here.</p>
          </div>
        ) : tab === "chunks" ? (
          ctx.chunks.length === 0
            ? <div className="rp-empty"><div className="rp-empty-art"><Ic.Layers size={26} /></div><p>No chunks were retrieved for the last query.</p></div>
            : <div className="chunk-list">{ctx.chunks.map((c, i) => <ChunkCard key={c.n} c={c} openDefault={i === 0} />)}</div>
        ) : tab === "sources" ? (
          ctx.chunks.length === 0 ? <div className="rp-empty"><p>No sources.</p></div> : <SourcesTab ctx={ctx} />
        ) : (
          <MetaTab ctx={ctx} />
        )}
      </div>
    </aside>
  );
}

Object.assign(window, { RightPanel });

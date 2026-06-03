/* RightPanel — Retrieved Context (Passages / Sources / Metadata) */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

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
        <span className="chunk-n">Passage {c.n}</span>
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
  const [selected, setSelected] = useStateP(null);
  const [relations, setRelations] = useStateP([]);
  const [traceVal, setTraceVal] = useStateP("");
  const [traceType, setTraceType] = useStateP("po");
  const [traceResult, setTraceResult] = useStateP(null);

  const loadRelations = async (source) => {
    try {
      const r = await fetch('/api/documents/by_source?source=' + encodeURIComponent(source));
      if (!r.ok) throw new Error('not found');
      const doc = await r.json();
      const rr = await fetch('/api/documents/' + doc.id + '/relations');
      const jr = await rr.json();
      setSelected(doc);
      setRelations(jr.relations || []);
    } catch (e) {
      setSelected(null);
      setRelations([]);
    }
  };

  const runTrace = async () => {
    if (!traceVal) return;
    try {
      const r = await fetch(`/api/transactions/${encodeURIComponent(traceType)}/${encodeURIComponent(traceVal)}`);
      if (!r.ok) throw new Error('not found');
      const j = await r.json();
      setTraceResult(j);
    } catch (e) {
      setTraceResult(null);
    }
  };
  const graphRef = useRefP(null);

  const sanitizeId = (s) => {
    if (!s) return 'N_unknown';
    return 'N' + String(s).replace(/[^a-zA-Z0-9]/g, '_');
  };

  const esc = (s) => String(s).replace(/"/g, '\\"');

  useEffectP(() => {
    if (!traceResult) {
      if (graphRef.current) graphRef.current.innerHTML = '';
      return;
    }
    const nodes = traceResult.nodes || [];
    const edges = traceResult.edges || [];
    let md = 'graph LR\n';
    nodes.forEach((n) => {
      md += `${sanitizeId(n.id)}["${esc(n.source)}"]\n`;
    });
    edges.forEach((e) => {
      md += `${sanitizeId(e.from_doc)} --|${esc(e.relation)}|--> ${sanitizeId(e.to_doc)}\n`;
    });
    try {
      if (window.mermaid && window.mermaid.mermaidAPI) {
        window.mermaid.mermaidAPI.render('mermaidGraph', md, (svgCode) => {
          if (graphRef.current) graphRef.current.innerHTML = svgCode;
        });
      } else if (graphRef.current) {
        graphRef.current.innerText = 'Mermaid not available';
      }
    } catch (err) {
      if (graphRef.current) graphRef.current.innerText = 'Graph render failed';
    }
  }, [traceResult]);
  return (
    <>
      <div className="src-list">
        <div style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={traceType} onChange={(e) => setTraceType(e.target.value)} style={{ height:28 }}>
            <option value="po">PO</option>
            <option value="invoice">Invoice</option>
            <option value="st">ST</option>
          </select>
          <input value={traceVal} onChange={(e) => setTraceVal(e.target.value)} placeholder="Enter identifier" style={{ flex:1, height:28, padding:'0 8px' }} />
          <button className="icon-btn" onClick={runTrace}>Trace</button>
        </div>
        {rows.map((r, i) => {
          const col = window.CleoData.COLLECTIONS.find((x) => x.id === r.collection);
          return (
            <div className="src-row" key={i} onClick={() => loadRelations(r.source)} style={{ cursor: 'pointer' }}>
              <span className="src-icon" style={{ color: col?.color || "#6B7280" }}><Ic.Doc size={18} /></span>
              <div className="src-meta">
                <div className="src-name">{r.source}</div>
                <span className="col-pill sm" style={{ background: (col?.color || "#6B7280") + "14", color: col?.color || "#6B7280" }}>{r.collection}</span>
              </div>
              <span className="src-count">{r.n} passage{r.n > 1 ? "s" : ""} used</span>
            </div>
          );
        })}
      </div>
      {traceResult && (
        <div style={{ marginTop: 12, padding: 10, borderTop: '1px solid #eef1f4' }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Trace Results</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>{(traceResult.nodes || []).length} document(s) found</div>
          <ul style={{ marginTop: 8 }}>
            {(traceResult.nodes || []).map((n) => (
              <li key={n.id} style={{ fontSize: 13 }}>{n.source} — {n.collection}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 13, fontWeight:600 }}>Relations</div>
          <ul style={{ marginTop: 6 }}>
            {(traceResult.edges || []).map((e, i) => (
              <li key={i} style={{ fontSize: 13 }}>{e.from_doc} → {e.to_doc} ({e.relation})</li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight:600 }}>Graph</div>
            <div ref={graphRef} id="mermaid-container" style={{ marginTop: 8, minHeight: 120 }} />
          </div>
        </div>
      )}
    </>
  );
}

function MetaTab({ ctx }) {
  const rows = [
    ["Query length", ctx.queryLen + " chars"],
    ["Collections searched", ctx.collections.length || "—"],
    ["Passages retrieved", ctx.chunksRetrieved],
    ["Passages used", ctx.chunksUsed],
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

function RightPanel({ ctx, collapsed, onToggle, initTab }) {
  const Ic = window.Icons;
  const [tab, setTab] = useStateP("context");

  useEffectP(() => {
    if (initTab) setTab(initTab);
  }, [initTab]);

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
          <span className="rp-info" title="Shows the document excerpts the assistant retrieved and used to ground its last answer."><Ic.Info size={14} /></span>
        </div>
        <button className="icon-btn small" onClick={onToggle} aria-label="Collapse"><Ic.Chevron size={16} /></button>
      </div>

      <div className="rp-tabs">
        {["context", "sources", "metadata"].map((t) => (
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
        ) : tab === "context" ? (
          ctx.chunks.length === 0
            ? <div className="rp-empty"><div className="rp-empty-art"><Ic.Layers size={26} /></div><p>No relevant source excerpts were retrieved for the last query.</p></div>
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

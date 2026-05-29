/* Cleo Supply Chain Intelligence — static data layer
   Collection IDs must exactly match the backend COLLECTIONS in app/config.py.
   Chunk counts start at 0 — app.jsx refreshes them from GET /api/stats on mount. */
(function () {
  const COLLECTIONS = [
    { id: "edi_standards",         name: "EDI Standards",       color: "#0077C8", chunks: 0 },
    { id: "supply_chain_concepts", name: "Supply Chain",        color: "#0D9488", chunks: 0 },
    { id: "compliance_regulations",name: "Compliance",          color: "#7C3AED", chunks: 0 },
    { id: "logistics_shipping",    name: "Logistics",           color: "#16A34A", chunks: 0 },
    { id: "integration_onboarding",name: "Integration",         color: "#4F46E5", chunks: 0 },
    { id: "cleo_company",          name: "Cleo Company",        color: "#005FA3", chunks: 0 },
    { id: "troubleshooting",       name: "Troubleshooting",     color: "#D97706", chunks: 0 },
    { id: "uploaded_documents",    name: "Uploads",             color: "#6B7280", chunks: 0 },
  ];

  const RECENT = [
    { id: "c1", title: "What does AK5*R mean in a 997 acknowledgment?", time: "2m ago", active: true },
    { id: "c2", title: "856 ASN hierarchical loop structure explained",  time: "1h ago" },
    { id: "c3", title: "AS2 vs SFTP — which transport for retail EDI?",  time: "Yesterday" },
    { id: "c4", title: "GS segment functional group control numbers",     time: "Yesterday" },
    { id: "c5", title: "How to map an 850 PO into an inbound order",     time: "2 days ago" },
    { id: "c6", title: "Walmart compliance: 810 invoice requirements",    time: "3 days ago" },
  ];

  const SUGGESTIONS = [
    "What does AK5*R mean in a 997 acknowledgment?",
    "How does the 856 ASN hierarchical loop work?",
    "What is the difference between AS2 and SFTP for EDI?",
  ];

  window.CleoData = { COLLECTIONS, RECENT, SUGGESTIONS };
})();

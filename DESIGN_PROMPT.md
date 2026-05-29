# CSCI Chat UI — Design Prompt for Claude

> Paste everything below the horizontal rule into Claude's design tool.

---

## CONTEXT

Design a production-grade chat interface called **"Cleo Supply Chain Intelligence"** — an AI assistant for EDI standards, supply chain operations, and logistics. This tool lives inside the Cleo ecosystem, so it must look and feel like a natural extension of the Cleo IntegrationCloud platform.

---

## BRAND & VISUAL IDENTITY

**Primary brand color:** Cleo Blue — `#0077C8` (the exact blue from the Cleo logo)
**Secondary blue (hover/active):** `#005FA3`
**Dark nav/header:** `#111827` (near-black charcoal, matching Cleo's top navigation bar)
**Background:** `#F4F6F9` (the light cool-gray used across Cleo's content areas)
**Card surface:** `#FFFFFF`
**Border:** `#E2E6EA`
**Text primary:** `#1A1D23`
**Text secondary:** `#6B7280`
**Success green:** `#16A34A`
**Warning amber:** `#D97706`
**Error red:** `#DC2626`

**Typography:** Inter (or system-ui fallback). Nav = 14px medium. Body = 14px regular. Labels = 12px medium uppercase tracking-wide. Code/EDI segments = `font-mono` 13px.

**Radius:** Cards and inputs use `8px`. Buttons use `6px`. Badges/pills use `999px` (fully rounded).

**Shadows:** Cards use `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` — subtle, enterprise-grade, not floaty.

---

## LAYOUT STRUCTURE

Three-column layout at 1280px+. On mobile, sidebar collapses.

```
┌─────────────────────────────────────────────────────────────────┐
│  TOP NAV BAR  (dark #111827, 56px tall)                         │
├──────────────┬──────────────────────────────┬───────────────────┤
│              │                              │                   │
│  LEFT        │   CHAT AREA                  │  RIGHT PANEL      │
│  SIDEBAR     │   (center, main)             │  (context/debug)  │
│  240px       │   flex-1                     │  320px            │
│              │                              │                   │
│              │                              │                   │
└──────────────┴──────────────────────────────┴───────────────────┘
```

Right panel is collapsible — a `>` icon collapses it to an icon strip.

---

## TOP NAVIGATION BAR

Dark background `#111827`. Height 56px. Full width.

**Left side:**
- Cleo logo mark (the blue "Cleo" wordmark, white version) — 32px tall
- A thin vertical divider `|` in gray
- Text: **"Supply Chain Intelligence"** in white, 15px medium weight
- A small beta pill badge: `BETA` in `#0077C8` fill, white text, 10px, fully rounded

**Right side (icon buttons, white icons):**
- Settings gear icon
- A user avatar circle (initials "MK" in Cleo blue on dark background)
- Model status indicator: a small dot (green `#16A34A` if Ollama online, red `#DC2626` if offline) + text "phi3:mini" in gray 12px

---

## LEFT SIDEBAR

Background `#FFFFFF`. Border-right `1px solid #E2E6EA`. Width 240px.

### Section 1 — New Chat
A full-width button: `+ New Conversation`
Style: outlined, Cleo blue border and text, `#0077C8`, 36px height, 6px radius. On hover fills to Cleo blue with white text.

### Section 2 — Knowledge Base
Label: `KNOWLEDGE BASE` in 11px uppercase tracking-widest, color `#9CA3AF`.

Show each collection as a row:
```
[icon]  EDI Standards          [badge: 13]
[icon]  Supply Chain           [badge: 5]
[icon]  Troubleshooting        [badge: 0 — grayed out]
```
Icons are small colored squares (8px) matching collection type:
- EDI Standards → Cleo blue
- Supply Chain → teal `#0D9488`
- Troubleshooting → amber `#D97706`
- Compliance → purple `#7C3AED`
- Logistics → green `#16A34A`
- Integration → indigo `#4F46E5`
- Cleo Company → Cleo blue (darker)
- Uploads → gray `#6B7280`

Badge shows chunk count. If 0, row is grayed and shows "Empty".

A small progress bar below each collection shows relative fullness vs largest collection.

### Section 3 — Upload Document
Label: `ADD KNOWLEDGE` in 11px uppercase.

A dashed-border drop zone, 80px tall, with:
- Upload icon (centered)
- "Drop file or click to browse" in 12px gray
- Sub-label: "PDF, DOCX, Excel, TXT"

Below the drop zone: a `Collection` dropdown (compact, 32px) to select target collection before uploading.

### Section 4 — Recent Conversations
Label: `RECENT` in 11px uppercase.
List of past chat sessions (conversation starters truncated to 1 line, timestamp below in gray 11px).
Active session highlighted with Cleo blue left border `3px` and `#EFF6FF` background.

---

## CHAT AREA (CENTER)

Background `#F4F6F9`.

### Empty state (no messages yet)
Centered vertically and horizontally:
- Cleo logo mark, 48px, slightly desaturated
- Heading: **"Ask me anything about EDI & Supply Chain"** — 22px semibold, dark
- Subheading: "Powered by your private knowledge base. Answers are grounded in your documents only." — 14px gray
- Three suggested question pills below, each a clickable card:
  - "What does AK5*R mean in a 997 acknowledgment?"
  - "How does the 856 ASN hierarchical loop work?"
  - "What is the difference between AS2 and SFTP for EDI?"
  Style: white card, 1px border, 8px radius, Cleo blue left accent border `3px`, hover lifts shadow slightly.

### Message bubbles

**User message:**
Right-aligned. Pill-shaped bubble, background `#0077C8`, white text, max-width 65%, 14px, `12px 16px` padding. No avatar.

**Assistant message:**
Left-aligned. White card, `1px solid #E2E6EA`, 8px radius, `16px 20px` padding, max-width 80%. Subtle left border `3px solid #0077C8`.

Small avatar circle left of assistant bubble: Cleo "C" mark in blue, 28px.

Below each assistant message, a compact metadata row in gray 12px:
```
🟢 78% confidence  ·  Sources: edi_standards_batch1.txt  ·  Collections: edi_standards, troubleshooting  ·  2 chunks
```
Confidence dot colors: green ≥70%, yellow 50-70%, orange 35-50%, red = no match.

**No-match response:**
Same white card BUT with a left border `3px solid #E2E6EA` (gray, not blue) and a soft amber info banner at the top of the card:
```
⚠  No relevant documents found in the knowledge base.
```

### Typing indicator
Three animated dots in Cleo blue, inside a small white card matching assistant bubble style. Shows while waiting for response.

### Input bar
Pinned to bottom of chat area. White bar with `1px solid #E2E6EA`, 8px radius, `12px` padding. Full width of chat column minus `32px` margins.

- Left: a small paperclip icon (attach document inline) in gray
- Center: text input placeholder "Ask about EDI standards, supply chain, compliance..."
- Right: Send button — Cleo blue filled circle, white arrow icon, 36px diameter. Disabled (gray) when input is empty. On hover, darkens to `#005FA3`.

Pressing Enter sends. Shift+Enter newline.

---

## RIGHT PANEL — Context & Debug

Header: **"Retrieved Context"** — 14px semibold + a small info icon with tooltip explaining what this panel shows.

A toggle at the top: `Chunks  |  Sources  |  Metadata` — tab-style.

### Chunks tab
Each retrieved chunk shown as a card:
```
┌──────────────────────────────────────────┐
│  Chunk 1                    Score: 0.782 │  ← score as a pill badge (green/yellow/orange)
│  edi_standards_batch1.txt                │  ← source in gray 12px
│  Collection: edi_standards               │  ← blue pill badge
│  ─────────────────────────────────────── │
│  "The X12 EDI 856 Ship Notice/Manifest,  │
│   commonly called the ASN, is transmitted│
│   by a supplier to a retail partner..."  │  ← truncated text, 3 lines, expand on click
└──────────────────────────────────────────┘
```
Cards stacked vertically with 8px gap. Chunk 1 always expanded, rest collapsed.

### Sources tab
Simple list — each source document as a row with:
- File icon (PDF/DOCX/TXT/XLS icon, color-coded)
- Filename
- Collection badge
- "N chunks used" in gray

### Metadata tab
Key-value pairs in a compact table:
```
Query length         42 chars
Collections searched  2
Chunks retrieved     8
Chunks used          4
Max confidence       0.782
Response time        —
```

**When no query has been run yet:** panel shows a placeholder illustration and text "Ask a question to see retrieved context here."

---

## INGESTION PROGRESS OVERLAY

When a file is being ingested (via drag-drop or paperclip), show a slim progress bar at the top of the page (like GitHub's blue bar) in Cleo blue. Below the input bar, show a dismissable toast:

```
✓  Ingested "EDI_Guide.pdf"  →  edi_standards  ·  13 chunks added
```
Toast: white card, green left border, slides up from bottom-right, auto-dismisses after 4 seconds.

---

## INTERACTION STATES

- **Hover on cards:** `box-shadow` lifts slightly, border color darkens to `#CBD5E1`
- **Active/selected items:** Cleo blue `3px` left border + `#EFF6FF` background tint
- **Loading state:** Skeleton shimmer animation on cards (light gray → lighter gray pulse)
- **Error state:** Red `#DC2626` left border + `#FEF2F2` background tint + error message
- **Focus rings:** `2px solid #0077C8` offset `2px` on all interactive elements

---

## RESPONSIVENESS

- **1280px+:** Three-column layout as described
- **1024px:** Right panel hidden by default (toggle button to show)
- **768px:** Left sidebar collapses to icon strip (40px wide); hamburger menu to expand
- **Mobile:** Single column; sidebar as bottom sheet; right panel not shown

---

## TECH STACK CONTEXT

The frontend will talk to a FastAPI backend at `http://localhost:8000`. The UI should be built in **Next.js 14 with Tailwind CSS**. Use `shadcn/ui` components as the base (they align well with this design system). The chat uses streaming responses via `fetch` with `ReadableStream` so messages stream token-by-token.

---

## WHAT TO DESIGN

Please produce:
1. The full application layout at 1280px (desktop) — all three columns visible
2. The chat area with: empty state, a user message, an assistant message with metadata row, and the typing indicator
3. The left sidebar with populated knowledge base stats
4. The right panel showing retrieved chunks for an answered question
5. The input bar with focus state
6. The ingestion toast notification
7. A mobile view at 375px showing the collapsed sidebar and chat

Match the Cleo IntegrationCloud visual language exactly: same dark nav, same blue, same card style, same enterprise-grade density and typography. A Cleo employee seeing this should feel it belongs in their product suite.

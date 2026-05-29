/* Shared inline SVG icons — stroke-based, 1.6 weight, currentColor */
(function () {
  const I = (paths, props = {}) =>
    function Icon(p) {
      const { size = 18, ...rest } = p || {};
      return React.createElement(
        "svg",
        {
          width: size, height: size, viewBox: "0 0 24 24", fill: "none",
          stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round",
          strokeLinejoin: "round", ...props, ...rest,
        },
        paths.map((d, i) =>
          typeof d === "string"
            ? React.createElement("path", { key: i, d })
            : React.createElement(d.tag, { key: i, ...d.attr })
        )
      );
    };

  const Icons = {
    Plus: I(["M12 5v14", "M5 12h14"]),
    Gear: I([
      "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z",
    ]),
    Upload: I(["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"]),
    Send: I([{ tag: "path", attr: { d: "M22 2 11 13" } }, { tag: "path", attr: { d: "M22 2 15 22l-4-9-9-4 20-7Z" } }]),
    Paperclip: I(["M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"]),
    Chevron: I(["M9 18l6-6-6-6"]),
    Info: I([{ tag: "circle", attr: { cx: 12, cy: 12, r: 9 } }, "M12 16v-4", "M12 8h.01"]),
    Search: I([{ tag: "circle", attr: { cx: 11, cy: 11, r: 7 } }, "M21 21l-4.3-4.3"]),
    File: I(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"]),
    Doc: I(["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M9 13h6", "M9 17h6"]),
    Menu: I(["M3 6h18", "M3 12h18", "M3 18h18"]),
    Check: I(["M20 6 9 17l-5-5"]),
    Sparkle: I(["M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"]),
    Database: I([{ tag: "ellipse", attr: { cx: 12, cy: 5, rx: 8, ry: 3 } }, "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5", "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"]),
    X: I(["M18 6 6 18", "M6 6l12 12"]),
    Layers: I(["M12 2 2 7l10 5 10-5-10-5Z", "M2 17l10 5 10-5", "M2 12l10 5 10-5"]),
  };

  window.Icons = Icons;
})();

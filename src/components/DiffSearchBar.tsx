import React, { useCallback, useEffect, useRef, useState } from "react";

const highlightsSupported =
  typeof CSS !== "undefined" &&
  "highlights" in CSS &&
  typeof Highlight !== "undefined";

const HIGHLIGHT_CSS = `
::highlight(diff-search) { background-color: rgba(255, 200, 0, 0.35); }
::highlight(diff-search-current) { background-color: rgba(255, 150, 0, 0.6); }
`;

/** Collect all text nodes, traversing into open shadow roots */
function collectTextNodes(root: Node): Text[] {
  const nodes: Text[] = [];
  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      nodes.push(node as Text);
      return;
    }
    if (node instanceof Element && node.shadowRoot) {
      walk(node.shadowRoot);
    }
    let child = node.firstChild;
    while (child) {
      walk(child);
      child = child.nextSibling;
    }
  }
  walk(root);
  return nodes;
}

/** Inject ::highlight() styles into open shadow roots so highlights render inside them */
const styledRoots = new WeakSet<ShadowRoot>();
function ensureShadowHighlightStyles(root: Node) {
  if (root instanceof Element && root.shadowRoot && !styledRoots.has(root.shadowRoot)) {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(HIGHLIGHT_CSS);
    root.shadowRoot.adoptedStyleSheets = [
      ...root.shadowRoot.adoptedStyleSheets,
      sheet,
    ];
    styledRoots.add(root.shadowRoot);
  }
  let child = root.firstChild;
  while (child) {
    if (child instanceof Element) ensureShadowHighlightStyles(child);
    child = child.nextSibling;
  }
}

interface DiffSearchBarProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export const DiffSearchBar: React.FC<DiffSearchBarProps> = ({
  scrollContainerRef,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const rangesRef = useRef<Range[]>([]);

  const clearHighlights = useCallback(() => {
    if (!highlightsSupported) return;
    CSS.highlights!.delete("diff-search");
    CSS.highlights!.delete("diff-search-current");
  }, []);

  const applyHighlights = useCallback(
    (ranges: Range[], index: number) => {
      if (!highlightsSupported || ranges.length === 0) return;
      CSS.highlights!.set("diff-search", new Highlight(...ranges));
      if (index >= 0 && index < ranges.length) {
        CSS.highlights!.set(
          "diff-search-current",
          new Highlight(ranges[index]),
        );
      }
    },
    [],
  );

  const findMatches = useCallback(
    (q: string): Range[] => {
      if (!q || !scrollContainerRef.current) return [];
      // Ensure shadow roots have highlight styles before searching
      ensureShadowHighlightStyles(scrollContainerRef.current);
      const textNodes = collectTextNodes(scrollContainerRef.current);
      const ranges: Range[] = [];
      const lowerQ = q.toLowerCase();
      for (const node of textNodes) {
        const text = node.textContent?.toLowerCase() ?? "";
        let pos = text.indexOf(lowerQ);
        while (pos !== -1) {
          const range = new Range();
          range.setStart(node, pos);
          range.setEnd(node, pos + q.length);
          ranges.push(range);
          pos = text.indexOf(lowerQ, pos + 1);
        }
      }
      return ranges;
    },
    [scrollContainerRef],
  );

  const scrollToRange = useCallback(
    (range: Range) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rangeRect = range.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      if (
        rangeRect.top < containerRect.top ||
        rangeRect.bottom > containerRect.bottom
      ) {
        container.scrollTop +=
          rangeRect.top - containerRect.top - containerRect.height / 3;
      }
    },
    [scrollContainerRef],
  );

  const doSearch = useCallback(
    (q: string) => {
      clearHighlights();
      const ranges = findMatches(q);
      rangesRef.current = ranges;
      setMatchCount(ranges.length);
      if (ranges.length > 0) {
        setCurrentIndex(0);
        applyHighlights(ranges, 0);
        scrollToRange(ranges[0]);
      } else {
        setCurrentIndex(-1);
      }
    },
    [clearHighlights, findMatches, applyHighlights, scrollToRange],
  );

  const navigate = useCallback(
    (direction: "next" | "prev") => {
      const ranges = rangesRef.current;
      if (ranges.length === 0) return;
      setCurrentIndex((prev) => {
        const next =
          direction === "next"
            ? (prev + 1) % ranges.length
            : (prev - 1 + ranges.length) % ranges.length;
        if (highlightsSupported) {
          CSS.highlights!.delete("diff-search-current");
          CSS.highlights!.set(
            "diff-search-current",
            new Highlight(ranges[next]),
          );
        }
        scrollToRange(ranges[next]);
        return next;
      });
    },
    [scrollToRange],
  );

  const handleClose = useCallback(() => {
    clearHighlights();
    rangesRef.current = [];
    onClose();
  }, [clearHighlights, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    return () => clearHighlights();
  }, [clearHighlights]);

  return (
    <div className="diff-search-bar">
      <input
        ref={inputRef}
        type="text"
        className="diff-search-input"
        placeholder="Search in diff..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          doSearch(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            navigate(e.shiftKey ? "prev" : "next");
          }
          if (e.key === "Escape") {
            handleClose();
          }
        }}
      />
      {query && (
        <span className="diff-search-count">
          {matchCount > 0
            ? `${currentIndex + 1}/${matchCount}`
            : "No results"}
        </span>
      )}
      <button
        className="diff-search-btn"
        title="Previous (Shift+Enter)"
        onClick={() => navigate("prev")}
        disabled={matchCount === 0}
      >
        &#x25B2;
      </button>
      <button
        className="diff-search-btn"
        title="Next (Enter)"
        onClick={() => navigate("next")}
        disabled={matchCount === 0}
      >
        &#x25BC;
      </button>
      <button
        className="diff-search-btn diff-search-close"
        title="Close (Escape)"
        onClick={handleClose}
      >
        &#x2715;
      </button>
    </div>
  );
};

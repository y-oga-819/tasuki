import React, { useEffect, useRef, useState, useCallback } from "react";
import "@xterm/xterm/css/xterm.css";
import { useTerminalManager } from "./TerminalManagerContext";
import s from "./Terminal.module.css";

export const TerminalPanel: React.FC<{ visible: boolean }> = ({ visible }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const manager = useTerminalManager();

  // Search bar state (React-managed UI)
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Wire up the manager's search toggle callback
  useEffect(() => {
    manager.setOnSearchToggle((v) => {
      setSearchVisible(v);
      if (v) requestAnimationFrame(() => searchInputRef.current?.focus());
      if (!v) setSearchQuery("");
    });
    return () => {
      manager.setOnSearchToggle(null);
    };
  }, [manager]);

  // Keep manager's search visible ref in sync
  useEffect(() => {
    manager.setSearchVisible(searchVisible);
  }, [manager, searchVisible]);

  // Initialize / re-attach terminal when visible
  useEffect(() => {
    if (visible && containerRef.current) {
      manager.init(containerRef.current);
    }
    return () => {
      manager.detach();
    };
  }, [visible, manager]);

  // Re-fit on visibility change
  useEffect(() => {
    if (visible && manager.isInitialized) {
      requestAnimationFrame(() => {
        manager.fit();
        manager.focus();
      });
    }
  }, [visible, manager]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (visible) manager.fit();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible, manager]);

  const closeSearch = useCallback(() => {
    manager.closeSearch();
    setSearchVisible(false);
    setSearchQuery("");
  }, [manager]);

  const doSearch = useCallback(
    (query: string, direction: "next" | "prev" = "next") => {
      if (!query) return;
      if (direction === "next") {
        manager.findNext(query);
      } else {
        manager.findPrev(query);
      }
    },
    [manager],
  );

  return (
    <div
      className={`${s.container} ${visible ? "" : s.hidden}`}
      ref={containerRef}
    >
      {searchVisible && (
        <div className={s.searchBar}>
          <input
            ref={searchInputRef}
            type="text"
            className={s.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              doSearch(e.target.value, "next");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                doSearch(searchQuery, e.shiftKey ? "prev" : "next");
              }
              if (e.key === "Escape") {
                closeSearch();
              }
            }}
          />
          <button
            className={s.searchBtn}
            title="Previous (Shift+Enter)"
            onClick={() => doSearch(searchQuery, "prev")}
          >
            &#x25B2;
          </button>
          <button
            className={s.searchBtn}
            title="Next (Enter)"
            onClick={() => doSearch(searchQuery, "next")}
          >
            &#x25BC;
          </button>
          <button
            className={s.closeBtn}
            title="Close (Escape)"
            onClick={closeSearch}
          >
            &#x2715;
          </button>
        </div>
      )}
    </div>
  );
};

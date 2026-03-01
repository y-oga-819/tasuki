import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import GithubSlugger from "github-slugger";
import { renderMermaid, THEMES } from "beautiful-mermaid";
import { useDisplayStore } from "../store/displayStore";
import { useDocStore } from "../store/docStore";
import { MermaidZoomModal } from "./MermaidZoomModal";
import * as api from "../utils/tauri-api";

export const MarkdownViewer: React.FC = () => {
  const { tocOpen, setTocOpen, markdownViewMode, setMarkdownViewMode } = useDisplayStore();
  const { selectedDoc, docContent, setDocContent, docSource } = useDocStore();
  const [tocItems, setTocItems] = useState<
    { id: string; text: string; level: number }[]
  >([]);
  const tocRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedDoc) {
      setDocContent(null);
      return;
    }

    (async () => {
      try {
        let content: string;
        if (docSource === "design") {
          content = await api.readDesignDoc(selectedDoc.replace("design:", ""));
        } else if (docSource === "external") {
          // external:{folder}/{relativePath} → absolute path
          const absPath = selectedDoc.replace("external:", "");
          content = await api.readExternalFile(absPath);
        } else {
          content = await api.readFile(selectedDoc);
        }
        setDocContent(content);
        // Extract TOC from headings using github-slugger (matches rehype-slug)
        const slugger = new GithubSlugger();
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const items: { id: string; text: string; level: number }[] = [];
        let match;
        while ((match = headingRegex.exec(content)) !== null) {
          const level = match[1].length;
          const text = match[2].trim();
          const id = slugger.slug(text);
          items.push({ id, text, level });
        }
        setTocItems(items);
      } catch (err) {
        setDocContent(`*Error loading document: ${err}*`);
      }
    })();
  }, [selectedDoc, docSource, setDocContent]);

  // Close TOC on outside click
  useEffect(() => {
    if (!tocOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (tocRef.current && !tocRef.current.contains(e.target as Node)) {
        setTocOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [tocOpen, setTocOpen]);

  const handleTocClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setTocOpen(false);
    },
    [setTocOpen],
  );

  if (!selectedDoc) {
    return (
      <div className="markdown-viewer empty">
        <p>Select a document from the sidebar to view.</p>
      </div>
    );
  }

  if (!docContent) {
    return (
      <div className="markdown-viewer loading">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="markdown-viewer">
      <header className="markdown-toolbar">
        {tocItems.length > 3 && (
          <div className="toc-container" ref={tocRef}>
            <button
              className="toc-toggle-btn"
              onClick={() => setTocOpen(!tocOpen)}
              title="Table of Contents"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75zM1.75 12a.75.75 0 0 0 0 1.5h12.5a.75.75 0 0 0 0-1.5H1.75z" />
              </svg>
            </button>
            {tocOpen && (
              <nav className="toc-dropdown">
                <h4 className="toc-title">Table of Contents</h4>
                <ul className="toc-list">
                  {tocItems.map((item, i) => (
                    <li
                      key={`${item.id}-${i}`}
                      className={`toc-item toc-level-${item.level}`}
                    >
                      <a
                        href={`#${item.id}`}
                        onClick={(e) => handleTocClick(e, item.id)}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </div>
        )}
        <div className="markdown-view-toggle">
          <button
            className={`layout-btn ${markdownViewMode === "preview" ? "active" : ""}`}
            onClick={() => setMarkdownViewMode("preview")}
          >
            Preview
          </button>
          <button
            className={`layout-btn ${markdownViewMode === "raw" ? "active" : ""}`}
            onClick={() => setMarkdownViewMode("raw")}
          >
            Raw
          </button>
        </div>
      </header>
      <div className="markdown-scroll">
      {markdownViewMode === "raw" ? (
        <pre className="markdown-raw">{docContent}</pre>
      ) : (
      <article className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeRaw]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "");
              const language = match ? match[1] : "";

              // Handle Mermaid diagrams
              if (language === "mermaid") {
                return (
                  <MermaidBlock
                    code={String(children).replace(/\n$/, "")}
                  />
                );
              }

              // Inline code
              if (!className) {
                return (
                  <code className="inline-code" {...props}>
                    {children}
                  </code>
                );
              }

              // Code block with syntax highlighting
              return (
                <pre className={`code-block ${className || ""}`}>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            },
            table({ children }) {
              return (
                <div className="table-wrapper">
                  <table>{children}</table>
                </div>
              );
            },
          }}
        >
          {docContent}
        </ReactMarkdown>
      </article>
      )}
      </div>
    </div>
  );
};

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ok"; svg: string } | { status: "error"; message: string }
  >({ status: "loading" });
  const [zoomOpen, setZoomOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    renderMermaid(code, THEMES["github-dark"])
      .then((result) => {
        if (!cancelled) setState({ status: "ok", svg: result });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === "error") {
    return (
      <div className="mermaid-block mermaid-error">
        <div className="mermaid-label">Mermaid Diagram (Error)</div>
        <pre className="mermaid-source">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="mermaid-block mermaid-loading">
        <div className="mermaid-label">Mermaid Diagram</div>
        <div className="mermaid-render-area">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mermaid-block">
      <button
        className="mermaid-zoom-btn"
        onClick={() => setZoomOpen(true)}
        title="Zoom diagram"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.5 1h4a.5.5 0 0 1 0 1H2.707l3.147 3.146a.5.5 0 1 1-.708.708L2 2.707V5.5a.5.5 0 0 1-1 0v-4a.5.5 0 0 1 .5-.5zm13 0a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-1 0V2.707l-3.146 3.147a.5.5 0 1 1-.708-.708L13.293 2H10.5a.5.5 0 0 1 0-1h4zM1.5 15a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 1 0v2.793l3.146-3.147a.5.5 0 1 1 .708.708L2.707 14H5.5a.5.5 0 0 1 0 1h-4zm13 0h-4a.5.5 0 0 1 0-1h2.793l-3.147-3.146a.5.5 0 0 1 .708-.708L14 13.293V10.5a.5.5 0 0 1 1 0v4a.5.5 0 0 1-.5.5z" />
        </svg>
      </button>
      <div
        ref={containerRef}
        className="mermaid-render-area"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
      {zoomOpen && (
        <MermaidZoomModal svg={state.svg} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
};

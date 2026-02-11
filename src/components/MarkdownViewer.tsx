import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import { renderMermaid, THEMES } from "beautiful-mermaid";
import { useStore } from "../store";
import * as api from "../utils/tauri-api";

export const MarkdownViewer: React.FC = () => {
  const { selectedDoc, docContent, setDocContent } = useStore();
  const [tocItems, setTocItems] = useState<
    { id: string; text: string; level: number }[]
  >([]);

  useEffect(() => {
    if (!selectedDoc) {
      setDocContent(null);
      return;
    }

    (async () => {
      try {
        const content = await api.readFile(selectedDoc);
        setDocContent(content);
        // Extract TOC from headings
        const headingRegex = /^(#{1,6})\s+(.+)$/gm;
        const items: { id: string; text: string; level: number }[] = [];
        let match;
        while ((match = headingRegex.exec(content)) !== null) {
          const level = match[1].length;
          const text = match[2].trim();
          const id = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");
          items.push({ id, text, level });
        }
        setTocItems(items);
      } catch (err) {
        setDocContent(`*Error loading document: ${err}*`);
      }
    })();
  }, [selectedDoc, setDocContent]);

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
      {tocItems.length > 3 && (
        <nav className="toc">
          <h4 className="toc-title">Table of Contents</h4>
          <ul className="toc-list">
            {tocItems.map((item) => (
              <li
                key={item.id}
                className={`toc-item toc-level-${item.level}`}
              >
                <a href={`#${item.id}`}>{item.text}</a>
              </li>
            ))}
          </ul>
        </nav>
      )}
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
    </div>
  );
};

const MermaidBlock: React.FC<{ code: string }> = ({ code }) => {
  const [state, setState] = useState<
    { status: "loading" } | { status: "ok"; svg: string } | { status: "error"; message: string }
  >({ status: "loading" });
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
      <div
        ref={containerRef}
        className="mermaid-render-area"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    </div>
  );
};

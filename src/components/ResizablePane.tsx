import React, { useCallback, useEffect, useRef, useState } from "react";
import s from "./ResizablePane.module.css";

interface ResizablePaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  /** Maximum width (px) for the right pane. Limits how far left the handle can be dragged. */
  maxRightWidth?: number;
}

export const ResizablePane: React.FC<ResizablePaneProps> = ({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
  maxRightWidth,
}) => {
  const [ratio, setRatio] = useState(defaultRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const rafIdRef = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    document.body.style.userSelect = "none";
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;

      const { clientX } = e;
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const effectiveMinRatio =
          maxRightWidth != null
            ? Math.max(minRatio, 1 - maxRightWidth / rect.width)
            : minRatio;
        const clamped = Math.max(
          effectiveMinRatio,
          Math.min(maxRatio, (clientX - rect.left) / rect.width),
        );
        setRatio(clamped);
      });
    },
    [minRatio, maxRatio, maxRightWidth],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  // Clamp ratio to respect maxRightWidth on mount and window resize
  useEffect(() => {
    if (maxRightWidth == null || !containerRef.current) return;
    const clamp = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      const effectiveMinRatio = Math.max(minRatio, 1 - maxRightWidth / width);
      setRatio((prev) => Math.max(effectiveMinRatio, prev));
    };
    clamp();
    window.addEventListener("resize", clamp);
    return () => window.removeEventListener("resize", clamp);
  }, [maxRightWidth, minRatio]);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  const adjustRatio = useCallback(
    (delta: number) => {
      setRatio((prev) => {
        const effectiveMinRatio =
          maxRightWidth != null && containerRef.current
            ? Math.max(minRatio, 1 - maxRightWidth / containerRef.current.getBoundingClientRect().width)
            : minRatio;
        return Math.max(effectiveMinRatio, Math.min(maxRatio, prev + delta));
      });
    },
    [minRatio, maxRatio, maxRightWidth],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        adjustRatio(-0.05);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        adjustRatio(0.05);
      }
    },
    [adjustRatio],
  );

  const leftBasis = `${ratio * 100}%`;
  const rightBasis = `${(1 - ratio) * 100}%`;

  return (
    <div className={s.pane} ref={containerRef}>
      <div className={`${s.left} resizable-left`} style={{ flexBasis: leftBasis }}>
        {left}
      </div>
      <div
        className={s.handle}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize pane"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
      />
      <div className={s.right} style={{ flexBasis: rightBasis }}>
        {right}
      </div>
    </div>
  );
};

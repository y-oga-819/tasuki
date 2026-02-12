import React, { useCallback, useEffect, useRef, useState } from "react";

interface ResizablePaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultRatio?: number;
  minRatio?: number;
  maxRatio?: number;
}

export const ResizablePane: React.FC<ResizablePaneProps> = ({
  left,
  right,
  defaultRatio = 0.5,
  minRatio = 0.2,
  maxRatio = 0.8,
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
        const clamped = Math.max(
          minRatio,
          Math.min(maxRatio, (clientX - rect.left) / rect.width),
        );
        setRatio(clamped);
      });
    },
    [minRatio, maxRatio],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.userSelect = "";
    cancelAnimationFrame(rafIdRef.current);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current);
  }, []);

  const leftBasis = `${ratio * 100}%`;
  const rightBasis = `${(1 - ratio) * 100}%`;

  return (
    <div className="resizable-pane" ref={containerRef}>
      <div className="resizable-left" style={{ flexBasis: leftBasis }}>
        {left}
      </div>
      <div
        className="resizable-handle"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <div className="resizable-right" style={{ flexBasis: rightBasis }}>
        {right}
      </div>
    </div>
  );
};

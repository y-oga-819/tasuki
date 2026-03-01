import React, { useCallback, useEffect, useRef, useState } from "react";
import { clampScale, ZOOM_STEP } from "../utils/zoom";
import s from "./MermaidZoomModal.module.css";

interface MermaidZoomModalProps {
  svg: string;
  onClose: () => void;
}

export const MermaidZoomModal: React.FC<MermaidZoomModalProps> = ({
  svg,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((prev) => clampScale(prev + delta));
  }, []);

  // Pan with mouse drag
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPosRef.current.x;
    const dy = e.clientY - lastPosRef.current.y;
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setTranslate((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev + ZOOM_STEP * 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => clampScale(prev - ZOOM_STEP * 2));
  }, []);

  // Prevent body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className={`${s.modal} mermaid-zoom-modal`} onClick={onClose}>
      <div
        className={s.container}
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          className={s.content}
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      <div className={`${s.controls} mermaid-zoom-controls`} onClick={(e) => e.stopPropagation()}>
        <button
          className={`${s.ctrlBtn} mermaid-zoom-ctrl-btn`}
          onClick={handleZoomOut}
          title="Zoom out"
        >
          -
        </button>
        <button
          className={`${s.zoomLevel} mermaid-zoom-level`}
          onClick={handleReset}
          title="Reset zoom"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          className={`${s.ctrlBtn} mermaid-zoom-ctrl-btn`}
          onClick={handleZoomIn}
          title="Zoom in"
        >
          +
        </button>
      </div>

      <button
        className={s.closeBtn}
        onClick={onClose}
        title="Close (Escape)"
      >
        &#x2715;
      </button>
    </div>
  );
};

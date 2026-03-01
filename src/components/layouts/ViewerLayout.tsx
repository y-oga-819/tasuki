import React, { lazy, Suspense } from "react";
import { ResizablePane } from "../ResizablePane";
import { MarkdownViewer } from "../MarkdownViewer";
import { MAX_RIGHT_WIDTH } from "../../utils/layout";
import l from "./Layout.module.css";

const TerminalPanel = lazy(() =>
  import("../Terminal").then((m) => ({ default: m.TerminalPanel })),
);

export const ViewerLayout: React.FC = () => {
  return (
    <main className={`main-content viewer-layout ${l.viewerLayout}`}>
      <ResizablePane
        defaultRatio={0.6}
        minRatio={0.3}
        maxRatio={0.85}
        maxRightWidth={MAX_RIGHT_WIDTH}
        left={<MarkdownViewer />}
        right={
          <Suspense fallback={<div className="loading-spinner">Loading...</div>}>
            <TerminalPanel visible />
          </Suspense>
        }
      />
    </main>
  );
};

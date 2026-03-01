import React from "react";
import { useUiStore } from "../../store/uiStore";
import { useDiffStore } from "../../store/diffStore";
import { DiffOnlyLayout } from "./DiffOnlyLayout";
import { SplitLayout } from "./SplitLayout";
import { ViewerLayout } from "./ViewerLayout";

export const LayoutSwitch: React.FC = () => {
  const displayMode = useUiStore((s) => s.displayMode);
  const isLoading = useDiffStore((s) => s.isLoading);
  const error = useDiffStore((s) => s.error);

  if (isLoading) {
    return (
      <main className="main-content loading">
        <DiffSkeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main className="main-content error">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  switch (displayMode) {
    case "diff":
      return <DiffOnlyLayout />;
    case "split":
      return <SplitLayout />;
    case "viewer":
      return <ViewerLayout />;
  }
};

/** Skeleton loading state for diff view */
const DiffSkeleton: React.FC = () => (
  <div className="skeleton-container">
    {[1, 2, 3].map((i) => (
      <div key={i} className="skeleton-file">
        <div className="skeleton-header skeleton-pulse" />
        <div className="skeleton-lines">
          <div className="skeleton-line skeleton-pulse" style={{ width: "90%" }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: "70%" }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: "80%" }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: "60%" }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: "85%" }} />
        </div>
      </div>
    ))}
  </div>
);

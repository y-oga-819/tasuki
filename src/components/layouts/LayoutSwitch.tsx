import React from "react";
import { useDisplayStore } from "../../store/displayStore";
import { useDiffStore } from "../../store/diffStore";
import { DiffOnlyLayout } from "./DiffOnlyLayout";
import { SplitLayout } from "./SplitLayout";
import { ViewerLayout } from "./ViewerLayout";

export const LayoutSwitch: React.FC = () => {
  const displayMode = useDisplayStore((s) => s.displayMode);
  const isLoading = useDiffStore((s) => s.isLoading);
  const error = useDiffStore((s) => s.error);

  if (isLoading) {
    return (
      <main className="main-content loading">
        <div className="loading-spinner">Loading...</div>
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

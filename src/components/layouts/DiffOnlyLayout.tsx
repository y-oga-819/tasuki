import React from "react";
import { DiffPane } from "../DiffPane";

export const DiffOnlyLayout: React.FC = () => {
  return (
    <main className="main-content">
      <div className="split-left diff-only">
        <DiffPane />
      </div>
    </main>
  );
};

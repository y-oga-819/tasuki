import React from "react";
import { DiffPane } from "../DiffPane";
import l from "./Layout.module.css";

export const DiffOnlyLayout: React.FC = () => {
  return (
    <main className="main-content">
      <div className={l.diffOnly}>
        <DiffPane />
      </div>
    </main>
  );
};

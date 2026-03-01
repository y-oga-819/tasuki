import React from "react";
import ReactDOM from "react-dom/client";
import { LineSelectionManager } from "@pierre/diffs";
import App from "./App";
import "./store"; // side-effect: exposes __zustandStore for E2E tests in DEV
import "./styles/tokens.css";
import "./styles/reset.css";
import "./styles/global.css";
import "./styles/pierre.css";
import "./styles/responsive.css";

// Patch: prevent LineSelectionManager.setSelection from throwing when
// the selection cannot be mapped to the DOM after a re-render (e.g.
// when annotations trigger a full diff rebuild). The original
// renderSelection() throws an Error that propagates through
// useLayoutEffect and crashes the entire React tree.
// renderSelection is an arrow-function instance property so we patch
// setSelection (a prototype method that calls renderSelection).
const origSetSelection = LineSelectionManager.prototype.setSelection;
LineSelectionManager.prototype.setSelection = function (range) {
  try {
    return origSetSelection.call(this, range);
  } catch (e) {
    console.warn("[Tasuki] setSelection failed, ignoring:", e);
  }
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

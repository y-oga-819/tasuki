import React, { createContext, useContext, useEffect, useState } from "react";
import { TerminalManager } from "./TerminalManager";

const TerminalManagerCtx = createContext<TerminalManager | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useTerminalManager(): TerminalManager {
  const ctx = useContext(TerminalManagerCtx);
  if (!ctx) throw new Error("useTerminalManager must be used within TerminalManagerProvider");
  return ctx;
}

export const TerminalManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manager] = useState(() => new TerminalManager());

  useEffect(() => {
    return () => {
      manager.dispose();
    };
  }, [manager]);

  return (
    <TerminalManagerCtx.Provider value={manager}>
      {children}
    </TerminalManagerCtx.Provider>
  );
};

"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

type EvaluationLayoutContextType = {
  autoSaveLabel: string;
  setAutoSaveLabel: (label: string) => void;
  exportCsvUrl: string | null;
  setExportCsvUrl: (url: string | null) => void;
  publishGrades: (() => Promise<void>) | null;
  setPublishGrades: (fn: (() => Promise<void>) | null) => void;
};

const EvaluationLayoutContext = createContext<EvaluationLayoutContextType | undefined>(undefined);

export function EvaluationLayoutProvider({ children }: { children: ReactNode }) {
  const [autoSaveLabel, setAutoSaveLabel] = useState("");
  const [exportCsvUrl, setExportCsvUrl] = useState<string | null>(null);
  const [publishGrades, setPublishGradesInternal] = useState<(() => Promise<void>) | null>(null);

  // Wrapper to properly handle function as state value
  const setPublishGrades = useCallback((fn: (() => Promise<void>) | null) => {
    setPublishGradesInternal(() => fn);
  }, []);

  return (
    <EvaluationLayoutContext.Provider
      value={{
        autoSaveLabel,
        setAutoSaveLabel,
        exportCsvUrl,
        setExportCsvUrl,
        publishGrades,
        setPublishGrades,
      }}
    >
      {children}
    </EvaluationLayoutContext.Provider>
  );
}

export function useEvaluationLayout() {
  const context = useContext(EvaluationLayoutContext);
  if (!context) {
    throw new Error("useEvaluationLayout must be used within EvaluationLayoutProvider");
  }
  return context;
}

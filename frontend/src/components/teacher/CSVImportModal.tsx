"use client";

import { useState } from "react";
import { CSVImportResult } from "@/services/teacher.service";

type CSVImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File) => Promise<CSVImportResult>;
  onSuccess: () => void;
};

export default function CSVImportModal({
  isOpen,
  onClose,
  onImport,
  onSuccess,
}: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<CSVImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".csv")) {
        setError("Selecteer een geldig CSV-bestand");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await onImport(file);
      setResult(importResult);

      if (importResult.error_count === 0) {
        // Success - close after a short delay
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import mislukt");
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError(null);
    onClose();
  };

  const downloadTemplate = () => {
    const csvContent = "name,email,role\nAnna de Vries,a.devries@school.nl,admin\nPeter Jansen,p.jansen@school.nl,teacher";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "teachers_template.csv";
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Docenten importeren uit CSV
        </h2>

        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 font-medium mb-1">
            Verwacht CSV-formaat:
          </p>
          <code className="text-xs text-blue-700 block">
            name,email,role
          </code>
          <p className="text-xs text-blue-700 mt-2">
            Rol moet &apos;teacher&apos; of &apos;admin&apos; zijn
          </p>
          <button
            type="button"
            onClick={downloadTemplate}
            className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
          >
            Download voorbeeldbestand
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Importresultaat:
              </span>
              <span
                className={`text-sm font-semibold ${
                  result.error_count === 0
                    ? "text-green-600"
                    : "text-orange-600"
                }`}
              >
                {result.success_count} geslaagd, {result.error_count} gefaald
              </span>
            </div>

            {result.created.length > 0 && (
              <p className="text-xs text-gray-600">
                ✓ {result.created.length} nieuwe docent(en) aangemaakt
              </p>
            )}
            {result.updated.length > 0 && (
              <p className="text-xs text-gray-600">
                ✓ {result.updated.length} docent(en) bijgewerkt
              </p>
            )}

            {result.errors.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                <p className="text-xs font-medium text-red-600 mb-1">Fouten:</p>
                <ul className="text-xs text-red-600 space-y-1">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!result && (
          <div className="mb-4">
            <label
              htmlFor="csv-file"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Selecteer CSV-bestand
            </label>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isImporting}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50"
            />
            {file && (
              <p className="mt-2 text-xs text-gray-500">
                Geselecteerd: {file.name}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            disabled={isImporting}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {result ? "Sluiten" : "Annuleren"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleImport}
              disabled={!file || isImporting}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isImporting ? "Importeren..." : "Importeren"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

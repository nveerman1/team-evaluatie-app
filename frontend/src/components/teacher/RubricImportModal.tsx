"use client";

import { useState, useCallback, useEffect } from "react";
import {
  rubricImportService,
  CsvPreviewResult,
  CsvImportResult,
  PreviewRubric,
} from "@/services/rubric-import.service";
import { subjectService } from "@/services/subject.service";
import type { Subject } from "@/dtos/subject.dto";

type Step = "upload" | "preview" | "importing" | "done";

type RubricImportModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RubricImportModal({
  open,
  onClose,
  onSuccess,
}: RubricImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      subjectService
        .listSubjects({ per_page: 100, is_active: true })
        .then((res) => setSubjects(res.subjects))
        .catch(() => setSubjects([]));
    }
  }, [open]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setPreviewError(null);
    setIsDragging(false);
    setLoadingPreview(false);
    setSelectedSubjectId(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setPreviewError("Selecteer een geldig CSV-bestand (.csv)");
      return;
    }
    setFile(selectedFile);
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      const previewResult = await rubricImportService.preview(selectedFile, selectedSubjectId);
      setPreview(previewResult);
      setStep("preview");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setPreviewError(
        axiosErr?.response?.data?.detail ||
          (err instanceof Error ? err.message : "Preview mislukt"),
      );
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedSubjectId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelected(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelected(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setStep("importing");
    try {
      const importResult = await rubricImportService.importCsv(file, selectedSubjectId);
      setResult(importResult);
      setStep("done");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setResult({
        created_rubrics: 0,
        created_criteria: 0,
        linked_objectives: 0,
        errors: [
          axiosErr?.response?.data?.detail ||
            (err instanceof Error ? err.message : "Import mislukt"),
        ],
        warnings: [],
        rubric_ids: [],
      });
      setStep("done");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            📥 Rubrics importeren via CSV
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Step: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              {/* CSV format info */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
                <p className="font-medium mb-2">Verwacht CSV-formaat:</p>
                <code className="block text-xs bg-blue-100 rounded p-2 overflow-x-auto whitespace-pre">
                  {`scope,target_level,rubric_title,rubric_description,scale_min,scale_max,criterion_name,category,weight,level1,level2,level3,level4,level5,learning_objectives`}
                </code>
                <ul className="mt-2 text-xs space-y-1">
                  <li>
                    <strong>Verplicht:</strong> rubric_title, criterion_name,
                    scope (peer/project)
                  </li>
                  <li>
                    <strong>Optioneel:</strong> rubric_description, target_level,
                    scale_min/max, category, weight, level1-5,
                    learning_objectives
                  </li>
                  <li>
                    <strong>learning_objectives:</strong> puntkomma-gescheiden
                    nummers, bijv. <code>9;11;14</code>
                  </li>
                </ul>
              </div>

              {/* Subject selector */}
              {subjects.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vakgebied (aanbevolen)
                  </label>
                  <select
                    value={selectedSubjectId ?? ""}
                    onChange={(e) =>
                      setSelectedSubjectId(
                        e.target.value ? parseInt(e.target.value, 10) : null,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">— Alle vakgebieden (kan dubbele leerdoelen geven) —</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Selecteer het vakgebied waarvan de leerdoel-nummers in de CSV afkomstig zijn.
                  </p>
                </div>
              )}

              {previewError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {previewError}
                </div>
              )}

              {/* Drag & drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <p className="text-gray-500 mb-3">
                  Sleep een CSV-bestand hierheen of
                </p>
                <label className="cursor-pointer inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  Bestand selecteren
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={loadingPreview}
                  />
                </label>
                {loadingPreview && (
                  <p className="mt-3 text-sm text-gray-500 animate-pulse">
                    Preview wordt geladen...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === "preview" && preview && (
            <div className="space-y-4">
              {preview.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm font-medium text-red-700 mb-1">
                    Fouten gevonden:
                  </p>
                  <ul className="text-sm text-red-600 space-y-0.5">
                    {preview.errors.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-700 mb-1">
                    Waarschuwingen:
                  </p>
                  <ul className="text-sm text-amber-600 space-y-0.5">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>⚠ {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.rubrics.map((rubric: PreviewRubric, idx: number) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-gray-900">
                        {rubric.title}
                      </span>
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                        {rubric.scope}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {rubric.criteria_count} criteria
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">
                            Criterium
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">
                            Categorie
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">
                            Gewicht
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">
                            Descriptors
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">
                            Leerdoelen
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {rubric.criteria.map((c, ci) => (
                          <tr key={ci} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">
                              {c.name}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {c.category || "—"}
                            </td>
                            <td className="px-3 py-2 text-gray-700">
                              {(c.weight * 100).toFixed(0)}%
                            </td>
                            <td className="px-3 py-2">
                              {c.has_descriptors ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {c.learning_objectives.length === 0 && (
                                  <span className="text-gray-400">—</span>
                                )}
                                {c.learning_objectives.map((lo, li) => (
                                  <span
                                    key={li}
                                    title={lo.title || undefined}
                                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                      lo.found
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-600"
                                    }`}
                                  >
                                    {lo.order}
                                    {lo.found ? " ✓" : " ✗"}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step: Importing */}
          {step === "importing" && (
            <div className="py-10 flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-600">Rubrics worden geïmporteerd...</p>
            </div>
          )}

          {/* Step: Done */}
          {step === "done" && result && (
            <div className="space-y-4">
              {result.errors.length === 0 ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-semibold mb-2">
                    ✓ Import geslaagd!
                  </p>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• {result.created_rubrics} rubric(s) aangemaakt</li>
                    <li>• {result.created_criteria} criteria aangemaakt</li>
                    <li>
                      • {result.linked_objectives} leerdoel-koppelingen
                      aangemaakt
                    </li>
                  </ul>
                </div>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-semibold mb-2">
                    Import mislukt
                  </p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-700 mb-1">
                    Waarschuwingen:
                  </p>
                  <ul className="text-sm text-amber-600 space-y-0.5">
                    {result.warnings.map((w, i) => (
                      <li key={i}>⚠ {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-gray-100 pt-4">
          {step === "upload" && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Annuleren
            </button>
          )}
          {step === "preview" && (
            <>
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Ander bestand
              </button>
              {preview?.valid && (
                <button
                  type="button"
                  onClick={handleImport}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Importeren
                </button>
              )}
            </>
          )}
          {step === "done" && (
            <button
              type="button"
              onClick={() => {
                if (result && result.errors.length === 0) {
                  onSuccess();
                }
                handleClose();
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Sluiten
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

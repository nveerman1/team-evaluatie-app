"use client";

import { useState, useEffect } from "react";
import { academicYearService } from "@/services/academic-year.service";
import {
  AcademicYear,
  ClassInfo,
  ClassMapping,
  TransitionResult,
} from "@/dtos/academic-year.dto";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface YearTransitionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function YearTransitionWizard({
  isOpen,
  onClose,
  onSuccess,
}: YearTransitionWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step data
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [sourceYear, setSourceYear] = useState<AcademicYear | null>(null);
  const [targetYear, setTargetYear] = useState<AcademicYear | null>(null);
  const [sourceClasses, setSourceClasses] = useState<ClassInfo[]>([]);
  const [classMapping, setClassMapping] = useState<ClassMapping>({});
  const [copyCourseEnrollments, setCopyCourseEnrollments] = useState(true);
  const [result, setResult] = useState<TransitionResult | null>(null);

  // Load academic years on mount
  useEffect(() => {
    if (isOpen) {
      loadAcademicYears();
    }
  }, [isOpen]);

  const loadAcademicYears = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await academicYearService.listAcademicYears({
        per_page: 100,
      });
      setAcademicYears(response.academic_years);
    } catch (err: any) {
      setError("Kon academische jaren niet laden.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSourceClasses = async (yearId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await academicYearService.getClassesForYear(yearId, {
        per_page: 100,
      });
      setSourceClasses(response.classes);
      
      // Initialize class mapping with suggested names
      const mapping: ClassMapping = {};
      response.classes.forEach((cls) => {
        mapping[cls.name] = suggestClassName(cls.name);
      });
      setClassMapping(mapping);
    } catch (err: any) {
      setError("Kon klassen niet laden.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Suggest next year's class name (e.g., G2a -> G3a)
  const suggestClassName = (name: string): string => {
    const match = name.match(/^([A-Z])(\d+)(.*)$/);
    if (match) {
      const [, prefix, year, suffix] = match;
      const nextYear = parseInt(year) + 1;
      return `${prefix}${nextYear}${suffix}`;
    }
    // Fallback: just return the original name if pattern doesn't match
    return name;
  };

  const handleSourceYearSelect = (year: AcademicYear) => {
    setSourceYear(year);
    loadSourceClasses(year.id);
    setStep(2);
  };

  const handleTargetYearSelect = (year: AcademicYear) => {
    if (sourceYear && year.id === sourceYear.id) {
      setError("Doeljaar moet verschillen van het bronjaar.");
      return;
    }
    setTargetYear(year);
    setStep(3);
  };

  const handleClassMappingChange = (sourceName: string, targetName: string) => {
    setClassMapping({
      ...classMapping,
      [sourceName]: targetName,
    });
  };

  const validateClassMapping = (): boolean => {
    const targetNames = Object.values(classMapping);
    const uniqueTargets = new Set(targetNames);
    
    if (targetNames.length !== uniqueTargets.size) {
      setError("Doelklasnamen moeten uniek zijn.");
      return false;
    }
    
    if (targetNames.some((name) => !name || name.trim() === "")) {
      setError("Alle klassen moeten een doelnaam hebben.");
      return false;
    }
    
    setError(null);
    return true;
  };

  const executeTransition = async () => {
    if (!sourceYear || !targetYear) {
      setError("Selecteer bron- en doeljaar.");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const result = await academicYearService.executeTransition(
        sourceYear.id,
        {
          target_academic_year_id: targetYear.id,
          class_mapping: classMapping,
          copy_course_enrollments: copyCourseEnrollments,
        }
      );
      setResult(result);
      setStep(6);
    } catch (err: any) {
      const errorDetail = err?.response?.data?.detail;
      const errorMessage = errorDetail 
        ? `Transitie mislukt: ${errorDetail}` 
        : "Transitie mislukt. Probeer het opnieuw of neem contact op met support.";
      setError(errorMessage);
      console.error("Transition failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Reset wizard state
    setStep(1);
    setSourceYear(null);
    setTargetYear(null);
    setSourceClasses([]);
    setClassMapping({});
    setCopyCourseEnrollments(true);
    setResult(null);
    setError(null);
    onClose();
  };

  const handleFinish = () => {
    onSuccess();
    handleClose();
  };

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && step !== 6) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, step]);

  if (!isOpen) return null;

  const totalSteps = 6;
  const progressPercent = (step / totalSteps) * 100;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      role="dialog"
      aria-labelledby="wizard-title"
      aria-modal="true"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6">
          <h2 id="wizard-title" className="text-2xl font-bold text-gray-900 mb-2">
            Academisch Jaar Transitie
          </h2>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-sm text-gray-600 mt-2">
            Stap {step} van {totalSteps}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Step 1: Select Source Year */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Selecteer het bronacademisch jaar
            </h3>
            <p className="text-sm text-gray-600">
              Kies het academisch jaar waarvandaan studenten en klassen worden
              overgedragen.
            </p>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="grid gap-3">
                {academicYears.map((year) => (
                  <Card
                    key={year.id}
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleSourceYearSelect(year)}
                  >
                    <div className="font-semibold">{year.label}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(year.start_date).toLocaleDateString()} -{" "}
                      {new Date(year.end_date).toLocaleDateString()}
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={handleClose}>
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Select Target Year */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Selecteer het doel academisch jaar
            </h3>
            <p className="text-sm text-gray-600">
              Kies het academisch jaar waarheen studenten en klassen worden
              overgedragen.
            </p>
            <p className="text-sm text-gray-700">
              <strong>Bronjaar:</strong> {sourceYear?.label}
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="grid gap-3">
                {academicYears
                  .filter((year) => year.id !== sourceYear?.id)
                  .map((year) => (
                    <Card
                      key={year.id}
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => handleTargetYearSelect(year)}
                    >
                      <div className="font-semibold">{year.label}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(year.start_date).toLocaleDateString()} -{" "}
                        {new Date(year.end_date).toLocaleDateString()}
                      </div>
                    </Card>
                  ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Terug
              </Button>
              <Button variant="secondary" onClick={handleClose}>
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Map Classes */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Klas mapping configureren</h3>
            <p className="text-sm text-gray-600">
              Wijs elke klas van het bronjaar toe aan een nieuwe klasnaam in
              het doeljaar.
            </p>
            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <strong>Bronjaar:</strong> {sourceYear?.label}
              </p>
              <p>
                <strong>Doeljaar:</strong> {targetYear?.label}
              </p>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sourceClasses.map((cls) => (
                <div
                  key={cls.id}
                  className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{cls.name}</div>
                    {cls.student_count !== undefined && (
                      <div className="text-sm text-gray-600">
                        {cls.student_count} student(en)
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">→</span>
                    <input
                      type="text"
                      value={classMapping[cls.name] || ""}
                      onChange={(e) =>
                        handleClassMappingChange(cls.name, e.target.value)
                      }
                      className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Nieuwe naam"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Terug
              </Button>
              <Button
                onClick={() => {
                  if (validateClassMapping()) {
                    setStep(4);
                  }
                }}
              >
                Volgende
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Configure Options */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Opties configureren</h3>
            <p className="text-sm text-gray-600">
              Kies welke aanvullende gegevens moeten worden gekopieerd.
            </p>

            <div className="p-4 bg-gray-50 rounded-lg space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyCourseEnrollments}
                  onChange={(e) => setCopyCourseEnrollments(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium">
                    Vak inschrijvingen kopiëren
                  </div>
                  <div className="text-sm text-gray-600">
                    Als dit is ingeschakeld, worden vakken gekopieerd naar het
                    nieuwe jaar en blijven student inschrijvingen behouden voor
                    studenten die overgaan.
                  </div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setStep(3)}>
                Terug
              </Button>
              <Button onClick={() => setStep(5)}>Volgende</Button>
            </div>
          </div>
        )}

        {/* Step 5: Preview & Confirm */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Preview en bevestigen</h3>
            <p className="text-sm text-gray-600">
              Controleer de samenvatting voordat u doorgaat met de transitie.
            </p>

            <Card className="p-4 space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-500">
                  Bronjaar
                </div>
                <div className="text-lg font-semibold">{sourceYear?.label}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500">
                  Doeljaar
                </div>
                <div className="text-lg font-semibold">{targetYear?.label}</div>
              </div>
            </Card>

            <div>
              <h4 className="font-semibold mb-2">Klas transities:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sourceClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <span className="font-medium">{cls.name}</span>
                    <span className="text-gray-500">→</span>
                    <span className="font-medium">
                      {classMapping[cls.name]}
                    </span>
                    {cls.student_count !== undefined && (
                      <span className="text-sm text-gray-600">
                        ({cls.student_count} student(en))
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 text-sm text-gray-700">
                <strong>Totaal:</strong> {sourceClasses.length} klassen,{" "}
                {sourceClasses.reduce(
                  (sum, cls) => sum + (cls.student_count || 0),
                  0
                )}{" "}
                studenten
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded">
              <div className="text-sm">
                <strong>Vak inschrijvingen:</strong>{" "}
                {copyCourseEnrollments
                  ? "Worden gekopieerd"
                  : "Worden niet gekopieerd"}
              </div>
            </div>

            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-2">
                <span className="text-yellow-600 font-bold">⚠️</span>
                <div className="flex-1 text-sm text-yellow-800">
                  Deze bewerking kan niet ongedaan worden gemaakt. Historische
                  gegevens blijven behouden, maar er worden nieuwe klassen en
                  lidmaatschappen aangemaakt in het doeljaar.
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setStep(4)}>
                Terug
              </Button>
              <Button
                onClick={executeTransition}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? "Transitie uitvoeren..." : "Transitie uitvoeren"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 6: Results */}
        {step === 6 && result && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="text-2xl font-bold text-green-600">
                Transitie voltooid!
              </h3>
            </div>

            <Card className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Klassen aangemaakt</div>
                  <div className="text-2xl font-bold">
                    {result.classes_created}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Studenten verplaatst</div>
                  <div className="text-2xl font-bold">
                    {result.students_moved}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Vakken aangemaakt</div>
                  <div className="text-2xl font-bold">
                    {result.courses_created}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">
                    Inschrijvingen gekopieerd
                  </div>
                  <div className="text-2xl font-bold">
                    {result.enrollments_copied}
                  </div>
                </div>
              </div>
              {result.skipped_students > 0 && (
                <div className="pt-3 border-t">
                  <div className="text-sm text-gray-600">
                    Studenten overgeslagen
                  </div>
                  <div className="text-lg font-bold text-yellow-600">
                    {result.skipped_students}
                  </div>
                </div>
              )}
            </Card>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={handleFinish}>Sluiten</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

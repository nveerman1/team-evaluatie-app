"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { projectService, clientService } from "@/services";
import { useCourses } from "@/hooks";
import type { WizardProjectCreate, EvaluationConfig } from "@/dtos/project.dto";
import type { ClientListItem } from "@/dtos/client.dto";
import { Loading } from "@/components";

export default function NewProjectWizardPage() {
  const router = useRouter();
  const { courses } = useCourses();

  // Wizard state
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);

  // Step 1: Project basics
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [className, setClassName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Evaluations
  const [evalConfig, setEvalConfig] = useState<EvaluationConfig>({
    create_peer_tussen: true,
    create_peer_eind: true,
    create_project_assessment: true,
    create_competency_scan: false,
  });

  // Step 3: Clients and notes
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<number[]>([]);
  const [createDefaultNote, setCreateDefaultNote] = useState(true);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientsLoadError, setClientsLoadError] = useState<string | null>(null);
  const [clientsLoaded, setClientsLoaded] = useState(false);

  // Load clients when reaching step 3
  useEffect(() => {
    if (step === 3 && !clientsLoaded) {
      loadClients();
    }
  }, [step, clientsLoaded]);

  async function loadClients() {
    setLoadingClients(true);
    setClientsLoadError(null);
    try {
      const response = await clientService.listClients({ per_page: 100 });
      setClients(response.items || []);
      setClientsLoaded(true);
    } catch (e: any) {
      console.error("Failed to load clients:", e);
      setClientsLoadError(
        "Kon opdrachtgevers niet laden. Je kunt doorgaan zonder opdrachtgevers te selecteren."
      );
      // Mark as loaded to prevent retry loop
      setClientsLoaded(true);
    } finally {
      setLoadingClients(false);
    }
  }

  function validateStep1() {
    if (!title.trim()) {
      setError("Vul een projecttitel in");
      return false;
    }
    setError(null);
    return true;
  }

  function handleNext() {
    if (step === 1) {
      if (!validateStep1()) return;
    }
    setError(null);
    setStep(step + 1);
  }

  function handleBack() {
    setError(null);
    setStep(step - 1);
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    try {
      const payload: WizardProjectCreate = {
        project: {
          title: title.trim(),
          course_id: courseId || undefined,
          class_name: className.trim() || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          description: description.trim() || undefined,
          status: "concept",
        },
        evaluations: evalConfig,
        client_ids: selectedClientIds,
        create_default_note: createDefaultNote,
      };

      const result = await projectService.wizardCreateProject(payload);
      setCreatedProjectId(result.project.id);
      setSuccess(true);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const errorMessage = e?.message?.includes("Network Error")
        ? "Kan geen verbinding maken met de backend server. Controleer of de backend server draait op http://localhost:8000"
        : typeof detail === "string"
        ? detail
        : e?.message || "Project aanmaken mislukt";
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleClient(clientId: number) {
    if (selectedClientIds.includes(clientId)) {
      setSelectedClientIds(selectedClientIds.filter(id => id !== clientId));
    } else {
      setSelectedClientIds([...selectedClientIds, clientId]);
    }
  }

  // Success screen
  if (success) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Project aangemaakt!</h1>
          <p className="text-gray-600 mb-6">
            Het project "{title}" is succesvol aangemaakt met alle geselecteerde evaluaties.
          </p>
          
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => router.push("/teacher/project-assessments")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Ga naar Projectbeoordelingen
            </button>
            <button
              onClick={() => router.push("/teacher/evaluations")}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Ga naar Peerevaluaties
            </button>
            <button
              onClick={() => router.push("/teacher")}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Terug naar Dashboard
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Nieuw project aanmaken</h1>
        <p className="text-gray-600">
          Maak in één keer een project aan met gekoppelde evaluaties, opdrachtgevers en aantekeningen.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < 4 ? "flex-1" : ""}`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  s < step
                    ? "bg-green-500 text-white"
                    : s === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                {s < step ? "✓" : s}
              </div>
              {s < 4 && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    s < step ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className={step === 1 ? "font-semibold" : "text-gray-600"}>
            Projectbasis
          </span>
          <span className={step === 2 ? "font-semibold" : "text-gray-600"}>
            Evaluaties
          </span>
          <span className={step === 3 ? "font-semibold" : "text-gray-600"}>
            Opdrachtgevers
          </span>
          <span className={step === 4 ? "font-semibold" : "text-gray-600"}>
            Bevestigen
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {/* Step 1: Project basics */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Projectbasis</h2>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Projecttitel <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Bijv. Klimaatonderzoek 5V1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value ? Number(e.target.value) : "")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecteer een course...</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Klas</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="Bijv. GA2, AH3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Startdatum</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Einddatum</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Beschrijving</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Korte beschrijving van het project..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Step 2: Evaluations */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Evaluaties & beoordeling</h2>
            <p className="text-sm text-gray-600 mb-4">
              Selecteer welke evaluaties automatisch aangemaakt moeten worden voor dit project.
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evalConfig.create_peer_tussen || false}
                  onChange={(e) =>
                    setEvalConfig({ ...evalConfig, create_peer_tussen: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Peerevaluatie tussentijds</div>
                  <div className="text-sm text-gray-600">
                    Studenten beoordelen elkaar halverwege het project
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evalConfig.create_peer_eind || false}
                  onChange={(e) =>
                    setEvalConfig({ ...evalConfig, create_peer_eind: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Peerevaluatie eind</div>
                  <div className="text-sm text-gray-600">
                    Studenten beoordelen elkaar aan het einde van het project
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evalConfig.create_project_assessment || false}
                  onChange={(e) =>
                    setEvalConfig({ ...evalConfig, create_project_assessment: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Projectbeoordeling</div>
                  <div className="text-sm text-gray-600">
                    Docent beoordeelt het projectresultaat per team
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={evalConfig.create_competency_scan || false}
                  onChange={(e) =>
                    setEvalConfig({ ...evalConfig, create_competency_scan: e.target.checked })
                  }
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">Competentiescan</div>
                  <div className="text-sm text-gray-600">
                    Studenten vullen een competentiescan in voor dit project
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step 3: Clients and notes */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Opdrachtgevers & aantekeningen</h2>

            <div>
              <h3 className="font-medium mb-2">Opdrachtgevers</h3>
              <p className="text-sm text-gray-600 mb-3">
                Selecteer welke opdrachtgevers betrokken zijn bij dit project.
              </p>

              {clientsLoadError && (
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">{clientsLoadError}</p>
                  <button
                    onClick={() => {
                      setClientsLoaded(false);
                      loadClients();
                    }}
                    className="mt-2 text-sm text-blue-600 hover:underline"
                  >
                    Opnieuw proberen
                  </button>
                </div>
              )}

              {loadingClients ? (
                <Loading />
              ) : clients.length === 0 && !clientsLoadError ? (
                <p className="text-sm text-gray-500 italic">
                  Geen opdrachtgevers beschikbaar.
                </p>
              ) : (
                clients.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {clients.map((client) => (
                      <label
                        key={client.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(client.id)}
                          onChange={() => toggleClient(client.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{client.organization}</div>
                          {client.contact_name && (
                            <div className="text-xs text-gray-600">
                              {client.contact_name}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="pt-4 border-t">
              <label className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createDefaultNote}
                  onChange={(e) => setCreateDefaultNote(e.target.checked)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">
                    Maak een standaard projectaantekeningen-pagina aan
                  </div>
                  <div className="text-sm text-gray-600">
                    Projectaantekeningen zijn alleen zichtbaar voor docenten en kunnen gebruikt
                    worden voor planning, materialen, contact met opdrachtgever etc.
                  </div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold mb-4">Bevestigen</h2>
            <p className="text-sm text-gray-600 mb-4">
              Controleer de gegevens en klik op "Project aanmaken" om te bevestigen.
            </p>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Projectgegevens</h3>
                <dl className="space-y-1 text-sm">
                  <div className="flex">
                    <dt className="w-32 text-gray-600">Titel:</dt>
                    <dd className="font-medium">{title}</dd>
                  </div>
                  {courseId && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Course:</dt>
                      <dd>{courses.find((c) => c.id === courseId)?.name}</dd>
                    </div>
                  )}
                  {className && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Klas:</dt>
                      <dd>{className}</dd>
                    </div>
                  )}
                  {startDate && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Startdatum:</dt>
                      <dd>{new Date(startDate).toLocaleDateString("nl-NL")}</dd>
                    </div>
                  )}
                  {endDate && (
                    <div className="flex">
                      <dt className="w-32 text-gray-600">Einddatum:</dt>
                      <dd>{new Date(endDate).toLocaleDateString("nl-NL")}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Evaluaties</h3>
                <ul className="space-y-1 text-sm">
                  {evalConfig.create_peer_tussen && (
                    <li>✓ Peerevaluatie tussentijds</li>
                  )}
                  {evalConfig.create_peer_eind && <li>✓ Peerevaluatie eind</li>}
                  {evalConfig.create_project_assessment && (
                    <li>✓ Projectbeoordeling</li>
                  )}
                  {evalConfig.create_competency_scan && <li>✓ Competentiescan</li>}
                  {!evalConfig.create_peer_tussen &&
                    !evalConfig.create_peer_eind &&
                    !evalConfig.create_project_assessment &&
                    !evalConfig.create_competency_scan && (
                      <li className="text-gray-500 italic">Geen evaluaties geselecteerd</li>
                    )}
                </ul>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Opdrachtgevers & aantekeningen</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Geselecteerde opdrachtgevers: </span>
                    <span className="font-medium">
                      {selectedClientIds.length === 0
                        ? "Geen"
                        : selectedClientIds.length}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Projectaantekeningen: </span>
                    <span className="font-medium">
                      {createDefaultNote ? "Ja" : "Nee"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6 pt-6 border-t">
          <button
            onClick={step > 1 ? handleBack : () => router.push("/teacher")}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            {step > 1 ? "Vorige" : "Annuleren"}
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volgende
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Bezig..." : "Project aanmaken"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

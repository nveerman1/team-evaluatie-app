"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  listLearningObjectives,
  createLearningObjective,
  updateLearningObjective,
  deleteLearningObjective,
  importLearningObjectives,
} from "@/services/learning-objective.service";
import type {
  LearningObjectiveDto,
  LearningObjectiveCreateDto,
  LearningObjectiveUpdateDto,
  LearningObjectiveImportItem,
} from "@/dtos/learning-objective.dto";

export default function LearningObjectivesInner() {
  const [objectives, setObjectives] = useState<LearningObjectiveDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(
    undefined
  );

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [currentObjective, setCurrentObjective] =
    useState<LearningObjectiveDto | null>(null);

  // Form state
  const [formData, setFormData] = useState<
    LearningObjectiveCreateDto | LearningObjectiveUpdateDto
  >({
    domain: "",
    title: "",
    description: "",
    level: "",
    order: 0,
    active: true,
  });

  // Import state
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    fetchObjectives();
  }, [page, searchQuery, domainFilter, levelFilter, activeFilter]);

  async function fetchObjectives() {
    setLoading(true);
    setError(null);

    try {
      const response = await listLearningObjectives({
        page,
        limit,
        domain: domainFilter || undefined,
        level: levelFilter || undefined,
        active: activeFilter,
        search: searchQuery || undefined,
      });

      setObjectives(response.items);
      setTotal(response.total);
    } catch (err) {
      console.error("Error fetching learning objectives:", err);
      setError("Er is een fout opgetreden bij het ophalen van de leerdoelen.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setFormData({
      domain: "",
      title: "",
      description: "",
      level: "",
      order: 0,
      active: true,
    });
    setIsCreateModalOpen(true);
  }

  function openEditModal(objective: LearningObjectiveDto) {
    setCurrentObjective(objective);
    setFormData({
      domain: objective.domain || "",
      title: objective.title,
      description: objective.description || "",
      level: objective.level || "",
      order: objective.order,
      active: objective.active,
    });
    setIsEditModalOpen(true);
  }

  async function handleCreate() {
    if (!formData.title) {
      alert("Titel is verplicht");
      return;
    }

    try {
      await createLearningObjective(
        formData as LearningObjectiveCreateDto
      );
      setIsCreateModalOpen(false);
      fetchObjectives();
    } catch (err) {
      console.error("Error creating learning objective:", err);
      alert("Er is een fout opgetreden bij het aanmaken van het leerdoel.");
    }
  }

  async function handleUpdate() {
    if (!currentObjective) return;

    try {
      await updateLearningObjective(
        currentObjective.id,
        formData as LearningObjectiveUpdateDto
      );
      setIsEditModalOpen(false);
      setCurrentObjective(null);
      fetchObjectives();
    } catch (err) {
      console.error("Error updating learning objective:", err);
      alert("Er is een fout opgetreden bij het bijwerken van het leerdoel.");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Weet je zeker dat je dit leerdoel wilt verwijderen?")) {
      return;
    }

    try {
      await deleteLearningObjective(id);
      fetchObjectives();
    } catch (err) {
      console.error("Error deleting learning objective:", err);
      alert("Er is een fout opgetreden bij het verwijderen van het leerdoel.");
    }
  }

  async function handleImport() {
    if (!importText.trim()) {
      alert("Voer CSV-gegevens in");
      return;
    }

    try {
      // Parse CSV (simple implementation - expects: domain,title,description,level,order,active)
      const lines = importText.trim().split("\n");
      const items: LearningObjectiveImportItem[] = [];

      // Skip header if present
      const startIdx = lines[0].toLowerCase().includes("domain") ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",").map((p) => p.trim());
        if (parts.length < 2) continue;

        items.push({
          domain: parts[0] || null,
          title: parts[1],
          description: parts[2] || null,
          level: parts[3] || null,
          order: parts[4] ? parseInt(parts[4], 10) : 0,
          active: parts[5] ? parts[5].toLowerCase() === "true" : true,
        });
      }

      const result = await importLearningObjectives({ items });
      setImportResult(result);
      if (result.errors.length === 0) {
        fetchObjectives();
      }
    } catch (err) {
      console.error("Error importing learning objectives:", err);
      alert("Er is een fout opgetreden bij het importeren.");
    }
  }

  const totalPages = Math.ceil(total / limit);

  if (loading && objectives.length === 0) {
    return (
      <div className="p-8">
        <div className="text-center">Laden...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Leerdoelen / Eindtermen</h1>
        <p className="text-gray-600">
          Beheer leerdoelen en koppel ze aan rubrieken voor rapportage en
          voortgangsmonitoring.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Nieuw Leerdoel
        </button>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Importeer CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded">
        <div>
          <label className="block text-sm font-medium mb-1">Zoeken</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Titel of beschrijving..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Domein</label>
          <input
            type="text"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            placeholder="A, B, C, D, E..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Niveau</label>
          <input
            type="text"
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            placeholder="VWO, HAVO..."
            className="w-full px-3 py-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={
              activeFilter === undefined ? "" : activeFilter ? "true" : "false"
            }
            onChange={(e) =>
              setActiveFilter(
                e.target.value === "" ? undefined : e.target.value === "true"
              )
            }
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">Alle</option>
            <option value="true">Actief</option>
            <option value="false">Inactief</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nr
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Domein
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Titel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Niveau
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Acties
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {objectives.map((obj) => (
              <tr key={obj.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm">{obj.order}</td>
                <td className="px-6 py-4 text-sm">{obj.domain || "-"}</td>
                <td className="px-6 py-4 text-sm font-medium">{obj.title}</td>
                <td className="px-6 py-4 text-sm">{obj.level || "-"}</td>
                <td className="px-6 py-4 text-sm">
                  {obj.active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      Actief
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                      Inactief
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openEditModal(obj)}
                    className="text-blue-600 hover:text-blue-800 mr-3"
                  >
                    Bewerken
                  </button>
                  <button
                    onClick={() => handleDelete(obj.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {objectives.length === 0 && !loading && (
          <div className="text-center py-8 text-gray-500">
            Geen leerdoelen gevonden
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Vorige
          </button>
          <span className="px-4 py-2">
            Pagina {page} van {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded disabled:opacity-50"
          >
            Volgende
          </button>
        </div>
      )}

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Nieuw Leerdoel</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Domein
                </label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  placeholder="A, B, C, D - Ontwerpen, E"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Conceptontwikkeling"
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Ontwerprichtingen genereren en onderbouwen"
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Niveau</label>
                <input
                  type="text"
                  value={formData.level || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                  placeholder="VWO, HAVO, VMBO"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nummer/Volgorde
                </label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.active !== false}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Actief</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Aanmaken
              </button>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && currentObjective && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Leerdoel Bewerken</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Domein
                </label>
                <input
                  type="text"
                  value={formData.domain || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, domain: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={formData.title || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Niveau</label>
                <input
                  type="text"
                  value={formData.level || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, level: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Nummer/Volgorde
                </label>
                <input
                  type="number"
                  value={formData.order || 0}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      order: parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.active !== false}
                    onChange={(e) =>
                      setFormData({ ...formData, active: e.target.checked })
                    }
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">Actief</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Opslaan
              </button>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setCurrentObjective(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              Importeer Leerdoelen (CSV)
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Formaat: domain,title,description,level,order,active
              <br />
              Bijvoorbeeld: D - Ontwerpen,Conceptontwikkeling,Ontwerprichtingen
              genereren,VWO,9,true
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Plak CSV-gegevens hier..."
              className="w-full px-3 py-2 border rounded font-mono text-sm"
              rows={10}
            />
            {importResult && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium">Resultaat:</p>
                <p>Aangemaakt: {importResult.created}</p>
                <p>Bijgewerkt: {importResult.updated}</p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium text-red-600">Fouten:</p>
                    <ul className="list-disc list-inside text-sm">
                      {importResult.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleImport}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Importeren
              </button>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportText("");
                  setImportResult(null);
                }}
                className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { competencyService } from "@/services/competency.service";
import type { 
  ExternalInvite, 
  ExternalInviteCreate, 
  Competency 
} from "@/dtos/competency.dto";

interface ExternalInviteModalProps {
  windowId: number;
  subjectUserId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function ExternalInviteModal({
  windowId,
  subjectUserId,
  onClose,
  onSuccess,
}: ExternalInviteModalProps) {
  const [emails, setEmails] = useState<string[]>([""]);
  const [externalName, setExternalName] = useState("");
  const [externalOrg, setExternalOrg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [selectedCompetencies, setSelectedCompetencies] = useState<number[]>([]);
  const [loadingCompetencies, setLoadingCompetencies] = useState(true);

  useEffect(() => {
    loadCompetencies();
  }, []);

  const loadCompetencies = async () => {
    try {
      setLoadingCompetencies(true);
      const comps = await competencyService.getCompetencies(true);
      setCompetencies(comps);
      // By default, select all competencies
      setSelectedCompetencies(comps.map((c) => c.id));
    } catch (err) {
      console.error("Failed to load competencies:", err);
      setError("Competenties laden mislukt. Probeer het opnieuw.");
    } finally {
      setLoadingCompetencies(false);
    }
  };

  const toggleCompetency = (competencyId: number) => {
    setSelectedCompetencies((prev) =>
      prev.includes(competencyId)
        ? prev.filter((id) => id !== competencyId)
        : [...prev, competencyId]
    );
  };

  const toggleAllCompetencies = () => {
    if (selectedCompetencies.length === competencies.length) {
      setSelectedCompetencies([]);
    } else {
      setSelectedCompetencies(competencies.map((c) => c.id));
    }
  };

  const addEmailField = () => {
    setEmails([...emails, ""]);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const updateEmail = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Better email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validEmails = emails.filter(
      (email) => email.trim() && emailRegex.test(email.trim())
    );

    if (validEmails.length === 0) {
      setError("Voer ten minste één geldig e-mailadres in.");
      return;
    }

    // Check for invalid emails
    const invalidEmails = emails.filter(
      (email) => email.trim() && !emailRegex.test(email.trim())
    );
    if (invalidEmails.length > 0) {
      setError(
        `Ongeldig e-mailformaat: ${invalidEmails.join(", ")}. Corrigeer dit en probeer opnieuw.`
      );
      return;
    }

    // Validate that at least one competency is selected
    if (selectedCompetencies.length === 0) {
      setError("Selecteer ten minste één competentie voor de externe beoordelaar om te beoordelen.");
      return;
    }

    try {
      setSubmitting(true);
      const data: ExternalInviteCreate = {
        window_id: windowId,
        subject_user_id: subjectUserId,
        emails: validEmails,
        external_name: externalName || undefined,
        external_organization: externalOrg || undefined,
        competency_ids: selectedCompetencies,
      };

      await competencyService.createExternalInvites(data);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || "Aanmaken uitnodigingen mislukt. Probeer het opnieuw."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Nodig Externe Beoordelaars Uit
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Privacy Melding:</strong> Je deelt een beoordelingsverzoek
              met een externe persoon. Nodig alleen mensen uit die je vertrouwt. Zij ontvangen
              een eenmalige link om jouw competenties te beoordelen.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              {/* Email Addresses */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mailadressen *
                </label>
                <div className="space-y-2">
                  {emails.map((email, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="beoordelaar@voorbeeld.nl"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required={index === 0}
                      />
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmailField(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                        >
                          Verwijder
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {emails.length < 10 && (
                  <button
                    type="button"
                    onClick={addEmailField}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Voeg nog een e-mail toe
                  </button>
                )}
              </div>

              {/* External Name (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naam (Optioneel)
                </label>
                <input
                  type="text"
                  value={externalName}
                  onChange={(e) => setExternalName(e.target.value)}
                  placeholder="Naam beoordelaar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* External Organization (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organisatie (Optioneel)
                </label>
                <input
                  type="text"
                  value={externalOrg}
                  onChange={(e) => setExternalOrg(e.target.value)}
                  placeholder="Bedrijf of organisatie"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Competency Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Selecteer Competenties om te Beoordelen *
                  </label>
                  <button
                    type="button"
                    onClick={toggleAllCompetencies}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    {selectedCompetencies.length === competencies.length
                      ? "Deselecteer Alles"
                      : "Selecteer Alles"}
                  </button>
                </div>
                {loadingCompetencies ? (
                  <div className="text-sm text-gray-500">Competenties laden...</div>
                ) : (
                  <div className="border border-gray-300 rounded-md p-3 max-h-60 overflow-y-auto">
                    {competencies.length === 0 ? (
                      <div className="text-sm text-gray-500">
                        Geen competenties beschikbaar
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {competencies.map((comp) => (
                          <label
                            key={comp.id}
                            className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={selectedCompetencies.includes(comp.id)}
                              onChange={() => toggleCompetency(comp.id)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {comp.name}
                              </div>
                              {comp.description && (
                                <div className="text-xs text-gray-600 mt-0.5">
                                  {comp.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-1 text-xs text-gray-600">
                  {selectedCompetencies.length} van {competencies.length} geselecteerd
                </div>
              </div>

              {/* Information Box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">
                  Wat gebeurt er nu?
                </h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Uitnodigingen worden verstuurd naar de opgegeven e-mailadressen</li>
                  <li>
                    • Elke uitnodiging bevat een unieke, eenmalig te gebruiken link
                  </li>
                  <li>• Links verlopen na 14 dagen</li>
                  <li>
                    • Externe beoordelaars zien jouw naam en de geselecteerde
                    competenties om te beoordelen
                  </li>
                  <li>
                    • Je ziet alleen de gecombineerde scores van externe beoordelaars
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "Verzenden..." : "Verstuur Uitnodigingen"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

interface ExternalInviteListProps {
  windowId: number;
  subjectUserId: number;
}

export function ExternalInviteList({
  windowId,
  subjectUserId,
}: ExternalInviteListProps) {
  const [invites, setInvites] = useState<ExternalInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvites();
  }, [windowId, subjectUserId]);

  const loadInvites = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await competencyService.getExternalInvites(
        windowId,
        subjectUserId
      );
      setInvites(data);
    } catch (err: any) {
      setError("Uitnodigingen laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (inviteId: number) => {
    if (!confirm("Weet je zeker dat je deze uitnodiging wilt intrekken?")) {
      return;
    }

    try {
      await competencyService.revokeExternalInvite(inviteId);
      loadInvites();
    } catch (err: any) {
      alert("Intrekken van uitnodiging mislukt");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      used: "bg-green-100 text-green-800",
      revoked: "bg-red-100 text-red-800",
      expired: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = {
      pending: "In afwachting",
      used: "Gebruikt",
      revoked: "Ingetrokken",
      expired: "Verlopen",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-medium rounded ${
          colors[status] || "bg-gray-100 text-gray-800"
        }`}
      >
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return <div className="text-sm text-gray-600">Uitnodigingen laden...</div>;
  }

  if (error) {
    return <div className="text-sm text-red-600">{error}</div>;
  }

  if (invites.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        Nog geen externe uitnodigingen. Klik op "Nodig Externen Uit" om uitnodigingen te versturen.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              E-mail
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Verstuurd
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Verloopt
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
              Acties
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {invites.map((invite) => (
            <tr key={invite.id}>
              <td className="px-4 py-2 text-sm text-gray-900">{invite.email}</td>
              <td className="px-4 py-2">{getStatusBadge(invite.status)}</td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {invite.sent_at
                  ? new Date(invite.sent_at).toLocaleDateString()
                  : "-"}
              </td>
              <td className="px-4 py-2 text-sm text-gray-600">
                {new Date(invite.expires_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-2">
                {invite.status === "pending" && (
                  <button
                    onClick={() => handleRevoke(invite.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Intrekken
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

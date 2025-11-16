"use client";

import { useState } from "react";
import { clientService } from "@/services";
import { ClientLogCreate } from "@/dtos/client.dto";

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientId: number;
}

export function AddNoteModal({ isOpen, onClose, onSuccess, clientId }: AddNoteModalProps) {
  const [formData, setFormData] = useState<ClientLogCreate>({
    log_type: "Notitie",
    text: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await clientService.createLogEntry(clientId, formData);
      onSuccess();
      onClose();
      // Reset form
      setFormData({
        log_type: "Notitie",
        text: "",
      });
    } catch (err: any) {
      setError(err.message || "Fout bij toevoegen van notitie");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-30 transition-opacity" onClick={onClose} />
        <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-slate-900 mb-4">
            Nieuwe notitie toevoegen
          </h2>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Type
              </label>
              <select
                value={formData.log_type}
                onChange={(e) => setFormData({ ...formData, log_type: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              >
                <option value="Notitie">Notitie</option>
                <option value="Telefoongesprek">Telefoongesprek</option>
                <option value="Meeting">Meeting</option>
                <option value="Email">Email</option>
                <option value="Andere">Andere</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Notitie <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                rows={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="Voer hier je notitie in..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {loading ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

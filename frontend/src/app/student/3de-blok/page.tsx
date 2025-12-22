"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  MapPin, 
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  Award
} from "lucide-react";
import { attendanceService, type AttendanceTotals } from "@/services/attendance.service";

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} uur ${minutes} min`;
  }
  return `${minutes} minuten`;
}

export default function Student3deBlokPage() {
  const [totals, setTotals] = useState<AttendanceTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    check_in: "",
    check_out: "",
    location: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTotals();
  }, []);

  const fetchTotals = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await attendanceService.getMyAttendance();
      setTotals(data);
    } catch (err) {
      console.error("Error fetching totals:", err);
      setError("Kon aanwezigheidsgegevens niet ophalen");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitExternalWork = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.check_in || !formData.check_out || !formData.location || !formData.description) {
      alert("Vul alle velden in");
      return;
    }

    try {
      setSubmitting(true);
      await attendanceService.createExternalWork({
        check_in: new Date(formData.check_in).toISOString(),
        check_out: new Date(formData.check_out).toISOString(),
        location: formData.location,
        description: formData.description,
      });
      
      alert("Extern werk succesvol ingediend!");
      setShowForm(false);
      setFormData({
        check_in: "",
        check_out: "",
        location: "",
        description: "",
      });
      fetchTotals();
    } catch (err) {
      console.error("Error submitting external work:", err);
      alert("Fout bij indienen");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">3de Blok - Mijn Aanwezigheid</h1>
        <p className="text-gray-600 mt-1">
          Bekijk je aanwezigheidsuren en registreer extern werk
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {totals && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">School uren</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(totals.total_school_seconds)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Extern goedgekeurd</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(totals.total_external_approved_seconds)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">Extern in afwachting</p>
                  <p className="text-2xl font-bold">
                    {formatDuration(totals.total_external_pending_seconds)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">Lesblokken</p>
                  <p className="text-2xl font-bold">{totals.lesson_blocks}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Info Card */}
          <Card className="p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">Wat zijn lesblokken?</h3>
                <p className="text-sm text-gray-700">
                  Elk lesblok is 75 minuten (1 uur en 15 minuten). Je totale aanwezigheid 
                  (school + goedgekeurd extern werk) wordt automatisch omgerekend naar lesblokken.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  <strong>Totaal:</strong> {formatDuration(totals.total_school_seconds + totals.total_external_approved_seconds)} = {totals.lesson_blocks} lesblokken
                </p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* Register External Work */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Extern Werk Registreren
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Registreer werk dat je buiten school hebt gedaan (bijvoorbeeld stage of project werk)
            </p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              Nieuwe registratie
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmitExternalWork} className="space-y-4 mt-4 border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start datum en tijd *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.check_in}
                  onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Eind datum en tijd *
                </label>
                <Input
                  type="datetime-local"
                  value={formData.check_out}
                  onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Locatie *
              </label>
              <Input
                type="text"
                placeholder="Bijvoorbeeld: Stage bij Bedrijf XYZ"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Beschrijving *
              </label>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={4}
                placeholder="Beschrijf wat je hebt gedaan..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Indienen..." : "Indienen"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Annuleren
              </Button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="font-medium text-yellow-800">Let op:</p>
              <p className="text-yellow-700 mt-1">
                Je registratie moet goedgekeurd worden door een docent voordat deze meetelt 
                voor je lesblokken. Je ontvangt een bericht zodra je registratie is behandeld.
              </p>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

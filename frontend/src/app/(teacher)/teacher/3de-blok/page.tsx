"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Users, TrendingUp, List, MapPin, ArrowRight, CreditCard, BarChart3 } from "lucide-react";
import { fetchWithErrorHandling } from "@/lib/api";

interface OpenSession {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  class_name: string | null;
  check_in: string;
  project_id: number | null;
  project_name: string | null;
  duration_seconds: number;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}u ${minutes}m`;
  }
  return `${minutes}m`;
}

export default function AttendanceDashboardPage() {
  const [openSessions, setOpenSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPresence();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPresence = async () => {
    try {
      setError(null);
      const response = await fetchWithErrorHandling("/api/v1/attendance/presence");
      const data = await response.json();
      setOpenSessions(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error fetching presence:", err);
      setError(`Kon aanwezigheidsgegevens niet ophalen: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = openSessions.filter((session) =>
    session.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (session.class_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const groupedByClass = filteredSessions.reduce((acc, session) => {
    const className = session.class_name || "Geen klas";
    if (!acc[className]) {
      acc[className] = [];
    }
    acc[className].push(session);
    return acc;
  }, {} as Record<string, OpenSession[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Aanwezigheid laden...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">3de Blok - Aanwezigheid</h1>
          <p className="text-gray-600 mt-1 text-sm">
            Real-time overzicht van aanwezige studenten
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Stats Card */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
        <div className="flex items-center gap-4">
          <Users className="h-8 w-8 text-green-600" />
          <div>
            <p className="text-sm text-gray-600">Nu aanwezig</p>
            <p className="text-2xl font-semibold">{openSessions.length}</p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/teacher/3de-blok/events">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <List className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Alle gebeurtenissen</h3>
                  <p className="text-sm text-gray-600">Bekijk, filter en beheer alle check-ins</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </Link>

        <Link href="/teacher/3de-blok/extern">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Extern werk</h3>
                  <p className="text-sm text-gray-600">Goedkeuren of afwijzen van externe registraties</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </Link>

        <Link href="/teacher/3de-blok/rfid">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">RFID Kaarten</h3>
                  <p className="text-sm text-gray-600">Koppel en beheer RFID kaarten</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </Link>

        <Link href="/teacher/3de-blok/overzicht">
          <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <BarChart3 className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Overzicht</h3>
                  <p className="text-sm text-gray-600">Totalen per student</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-gray-200/80 rounded-xl p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <div className="flex items-center gap-4">
          <Input
            type="text"
            placeholder="Zoek op naam of klas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
          <Button onClick={fetchPresence} variant="outline">
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Presence List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600">Niemand aanwezig</h3>
          <p className="text-gray-500 mt-2">Er zijn momenteel geen studenten ingecheckt</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByClass)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([className, sessions]) => (
              <div key={className} className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Badge variant="outline" className="text-base">
                      {className}
                    </Badge>
                    <span className="text-sm text-gray-600">
                      ({sessions.length} {sessions.length === 1 ? "student" : "studenten"})
                    </span>
                  </h2>
                </div>
                
                <div className="grid gap-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-700 font-semibold">
                            {session.user_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{session.user_name}</p>
                          <p className="text-sm text-gray-600">{session.user_email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(session.check_in).toLocaleTimeString("nl-NL", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gray-600" />
                          <Badge variant="secondary">
                            {formatDuration(session.duration_seconds)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
      </div>
    </>
  );
}

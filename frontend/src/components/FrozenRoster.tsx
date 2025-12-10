/**
 * Frozen Roster Display Component
 * 
 * Displays a locked/frozen roster for an evaluation with project_team_id
 */

"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
import { projectTeamService } from "@/services/project-team.service";
import type { ProjectTeamMember } from "@/dtos/project-team.dto";

type FrozenRosterProps = {
  projectTeamId: number;
  closedAt?: string | null;
  isLegacy?: boolean;
};

export default function FrozenRoster({ projectTeamId, closedAt, isLegacy = false }: FrozenRosterProps) {
  const [members, setMembers] = useState<ProjectTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await projectTeamService.getProjectTeamMembers(projectTeamId);
        setMembers(data);
      } catch (e: any) {
        console.error("Failed to load roster members:", e);
        setError("Kon teamleden niet laden");
      } finally {
        setLoading(false);
      }
    };

    if (projectTeamId) {
      loadMembers();
    }
  }, [projectTeamId]);

  if (isLegacy) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-medium text-amber-900">Legacy evaluatie</p>
            <p className="text-sm text-amber-800 mt-1">
              Deze evaluatie gebruikt de oude teamindeling. Rosterinformatie kan afwijken van de huidige teams.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white border border-gray-200 p-6 mb-6">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900">Team Roster (Frozen)</h3>
        </div>
        <p className="text-sm text-gray-600">
          Deze evaluatie is gekoppeld aan een vastgelegde teamsamenstelling.
        </p>
        {closedAt && (
          <p className="text-xs text-gray-500 mt-1">
            Afgesloten op: {new Date(closedAt).toLocaleString("nl-NL")}
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-3 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-sm text-gray-600">Laden...</p>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-4 text-gray-500 text-sm">
          Geen leden in dit team
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className={`border rounded-lg p-3 ${
                member.user_status === "inactive"
                  ? "bg-gray-50 border-gray-200"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {member.user_name || "Onbekend"}
                    {member.user_status === "inactive" && (
                      <span className="ml-2 text-xs text-gray-500">(Inactief)</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{member.user_email}</p>
                  {member.role && (
                    <p className="text-xs text-gray-500 mt-1">Rol: {member.role}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

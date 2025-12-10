interface TeamInfo {
  teamNumber: number;
  displayName: string;
  memberCount: number;
}

interface TeamFilterProps {
  teams: TeamInfo[];
  selectedTeam: number | null;
  onTeamChange: (teamNumber: number | null) => void;
}

export function TeamFilter({
  teams,
  selectedTeam,
  onTeamChange,
}: TeamFilterProps) {
  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="team-filter" className="text-sm font-medium">
        Filter op team:
      </label>
      <select
        id="team-filter"
        value={selectedTeam ?? ""}
        onChange={(e) =>
          onTeamChange(e.target.value ? Number(e.target.value) : null)
        }
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">Alle teams</option>
        {teams.map((team) => (
          <option key={team.teamNumber} value={team.teamNumber}>
            Team {team.teamNumber} · {team.memberCount} leden
          </option>
        ))}
      </select>
    </div>
  );
}

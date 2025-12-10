import { EvaluationTeamMember } from "@/dtos/evaluation.dto";

interface TeamMembersListProps {
  members: EvaluationTeamMember[];
  showAllocatedStatus?: boolean;
}

export function TeamMembersList({
  members,
  showAllocatedStatus = false,
}: TeamMembersListProps) {
  if (members.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">Geen teamleden</div>
    );
  }

  // Helper function to safely get initials from full name
  const getInitials = (name: string): string => {
    if (!name || name.length === 0) return "??";
    
    // Split name into words and take first letter of each word
    const words = name.trim().split(/\s+/);
    if (words.length === 0) return "??";
    
    if (words.length === 1) {
      // Single word: take first two characters if available
      const word = words[0];
      return word.length === 1 
        ? word.toUpperCase() 
        : word.substring(0, 2).toUpperCase();
    }
    
    // Multiple words: take first letter of first two words
    return (words[0][0] + words[1][0]).toUpperCase();
  };

  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          key={member.user_id}
          className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium">
              {getInitials(member.name)}
            </div>
            <div>
              <div className="font-medium text-sm">{member.name}</div>
              <div className="text-xs text-gray-500">{member.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {showAllocatedStatus && (
              <div>
                {member.is_allocated ? (
                  <span className="text-xs text-green-600">✓ Toegewezen</span>
                ) : (
                  <span className="text-xs text-gray-400">Niet toegewezen</span>
                )}
              </div>
            )}
            {member.role && (
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {member.role}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

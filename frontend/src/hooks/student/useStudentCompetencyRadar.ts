import { useQuery } from "@tanstack/react-query";
import { studentService } from "@/services/student.service";

export interface ScanListItem {
  id: string;
  title: string;
  date: string;
  type: string;
}

export interface RadarCategoryScore {
  category_id: number;
  category_name: string;
  average_score: number;
  count: number;
}

export interface ScanRadarData {
  scan_id: string;
  scan_label: string;
  created_at: string;
  categories: RadarCategoryScore[];
  overall_avg?: number;
}

/**
 * Hook to fetch list of student's competency scans
 */
export function useStudentCompetencyScans() {
  return useQuery<ScanListItem[]>({
    queryKey: ["studentCompetencyScans"],
    queryFn: async () => {
      const response = await fetch("/api/v1/student/competency/scans", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch scans");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch radar data for a specific scan
 */
export function useStudentCompetencyRadar(scanId: string | null) {
  return useQuery<ScanRadarData>({
    queryKey: ["studentCompetencyRadar", scanId],
    queryFn: async () => {
      if (!scanId) {
        throw new Error("Scan ID is required");
      }
      const response = await fetch(
        `/api/v1/student/competency/scans/${scanId}/radar`,
        {
          credentials: "include",
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch radar data");
      }
      return response.json();
    },
    enabled: !!scanId, // Only fetch when scanId is provided
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

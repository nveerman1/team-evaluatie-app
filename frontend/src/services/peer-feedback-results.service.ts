import api from "@/lib/api";
import { EvaluationResult } from "@/dtos";

export const peerFeedbackResultsService = {
  /**
   * Get peer feedback results for the current student across all evaluations.
   * Returns data in OMZA format for the student results page.
   */
  async getMyPeerResults(): Promise<EvaluationResult[]> {
    const { data } = await api.get<EvaluationResult[]>("/evaluations/my/peer-results");
    return data || [];
  },
};

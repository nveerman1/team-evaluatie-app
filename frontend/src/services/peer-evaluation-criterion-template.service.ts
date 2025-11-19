import type {
  PeerEvaluationCriterionTemplateDto,
  PeerEvaluationCriterionTemplateCreateDto,
  PeerEvaluationCriterionTemplateUpdateDto,
} from "@/dtos/peer-evaluation-criterion-template.dto";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function listPeerCriteria(
  subjectId: number
): Promise<PeerEvaluationCriterionTemplateDto[]> {
  const response = await fetch(
    `${API_BASE}/api/v1/templates/peer-criteria?subject_id=${subjectId}`,
    {
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch peer criteria");
  }
  const data = await response.json();
  return data.items || [];
}

export async function createPeerCriterion(
  data: PeerEvaluationCriterionTemplateCreateDto
): Promise<PeerEvaluationCriterionTemplateDto> {
  const response = await fetch(`${API_BASE}/api/v1/templates/peer-criteria`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create peer criterion");
  }
  return response.json();
}

export async function updatePeerCriterion(
  id: number,
  data: PeerEvaluationCriterionTemplateUpdateDto
): Promise<PeerEvaluationCriterionTemplateDto> {
  const response = await fetch(
    `${API_BASE}/api/v1/templates/peer-criteria/${id}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(data),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update peer criterion");
  }
  return response.json();
}

export async function deletePeerCriterion(id: number): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/v1/templates/peer-criteria/${id}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );
  if (!response.ok) {
    throw new Error("Failed to delete peer criterion");
  }
}

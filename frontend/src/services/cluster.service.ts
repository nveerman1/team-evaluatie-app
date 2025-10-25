import api from "@/lib/api";
import type { ClusterOptionDto } from "@/dtos/cluster.dto";

export async function getClusters(): Promise<ClusterOptionDto[]> {
  const { data } = await api.get<ClusterOptionDto[]>("/clusters");
  return data;
}

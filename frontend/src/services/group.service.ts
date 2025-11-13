import api from "@/lib/api";
import {
  Group,
  GroupCreate,
  GroupUpdate,
  GroupWithMembers,
  GroupListResponse,
  GroupMember,
  GroupMemberCreate,
} from "@/dtos/group.dto";

export const groupService = {
  /**
   * Get paginated list of groups with filtering
   */
  async listGroups(params?: {
    page?: number;
    per_page?: number;
    course_id?: number;
    team_number?: number;
  }): Promise<GroupListResponse> {
    const response = await api.get<GroupListResponse>("/groups", { params });
    return response.data;
  },

  /**
   * Get a specific group by ID
   */
  async getGroup(groupId: number): Promise<GroupWithMembers> {
    const response = await api.get<GroupWithMembers>(`/groups/${groupId}`);
    return response.data;
  },

  /**
   * Create a new group
   */
  async createGroup(data: GroupCreate): Promise<Group> {
    const response = await api.post<Group>("/groups", data);
    return response.data;
  },

  /**
   * Update a group
   */
  async updateGroup(groupId: number, data: GroupUpdate): Promise<Group> {
    const response = await api.patch<Group>(`/groups/${groupId}`, data);
    return response.data;
  },

  /**
   * Delete a group
   */
  async deleteGroup(groupId: number): Promise<void> {
    await api.delete(`/groups/${groupId}`);
  },

  /**
   * Get members of a group
   */
  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const response = await api.get<GroupMember[]>(`/groups/${groupId}/members`);
    return response.data;
  },

  /**
   * Add a member to a group
   */
  async addGroupMember(
    groupId: number,
    data: GroupMemberCreate
  ): Promise<GroupMember> {
    const response = await api.post<GroupMember>(
      `/groups/${groupId}/members`,
      data
    );
    return response.data;
  },

  /**
   * Remove a member from a group
   */
  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${userId}`);
  },
};

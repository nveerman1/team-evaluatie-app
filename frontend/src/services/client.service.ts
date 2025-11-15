import api from "@/lib/api";
import {
  Client,
  ClientListItem,
  ClientListResponse,
  ClientCreate,
  ClientUpdate,
  ClientLog,
  ClientLogCreate,
  ClientLogListResponse,
  ClientProject,
  ClientProjectListResponse,
  Reminder,
  ReminderListResponse,
} from "@/dtos/client.dto";

export const clientService = {
  /**
   * Get paginated list of clients with filtering
   */
  async listClients(params?: {
    page?: number;
    per_page?: number;
    level?: string;
    status?: string;
    search?: string;
  }): Promise<ClientListResponse> {
    const response = await api.get<ClientListResponse>("/clients", { params });
    return response.data;
  },

  /**
   * Get a specific client by ID
   */
  async getClient(clientId: number): Promise<Client> {
    const response = await api.get<Client>(`/clients/${clientId}`);
    return response.data;
  },

  /**
   * Create a new client
   */
  async createClient(data: ClientCreate): Promise<Client> {
    const response = await api.post<Client>("/clients", data);
    return response.data;
  },

  /**
   * Update a client
   */
  async updateClient(clientId: number, data: ClientUpdate): Promise<Client> {
    const response = await api.put<Client>(`/clients/${clientId}`, data);
    return response.data;
  },

  /**
   * Delete a client
   */
  async deleteClient(clientId: number): Promise<void> {
    await api.delete(`/clients/${clientId}`);
  },

  /**
   * Get log entries for a client
   */
  async getClientLog(clientId: number): Promise<ClientLogListResponse> {
    const response = await api.get<ClientLogListResponse>(
      `/clients/${clientId}/log`
    );
    return response.data;
  },

  /**
   * Create a new log entry for a client
   */
  async createLogEntry(
    clientId: number,
    data: ClientLogCreate
  ): Promise<ClientLog> {
    const response = await api.post<ClientLog>(
      `/clients/${clientId}/log`,
      data
    );
    return response.data;
  },

  /**
   * Get projects linked to a client
   */
  async getClientProjects(
    clientId: number
  ): Promise<ClientProjectListResponse> {
    const response = await api.get<ClientProjectListResponse>(
      `/clients/${clientId}/projects`
    );
    return response.data;
  },

  /**
   * Get upcoming reminders for client communications
   */
  async getUpcomingReminders(): Promise<ReminderListResponse> {
    const response = await api.get<ReminderListResponse>(
      "/clients/upcoming-reminders"
    );
    return response.data;
  },
};

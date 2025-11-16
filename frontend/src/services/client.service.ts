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
  EmailTemplateListResponse,
  RenderedEmail,
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
  async getUpcomingReminders(
    daysAhead?: number
  ): Promise<ReminderListResponse> {
    const response = await api.get<ReminderListResponse>(
      "/clients/upcoming-reminders",
      { params: { days_ahead: daysAhead } }
    );
    return response.data;
  },

  /**
   * Export clients to CSV
   */
  async exportClientsCSV(params?: {
    level?: string;
    status?: string;
    search?: string;
  }): Promise<Blob> {
    const response = await api.get("/clients/export/csv", {
      params,
      responseType: "blob",
    });
    return response.data;
  },

  /**
   * List available email templates
   */
  async listEmailTemplates(): Promise<EmailTemplateListResponse> {
    const response = await api.get<EmailTemplateListResponse>(
      "/clients/templates"
    );
    return response.data;
  },

  /**
   * Render an email template with variables
   */
  async renderEmailTemplate(
    templateKey: string,
    variables: Record<string, any>
  ): Promise<RenderedEmail> {
    const response = await api.post<RenderedEmail>(
      `/clients/templates/${templateKey}/render`,
      variables
    );
    return response.data;
  },
};

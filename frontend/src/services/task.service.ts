import api from "@/lib/api";
import {
  Task,
  TaskListResponse,
  TaskCreate,
  TaskUpdate,
  TaskFilters,
} from "@/dtos/task.dto";

export const taskService = {
  /**
   * Get paginated list of tasks with filtering
   */
  async listTasks(filters?: TaskFilters): Promise<TaskListResponse> {
    const response = await api.get<TaskListResponse>("/teacher/tasks", {
      params: filters,
    });
    return response.data;
  },

  /**
   * Create a new task
   */
  async createTask(data: TaskCreate): Promise<Task> {
    const response = await api.post<Task>("/teacher/tasks", data);
    return response.data;
  },

  /**
   * Update a task
   */
  async updateTask(taskId: number, data: TaskUpdate): Promise<Task> {
    const response = await api.patch<Task>(`/teacher/tasks/${taskId}`, data);
    return response.data;
  },

  /**
   * Delete a task
   */
  async deleteTask(taskId: number): Promise<void> {
    await api.delete(`/teacher/tasks/${taskId}`);
  },

  /**
   * Mark a task as complete
   */
  async completeTask(taskId: number): Promise<Task> {
    const response = await api.post<Task>(`/teacher/tasks/${taskId}/complete`);
    return response.data;
  },

  /**
   * Generate mailto link for a task
   */
  generateMailtoLink(task: Task): string {
    const to = task.email_to || task.client_email || "";
    const cc = task.email_cc || "";
    const subject = encodeURIComponent(task.title || "");
    
    // Build email body with task context
    let bodyParts: string[] = [];
    
    if (task.project_name) {
      bodyParts.push(`Project: ${task.project_name}`);
    }
    if (task.client_name) {
      bodyParts.push(`Opdrachtgever: ${task.client_name}`);
    }
    if (task.class_name) {
      bodyParts.push(`Klas: ${task.class_name}`);
    }
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      bodyParts.push(`Deadline: ${dueDate.toLocaleDateString("nl-NL")}`);
    }
    if (task.description) {
      bodyParts.push("");
      bodyParts.push(task.description);
    }
    
    bodyParts.push("");
    bodyParts.push("---");
    bodyParts.push("Deze email is gegenereerd vanuit de Team Evaluatie App.");
    
    const body = encodeURIComponent(bodyParts.join("\n"));
    
    let mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    
    if (cc) {
      mailtoUrl += `&cc=${cc}`;
    }
    
    return mailtoUrl;
  },
};

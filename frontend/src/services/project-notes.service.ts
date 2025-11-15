// frontend/src/services/project-notes.service.ts
import api from "@/lib/api";
import {
  ProjectNotesContext,
  ProjectNotesContextCreate,
  ProjectNotesContextUpdate,
  ProjectNotesContextDetail,
  ProjectNote,
  ProjectNoteCreate,
  ProjectNoteUpdate,
} from "@/dtos/project-notes.dto";

export const projectNotesService = {
  /**
   * List all project note contexts for the current teacher
   */
  async listContexts(params?: {
    course_id?: number;
    class_name?: string;
  }): Promise<ProjectNotesContext[]> {
    const sp = new URLSearchParams();
    if (params?.course_id) sp.set("course_id", String(params.course_id));
    if (params?.class_name) sp.set("class_name", params.class_name);

    const { data } = await api.get<ProjectNotesContext[]>(
      `/project-notes/contexts${sp.size ? `?${sp.toString()}` : ""}`,
    );
    return data ?? [];
  },

  /**
   * Create a new project notes context
   */
  async createContext(
    payload: ProjectNotesContextCreate,
  ): Promise<ProjectNotesContext> {
    const { data } = await api.post<ProjectNotesContext>(
      "/project-notes/contexts",
      payload,
    );
    return data;
  },

  /**
   * Get details of a specific project notes context
   */
  async getContext(contextId: number): Promise<ProjectNotesContextDetail> {
    const { data } = await api.get<ProjectNotesContextDetail>(
      `/project-notes/contexts/${contextId}`,
    );
    return data;
  },

  /**
   * Update a project notes context
   */
  async updateContext(
    contextId: number,
    payload: ProjectNotesContextUpdate,
  ): Promise<ProjectNotesContext> {
    const { data } = await api.put<ProjectNotesContext>(
      `/project-notes/contexts/${contextId}`,
      payload,
    );
    return data;
  },

  /**
   * Delete a project notes context and all its notes
   */
  async deleteContext(contextId: number): Promise<void> {
    await api.delete(`/project-notes/contexts/${contextId}`);
  },

  /**
   * Get all notes for a specific context with optional filters
   */
  async listNotes(
    contextId: number,
    params?: {
      note_type?: "project" | "team" | "student";
      team_id?: number;
      student_id?: number;
      omza_category?: string;
    },
  ): Promise<ProjectNote[]> {
    const sp = new URLSearchParams();
    if (params?.note_type) sp.set("note_type", params.note_type);
    if (params?.team_id) sp.set("team_id", String(params.team_id));
    if (params?.student_id) sp.set("student_id", String(params.student_id));
    if (params?.omza_category) sp.set("omza_category", params.omza_category);

    const { data } = await api.get<ProjectNote[]>(
      `/project-notes/contexts/${contextId}/notes${sp.size ? `?${sp.toString()}` : ""}`,
    );
    return data ?? [];
  },

  /**
   * Create a new note in the context
   */
  async createNote(
    contextId: number,
    payload: ProjectNoteCreate,
  ): Promise<ProjectNote> {
    const { data } = await api.post<ProjectNote>(
      `/project-notes/contexts/${contextId}/notes`,
      payload,
    );
    return data;
  },

  /**
   * Get a specific note by ID
   */
  async getNote(noteId: number): Promise<ProjectNote> {
    const { data } = await api.get<ProjectNote>(
      `/project-notes/notes/${noteId}`,
    );
    return data;
  },

  /**
   * Update a note
   */
  async updateNote(
    noteId: number,
    payload: ProjectNoteUpdate,
  ): Promise<ProjectNote> {
    const { data } = await api.put<ProjectNote>(
      `/project-notes/notes/${noteId}`,
      payload,
    );
    return data;
  },

  /**
   * Delete a specific note
   */
  async deleteNote(noteId: number): Promise<void> {
    await api.delete(`/project-notes/notes/${noteId}`);
  },

  /**
   * Get chronological timeline of all notes in a context
   */
  async getTimeline(contextId: number): Promise<ProjectNote[]> {
    const { data } = await api.get<ProjectNote[]>(
      `/project-notes/contexts/${contextId}/timeline`,
    );
    return data ?? [];
  },
};

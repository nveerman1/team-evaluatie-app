"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye,
  Pencil,
  MoreHorizontal,
  Plus,
  Search,
  X,
  GripVertical,
} from "lucide-react";

// ============================================================================
// Type definitions
// ============================================================================

type TaskStatus = "todo" | "in_progress" | "waiting" | "done";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  projectName?: string;
  className?: string;
  studentName?: string;
  assignees: string[];
  dueDate?: string;
  priority?: "low" | "medium" | "high";
  labels?: string[];
};

type ColumnConfig = {
  id: TaskStatus;
  title: string;
};

// ============================================================================
// Constants
// ============================================================================

const COLUMNS: ColumnConfig[] = [
  { id: "todo", title: "Te doen" },
  { id: "in_progress", title: "Mee bezig" },
  { id: "waiting", title: "Wachten op" },
  { id: "done", title: "Gedaan" },
];

const MOCK_PROJECTS = [
  "Dutch Wave Power",
  "Smart City Mobility",
  "Eco Building Design",
  "Health Tech Innovation",
];

const MOCK_ASSIGNEES = ["Nick Veerman", "Eva de Vries", "Mark Jansen", "Lisa Peters"];

const INITIAL_TASKS: Task[] = [
  {
    id: "1",
    title: "Feedback tussenpresentatie verwerken",
    description: "Feedback van de opdrachtgever verwerken en doorsturen naar team.",
    status: "todo",
    projectName: "Dutch Wave Power",
    className: "H3a",
    assignees: ["Nick Veerman"],
    dueDate: "2025-12-15",
    priority: "high",
    labels: ["feedback", "urgent"],
  },
  {
    id: "2",
    title: "Oudercontact inplannen met M. Janssen",
    description: "Gesprek over voortgang leerling plannen.",
    status: "todo",
    projectName: "Smart City Mobility",
    className: "V5b",
    studentName: "Thomas Janssen",
    assignees: ["Eva de Vries"],
    dueDate: "2025-12-20",
    priority: "medium",
    labels: ["oudercontact"],
  },
  {
    id: "3",
    title: "Rubric eindpresentatie aanpassen",
    description: "Criteria voor eindpresentatie bijwerken op basis van feedback sectie.",
    status: "in_progress",
    projectName: "Eco Building Design",
    assignees: ["Nick Veerman", "Mark Jansen"],
    dueDate: "2025-12-18",
    priority: "medium",
    labels: ["administratie"],
  },
  {
    id: "4",
    title: "Externe beoordelaar uitnodigen",
    description: "Contact opnemen met bedrijf voor externe beoordeling eindproduct.",
    status: "waiting",
    projectName: "Health Tech Innovation",
    className: "H4c",
    assignees: ["Lisa Peters"],
    dueDate: "2025-12-22",
    priority: "low",
    labels: ["extern"],
  },
  {
    id: "5",
    title: "Voortgangsrapport Q4 opstellen",
    description: "Kwartaalrapport voor sectie vergadering voorbereiden.",
    status: "in_progress",
    assignees: ["Nick Veerman"],
    dueDate: "2025-12-10",
    priority: "high",
    labels: ["administratie"],
  },
  {
    id: "6",
    title: "Materialen bestellen voor prototype",
    description: "Onderdelen bestellen voor het werkende prototype.",
    status: "waiting",
    projectName: "Dutch Wave Power",
    className: "H3a",
    assignees: ["Mark Jansen"],
    dueDate: "2025-12-12",
    priority: "medium",
  },
  {
    id: "7",
    title: "Peer review formulieren controleren",
    description: "Alle ingevulde formulieren nalopen op volledigheid.",
    status: "done",
    projectName: "Smart City Mobility",
    className: "V5b",
    assignees: ["Eva de Vries"],
    priority: "low",
  },
  {
    id: "8",
    title: "Planning volgend semester maken",
    description: "Concept planning voor O&O projecten volgend semester.",
    status: "todo",
    assignees: ["Nick Veerman", "Lisa Peters"],
    dueDate: "2025-12-30",
    priority: "low",
    labels: ["planning"],
  },
];

// ============================================================================
// Utility functions
// ============================================================================

function formatDateDutch(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Sub-components
// ============================================================================

// Badge component
function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "high" | "medium" | "low" | "label";
}) {
  const variantStyles = {
    default: "bg-slate-100 text-slate-700",
    high: "bg-red-50 text-red-700 ring-1 ring-red-200",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    low: "bg-green-50 text-green-700 ring-1 ring-green-200",
    label: "bg-blue-50 text-blue-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}

// TaskCard component
function TaskCard({
  task,
  isDragging = false,
}: {
  task: Task;
  isDragging?: boolean;
}) {
  const priorityLabels = {
    high: "Hoog",
    medium: "Normaal",
    low: "Laag",
  };

  return (
    <div
      className={`rounded-2xl shadow-sm bg-white border border-slate-200 p-3 md:p-4 hover:shadow-md transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-blue-500 opacity-90" : ""
      }`}
    >
      {/* Title */}
      <h4 className="font-semibold text-slate-900 text-sm mb-1">{task.title}</h4>

      {/* Project and Class info */}
      {(task.projectName || task.className) && (
        <div className="text-xs text-slate-500 mb-2">
          {task.projectName && <span>{task.projectName}</span>}
          {task.projectName && task.className && <span className="mx-1">•</span>}
          {task.className && <span>{task.className}</span>}
        </div>
      )}

      {/* Description */}
      {task.description && (
        <p className="text-xs text-slate-600 line-clamp-2 mb-3">{task.description}</p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {task.priority && (
          <Badge variant={task.priority}>{priorityLabels[task.priority]}</Badge>
        )}
        {task.labels?.map((label) => (
          <Badge key={label} variant="label">
            {label}
          </Badge>
        ))}
      </div>

      {/* Assignees */}
      {task.assignees.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          {task.assignees.map((assignee) => (
            <span
              key={assignee}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-medium"
              title={assignee}
            >
              {getInitials(assignee)}
            </span>
          ))}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center justify-between">
        {/* Due date */}
        {task.dueDate ? (
          <span className="text-[10px] text-slate-400">
            Deadline: {formatDateDutch(task.dueDate)}
          </span>
        ) : (
          <span />
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Bekijk details"
          >
            <Eye size={14} />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Bewerken"
          >
            <Pencil size={14} />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Meer opties"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// SortableTaskCard component
function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
      >
        <GripVertical size={14} />
      </div>
      <TaskCard task={task} isDragging={isDragging} />
    </div>
  );
}

// KanbanColumn component
function KanbanColumn({
  column,
  tasks,
}: {
  column: ColumnConfig;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] max-w-sm bg-slate-100/60 rounded-2xl p-3 md:p-4 transition-colors ${
        isOver ? "bg-blue-50 ring-2 ring-blue-300" : ""
      }`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-700">{column.title}</h3>
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Tasks */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-3">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>

      {tasks.length === 0 && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Geen taken
        </div>
      )}
    </div>
  );
}

// Toolbar component
function Toolbar({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  assigneeFilter,
  onAssigneeFilterChange,
  projectFilter,
  onProjectFilterChange,
  showMyTasks,
  onShowMyTasksChange,
}: {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (value: string) => void;
  projectFilter: string;
  onProjectFilterChange: (value: string) => void;
  showMyTasks: boolean;
  onShowMyTasksChange: (value: boolean) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search field */}
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Zoeken
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Zoek op titel, leerling, project..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Assignee filter */}
        <div className="min-w-[160px]">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Toegewezen aan
          </label>
          <select
            value={assigneeFilter}
            onChange={(e) => onAssigneeFilterChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Iedereen</option>
            {MOCK_ASSIGNEES.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter */}
        <div className="min-w-[140px]">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle</option>
            <option value="todo">Te doen</option>
            <option value="in_progress">Mee bezig</option>
            <option value="waiting">Wachten op</option>
            <option value="done">Gedaan</option>
          </select>
        </div>

        {/* Project filter */}
        <div className="min-w-[160px]">
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            Project
          </label>
          <select
            value={projectFilter}
            onChange={(e) => onProjectFilterChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Alle projecten</option>
            {MOCK_PROJECTS.map((project) => (
              <option key={project} value={project}>
                {project}
              </option>
            ))}
          </select>
        </div>

        {/* My tasks toggle */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1.5 block">
            &nbsp;
          </label>
          <button
            onClick={() => onShowMyTasksChange(!showMyTasks)}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showMyTasks
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showMyTasks ? "Mijn taken" : "Alle taken"}
          </button>
        </div>
      </div>
    </div>
  );
}

// NewTaskDialog component
function NewTaskDialog({
  isOpen,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, "id">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectName, setProjectName] = useState("");
  const [className, setClassName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setProjectName("");
    setClassName("");
    setStudentName("");
    setAssignee("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      projectName: projectName || undefined,
      className: className.trim() || undefined,
      studentName: studentName.trim() || undefined,
      assignees: assignee ? [assignee] : [],
      status,
      priority,
      dueDate: dueDate || undefined,
    });

    resetForm();
    onClose();
  };

  const handleCancel = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-xl font-semibold text-slate-900">Nieuwe taak</h2>
          <button
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Sluiten"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titel van de taak"
              required
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Beschrijving
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionele beschrijving..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Project
              </label>
              <select
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Geen project</option>
                {MOCK_PROJECTS.map((project) => (
                  <option key={project} value={project}>
                    {project}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Klas
              </label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="bijv. H3a"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Student */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Leerling
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Naam van leerling"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Assignee */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Toegewezen aan
              </label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Niemand</option>
                {MOCK_ASSIGNEES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">Te doen</option>
                <option value="in_progress">Mee bezig</option>
                <option value="waiting">Wachten op</option>
                <option value="done">Gedaan</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Prioriteit
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as "low" | "medium" | "high")
                }
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Laag</option>
                <option value="medium">Normaal</option>
                <option value="high">Hoog</option>
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">
              Deadline
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuleer
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Opslaan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Main page component
// ============================================================================

export default function TeacherKanbanPage() {
  // State
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [showMyTasks, setShowMyTasks] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesSearch =
          task.title.toLowerCase().includes(search) ||
          task.description?.toLowerCase().includes(search) ||
          task.projectName?.toLowerCase().includes(search) ||
          task.studentName?.toLowerCase().includes(search) ||
          task.className?.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }

      // Assignee filter
      if (assigneeFilter !== "all" && !task.assignees.includes(assigneeFilter)) {
        return false;
      }

      // Project filter
      if (projectFilter !== "all" && task.projectName !== projectFilter) {
        return false;
      }

      // My tasks filter (hardcoded as "Nick Veerman")
      if (showMyTasks && !task.assignees.includes("Nick Veerman")) {
        return false;
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, assigneeFilter, projectFilter, showMyTasks]);

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      todo: [],
      in_progress: [],
      waiting: [],
      done: [],
    };

    filteredTasks.forEach((task) => {
      grouped[task.status].push(task);
    });

    return grouped;
  }, [filteredTasks]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Check if dropped on a column
    const targetStatus = COLUMNS.find((col) => col.id === overId)?.id;

    if (targetStatus) {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, status: targetStatus } : task
        )
      );
    }
  };

  // Add new task
  const handleAddTask = (taskData: Omit<Task, "id">) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
    };
    setTasks((prev) => [...prev, newTask]);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Page Header */}
      <header className="bg-white/80 border-b border-slate-200 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-5 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Sectietaken – Kanban
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Verdeel en volg taken met je collega&apos;s binnen O&amp;O.
            </p>
          </div>
          <button
            onClick={() => setIsDialogOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Nieuwe taak
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        {/* Toolbar */}
        <Toolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          assigneeFilter={assigneeFilter}
          onAssigneeFilterChange={setAssigneeFilter}
          projectFilter={projectFilter}
          onProjectFilterChange={setProjectFilter}
          showMyTasks={showMyTasks}
          onShowMyTasksChange={setShowMyTasks}
        />

        {/* Kanban Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {COLUMNS.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByStatus[column.id]}
                />
              ))}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTask && <TaskCard task={activeTask} isDragging />}
          </DragOverlay>
        </DndContext>
      </main>

      {/* New Task Dialog */}
      <NewTaskDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleAddTask}
      />
    </div>
  );
}

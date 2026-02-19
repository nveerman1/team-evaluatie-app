"use client";

import { useState, useEffect, useMemo } from "react";
import { skillTrainingService, courseService, competencyService, listLearningObjectives } from "@/services";
import type {
  SkillTraining,
  SkillTrainingCreate,
  CourseLite,
  CompetencyCategory,
  LearningObjectiveDto,
  TeacherProgressMatrixResponse,
  SkillTrainingStatus,
} from "@/dtos";
import { STATUS_META } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, Users, ChevronDown, Circle, Clock, CheckCircle2, ClipboardCheck, BadgeCheck as BadgeCheckIcon } from "lucide-react";

// Helper function for class names
function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function SkillTrainingsPage() {
  const [trainings, setTrainings] = useState<SkillTraining[]>([]);
  const [courses, setCourses] = useState<CourseLite[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [objectives, setObjectives] = useState<LearningObjectiveDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tab state
  const [tab, setTab] = useState<"matrix" | "overview" | "manage">("matrix");
  
  // Progress matrix state
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [progressData, setProgressData] = useState<TeacherProgressMatrixResponse | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  
  // Selection for bulk actions
  const [selectedTrainings, setSelectedTrainings] = useState<Record<string, boolean>>({});
  
  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<SkillTraining | null>(null);
  const [createForm, setCreateForm] = useState<SkillTrainingCreate>({
    title: "",
    url: "https://technasiummbh.nl/vaardigheden/",
    competency_category_id: 0,
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [trainingsData, coursesData, categoriesData, objectivesResponse] = await Promise.all([
        skillTrainingService.listTrainings(),
        courseService.getCourses(),
        competencyService.getCategories(),
        listLearningObjectives({
          limit: 100,
          include_teacher_objectives: true,
          include_course_objectives: true,
        }),
      ]);
      
      setTrainings(trainingsData);
      setCourses(coursesData);
      setCategories(categoriesData);
      setObjectives(objectivesResponse.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadProgressMatrix = async (courseId: number, className?: string) => {
    try {
      setLoadingProgress(true);
      const data = await skillTrainingService.getProgressMatrix(courseId, className);
      setProgressData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress");
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setSelectedTrainings({});
    if (courseId) {
      loadProgressMatrix(parseInt(courseId), selectedClass || undefined);
    } else {
      setProgressData(null);
    }
  };

  const handleClassChange = (className: string) => {
    setSelectedClass(className);
    if (selectedCourseId) {
      loadProgressMatrix(parseInt(selectedCourseId), className || undefined);
    }
  };

  const handleCreateTraining = async () => {
    try {
      if (!createForm.title || !createForm.url || !createForm.competency_category_id) {
        alert("Vul alle verplichte velden in");
        return;
      }
      
      await skillTrainingService.createTraining(createForm);
      setIsCreateModalOpen(false);
      setCreateForm({
        title: "",
        url: "https://technasiummbh.nl/vaardigheden/",
        competency_category_id: 0,
        is_active: true,
      });
      loadData();
      if (selectedCourseId) {
        loadProgressMatrix(parseInt(selectedCourseId), selectedClass || undefined);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create training");
    }
  };

  const handleEditTraining = async () => {
    try {
      if (!editingTraining) return;
      
      if (!editingTraining.title || !editingTraining.url || !editingTraining.competency_category_id) {
        alert("Vul alle verplichte velden in");
        return;
      }
      
      await skillTrainingService.updateTraining(editingTraining.id, {
        title: editingTraining.title,
        url: editingTraining.url,
        competency_category_id: editingTraining.competency_category_id,
        learning_objective_id: editingTraining.learning_objective_id || undefined,
        level: editingTraining.level || undefined,
        est_minutes: editingTraining.est_minutes || undefined,
        is_active: editingTraining.is_active,
      });
      
      setIsEditModalOpen(false);
      setEditingTraining(null);
      loadData();
      if (selectedCourseId) {
        loadProgressMatrix(parseInt(selectedCourseId), selectedClass || undefined);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update training");
    }
  };

  const openEditModal = (training: SkillTraining) => {
    setEditingTraining({ ...training });
    setIsEditModalOpen(true);
  };

  const handleStatusClick = async (studentId: number, trainingId: number, currentStatus: SkillTrainingStatus) => {
    if (!selectedCourseId) return;
    
    const statuses: SkillTrainingStatus[] = ["none", "planned", "in_progress", "submitted", "completed", "mastered"];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
      await skillTrainingService.updateProgressSingle(
        studentId,
        trainingId,
        parseInt(selectedCourseId),
        nextStatus
      );
      if (selectedCourseId) {
        loadProgressMatrix(parseInt(selectedCourseId), selectedClass || undefined);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const groupedTrainings = useMemo(() => {
    return categories.map((cat) => ({
      ...cat,
      trainings: trainings.filter((t) => t.competency_category_id === cat.id),
    }));
  }, [categories, trainings]);

  const filteredStudents = progressData?.students || [];
  
  const allTrainingIds = useMemo(() => trainings.map((t) => String(t.id)), [trainings]);
  
  const anyTrainingSelected = useMemo(() => {
    return allTrainingIds.some((id) => !!selectedTrainings[id]);
  }, [allTrainingIds, selectedTrainings]);
  
  const allTrainingsSelected = useMemo(() => {
    return allTrainingIds.length > 0 && allTrainingIds.every((id) => !!selectedTrainings[id]);
  }, [allTrainingIds, selectedTrainings]);

  const toggleSelectTraining = (trainingId: string, next: boolean) => {
    setSelectedTrainings((prev) => ({ ...prev, [trainingId]: next }));
  };

  const toggleSelectAllTrainings = (next: boolean) => {
    setSelectedTrainings((prev) => {
      const out = { ...prev };
      for (const id of allTrainingIds) out[id] = next;
      return out;
    });
  };

  const bulkSetStatus = async (status: SkillTrainingStatus) => {
    if (!selectedCourseId) return;
    const trainingIds = allTrainingIds.filter((id) => selectedTrainings[id]).map((id) => parseInt(id));
    if (trainingIds.length === 0) return;
    const studentIds = filteredStudents.map((s) => s.student_id);

    try {
      await skillTrainingService.bulkUpdateProgress(parseInt(selectedCourseId), {
        student_ids: studentIds,
        training_ids: trainingIds,
        status,
      });
      if (selectedCourseId) {
        loadProgressMatrix(parseInt(selectedCourseId), selectedClass || undefined);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to bulk update");
    }
  };

  // Get unique class names from students
  const availableClasses = useMemo(() => {
    if (!progressData) return [];
    const classes = new Set(progressData.students.map((s) => s.class_name).filter(Boolean));
    return Array.from(classes).sort();
  }, [progressData]);

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  const tabs = [
    { id: "matrix", label: "Overzicht competenties" },
    { id: "overview", label: "Overzicht trainingen" },
    { id: "manage", label: "Alle trainingen" },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">Vaardigheidstrainingen</h1>
            <p className="text-gray-600 mt-1 text-sm">
              Docentoverzicht — voortgang per leerling (trainingen staan op technasiummbh.nl)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  <Plus className="h-4 w-4" />
                  Training aanmaken
                </button>
              </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Nieuwe training aanmaken</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    <div>
                      <Label htmlFor="title">Titel *</Label>
                      <Input
                        id="title"
                        value={createForm.title}
                        onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                        placeholder="Bijv. Onderzoeksmethoden - Basis"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="url">URL *</Label>
                      <Input
                        id="url"
                        value={createForm.url}
                        onChange={(e) => setCreateForm({ ...createForm, url: e.target.value })}
                        placeholder="https://technasiummbh.nl/vaardigheden/..."
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="category">Competentiecategorie *</Label>
                      <Select
                        value={createForm.competency_category_id ? String(createForm.competency_category_id) : ""}
                        onValueChange={(value) => setCreateForm({ ...createForm, competency_category_id: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer categorie" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={String(cat.id)}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="objective">Leerdoel (optioneel)</Label>
                      <Select
                        value={createForm.learning_objective_id ? String(createForm.learning_objective_id) : "none"}
                        onValueChange={(value) => setCreateForm({ 
                          ...createForm, 
                          learning_objective_id: value === "none" ? undefined : parseInt(value) 
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Geen leerdoel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Geen leerdoel</SelectItem>
                          {objectives.map((obj) => (
                            <SelectItem key={obj.id} value={String(obj.id)}>
                              {obj.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="level">Niveau</Label>
                        <Select
                          value={createForm.level || "none"}
                          onValueChange={(value) => setCreateForm({ 
                            ...createForm, 
                            level: value === "none" ? undefined : value 
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Geen niveau" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Geen niveau</SelectItem>
                            <SelectItem value="basis">Basis</SelectItem>
                            <SelectItem value="plus">Plus</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label htmlFor="minutes">Geschatte tijd</Label>
                        <Input
                          id="minutes"
                          value={createForm.est_minutes || ""}
                          onChange={(e) => setCreateForm({ ...createForm, est_minutes: e.target.value })}
                          placeholder="Bijv. 10-15 min"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={createForm.is_active}
                        onChange={(e) => setCreateForm({ ...createForm, is_active: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="is_active">Actief</Label>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                        Annuleren
                      </Button>
                      <Button onClick={handleCreateTraining}>
                        Aanmaken
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            <button
              onClick={() => window?.open?.("https://technasiummbh.nl/vaardigheden", "_blank")}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <ExternalLink className="h-4 w-4" />
              Naar vaardighedensite
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Tabs Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-8" aria-label="Tabs">
            {tabs.map((t) => {
              const active = tab === (t.id as any);
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id as any)}
                  className={cn(
                    "py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                    active
                      ? "border-black text-black"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Filter bar - only show for matrix and overview tabs */}
        {tab !== "manage" && (
        <div className="rounded-lg border border-gray-200/80 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
            <div className="md:col-span-7">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-gray-600">Vak (course_id) *</div>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <ExternalLink className="h-4 w-4" />
                  </div>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => handleCourseChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pl-10 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecteer een vak</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </label>
            </div>
            <div className="md:col-span-5">
              <label className="block">
                <div className="mb-1 text-xs font-medium text-gray-600">Klas (optioneel)</div>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Users className="h-4 w-4" />
                  </div>
                  <select
                    value={selectedClass}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pl-10 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Alle klassen</option>
                    {availableClasses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>
              </label>
            </div>
          </div>
        </div>
        )}

        {/* Bulk action bar (only for Overzicht trainingen) */}
        {tab === "overview" && selectedCourseId && (
          <div className="rounded-lg border border-gray-200/80 bg-white px-5 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredStudents.length}</span> leerlingen •{" "}
                <span className="font-semibold text-gray-900">{trainings.length}</span> trainingen
                <span className="mx-2 text-gray-300">•</span>
                <span className={cn(!anyTrainingSelected && "text-gray-400")}>
                  Bulk: vink trainingen (kolommen) aan en kies status
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => toggleSelectAllTrainings(!allTrainingsSelected)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium shadow-sm bg-white text-gray-700 hover:bg-gray-50"
                >
                  {allTrainingsSelected ? "Alle trainingen uit" : "Alle trainingen aan"}
                </button>

                {(["none", "planned", "in_progress", "submitted", "completed", "mastered"] as SkillTrainingStatus[]).map((st) => (
                  <button
                    key={st}
                    disabled={!anyTrainingSelected}
                    onClick={() => bulkSetStatus(st)}
                    className={cn(
                      "rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium shadow-sm transition",
                      !anyTrainingSelected
                        ? "cursor-not-allowed bg-gray-50 text-gray-400"
                        : "bg-white text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {STATUS_META[st].label}
                  </button>
                ))}

                <button
                  disabled={!anyTrainingSelected}
                  onClick={() => setSelectedTrainings({})}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium",
                    !anyTrainingSelected ? "cursor-not-allowed text-gray-400" : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  Selectie wissen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content area - manage tab doesn't need course selection */}
        {tab === "manage" ? (
          <div className="rounded-lg border border-gray-200/80 bg-white shadow-sm">
            <AllTrainingsTable trainings={trainings} categories={categories} objectives={objectives} onEdit={openEditModal} />
          </div>
        ) : !selectedCourseId ? (
          <div className="rounded-lg border border-gray-200/80 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto max-w-md">
              <div className="text-lg font-semibold text-gray-900">Selecteer eerst een vak</div>
              <div className="mt-2 text-sm text-gray-600">Zonder vak (course_id) kunnen we geen leerlingen en trainingen tonen.</div>
            </div>
          </div>
        ) : loadingProgress ? (
          <div className="rounded-lg border border-gray-200/80 bg-white p-10 text-center shadow-sm">
            <Loading />
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200/80 bg-white shadow-sm">
            {tab === "matrix" ? (
              <MatrixView students={filteredStudents} groupedTrainings={groupedTrainings} progressData={progressData} />
            ) : (
              <OverviewTable
                students={filteredStudents}
                groupedTrainings={groupedTrainings}
                trainings={trainings}
                progressData={progressData}
                onCycle={handleStatusClick}
                selectedTrainings={selectedTrainings}
                onToggleTraining={toggleSelectTraining}
              />
            )}
          </div>
        )}
      </div>

      {/* Edit Training Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Training bewerken</DialogTitle>
          </DialogHeader>
          {editingTraining && (
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-title">Titel *</Label>
                <Input
                  id="edit-title"
                  value={editingTraining.title}
                  onChange={(e) => setEditingTraining({ ...editingTraining, title: e.target.value })}
                  placeholder="Bijv. Onderzoeksmethoden - Basis"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-url">URL *</Label>
                <Input
                  id="edit-url"
                  value={editingTraining.url}
                  onChange={(e) => setEditingTraining({ ...editingTraining, url: e.target.value })}
                  placeholder="https://technasiummbh.nl/vaardigheden/..."
                />
              </div>
              
              <div>
                <Label htmlFor="edit-category">Competentiecategorie *</Label>
                <Select
                  value={editingTraining.competency_category_id ? String(editingTraining.competency_category_id) : ""}
                  onValueChange={(value) => setEditingTraining({ ...editingTraining, competency_category_id: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="edit-objective">Leerdoel (optioneel)</Label>
                <Select
                  value={editingTraining.learning_objective_id ? String(editingTraining.learning_objective_id) : "none"}
                  onValueChange={(value) => setEditingTraining({ 
                    ...editingTraining, 
                    learning_objective_id: value === "none" ? undefined : parseInt(value) 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Geen leerdoel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen leerdoel</SelectItem>
                    {objectives.map((obj) => (
                      <SelectItem key={obj.id} value={String(obj.id)}>
                        {obj.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-level">Niveau</Label>
                  <Select
                    value={editingTraining.level || "none"}
                    onValueChange={(value) => setEditingTraining({ 
                      ...editingTraining, 
                      level: value === "none" ? undefined : value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Geen niveau" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen niveau</SelectItem>
                      <SelectItem value="basis">Basis</SelectItem>
                      <SelectItem value="plus">Plus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="edit-minutes">Geschatte tijd</Label>
                  <Input
                    id="edit-minutes"
                    value={editingTraining.est_minutes || ""}
                    onChange={(e) => setEditingTraining({ ...editingTraining, est_minutes: e.target.value })}
                    placeholder="Bijv. 10-15 min"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit_is_active"
                  checked={editingTraining.is_active}
                  onChange={(e) => setEditingTraining({ ...editingTraining, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="edit_is_active">Actief</Label>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleEditTraining}>
                  Opslaan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Component prop interfaces
interface GroupedTraining {
  id: number;
  name: string;
  trainings: SkillTraining[];
}

interface MatrixViewProps {
  students: SkillTrainingStudentProgressRow[];
  groupedTrainings: GroupedTraining[];
  progressData: TeacherProgressMatrixResponse | null;
}

// Matrix View Component
function MatrixView({ students, groupedTrainings, progressData }: MatrixViewProps) {
  const getStatus = (studentId: number, trainingId: number): SkillTrainingStatus => {
    const student = students.find((s) => s.student_id === studentId);
    return (student?.progress[trainingId] || "none") as SkillTrainingStatus;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Leerling</th>
            {groupedTrainings.map((group) => (
              <th key={group.id} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.student_id} className="border-t hover:bg-gray-50/60">
              <td className="px-5 py-3 text-sm font-bold text-slate-900">{s.student_name}</td>
              {groupedTrainings.map((group) => {
                const total = group.trainings.length;
                const done = group.trainings.filter((t) => {
                  const st = getStatus(s.student_id, t.id);
                  return st === "completed" || st === "mastered";
                }).length;
                const pct = total ? Math.round((done / total) * 100) : 0;
                return (
                  <td key={group.id} className="px-5 py-3">
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {done}/{total}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface FlatTraining extends SkillTraining {
  groupId: number;
  groupName: string;
}

interface GroupSpan {
  id: number;
  name: string;
  span: number;
}

interface OverviewTableProps {
  students: SkillTrainingStudentProgressRow[];
  groupedTrainings: GroupedTraining[];
  trainings: SkillTraining[];
  progressData: TeacherProgressMatrixResponse | null;
  onCycle: (studentId: number, trainingId: number) => void;
  selectedTrainings: Record<string, boolean>;
  onToggleTraining: (trainingId: number) => void;
}

// Overview Table Component
function OverviewTable({ students, groupedTrainings, trainings, progressData, onCycle, selectedTrainings, onToggleTraining }: OverviewTableProps) {
  const flatTrainings = useMemo(() => {
    const cols: FlatTraining[] = [];
    for (const g of groupedTrainings) {
      for (const t of g.trainings) {
        cols.push({ groupId: g.id, groupName: g.name, ...t });
      }
    }
    return cols;
  }, [groupedTrainings]);

  const spans = useMemo((): GroupSpan[] => {
    return groupedTrainings.map((g) => ({
      id: g.id,
      name: g.name,
      span: Math.max(1, g.trainings.length),
    }));
  }, [groupedTrainings]);

  const getStatus = (studentId: number, trainingId: number): SkillTrainingStatus => {
    const student = students.find((s) => s.student_id === studentId);
    return (student?.progress[trainingId] || "none") as SkillTrainingStatus;
  };

  const StatusPill = ({ status }: { status: SkillTrainingStatus }) => {
    const meta = STATUS_META[status];
    const icons: Record<string, any> = {
      none: Circle,
      planned: ClipboardCheck,
      in_progress: Clock,
      submitted: ClipboardCheck,
      completed: CheckCircle2,
      mastered: BadgeCheckIcon,
    };
    const Icon = icons[status] || Circle;
    
    return (
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.colorClass)}>
        <Icon className="h-3.5 w-3.5" />
        {meta.label}
      </span>
    );
  };

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px]">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              {/* Row 1: competency groups (sticky) */}
              <tr>
                <th
                  className={cn(
                    "sticky left-0 top-0 z-30 min-w-[260px] w-auto border-b border-gray-200 bg-gray-50 px-5 py-3",
                    "shadow-[1px_0_0_0_rgba(229,231,235,1)]"
                  )}
                />
                {spans.map((g: any) => (
                  <th
                    key={g.id}
                    colSpan={g.span}
                    className="sticky top-0 z-20 border-b border-l border-gray-200 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {g.name}
                  </th>
                ))}
              </tr>

              {/* Row 2: training titles (sticky) */}
              <tr>
                <th
                  className={cn(
                    "sticky left-0 top-[44px] z-30 border-b border-gray-200 bg-gray-100 px-5 py-3 text-left",
                    "shadow-[1px_0_0_0_rgba(229,231,235,1)]"
                  )}
                >
                  <div className="text-xs font-semibold text-gray-700">Leerlingen</div>
                </th>

                {flatTrainings.map((t: any) => (
                  <th
                    key={t.id}
                    className={cn(
                      "sticky top-[44px] z-20 border-b border-l border-gray-200 bg-gray-100 px-4 py-3 text-left",
                      selectedTrainings?.[t.id] && "bg-gray-200/60"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!selectedTrainings?.[t.id]}
                        onChange={(e) => onToggleTraining(String(t.id), e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        title="Selecteer kolom voor bulk"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-800" title={t.title}>
                          {t.title}
                        </div>
                        <div className="mt-1">
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-700"
                            title="Open training"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
                          </a>
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {students.map((s: any) => (
                <tr key={s.student_id} className="hover:bg-gray-50/60">
                  <td
                    className={cn(
                      "sticky left-0 z-10 min-w-[260px] w-auto border-b border-gray-200 bg-white px-5 py-3",
                      "shadow-[1px_0_0_0_rgba(229,231,235,1)]"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{s.student_name}</div>
                    </div>
                  </td>

                  {flatTrainings.map((t: any) => {
                    const st: SkillTrainingStatus = getStatus(s.student_id, t.id);
                    return (
                      <td key={`${s.student_id}:${t.id}`} className="border-b border-l border-gray-200 bg-white px-4 py-3">
                        <button
                          onClick={() => onCycle(s.student_id, t.id, st)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition hover:bg-gray-50"
                          title="Klik om status te wijzigen"
                        >
                          <StatusPill status={st} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// All Trainings Table Component
function AllTrainingsTable({ trainings, categories, objectives, onEdit }: {
  trainings: SkillTraining[];
  categories: CompetencyCategory[];
  objectives: LearningObjectiveDto[];
  onEdit: (training: SkillTraining) => void;
}) {
  const getCategoryName = (categoryId: number) => {
    return categories.find(c => c.id === categoryId)?.name || "-";
  };

  const getObjectiveTitle = (objectiveId?: number) => {
    if (!objectiveId) return "-";
    return objectives.find(o => o.id === objectiveId)?.title || "-";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3">Training</th>
            <th className="px-5 py-3">Competentie</th>
            <th className="px-5 py-3">Leerdoel</th>
            <th className="px-5 py-3">Niveau</th>
            <th className="px-5 py-3">Tijd</th>
            <th className="px-5 py-3">Actief</th>
            <th className="px-5 py-3">Acties</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {trainings.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-5 py-8 text-center text-sm text-gray-500">
                Geen trainingen gevonden
              </td>
            </tr>
          ) : (
            trainings.map((training) => (
              <tr key={training.id} className="border-t hover:bg-gray-50/60">
                <td className="px-5 py-4">
                  <span className="text-sm font-medium text-gray-900">{training.title}</span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {getCategoryName(training.competency_category_id)}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {getObjectiveTitle(training.learning_objective_id)}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {training.level || "-"}
                </td>
                <td className="px-5 py-4 text-sm text-gray-700">
                  {training.est_minutes || "-"}
                </td>
                <td className="px-5 py-4">
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                    training.is_active 
                      ? "bg-green-50 text-green-700" 
                      : "bg-gray-100 text-gray-600"
                  )}>
                    {training.is_active ? "Ja" : "Nee"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <a
                      href={training.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </a>
                    <button
                      onClick={() => onEdit(training)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Details
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

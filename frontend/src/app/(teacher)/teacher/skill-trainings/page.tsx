"use client";

import { useState, useEffect } from "react";
import { skillTrainingService, courseService, competencyService, listLearningObjectives } from "@/services";
import type {
  SkillTraining,
  SkillTrainingCreate,
  Course,
  CompetencyCategory,
  LearningObjectiveDto,
  TeacherProgressMatrixResponse,
  SkillTrainingStatus,
} from "@/dtos";
import { STATUS_META } from "@/dtos";
import { Loading, ErrorMessage } from "@/components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ExternalLink } from "lucide-react";

export default function SkillTrainingsPage() {
  const [trainings, setTrainings] = useState<SkillTraining[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CompetencyCategory[]>([]);
  const [objectives, setObjectives] = useState<LearningObjectiveDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Progress matrix state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [progressData, setProgressData] = useState<TeacherProgressMatrixResponse | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  
  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SkillTrainingCreate>({
    title: "",
    url: "",
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

  const loadProgressMatrix = async (courseId: number) => {
    try {
      setLoadingProgress(true);
      const data = await skillTrainingService.getProgressMatrix(courseId);
      setProgressData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load progress");
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleCourseChange = (courseId: string) => {
    const id = parseInt(courseId);
    setSelectedCourseId(id);
    loadProgressMatrix(id);
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
        url: "",
        competency_category_id: 0,
        is_active: true,
      });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create training");
    }
  };

  const handleStatusClick = async (studentId: number, trainingId: number, currentStatus: SkillTrainingStatus) => {
    if (!selectedCourseId) return;
    
    // Cycle through statuses
    const statuses: SkillTrainingStatus[] = ["none", "planned", "in_progress", "submitted", "completed", "mastered"];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    try {
      await skillTrainingService.updateProgressSingle(
        studentId,
        trainingId,
        selectedCourseId,
        nextStatus
      );
      // Reload matrix
      loadProgressMatrix(selectedCourseId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vaardigheidstrainingen</h1>
          <p className="text-gray-600">Beheer trainingen en volg voortgang van studenten</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nieuwe training
            </Button>
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
      </div>

      <Tabs defaultValue="matrix" className="w-full">
        <TabsList>
          <TabsTrigger value="matrix">Overzicht trainingen</TabsTrigger>
          <TabsTrigger value="progress">Overzicht competenties</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voortgang per training</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Selecteer vak</Label>
                  <Select
                    value={selectedCourseId ? String(selectedCourseId) : ""}
                    onValueChange={handleCourseChange}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Kies een vak" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={String(course.id)}>
                          {course.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {loadingProgress && <Loading />}
                
                {progressData && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white border p-2 text-left min-w-[200px]">
                            Student
                          </th>
                          {progressData.trainings.map((training) => (
                            <th key={training.id} className="border p-2 text-left min-w-[150px]">
                              <div className="text-sm font-semibold">{training.title}</div>
                              <div className="text-xs text-gray-500">{training.competency_category_name}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {progressData.students.map((student) => (
                          <tr key={student.student_id}>
                            <td className="sticky left-0 bg-white border p-2 font-medium">
                              {student.student_name}
                              {student.class_name && (
                                <span className="text-xs text-gray-500 ml-2">
                                  ({student.class_name})
                                </span>
                              )}
                            </td>
                            {progressData.trainings.map((training) => {
                              const status = (student.progress[training.id] || "none") as SkillTrainingStatus;
                              const meta = STATUS_META[status];
                              
                              return (
                                <td key={training.id} className="border p-2">
                                  <Badge
                                    className={`${meta.colorClass} cursor-pointer hover:opacity-80`}
                                    onClick={() => handleStatusClick(student.student_id, training.id, status)}
                                  >
                                    {meta.label}
                                  </Badge>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Voortgang per competentiecategorie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Deze weergave toont de voortgang per competentiecategorie. 
                Selecteer een vak om de voortgang te zien.
              </p>
              {/* This can be extended with progress bars per category */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Alle trainingen ({trainings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {trainings.map((training) => (
              <div
                key={training.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-semibold">{training.title}</div>
                  <div className="text-sm text-gray-600">
                    {training.competency_category_name}
                    {training.level && ` • ${training.level}`}
                    {training.est_minutes && ` • ${training.est_minutes}`}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={training.is_active ? "default" : "secondary"}>
                    {training.is_active ? "Actief" : "Inactief"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(training.url, "_blank")}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

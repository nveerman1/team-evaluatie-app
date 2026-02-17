import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ExternalLink, Search, Info } from "lucide-react";
import { skillTrainingService } from "@/services";
import type {
  StudentTrainingItem,
  SkillTrainingStatus,
} from "@/dtos";
import { STATUS_META, STUDENT_ALLOWED_STATUSES } from "@/dtos";

export function SkillTrainingTab() {
  const [items, setItems] = useState<StudentTrainingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StudentTrainingItem | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadTrainings();
  }, []);

  const loadTrainings = async () => {
    try {
      setLoading(true);
      const response = await skillTrainingService.getMyTrainings();
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trainings");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusClick = async (item: StudentTrainingItem) => {
    if (item.status === "completed" || item.status === "mastered") {
      alert("Status is vergrendeld door docent");
      return;
    }

    const currentIndex = STUDENT_ALLOWED_STATUSES.indexOf(item.status);
    const nextIndex = (currentIndex + 1) % STUDENT_ALLOWED_STATUSES.length;
    const nextStatus = STUDENT_ALLOWED_STATUSES[nextIndex];

    try {
      setUpdatingStatus(true);
      await skillTrainingService.updateMyStatus(item.training.id, {
        status: nextStatus,
      });
      await loadTrainings();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const openDetails = (item: StudentTrainingItem) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const searchText = `${item.training.title} ${item.training.competency_category_name}`.toLowerCase();
      if (!searchText.includes(query)) return false;
    }

    // Open filter
    if (showOnlyOpen) {
      if (item.status === "completed" || item.status === "mastered" || item.status === "none") {
        return false;
      }
    }

    return true;
  });

  // Group by competency category for progress cards
  const categoryProgress = items.reduce((acc, item) => {
    const categoryName = item.training.competency_category_name || "Overig";
    if (!acc[categoryName]) {
      acc[categoryName] = { total: 0, completed: 0 };
    }
    acc[categoryName].total++;
    if (item.status === "completed" || item.status === "mastered") {
      acc[categoryName].completed++;
    }
    return acc;
  }, {} as Record<string, { total: number; completed: number }>);

  const openItemsCount = items.filter(
    (item) =>
      item.status !== "none" &&
      item.status !== "completed" &&
      item.status !== "mastered"
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Zoek trainingen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="show-open"
                checked={showOnlyOpen}
                onChange={(e) => setShowOnlyOpen(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-open" className="text-sm cursor-pointer">
                Alleen open ({openItemsCount})
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress per category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(categoryProgress).map(([category, progress]) => (
          <Card key={category} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">{category}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Voortgang</span>
                  <span className="font-semibold">
                    {progress.completed} / {progress.total}
                  </span>
                </div>
                <Progress
                  value={(progress.completed / progress.total) * 100}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Training list */}
      <Card>
        <CardHeader>
          <CardTitle>Trainingen ({filteredItems.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredItems.length === 0 ? (
              <p className="text-gray-600 text-center py-8">
                Geen trainingen gevonden
              </p>
            ) : (
              filteredItems.map((item) => {
                const meta = STATUS_META[item.status];
                const isLocked = item.status === "completed" || item.status === "mastered";

                return (
                  <div
                    key={item.training.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg">{item.training.title}</div>
                      <div className="text-sm text-gray-600">
                        {item.training.competency_category_name}
                        {item.training.level && ` • ${item.training.level}`}
                        {item.training.est_minutes && ` • ${item.training.est_minutes}`}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Badge
                        className={`${meta.colorClass} ${
                          !isLocked ? "cursor-pointer hover:opacity-80" : ""
                        }`}
                        onClick={() => !isLocked && handleStatusClick(item)}
                      >
                        {meta.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDetails(item)}
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(item.training.url, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Details modal */}
      {selectedItem && (
        <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedItem.training.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <h3 className="font-semibold text-sm text-gray-600">Competentie</h3>
                <p>{selectedItem.training.competency_category_name}</p>
              </div>

              {selectedItem.training.learning_objective_title && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Leerdoel</h3>
                  <p>{selectedItem.training.learning_objective_title}</p>
                </div>
              )}

              {selectedItem.training.level && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Niveau</h3>
                  <p className="capitalize">{selectedItem.training.level}</p>
                </div>
              )}

              {selectedItem.training.est_minutes && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Geschatte tijd</h3>
                  <p>{selectedItem.training.est_minutes}</p>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-sm text-gray-600">Status</h3>
                <Badge className={STATUS_META[selectedItem.status].colorClass}>
                  {STATUS_META[selectedItem.status].label}
                </Badge>
              </div>

              {selectedItem.note && (
                <div>
                  <h3 className="font-semibold text-sm text-gray-600">Notitie</h3>
                  <p className="text-sm">{selectedItem.note}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => window.open(selectedItem.training.url, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open training
                </Button>

                {selectedItem.status !== "completed" &&
                  selectedItem.status !== "mastered" && (
                    <Button
                      onClick={() => {
                        handleStatusClick(selectedItem);
                        setIsDetailsOpen(false);
                      }}
                      disabled={updatingStatus}
                    >
                      Status wijzigen
                    </Button>
                  )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectPlanService } from "@/services/projectplan.service";
import {
  ProjectPlan,
  ProjectPlanSectionKey,
  ProjectPlanSectionStatus,
  SECTION_META,
} from "@/dtos/projectplan.dto";
import { StudentSectionEditor } from "@/components/projectplan/StudentSectionEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { studentStyles } from "@/styles/student-dashboard.styles";
import { ArrowLeft } from "lucide-react";

export default function StudentProjectPlanPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = parseInt(params.projectId as string);

  const [projectPlan, setProjectPlan] = useState<ProjectPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [title, setTitle] = useState("");
  const [titleEditing, setTitleEditing] = useState(false);

  useEffect(() => {
    loadProjectPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadProjectPlan = async () => {
    setLoading(true);
    try {
      const data = await projectPlanService.getMyProjectPlan(projectId);
      setProjectPlan(data);
      setTitle(data.title || "");
    } catch (err: any) {
      console.error("Failed to load project plan:", err);
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Kon projectplan niet laden";
      toast.error(message);

      // If 404, show helpful message
      if (err.response?.status === 404) {
        toast.error("Er is nog geen projectplan voor dit project aangemaakt.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTitleSave = async () => {
    if (!projectPlan || !title.trim()) return;

    setIsUpdating(true);
    try {
      const updated = await projectPlanService.updateMyProjectPlan(
        projectPlan.id,
        { title: title.trim() }
      );
      setProjectPlan(updated);
      setTitleEditing(false);
      toast.success("Titel opgeslagen");
    } catch (err: any) {
      console.error("Failed to update title:", err);
      const message =
        err.response?.data?.detail || err.message || "Kon titel niet opslaan";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSectionUpdate = async (
    sectionKey: string,
    data: {
      text?: string;
      status: ProjectPlanSectionStatus;
      client_organisation?: string;
      client_contact?: string;
      client_email?: string;
      client_phone?: string;
      client_description?: string;
    }
  ) => {
    if (!projectPlan) return;

    setIsUpdating(true);
    try {
      const updated = await projectPlanService.updateMySection(
        projectPlan.id,
        sectionKey as ProjectPlanSectionKey,
        data
      );
      setProjectPlan(updated);

      if (data.status === "draft") {
        toast.success("Opgeslagen als concept");
      } else if (data.status === "submitted") {
        toast.success("Sectie gemarkeerd als klaar");
      }
    } catch (err: any) {
      console.error("Failed to update section:", err);
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Kon sectie niet opslaan";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!projectPlan) return;

    // Check if all required sections are submitted
    const requiredSections = SECTION_META.filter((m) => m.requiredForGo).map(
      (m) => m.key
    );
    const sections = projectPlan.sections;
    const missingRequired = requiredSections.filter((key) => {
      const section = sections.find((s) => s.key === key);
      return !section || section.status === "empty" || section.status === "draft";
    });

    if (missingRequired.length > 0) {
      const missingTitles = missingRequired
        .map((key) => SECTION_META.find((m) => m.key === key)?.title)
        .join(", ");
      toast.error(
        `Vul eerst alle verplichte secties in: ${missingTitles}`
      );
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await projectPlanService.submitPlan(projectPlan.id);
      setProjectPlan(updated);
      toast.success("Projectplan ingediend voor GO/NO-GO beoordeling! 🎉");
    } catch (err: any) {
      console.error("Failed to submit plan:", err);
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Kon projectplan niet indienen";
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "concept":
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200">
            Concept
          </Badge>
        );
      case "ingediend":
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200">
            Ingediend
          </Badge>
        );
      case "go":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            ✓ GO
          </Badge>
        );
      case "no-go":
        return (
          <Badge className="bg-rose-100 text-rose-700 border-rose-200">
            ✗ NO-GO
          </Badge>
        );
      default:
        return null;
    }
  };

  const isLocked = projectPlan?.locked || projectPlan?.status === "go";

  if (loading) {
    return (
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.layout.contentWrapper}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!projectPlan) {
    return (
      <div className={studentStyles.layout.pageContainer}>
        <div className={studentStyles.layout.contentWrapper}>
          <div className="flex flex-col items-center justify-center min-h-screen gap-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Projectplan niet gevonden
              </h2>
              <p className="text-slate-600 mb-6">
                Er is nog geen projectplan voor dit project aangemaakt.
              </p>
              <Button
                onClick={() => router.back()}
                className="bg-slate-900 hover:bg-slate-800 rounded-xl"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Terug
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={studentStyles.layout.pageContainer}>
      {/* Header */}
      <div className="w-full bg-slate-800 text-white shadow-sm">
        <div className={studentStyles.header.wrapper}>
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-white hover:bg-white/10 rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left">
              <h1 className={studentStyles.header.title}>Projectplan</h1>
              <p className={studentStyles.header.subtitle}>
                Vul alle verplichte secties in en dien je plan in voor GO/NO-GO
                beoordeling
              </p>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(projectPlan.status)}
              {isLocked && (
                <Badge className="bg-white/20 text-white border-white/30">
                  🔒 Vergrendeld
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={studentStyles.layout.contentWrapper}>
        <div className="space-y-6">
          {/* Title Editor */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Projectplan Titel
            </label>
            {titleEditing && !isLocked ? (
              <div className="flex gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Geef je projectplan een titel..."
                  disabled={isUpdating}
                  className="flex-1"
                />
                <Button
                  onClick={handleTitleSave}
                  disabled={!title.trim() || isUpdating}
                  className="bg-slate-900 hover:bg-slate-800 rounded-xl"
                >
                  Opslaan
                </Button>
                <Button
                  onClick={() => {
                    setTitle(projectPlan.title || "");
                    setTitleEditing(false);
                  }}
                  disabled={isUpdating}
                  variant="outline"
                  className="rounded-xl"
                >
                  Annuleren
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-slate-900">
                  {projectPlan.title || (
                    <span className="text-slate-400 italic">
                      Geen titel ingesteld
                    </span>
                  )}
                </div>
                {!isLocked && (
                  <Button
                    onClick={() => setTitleEditing(true)}
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                  >
                    Bewerken
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Global Teacher Feedback (if any) */}
          {projectPlan.global_teacher_note && (
            <div className="rounded-2xl border border-purple-200 bg-purple-50 p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💬</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900 mb-2">
                    Algemene feedback van docent
                  </h3>
                  <p className="text-sm text-purple-800 whitespace-pre-wrap">
                    {projectPlan.global_teacher_note}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Lock Notice */}
          {isLocked && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🔒</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-emerald-900 mb-2">
                    Projectplan vergrendeld
                  </h3>
                  <p className="text-sm text-emerald-800">
                    Je projectplan heeft een GO gekregen en is vergrendeld. Je
                    kunt geen wijzigingen meer aanbrengen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Sections */}
          <div className="space-y-4">
            {SECTION_META.map((meta) => {
              const section = projectPlan.sections.find(
                (s) => s.key === meta.key
              );
              if (!section) return null;

              return (
                <StudentSectionEditor
                  key={section.key}
                  section={section}
                  meta={meta}
                  onSave={handleSectionUpdate}
                  isLocked={isLocked}
                  isUpdating={isUpdating}
                />
              );
            })}
          </div>

          {/* Submit Section - Sticky Bottom Bar */}
          {!isLocked && projectPlan.status !== "ingediend" && (
            <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg rounded-t-2xl">
              <div className="px-6 py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Klaar om in te dienen?
                    </h3>
                    <p className="text-sm text-slate-600">
                      Controleer of alle verplichte secties zijn ingevuld
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmitForReview}
                    disabled={isUpdating}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 w-full sm:w-auto"
                  >
                    🚀 Indienen voor GO/NO-GO
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Already submitted notice */}
          {projectPlan.status === "ingediend" && !isLocked && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📝</span>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Projectplan ingediend
                  </h3>
                  <p className="text-sm text-blue-800">
                    Je projectplan is ingediend voor beoordeling. Je docent zal
                    binnenkort feedback geven. Je kunt nog steeds wijzigingen
                    aanbrengen totdat de docent een definitieve beslissing
                    heeft genomen.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom spacing for sticky bar */}
        <div className="h-20"></div>
      </div>
    </div>
  );
}

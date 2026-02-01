"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { projectPlanService } from "@/services/projectplan.service";
import { ProjectPlan, SECTION_META, ProjectPlanSectionKey } from "@/dtos/projectplan.dto";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { SectionAccordion } from "@/components/projectplan/SectionAccordion";
import { toast } from "@/lib/toast";

function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "concept":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "ingediend":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "go":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "no-go":
      return "bg-rose-100 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "concept":
      return "Concept";
    case "ingediend":
      return "Ingediend";
    case "go":
      return "GO";
    case "no-go":
      return "NO-GO";
    default:
      return status;
  }
}

export default function ProjectPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectPlanId = Number(params.projectPlanId);

  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [globalNote, setGlobalNote] = useState("");

  useEffect(() => {
    if (projectPlanId) {
      fetchPlan();
    }
  }, [projectPlanId]);

  useEffect(() => {
    if (plan) {
      setGlobalNote(plan.global_teacher_note || "");
    }
  }, [plan]);

  async function fetchPlan() {
    setLoading(true);
    setError(null);
    try {
      const data = await projectPlanService.getProjectPlan(projectPlanId);
      setPlan(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdateSectionFeedback(
    sectionKey: string,
    feedback: string,
    status: "approved" | "revision"
  ) {
    if (!plan) return;
    setIsUpdating(true);
    try {
      const updated = await projectPlanService.updateSectionFeedback(
        plan.id,
        sectionKey as ProjectPlanSectionKey,
        { teacher_note: feedback, status }
      );
      setPlan(updated);
      toast.success("Feedback opgeslagen");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Opslaan feedback mislukt");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleGlobalDecision(decision: "go" | "no-go") {
    if (!plan) return;
    const confirmed = confirm(
      `Weet je zeker dat je dit projectplan als ${decision.toUpperCase()} wilt markeren?`
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const updated = await projectPlanService.updateProjectPlan(plan.id, {
        status: decision,
        global_teacher_note: globalNote || undefined,
        locked: decision === "go",
      });
      setPlan(updated);
      toast.success(`Projectplan gemarkeerd als ${decision.toUpperCase()}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Beslissing opslaan mislukt");
    } finally {
      setIsUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Laden...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          Fout: {error || "Projectplan niet gevonden"}
        </div>
        <Link href="/teacher/projectplans" className="text-blue-600 hover:underline mt-4 block">
          ← Terug naar overzicht
        </Link>
      </div>
    );
  }

  // Calculate stats
  const requiredSections = SECTION_META.filter((m) => m.requiredForGo);
  const approvedRequired = requiredSections.filter((meta) => {
    const section = plan.sections.find((s) => s.key === meta.key);
    return section?.status === "approved";
  }).length;

  const allSectionsApproved = plan.sections.every(
    (s) => s.status === "approved" || s.status === "empty"
  );

  const canApprove = approvedRequired === requiredSections.length;

  return (
    <>
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/teacher/projectplans"
                  className="text-slate-500 hover:text-slate-700"
                >
                  ← Terug
                </Link>
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {plan.title || "Projectplan"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Project ID: {plan.project_id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusBadgeClasses(plan.status)}>
                {getStatusLabel(plan.status)}
              </Badge>
              {plan.locked && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  🔒 Vergrendeld
                </Badge>
              )}
            </div>
          </div>

          {/* Global teacher note (if exists) */}
          {plan.global_teacher_note && (
            <div className="mt-4 p-4 rounded-xl bg-purple-50 border border-purple-200">
              <div className="text-sm font-semibold text-purple-900 mb-1">
                Algemene feedback:
              </div>
              <div className="text-sm text-purple-800 whitespace-pre-wrap">
                {plan.global_teacher_note}
              </div>
            </div>
          )}
        </header>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <Tabs defaultValue="overzicht" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
            <TabsTrigger value="projectplan">Projectplan</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overzicht" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-6">
                <div className="text-sm text-slate-500 mb-1">Status</div>
                <div className="text-xl font-bold text-slate-900">
                  {getStatusLabel(plan.status)}
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-slate-500 mb-1">Verplichte secties</div>
                <div className="text-xl font-bold text-slate-900">
                  {approvedRequired}/{requiredSections.length} akkoord
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-slate-500 mb-1">Totale secties</div>
                <div className="text-xl font-bold text-slate-900">
                  {plan.sections.filter((s) => s.status !== "empty").length}/{plan.sections.length}
                </div>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                Secties overzicht
              </h3>
              <div className="space-y-2">
                {SECTION_META.map((meta) => {
                  const section = plan.sections.find((s) => s.key === meta.key);
                  return (
                    <div
                      key={meta.key}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{meta.title}</span>
                        {meta.requiredForGo && (
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                            Verplicht
                          </Badge>
                        )}
                      </div>
                      <div>
                        {section && (
                          <>
                            {section.status === "empty" && (
                              <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                                Leeg
                              </Badge>
                            )}
                            {section.status === "draft" && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                Concept
                              </Badge>
                            )}
                            {section.status === "submitted" && (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                Ingediend
                              </Badge>
                            )}
                            {section.status === "approved" && (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                Akkoord
                              </Badge>
                            )}
                            {section.status === "revision" && (
                              <Badge className="bg-rose-100 text-rose-700 border-rose-200">
                                Aanpassen
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          {/* Projectplan Tab */}
          <TabsContent value="projectplan" className="space-y-4">
            {SECTION_META.map((meta) => {
              const section = plan.sections.find((s) => s.key === meta.key);
              if (!section) return null;
              return (
                <SectionAccordion
                  key={section.id}
                  section={section}
                  meta={meta}
                  onUpdateFeedback={handleUpdateSectionFeedback}
                  isUpdating={isUpdating}
                />
              );
            })}
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
            {/* Global Note Input */}
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Algemene opmerking (optioneel)
              </label>
              <Textarea
                value={globalNote}
                onChange={(e) => setGlobalNote(e.target.value)}
                placeholder="Algemene feedback voor studenten..."
                className="min-h-[60px] resize-none"
                disabled={isUpdating}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 md:flex-col md:justify-end">
              <Button
                onClick={() => handleGlobalDecision("no-go")}
                disabled={isUpdating || plan.locked}
                className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-700 text-white"
              >
                ✗ NO-GO
              </Button>
              <Button
                onClick={() => handleGlobalDecision("go")}
                disabled={isUpdating || !canApprove || plan.locked}
                className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                ✓ GO
              </Button>
            </div>
          </div>

          {!canApprove && (
            <div className="text-xs text-amber-600 mt-2">
              ⚠️ Niet alle verplichte secties zijn akkoord. GO is nog niet mogelijk.
            </div>
          )}
          {plan.locked && (
            <div className="text-xs text-slate-600 mt-2">
              🔒 Dit projectplan is vergrendeld en kan niet meer worden gewijzigd.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

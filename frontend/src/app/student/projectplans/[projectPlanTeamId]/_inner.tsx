"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { projectPlanService } from "@/services/projectplan.service";
import {
  ProjectPlanTeam,
  ProjectPlanSection,
  SectionKey,
  SectionStatus,
  PlanStatus,
  ClientData,
} from "@/dtos/projectplan.dto";
import { Loading, ErrorMessage } from "@/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Lock, AlertCircle, CheckCircle, FileText, Save, Send } from "lucide-react";
import { ApiAuthError } from "@/lib/api";

// Section metadata
const SECTION_INFO: Record<
  SectionKey,
  { label: string; description: string; required: boolean }
> = {
  [SectionKey.CLIENT]: {
    label: "1. Opdrachtgever",
    description: "Gegevens van de opdrachtgever",
    required: true,
  },
  [SectionKey.PROBLEM]: {
    label: "2. Probleemstelling",
    description: "Wat is het probleem dat opgelost moet worden?",
    required: true,
  },
  [SectionKey.GOAL]: {
    label: "3. Doelstelling",
    description: "Wat wil je bereiken met dit project?",
    required: true,
  },
  [SectionKey.METHOD]: {
    label: "4. Methode",
    description: "Hoe ga je het project aanpakken?",
    required: true,
  },
  [SectionKey.PLANNING]: {
    label: "5. Planning",
    description: "Wat is de tijdlijn van het project?",
    required: true,
  },
  [SectionKey.TASKS]: {
    label: "6. Taakverdeling",
    description: "Wie doet wat in het team?",
    required: true,
  },
  [SectionKey.MOTIVATION]: {
    label: "7. Motivatie",
    description: "Waarom is dit project interessant?",
    required: false,
  },
  [SectionKey.RISKS]: {
    label: "8. Risico's",
    description: "Welke risico's zie je en hoe pak je die aan?",
    required: false,
  },
};

function getSectionStatusBadge(status: SectionStatus) {
  switch (status) {
    case SectionStatus.APPROVED:
      return (
        <Badge className="rounded-full bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="mr-1 h-3 w-3" /> Goedgekeurd
        </Badge>
      );
    case SectionStatus.REVISION:
      return (
        <Badge className="rounded-full bg-amber-100 text-amber-800 border-amber-200">
          <AlertCircle className="mr-1 h-3 w-3" /> Aanpassen
        </Badge>
      );
    case SectionStatus.SUBMITTED:
      return (
        <Badge className="rounded-full bg-blue-100 text-blue-800 border-blue-200">
          <Send className="mr-1 h-3 w-3" /> Ingediend
        </Badge>
      );
    case SectionStatus.DRAFT:
      return (
        <Badge className="rounded-full bg-slate-100 text-slate-800 border-slate-200">
          <FileText className="mr-1 h-3 w-3" /> Concept
        </Badge>
      );
    default:
      return (
        <Badge className="rounded-full bg-slate-100 text-slate-600 border-slate-200">
          Leeg
        </Badge>
      );
  }
}

function getPlanStatusBadge(status: PlanStatus, locked: boolean) {
  if (locked) {
    return (
      <Badge className="rounded-full bg-green-100 text-green-800 border-green-200">
        <Lock className="mr-1 h-3 w-3" /> GO (Vergrendeld)
      </Badge>
    );
  }

  switch (status) {
    case PlanStatus.GO:
      return (
        <Badge className="rounded-full bg-green-100 text-green-800 border-green-200">
          <CheckCircle className="mr-1 h-3 w-3" /> GO
        </Badge>
      );
    case PlanStatus.NO_GO:
      return (
        <Badge className="rounded-full bg-red-100 text-red-800 border-red-200">
          <AlertCircle className="mr-1 h-3 w-3" /> NO-GO
        </Badge>
      );
    case PlanStatus.INGEDIEND:
      return (
        <Badge className="rounded-full bg-blue-100 text-blue-800 border-blue-200">
          <Send className="mr-1 h-3 w-3" /> Ingediend
        </Badge>
      );
    default:
      return (
        <Badge className="rounded-full bg-slate-100 text-slate-800 border-slate-200">
          <FileText className="mr-1 h-3 w-3" /> Concept
        </Badge>
      );
  }
}

export default function ProjectPlanEditor() {
  const params = useParams();
  const router = useRouter();
  const projectPlanTeamId = Number(params?.projectPlanTeamId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [data, setData] = useState<ProjectPlanTeam | null>(null);
  const [title, setTitle] = useState("");
  const [sections, setSections] = useState<Record<SectionKey, ProjectPlanSection | null>>({} as any);
  const [editedSections, setEditedSections] = useState<Record<SectionKey, boolean>>({} as any);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await projectPlanService.getMyProjectPlan(projectPlanTeamId);
        setData(result);
        setTitle(result.title || "");

        // Initialize sections map
        const sectionsMap: Record<SectionKey, ProjectPlanSection | null> = {} as any;
        Object.values(SectionKey).forEach((key) => {
          const section = result.sections.find((s) => s.key === key);
          sectionsMap[key] = section || null;
        });
        setSections(sectionsMap);
      } catch (e: any) {
        if (e instanceof ApiAuthError) {
          setError(e.originalMessage);
        } else {
          setError(e?.response?.data?.detail || e?.message || "Laden mislukt");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectPlanTeamId]);

  const handleSaveTitle = async () => {
    if (!title.trim()) {
      setError("Vul een titel in");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await projectPlanService.updateMyProjectPlanTitle(projectPlanTeamId, { title });
      setSuccessMsg("Titel opgeslagen ✓");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSection = async (sectionKey: SectionKey) => {
    const section = sections[sectionKey];
    
    // Validate section content
    if (sectionKey === SectionKey.CLIENT) {
      const client = section?.client;
      if (!client?.organisation?.trim()) {
        setError("Vul minimaal de organisatienaam in");
        return;
      }
    } else {
      if (!section?.text?.trim()) {
        setError("Vul de sectie in voordat je opslaat");
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payload: any = {
        status: SectionStatus.DRAFT,
      };

      if (sectionKey === SectionKey.CLIENT) {
        payload.client = section?.client;
      } else {
        payload.text = section?.text;
      }

      await projectPlanService.updateMySection(projectPlanTeamId, sectionKey, payload);
      
      // Reload data to get updated section
      const result = await projectPlanService.getMyProjectPlan(projectPlanTeamId);
      setData(result);
      const sectionsMap: Record<SectionKey, ProjectPlanSection | null> = {} as any;
      Object.values(SectionKey).forEach((key) => {
        const sec = result.sections.find((s) => s.key === key);
        sectionsMap[key] = sec || null;
      });
      setSections(sectionsMap);
      setEditedSections({ ...editedSections, [sectionKey]: false });

      setSuccessMsg("Sectie opgeslagen ✓");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Opslaan mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitPlan = async () => {
    // Check if all required sections are filled
    const requiredSections = Object.entries(SECTION_INFO)
      .filter(([_, info]) => info.required)
      .map(([key, _]) => key as SectionKey);

    const unfilledSections = requiredSections.filter((key) => {
      const section = sections[key];
      if (key === SectionKey.CLIENT) {
        return !section?.client?.organisation?.trim();
      }
      return !section?.text?.trim();
    });

    if (unfilledSections.length > 0) {
      setError(
        `Vul alle verplichte secties in voordat je indient: ${unfilledSections
          .map((k) => SECTION_INFO[k].label)
          .join(", ")}`
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await projectPlanService.submitProjectPlan(projectPlanTeamId);
      
      // Reload data
      const result = await projectPlanService.getMyProjectPlan(projectPlanTeamId);
      setData(result);
      
      setSuccessMsg("Projectplan ingediend! Wacht op feedback van de docent.");
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (e: any) {
      if (e instanceof ApiAuthError) {
        setError(e.originalMessage);
      } else {
        setError(e?.response?.data?.detail || e?.message || "Indienen mislukt");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateClientField = (field: keyof ClientData, value: string) => {
    const section = sections[SectionKey.CLIENT];
    const currentClient = section?.client || {};
    const updatedClient = { ...currentClient, [field]: value };
    
    setSections({
      ...sections,
      [SectionKey.CLIENT]: {
        ...(section || ({} as ProjectPlanSection)),
        client: updatedClient,
      },
    });
    setEditedSections({ ...editedSections, [SectionKey.CLIENT]: true });
  };

  const updateSectionText = (sectionKey: SectionKey, text: string) => {
    const section = sections[sectionKey];
    setSections({
      ...sections,
      [sectionKey]: {
        ...(section || ({} as ProjectPlanSection)),
        text,
      },
    });
    setEditedSections({ ...editedSections, [sectionKey]: true });
  };

  if (loading) return <Loading />;
  if (error && !data) return <ErrorMessage message={error} />;
  if (!data) return <ErrorMessage message="Projectplan niet gevonden" />;

  const isLocked = data.locked;
  const canSubmit =
    !isLocked &&
    data.status === PlanStatus.CONCEPT &&
    Object.entries(SECTION_INFO)
      .filter(([_, info]) => info.required)
      .every((([key, _]) => {
        const section = sections[key as SectionKey];
        if (key === SectionKey.CLIENT) {
          return section?.client?.organisation?.trim();
        }
        return section?.text?.trim();
      }));

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="w-full bg-slate-800 text-white shadow-sm">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-left">
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/student?tab=projectplannen")}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  ← Terug
                </Button>
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Projectplan</h1>
              <p className="mt-1 text-sm text-white/70">
                Vul alle verplichte secties in en dien je plan in voor beoordeling.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {getPlanStatusBadge(data.status, data.locked)}
            </div>
          </div>
        </div>
      </div>

      {/* Page container */}
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-800">{successMsg}</p>
          </div>
        )}

        {/* Lock warning */}
        {isLocked && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-green-900">
                  Plan Vergrendeld
                </h3>
                <p className="text-sm text-green-700">
                  Je projectplan is goedgekeurd met een GO. Je kunt nu starten met je project!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Global teacher note */}
        {data.global_teacher_note && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Feedback van docent
                </h3>
                <p className="text-sm text-blue-800 mt-1">{data.global_teacher_note}</p>
              </div>
            </div>
          </div>
        )}

        {/* Title section */}
        <Card className="mb-6 rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Projecttitel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Geef je project een titel"
                disabled={isLocked}
                className="rounded-xl"
              />
              <Button
                onClick={handleSaveTitle}
                disabled={saving || isLocked || !title.trim()}
                size="sm"
                className="rounded-xl"
              >
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sections accordion */}
        <Card className="mb-6 rounded-2xl border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Projectplan Secties</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full">
              {Object.entries(SECTION_INFO)
                .sort(([keyA], [keyB]) => {
                  // Define the fixed order of sections
                  const order = [
                    SectionKey.CLIENT,
                    SectionKey.PROBLEM,
                    SectionKey.GOAL,
                    SectionKey.METHOD,
                    SectionKey.PLANNING,
                    SectionKey.TASKS,
                    SectionKey.MOTIVATION,
                    SectionKey.RISKS,
                  ];
                  return order.indexOf(keyA as SectionKey) - order.indexOf(keyB as SectionKey);
                })
                .map(([key, info]) => {
                const sectionKey = key as SectionKey;
                const section = sections[sectionKey];
                const isEdited = editedSections[sectionKey];

                return (
                  <AccordionItem key={sectionKey} value={sectionKey}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {info.label}
                            {info.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </span>
                        </div>
                        {getSectionStatusBadge(section?.status || SectionStatus.EMPTY)}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-4">
                        <p className="text-sm text-slate-600">{info.description}</p>

                        {/* Client section has multiple fields */}
                        {sectionKey === SectionKey.CLIENT ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-medium text-slate-700 mb-1 block">
                                Organisatie *
                              </label>
                              <Input
                                value={section?.client?.organisation || ""}
                                onChange={(e) =>
                                  updateClientField("organisation", e.target.value)
                                }
                                placeholder="Naam van de organisatie"
                                disabled={isLocked}
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-700 mb-1 block">
                                Contactpersoon
                              </label>
                              <Input
                                value={section?.client?.contact || ""}
                                onChange={(e) =>
                                  updateClientField("contact", e.target.value)
                                }
                                placeholder="Naam contactpersoon"
                                disabled={isLocked}
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-700 mb-1 block">
                                Email
                              </label>
                              <Input
                                type="email"
                                value={section?.client?.email || ""}
                                onChange={(e) =>
                                  updateClientField("email", e.target.value)
                                }
                                placeholder="email@voorbeeld.nl"
                                disabled={isLocked}
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-700 mb-1 block">
                                Telefoon
                              </label>
                              <Input
                                type="tel"
                                value={section?.client?.phone || ""}
                                onChange={(e) =>
                                  updateClientField("phone", e.target.value)
                                }
                                placeholder="+31 6 12345678"
                                disabled={isLocked}
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-700 mb-1 block">
                                Beschrijving
                              </label>
                              <Textarea
                                value={section?.client?.description || ""}
                                onChange={(e) =>
                                  updateClientField("description", e.target.value)
                                }
                                placeholder="Omschrijving van de opdrachtgever"
                                disabled={isLocked}
                                className="rounded-xl min-h-[100px] resize-y"
                              />
                            </div>
                          </div>
                        ) : (
                          /* Other sections have a large textarea */
                          <Textarea
                            value={section?.text || ""}
                            onChange={(e) =>
                              updateSectionText(sectionKey, e.target.value)
                            }
                            placeholder={`Vul hier de ${info.label.toLowerCase()} in...`}
                            disabled={isLocked}
                            className="rounded-xl min-h-[200px] resize-y"
                          />
                        )}

                        {/* Teacher feedback */}
                        {section?.teacher_note && (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                            <p className="text-xs font-medium text-amber-900 mb-1">
                              Feedback docent:
                            </p>
                            <p className="text-xs text-amber-800">
                              {section.teacher_note}
                            </p>
                          </div>
                        )}

                        {/* Save button */}
                        <Button
                          onClick={() => handleSaveSection(sectionKey)}
                          disabled={saving || isLocked || !isEdited}
                          size="sm"
                          className="rounded-xl"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          Opslaan
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Submit button */}
        {!isLocked && data.status === PlanStatus.CONCEPT && (
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Klaar om in te dienen?
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Controleer of alle verplichte secties ingevuld zijn voordat je indient.
                  </p>
                </div>
                <Button
                  onClick={handleSubmitPlan}
                  disabled={saving || !canSubmit}
                  className="rounded-xl"
                  size="lg"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Indienen voor beoordeling
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

"use client";
import { useAuth } from "@/hooks/useAuth";
import { NavItem } from "@/components/admin/NavItem";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  Layers,
  CheckSquare,
  Users,
  BarChart3,
  FileEdit,
  Building2,
  School,
  Target,
  ClipboardList,
  FileStack,
  BookOpen,
  UsersRound,
} from "lucide-react";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-700 border-r border-slate-600 text-slate-100">
        <div className="p-4">
          <h1 className="text-xl font-bold mb-6 text-white">
            {isAdmin ? "Admin" : "Teacher"}
          </h1>

          <nav className="space-y-4">
            {/* ALGEMEEN Section */}
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                Algemeen
              </div>
              <div className="space-y-1">
                <NavItem href="/teacher" label="Dashboard" icon={LayoutDashboard} />
                <NavItem href="/teacher/calendar" label="Kalender" icon={Calendar} />
                <NavItem href="/teacher/overview" label="Overzicht" icon={FileText} />
              </div>
            </div>

            {/* PROJECTTOOLS Section */}
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                Projecttools
              </div>
              <div className="space-y-1">
                <NavItem href="/teacher/projects" label="Projecten" icon={Layers} />
                <NavItem href="/teacher/project-assessments" label="Projectbeoordeling" icon={CheckSquare} />
                <NavItem href="/teacher/evaluations" label="Peerevaluaties" icon={Users} />
                <NavItem href="/teacher/competencies" label="Competentiemonitor" icon={BarChart3} />
                <NavItem href="/teacher/project-notes" label="Projectaantekeningen" icon={FileEdit} />
                <NavItem href="/teacher/clients" label="Opdrachtgevers" icon={Building2} />
              </div>
            </div>

            {/* BEHEER Section (Admin only) */}
            {isAdmin && (
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                  Beheer
                </div>
                <div className="space-y-1">
                  <NavItem href="/teacher/admin/schoolbeheer" label="Schoolbeheer" icon={School} />
                  <NavItem href="/teacher/learning-objectives" label="Leerdoelen" icon={Target} />
                  <NavItem href="/teacher/rubrics" label="Rubrics" icon={ClipboardList} />
                  <NavItem href="/teacher/admin/templates" label="Templates" icon={FileStack} />
                </div>
              </div>
            )}

            {/* Teacher-specific items */}
            {!isAdmin && (
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                  Beheer
                </div>
                <div className="space-y-1">
                  <NavItem href="/teacher/courses" label="Vakken beheren" icon={BookOpen} />
                  <NavItem href="/teacher/class-teams" label="Klas- & Teambeheer" icon={UsersRound} />
                  <NavItem href="/teacher/learning-objectives" label="Leerdoelen" icon={Target} />
                  <NavItem href="/teacher/rubrics" label="Rubrics" icon={ClipboardList} />
                </div>
              </div>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

"use client";
import { useAuth } from "@/hooks/useAuth";
import { NavItem } from "@/components/admin/NavItem";

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
                <NavItem href="/teacher" label="Dashboard" />
                <NavItem href="/teacher/calendar" label="Kalender" />
                <NavItem href="/teacher/overview" label="Overzicht" />
              </div>
            </div>

            {/* PROJECTTOOLS Section */}
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                Projecttools
              </div>
              <div className="space-y-1">
                <NavItem href="/teacher/projects" label="Projecten" />
                <NavItem href="/teacher/project-assessments" label="Projectbeoordeling" />
                <NavItem href="/teacher/evaluations" label="Peerevaluaties" />
                <NavItem href="/teacher/competencies" label="Competentiemonitor" />
                <NavItem href="/teacher/project-notes" label="Projectaantekeningen" />
                <NavItem href="/teacher/clients" label="Opdrachtgevers" />
              </div>
            </div>

            {/* BEHEER Section (Admin only) */}
            {isAdmin && (
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-[0.16em] text-slate-500 mb-1 mt-1 px-3">
                  Beheer
                </div>
                <div className="space-y-1">
                  <NavItem href="/teacher/admin/schoolbeheer" label="Schoolbeheer" />
                  <NavItem href="/teacher/learning-objectives" label="Leerdoelen" />
                  <NavItem href="/teacher/rubrics" label="Rubrics" />
                  <NavItem href="/teacher/admin/templates" label="Templates" />
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
                  <NavItem href="/teacher/courses" label="Vakken beheren" />
                  <NavItem href="/teacher/class-teams" label="Klas- & Teambeheer" />
                  <NavItem href="/teacher/learning-objectives" label="Leerdoelen" />
                  <NavItem href="/teacher/rubrics" label="Rubrics" />
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

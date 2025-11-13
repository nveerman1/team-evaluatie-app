"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isAdmin, loading: authLoading } = useAuth();

  // Define navigation items based on role
  const getNavItems = () => {
    if (isAdmin) {
      return [
        { href: "/teacher", label: "Dashboard" },
        { href: "/teacher/overview", label: "Overzicht" },
        { href: "/teacher/courses", label: "Vakken beheren" },
        { href: "/teacher/project-assessments", label: "Projectbeoordeling" },
        { href: "/teacher/evaluations", label: "Evaluaties" },
        { href: "/teacher/competencies", label: "Competentiemonitor" },
        { href: "/teacher/learning-objectives", label: "Leerdoelen" },
        { href: "/teacher/analytics", label: "Analytics" },
        { href: "/teacher/rubrics", label: "Rubrics" },
      ];
    } else {
      // Teacher navigation
      return [
        { href: "/teacher", label: "Dashboard" },
        { href: "/teacher/overview", label: "Overzicht" },
        { href: "/teacher/class-teams", label: "Klas- & Teambeheer" },
        { href: "/teacher/project-assessments", label: "Projectbeoordeling" },
        { href: "/teacher/evaluations", label: "Evaluaties" },
        { href: "/teacher/competencies", label: "Competentiemonitor" },
        { href: "/teacher/learning-objectives", label: "Leerdoelen" },
        { href: "/teacher/rubrics", label: "Rubrics" },
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm p-4">
        <h1 className="text-xl font-bold mb-6">
          {isAdmin ? "Admin" : "Teacher"}
        </h1>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg ${
                pathname.startsWith(item.href)
                  ? "bg-gray-200 font-semibold"
                  : "hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <header className="border-b pb-4 mb-6">
          <h2 className="text-2xl font-semibold">
            {isAdmin ? "Admin Dashboard" : "Teacher Dashboard"}
          </h2>
        </header>
        {children}
      </main>
    </div>
  );
}

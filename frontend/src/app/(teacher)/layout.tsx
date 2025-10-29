"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/project-assessments", label: "Projectbeoordeling" },
  { href: "/teacher/evaluations", label: "Evaluaties" },
  { href: "/teacher/admin/students", label: "Leerlingen" },
  { href: "/teacher/rubrics", label: "Rubrics" },
];

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r shadow-sm p-4">
        <h1 className="text-xl font-bold mb-6">Teacher</h1>
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
          <h2 className="text-2xl font-semibold">Teacher Dashboard</h2>
        </header>
        {children}
      </main>
    </div>
  );
}

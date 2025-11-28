"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { id: "heatmap", label: "Heatmap", href: (id: string) => `/teacher/competencies/windows/${id}` },
  { id: "leerdoelen", label: "Leerdoelen", href: (id: string) => `/teacher/competencies/windows/${id}/leerdoelen` },
  { id: "reflecties", label: "Reflecties", href: (id: string) => `/teacher/competencies/windows/${id}/reflecties` },
  { id: "analyse", label: "Analyse", href: (id: string) => `/teacher/competencies/windows/${id}/analyse` },
];

type CompetencyMonitorTabsProps = {
  windowId: string;
};

export function CompetencyMonitorTabs({ windowId }: CompetencyMonitorTabsProps) {
  const pathname = usePathname();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (!pathname) return "heatmap";
    
    // Check for specific tab paths
    if (pathname.includes("/leerdoelen")) return "leerdoelen";
    if (pathname.includes("/reflecties")) return "reflecties";
    if (pathname.includes("/analyse")) return "analyse";
    
    // Default to heatmap for base path
    return "heatmap";
  };

  const activeTab = getActiveTab();

  return (
    <div className="border-b border-gray-200">
      <nav className="flex gap-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={tab.href(windowId)}
              className={`
                py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  isActive
                    ? "border-black text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }
              `}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { id: "submissions", label: "Inleveren", href: (id: string) => `/student/project-assessments/${id}/submissions` },
  { id: "overview", label: "Overzicht", href: (id: string) => `/student/project-assessments/${id}` },
];

type StudentProjectAssessmentTabsProps = {
  assessmentId: string;
};

export function StudentProjectAssessmentTabs({ assessmentId }: StudentProjectAssessmentTabsProps) {
  const pathname = usePathname();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (!pathname) return "overview";
    
    // Check if on submissions page
    if (pathname.includes('/submissions')) {
      return "submissions";
    }
    
    // Use regex to extract the segment after /project-assessments/{id}/
    const match = pathname.match(/\/project-assessments\/[^/]+\/([^/?]+)/);
    const tabSegment = match?.[1];
    
    // Match the segment to a valid tab id from the tabs array
    return tabs.find(tab => tab.id === tabSegment)?.id || "overview";
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
              href={tab.href(assessmentId)}
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

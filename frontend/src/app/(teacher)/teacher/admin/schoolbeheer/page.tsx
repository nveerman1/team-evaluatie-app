"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Tabs } from "@/components/Tabs";
import SectionsManagement from "@/components/admin/SectionsManagement";
import CoursesManagement from "@/components/admin/CoursesManagement";
import TeachersManagement from "@/components/admin/TeachersManagement";

export default function SchoolbeheerPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial tab from URL or default to "secties"
  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || "secties");

  // Redirect non-admins
  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push("/teacher");
    }
  }, [isAdmin, loading, router]);

  // Update URL when tab changes
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Update URL with new tab parameter
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tabId);
    window.history.pushState({}, "", url);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const tabs = [
    {
      id: "secties",
      label: "Secties",
      content: <SectionsManagement />,
    },
    {
      id: "vakken",
      label: "Vakken",
      content: <CoursesManagement />,
    },
    {
      id: "docenten",
      label: "Docenten",
      content: <TeachersManagement />,
    },
  ];

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
            Schoolbeheer
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Beheer secties, vakken en docenten van jouw school
          </p>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </>
  );
}

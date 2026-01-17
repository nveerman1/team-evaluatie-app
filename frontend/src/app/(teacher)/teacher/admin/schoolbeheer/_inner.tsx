"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Tabs } from "@/components/Tabs";
import SectionsManagement from "@/components/admin/SectionsManagement";
import CoursesManagement from "@/components/admin/CoursesManagement";
import TeachersManagement from "@/components/admin/TeachersManagement";
import StudentsManagement from "@/components/admin/StudentsManagement";
import AcademicYearsManagement from "@/components/admin/AcademicYearsManagement";

export default function SchoolbeheerPageInner() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get initial tab from URL or default to "secties"
  const tabParam = searchParams?.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || "secties");
  
  // Refs to call methods on child components
  const sectiesRef = useRef<any>(null);
  const vakkenRef = useRef<any>(null);
  const docentenRef = useRef<any>(null);
  const leerlingenRef = useRef<any>(null);
  const jarenRef = useRef<any>(null);

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
      content: <SectionsManagement ref={sectiesRef} />,
    },
    {
      id: "vakken",
      label: "Vakken",
      content: <CoursesManagement ref={vakkenRef} />,
    },
    {
      id: "docenten",
      label: "Docenten",
      content: <TeachersManagement ref={docentenRef} />,
    },
    {
      id: "leerlingen",
      label: "Leerlingen",
      content: <StudentsManagement ref={leerlingenRef} />,
    },
    {
      id: "jaren",
      label: "Academische Jaren",
      content: <AcademicYearsManagement ref={jarenRef} />,
    },
  ];

  // Render action buttons based on active tab
  const renderHeaderActions = () => {
    switch (activeTab) {
      case "secties":
        return (
          <button
            onClick={() => sectiesRef.current?.handleCreate?.()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuwe sectie
          </button>
        );
      case "vakken":
        return (
          <button
            onClick={() => vakkenRef.current?.handleCreate?.()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            + Nieuw vak
          </button>
        );
      case "docenten":
        return (
          <div className="flex gap-3">
            <button
              onClick={() => docentenRef.current?.handleExportCSV?.()}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Exporteer CSV
            </button>
            <button
              onClick={() => docentenRef.current?.handleImportCSV?.()}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Importeer CSV
            </button>
            <button
              onClick={() => docentenRef.current?.handleCreate?.()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuwe docent
            </button>
          </div>
        );
      case "leerlingen":
        return (
          <div className="flex gap-3">
            <button
              onClick={() => leerlingenRef.current?.handleImportCSV?.()}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Importeer CSV
            </button>
            <button
              onClick={() => leerlingenRef.current?.handleExportCSV?.()}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Exporteer CSV
            </button>
            <button
              onClick={() => leerlingenRef.current?.handleCreate?.()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuwe leerling
            </button>
          </div>
        );
      case "jaren":
        return (
          <div className="flex gap-3">
            <button
              onClick={() => jarenRef.current?.handleTransition?.()}
              className="rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Jaartransitie
            </button>
            <button
              onClick={() => jarenRef.current?.handleCreate?.()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + Nieuw Academisch Jaar
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Schoolbeheer
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Beheer secties, vakken, docenten, leerlingen en academische jaren van jouw school
            </p>
          </div>
          <div className="flex gap-3">
            {renderHeaderActions()}
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </>
  );
}

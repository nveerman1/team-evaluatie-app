"use client";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { get_role_home_path } from "@/lib/role-utils";

/**
 * Student layout wrapper that checks role-based access
 */
export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, loading } = useAuth();
  const router = useRouter();

  // Role-based access control
  useEffect(() => {
    if (!loading && user && role) {
      // Only students can access student routes
      if (role !== "student") {
        // Redirect to correct home for their role
        const correctPath = get_role_home_path(role);
        router.replace(correctPath);
      }
    }
  }, [user, role, loading, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render if wrong role (will redirect)
  if (!user || role !== "student") {
    return null;
  }

  return <>{children}</>;
}

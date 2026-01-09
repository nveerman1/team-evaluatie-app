"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading, error } = useCurrentUser();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only redirect once we have a user and haven't redirected yet
    if (!loading && user && !hasRedirected) {
      setHasRedirected(true);
      
      // Redirect based on user role
      if (user.role === "teacher") {
        router.push("/teacher");
      } else if (user.role === "student") {
        router.push("/student");
      } else {
        router.push("/");
      }
    }
  }, [user, loading, hasRedirected, router]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Authentication Error
          </h1>
          <p className="text-gray-600 mb-4">
            Er is een fout opgetreden bij het inloggen. Probeer het opnieuw.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Terug naar login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <h1 className="text-xl font-semibold">Inloggen...</h1>
        <p className="text-gray-500 mt-2">Een moment geduld alstublieft</p>
      </div>
    </div>
  );
}

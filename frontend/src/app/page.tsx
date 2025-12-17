"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { authService } from "@/services/auth.service";

export default function Home() {
  const [email, setEmail] = useState("");
  const [showDevWarning, setShowDevWarning] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    const e = localStorage.getItem("x_user_email");
    if (e) setEmail(e);
    
    // Check if we're in production mode
    // When in production, show warning and disable dev-login
    const isProd = process.env.NODE_ENV === "production";
    setShowDevWarning(isProd);
  }, []);
  
  const go = (path: string) => router.push(path);
  
  const handleAzureLogin = () => {
    // For Azure AD login, redirect to backend OAuth endpoint
    // Default to school_id=1 for demo, in production this should be selected
    const schoolId = 1;
    authService.redirectToAzureLogin(schoolId);
  };

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Team Evaluatie App — MVP</h1>
      
      {/* Azure AD Login - Production Method */}
      <div className="p-4 border rounded-xl space-y-3 bg-blue-50">
        <h2 className="text-lg font-semibold">Office 365 Login</h2>
        <p className="text-sm text-gray-600">
          Gebruik je schoolaccount om in te loggen via Office 365.
        </p>
        <button
          className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 w-full"
          onClick={handleAzureLogin}
        >
          Login met Office 365
        </button>
      </div>
      
      {/* Dev Login - Development Only */}
      <div className={`p-4 border rounded-xl space-y-3 ${showDevWarning ? "bg-red-50 border-red-300" : ""}`}>
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium">Dev-login (X-User-Email)</label>
          {showDevWarning && (
            <span className="text-xs text-red-600 font-semibold">⚠️ DEVELOPMENT ONLY</span>
          )}
        </div>
        
        {showDevWarning && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-xs">
            <strong>Warning:</strong> Dev-login is disabled in production mode. 
            Please use Azure AD authentication (Office 365).
          </div>
        )}
        
        <input
          className="w-full border rounded px-3 py-2"
          placeholder="student1@example.com of docent@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={showDevWarning}
        />
        <button
          className={`px-4 py-2 rounded-xl ${showDevWarning ? "bg-gray-400" : "bg-black text-white"}`}
          onClick={() => {
            if (!showDevWarning) {
              localStorage.setItem("x_user_email", email);
            }
          }}
          disabled={showDevWarning}
        >
          Opslaan
        </button>
        
        {!showDevWarning && (
          <p className="text-xs text-gray-500">
            ⚠️ Alleen voor lokale ontwikkeling. In productie wordt Azure AD gebruikt.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          className="px-4 py-3 rounded-xl border"
          onClick={() => go("/student")}
        >
          Student
        </button>
        <button
          className="px-4 py-3 rounded-xl border"
          onClick={() => go("/teacher")}
        >
          Teacher
        </button>
      </div>
    </main>
  );
}

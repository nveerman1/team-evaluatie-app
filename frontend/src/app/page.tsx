"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { authService } from "@/services/auth.service";

export default function Home() {
  const [email, setEmail] = useState("");
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const e = localStorage.getItem("x_user_email");
    if (e) setEmail(e);
    
    // Check if dev-login is enabled via environment variable
    const isDevLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";
    setDevLoginEnabled(isDevLoginEnabled);
  }, []);
  
  const handleAzureLogin = () => {
    // Get returnTo from URL params if present
    const returnTo = searchParams.get("returnTo") || undefined;
    
    // For Azure AD login, redirect to backend OAuth endpoint
    // Default to school_id=1 for demo, in production this should be selected
    const schoolId = 1;
    authService.redirectToAzureLogin(schoolId, returnTo);
  };

  const handleDevLogin = async () => {
    if (!devLoginEnabled || !email || isLoggingIn) return;
    
    setIsLoggingIn(true);
    setError(null);
    
    try {
      // Save email to localStorage for next time
      localStorage.setItem("x_user_email", email);
      
      // Get returnTo from URL params if present
      const returnTo = searchParams.get("returnTo") || undefined;
      
      // Call dev-login with fetch (POST) - this will redirect on success
      await authService.devLogin(email, returnTo);
    } catch (err) {
      setIsLoggingIn(false);
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  return (
    <main className="p-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Team Evaluatie App</h1>
      
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
      {devLoginEnabled && (
        <div className="p-4 border rounded-xl space-y-3 bg-yellow-50 border-yellow-300">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Dev-login (Development Only)</label>
            <span className="text-xs text-yellow-700 font-semibold">⚠️ DEV ONLY</span>
          </div>
          
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-xs">
            <strong>Development Mode:</strong> Dit is alleen beschikbaar in lokale ontwikkeling.
            Voer een email in en klik op "Dev Login".
          </div>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}
          
          <input
            className="w-full border rounded px-3 py-2"
            placeholder="student1@example.com of docent@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDevLogin();
            }}
            disabled={isLoggingIn}
          />
          <button
            type="button"
            className={`px-4 py-2 rounded-xl w-full ${
              isLoggingIn
                ? "bg-yellow-400 cursor-wait"
                : "bg-yellow-600 hover:bg-yellow-700"
            } text-white`}
            onClick={handleDevLogin}
            disabled={!email || isLoggingIn}
          >
            {isLoggingIn ? "Inloggen..." : "Dev Login"}
          </button>
          
          <p className="text-xs text-gray-600">
            💡 Tip: Gebruik admin@school.nl, docent@school.nl, of student1@school.nl
          </p>
        </div>
      )}

      {!devLoginEnabled && (
        <div className="p-4 border rounded-xl bg-gray-50 text-center text-sm text-gray-600">
          Voor lokale ontwikkeling: zet NEXT_PUBLIC_ENABLE_DEV_LOGIN=true in je .env.local
        </div>
      )}
    </main>
  );
}

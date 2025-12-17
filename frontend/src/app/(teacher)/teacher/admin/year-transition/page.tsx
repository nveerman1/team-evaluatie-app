"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import YearTransitionWizard from "@/components/admin/YearTransitionWizard";
import { Button } from "@/components/ui/button";

export default function YearTransitionPage() {
  const { isAdmin, loading } = useAuth();
  const router = useRouter();
  const [showWizard, setShowWizard] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    router.push("/teacher");
    return null;
  }

  return (
    <>
      {/* Page Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200/70">
        <header className="px-6 py-6 max-w-6xl mx-auto">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900">
              Academisch Jaar Transitie
            </h1>
            <p className="text-gray-600 mt-1 text-sm">
              Verplaats studenten en klassen naar een nieuw academisch jaar
            </p>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">
                Over de jaartransitie
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">
                De academisch jaar transitie functie stelt je in staat om
                veilig studenten en klassen van het ene academisch jaar naar
                het volgende over te dragen zonder historische gegevens te
                verliezen.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Wat gebeurt er tijdens de transitie?
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>
                  Nieuwe klassen worden aangemaakt in het doeljaar op basis van
                  de mapping
                </li>
                <li>
                  Studenten worden gekoppeld aan hun nieuwe klassen voor het
                  nieuwe jaar
                </li>
                <li>
                  Optioneel worden vakken en inschrijvingen ook gekopieerd
                </li>
                <li>
                  Alle historische gegevens (projecten, teams, beoordelingen)
                  blijven intact
                </li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">
                Belangrijke opmerkingen
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Deze bewerking kan niet ongedaan worden gemaakt</li>
                <li>
                  Het is aanbevolen om eerst te testen met een klein aantal
                  klassen
                </li>
                <li>
                  Zorg dat het doeljaar al is aangemaakt voordat je de transitie
                  start
                </li>
                <li>Alle bewerkingen worden uitgevoerd in één transactie</li>
              </ul>
            </div>

            <div className="pt-4">
              <Button
                onClick={() => setShowWizard(true)}
                className="bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                Start Transitie Wizard
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Wizard Modal */}
      <YearTransitionWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={() => {
          setShowWizard(false);
          // Could add a success toast here
        }}
      />
    </>
  );
}

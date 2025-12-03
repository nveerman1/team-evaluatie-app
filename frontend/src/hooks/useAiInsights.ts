"use client";

import { useState, useEffect, useCallback } from "react";

// Types for AI insights
export type StudentAiSummary = {
  student_id: number;
  student_name: string;
  class_name: string;
  sterk_in: string[];
  ontwikkelt_in: string[];
  aandachtspunt: string;
  suggestie: string;
};

export type ReflectionItem = {
  id: string;
  date: string;
  category: "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";
  note: string;
};

export type StudentReflections = {
  student_id: number;
  student_name: string;
  reflections: ReflectionItem[];
};

export type AiInsightsData = {
  studentSummaries: StudentAiSummary[];
  studentReflections: StudentReflections[];
};

// Mock data generator
function generateMockAiInsightsData(): AiInsightsData {
  const studentSummaries: StudentAiSummary[] = [
    {
      student_id: 1,
      student_name: "Jan de Vries",
      class_name: "4A",
      sterk_in: ["Plannen en organiseren", "Initiatief nemen"],
      ontwikkelt_in: ["Zelfstandig werken"],
      aandachtspunt: "Soms te dominant in groepssituaties",
      suggestie: "Oefen met anderen de ruimte te geven om ideeën te delen",
    },
    {
      student_id: 2,
      student_name: "Maria Jansen",
      class_name: "4A",
      sterk_in: ["Samenwerking", "Empathie"],
      ontwikkelt_in: ["Assertiviteit"],
      aandachtspunt: "Durft eigen mening niet altijd te geven",
      suggestie: "Probeer in kleinere groepjes je standpunt te verdedigen",
    },
    {
      student_id: 3,
      student_name: "Peter Bakker",
      class_name: "4B",
      sterk_in: ["Creativiteit"],
      ontwikkelt_in: ["Planning", "Zelfvertrouwen", "Tijdmanagement"],
      aandachtspunt: "Structureel lage scores op meerdere gebieden",
      suggestie: "Begin met kleine, haalbare doelen en vier successen",
    },
    {
      student_id: 4,
      student_name: "Sophie van Dam",
      class_name: "4B",
      sterk_in: ["Zelfstandigheid", "Verantwoordelijkheid", "Communicatie"],
      ontwikkelt_in: [],
      aandachtspunt: "Geen specifieke aandachtspunten",
      suggestie: "Kan als mentor fungeren voor andere studenten",
    },
    {
      student_id: 5,
      student_name: "Lucas Mulder",
      class_name: "4A",
      sterk_in: ["Technische vaardigheden"],
      ontwikkelt_in: ["Communicatie", "Aanwezigheid"],
      aandachtspunt: "Communicatie binnen het team kan beter",
      suggestie: "Gebruik een dagelijkse check-in met het team",
    },
  ];

  const studentReflections: StudentReflections[] = [
    {
      student_id: 1,
      student_name: "Jan de Vries",
      reflections: [
        {
          id: "r1",
          date: "2024-11-15",
          category: "organiseren",
          note: "Ik heb geleerd om beter te plannen door taken te prioriteren.",
        },
        {
          id: "r2",
          date: "2024-10-20",
          category: "meedoen",
          note: "Samenwerken ging goed, maar ik kan meer ruimte geven aan anderen.",
        },
      ],
    },
    {
      student_id: 2,
      student_name: "Maria Jansen",
      reflections: [
        {
          id: "r3",
          date: "2024-11-15",
          category: "zelfvertrouwen",
          note: "Ik durf steeds vaker mijn mening te geven in de groep.",
        },
      ],
    },
    {
      student_id: 3,
      student_name: "Peter Bakker",
      reflections: [
        {
          id: "r4",
          date: "2024-11-15",
          category: "organiseren",
          note: "Ik wil beter leren plannen. Deadlines zijn moeilijk.",
        },
        {
          id: "r5",
          date: "2024-10-20",
          category: "zelfvertrouwen",
          note: "Ik twijfel soms aan mezelf, maar ik probeer positief te blijven.",
        },
      ],
    },
    {
      student_id: 4,
      student_name: "Sophie van Dam",
      reflections: [
        {
          id: "r6",
          date: "2024-11-15",
          category: "autonomie",
          note: "Ik werk graag zelfstandig en neem verantwoordelijkheid.",
        },
      ],
    },
    {
      student_id: 5,
      student_name: "Lucas Mulder",
      reflections: [
        {
          id: "r7",
          date: "2024-11-15",
          category: "meedoen",
          note: "Ik moet beter communiceren met mijn team. Dat is een leerpunt.",
        },
      ],
    },
  ];

  return {
    studentSummaries,
    studentReflections,
  };
}

export function useAiInsights() {
  const [data, setData] = useState<AiInsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Return mock data
      const mockData = generateMockAiInsightsData();
      setData(mockData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load AI insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

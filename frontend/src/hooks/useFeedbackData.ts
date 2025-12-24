"use client";

import { useState, useEffect, useCallback } from "react";

// Types for feedback data
export type FeedbackItem = {
  id: string;
  student_id: number;
  student_name: string;
  project_name: string;
  date: string;
  category: "organiseren" | "meedoen" | "zelfvertrouwen" | "autonomie";
  sentiment: "positief" | "kritiek" | "waarschuwing";
  text: string;
  keywords: string[];
  is_risk_behavior: boolean;
};

export type AiCluster = {
  id: string;
  title: string;
  count: number;
  student_ids: number[];
};

export type FeedbackFilters = {
  evaluationIds?: number[];
  category?: string;
  sentiment?: string;
  searchText?: string;
  riskOnly?: boolean;
};

export type FeedbackData = {
  feedbackItems: FeedbackItem[];
  totalCount: number;
};

// Mock data generator
function generateMockFeedbackData(): FeedbackData {
  const feedbackItems: FeedbackItem[] = [
    {
      id: "1",
      student_id: 1,
      student_name: "Jan de Vries",
      project_name: "Webshop Project",
      date: "2024-11-15",
      category: "organiseren",
      sentiment: "positief",
      text: "Jan neemt initiatief bij het plannen van taken en houdt het team op schema.",
      keywords: ["plannen", "initiatief", "team"],
      is_risk_behavior: false,
    },
    {
      id: "2",
      student_id: 2,
      student_name: "Maria Jansen",
      project_name: "Webshop Project",
      date: "2024-11-15",
      category: "meedoen",
      sentiment: "positief",
      text: "Maria werkt uitstekend samen en helpt anderen waar nodig.",
      keywords: ["samenwerking", "helpen"],
      is_risk_behavior: false,
    },
    {
      id: "3",
      student_id: 3,
      student_name: "Peter Bakker",
      project_name: "Webshop Project",
      date: "2024-11-15",
      category: "zelfvertrouwen",
      sentiment: "waarschuwing",
      text: "Peter lijkt onzeker over zijn eigen bijdrage en vraagt vaak bevestiging.",
      keywords: ["onzeker", "bevestiging"],
      is_risk_behavior: true,
    },
    {
      id: "4",
      student_id: 3,
      student_name: "Peter Bakker",
      project_name: "Webshop Project",
      date: "2024-11-15",
      category: "organiseren",
      sentiment: "kritiek",
      text: "Peter heeft moeite met het plannen van zijn werk en mist regelmatig deadlines.",
      keywords: ["plannen", "deadlines"],
      is_risk_behavior: true,
    },
    {
      id: "5",
      student_id: 4,
      student_name: "Sophie van Dam",
      project_name: "App Ontwikkeling",
      date: "2024-10-20",
      category: "autonomie",
      sentiment: "positief",
      text: "Sophie werkt zelfstandig en neemt verantwoordelijkheid voor haar taken.",
      keywords: ["zelfstandig", "verantwoordelijkheid"],
      is_risk_behavior: false,
    },
    {
      id: "6",
      student_id: 5,
      student_name: "Lucas Mulder",
      project_name: "App Ontwikkeling",
      date: "2024-10-20",
      category: "meedoen",
      sentiment: "kritiek",
      text: "Lucas is soms afwezig tijdens groepsoverleg en communiceert niet altijd duidelijk.",
      keywords: ["afwezig", "communicatie"],
      is_risk_behavior: false,
    },
  ];

  return {
    feedbackItems,
    totalCount: feedbackItems.length,
  };
}

export function useFeedbackData(filters?: FeedbackFilters) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Get mock data
      const mockData = generateMockFeedbackData();
      
      // Apply filters
      let filteredItems = [...mockData.feedbackItems];
      
      if (filters?.category) {
        filteredItems = filteredItems.filter((item) => item.category === filters.category);
      }
      if (filters?.sentiment) {
        filteredItems = filteredItems.filter((item) => item.sentiment === filters.sentiment);
      }
      if (filters?.searchText) {
        const query = filters.searchText.toLowerCase();
        filteredItems = filteredItems.filter(
          (item) =>
            item.text.toLowerCase().includes(query) ||
            item.keywords.some((k) => k.toLowerCase().includes(query))
        );
      }
      if (filters?.riskOnly) {
        filteredItems = filteredItems.filter((item) => item.is_risk_behavior);
      }
      
      setData({
        feedbackItems: filteredItems,
        totalCount: filteredItems.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feedback data");
    } finally {
      setLoading(false);
    }
  }, [filters?.category, filters?.sentiment, filters?.searchText, filters?.riskOnly]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}

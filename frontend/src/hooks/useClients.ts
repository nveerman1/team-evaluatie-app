import { useState, useEffect } from "react";
import { clientService } from "@/services";
import {
  ClientListResponse,
  Client,
  ClientLogListResponse,
  ReminderListResponse,
} from "@/dtos/client.dto";
import { useDebounce } from "./useDebounce";

/**
 * Custom hook for fetching and managing clients with debounced search
 */
export function useClients(params?: {
  page?: number;
  per_page?: number;
  level?: string;
  status?: string;
  search?: string;
  autoFetch?: boolean;
}) {
  const [data, setData] = useState<ClientListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce the search term
  const debouncedSearch = useDebounce(params?.search, 500);

  useEffect(() => {
    if (params?.autoFetch === false) return;

    const fetchClients = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await clientService.listClients({
          ...params,
          search: debouncedSearch,
        });
        setData(result);
      } catch (err: any) {
        setError(err.message || "Failed to fetch clients");
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [
    params?.page,
    params?.per_page,
    params?.level,
    params?.status,
    debouncedSearch,
    params?.autoFetch,
  ]);

  return { data, loading, error };
}

/**
 * Custom hook for fetching a single client
 */
export function useClient(clientId: number | null) {
  const [data, setData] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;

    const fetchClient = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await clientService.getClient(clientId);
        setData(result);
      } catch (err: any) {
        setError(err.message || "Failed to fetch client");
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [clientId]);

  return { data, loading, error };
}

/**
 * Custom hook for fetching client logs
 */
export function useClientLogs(clientId: number | null) {
  const [data, setData] = useState<ClientLogListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!clientId) return;

    setLoading(true);
    setError(null);
    try {
      const result = await clientService.getClientLog(clientId);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [clientId]);

  return { data, loading, error, refetch: fetchLogs };
}

/**
 * Custom hook for fetching upcoming reminders
 */
export function useReminders(daysAhead?: number) {
  const [data, setData] = useState<ReminderListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReminders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await clientService.getUpcomingReminders(daysAhead);
      setData(result);
    } catch (err: any) {
      setError(err.message || "Failed to fetch reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [daysAhead]);

  return { data, loading, error, refetch: fetchReminders };
}

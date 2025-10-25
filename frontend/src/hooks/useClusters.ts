"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import type { ClusterOptionDto } from "@/dtos/cluster.dto";

// Eenvoudige module-scope cache (geldt binnen dezelfde runtime)
let _clustersCache: ClusterOptionDto[] | null = null;
let _clustersLoading = false;
let _clustersError: string | null = null;
let _lastFetchTs = 0;

// Optioneel: TTL in ms (0 = altijd uit cache als beschikbaar)
const TTL_MS = 0;

async function fetchClusters(): Promise<ClusterOptionDto[]> {
  _clustersLoading = true;
  _clustersError = null;
  try {
    const { data } = await api.get<ClusterOptionDto[]>("/clusters");
    const arr = Array.isArray(data) ? data : [];
    _clustersCache = arr;
    _lastFetchTs = Date.now();
    return arr;
  } catch (e: any) {
    const msg =
      e?.response?.data?.detail || e?.message || "Kon clusters niet ophalen";
    _clustersError = msg;
    throw new Error(msg);
  } finally {
    _clustersLoading = false;
  }
}

export function useClusters(options?: { refresh?: boolean }) {
  const [clusters, setClusters] = useState<ClusterOptionDto[]>(
    _clustersCache ?? [],
  );
  const [loading, setLoading] = useState<boolean>(
    _clustersLoading || !_clustersCache,
  );
  const [error, setError] = useState<string | null>(_clustersError);

  const shouldRefetch =
    options?.refresh ||
    !_clustersCache ||
    (TTL_MS > 0 && Date.now() - _lastFetchTs > TTL_MS);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClusters();
      setClusters(data);
    } catch (e: any) {
      setError(e?.message || "Kon clusters niet ophalen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (shouldRefetch) {
      void load();
    } else {
      // Sync state met cache als die er al is
      if (_clustersCache) setClusters(_clustersCache);
      if (_clustersError) setError(_clustersError);
      setLoading(_clustersLoading || !_clustersCache);
    }
  }, [shouldRefetch, load]);

  // Handige handmatige refresh
  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return { clusters, loading, error, refresh };
}

export default useClusters;

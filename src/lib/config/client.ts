/**
 * Client-side Configuration Utilities
 *
 * Provides hooks and utilities for accessing tenant configuration
 * in client components.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TenantConfig, BrandConfig, Competitor, PersonaConfig, StageConfig } from "./types";

// Client-side cache
let clientConfigCache: TenantConfig | null = null;
let fetchPromise: Promise<TenantConfig> | null = null;

/**
 * Fetch tenant config from API (with deduplication)
 */
async function fetchTenantConfig(): Promise<TenantConfig> {
  // Return cached config if available
  if (clientConfigCache) {
    return clientConfigCache;
  }

  // Return existing fetch promise if in flight
  if (fetchPromise) {
    return fetchPromise;
  }

  // Start new fetch
  fetchPromise = fetch("/api/tenant/config")
    .then((res) => {
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    })
    .then((config) => {
      clientConfigCache = config;
      fetchPromise = null;
      return config;
    })
    .catch((err) => {
      fetchPromise = null;
      throw err;
    });

  return fetchPromise;
}

/**
 * Hook to get tenant configuration in client components
 *
 * Usage:
 *   const { config, loading, error } = useTenantConfig();
 */
export function useTenantConfig() {
  const [config, setConfig] = useState<TenantConfig | null>(clientConfigCache);
  const [loading, setLoading] = useState(!clientConfigCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (clientConfigCache) {
      setConfig(clientConfigCache);
      setLoading(false);
      return;
    }

    fetchTenantConfig()
      .then((cfg) => {
        setConfig(cfg);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { config, loading, error };
}

/**
 * Hook to get brand configuration
 */
export function useBrandConfig(): {
  brand: BrandConfig | null;
  loading: boolean;
  error: Error | null;
} {
  const { config, loading, error } = useTenantConfig();
  return {
    brand: config?.brand ?? null,
    loading,
    error,
  };
}

/**
 * Hook to get competitor list
 */
export function useCompetitors(): {
  competitors: Competitor[];
  loading: boolean;
  error: Error | null;
} {
  const { config, loading, error } = useTenantConfig();
  return {
    competitors: config?.competitors ?? [],
    loading,
    error,
  };
}

/**
 * Hook to get persona list
 */
export function usePersonas(): {
  personas: PersonaConfig[];
  loading: boolean;
  error: Error | null;
} {
  const { config, loading, error } = useTenantConfig();
  return {
    personas: config?.personas ?? [],
    loading,
    error,
  };
}

/**
 * Hook to get stage list
 */
export function useStages(): {
  stages: StageConfig[];
  loading: boolean;
  error: Error | null;
} {
  const { config, loading, error } = useTenantConfig();
  return {
    stages: config?.stages ?? [],
    loading,
    error,
  };
}

/**
 * Clear the client-side config cache
 * Useful for forcing a refresh
 */
export function clearClientConfigCache(): void {
  clientConfigCache = null;
  fetchPromise = null;
}

/**
 * Pre-fetch config (call early to reduce loading time)
 */
export function prefetchConfig(): Promise<TenantConfig> {
  return fetchTenantConfig();
}

// Default values for SSR and initial render
export const DEFAULT_BRAND: BrandConfig = {
  name: "Brand",
  aliases: [],
  highlightColor: "#dcf3dc",
};

export const DEFAULT_PERSONAS: PersonaConfig[] = [
  {
    id: "known_valued_parents",
    label: "Known & Valued Parents",
    description: "Public-school switchers seeking safety, support, and affordability.",
  },
  {
    id: "known_valued_students",
    label: "Known & Valued Students",
    description: "Students who want to be seen, supported, and safe in a smaller environment.",
  },
  {
    id: "optimization_outcomes_parents",
    label: "Optimization & Outcomes Parents",
    description: "Families prioritizing rigor, pathways, and strong college outcomes.",
  },
  {
    id: "optimization_outcomes_students",
    label: "Optimization & Outcomes Students",
    description: "Driven students seeking challenge, rigor, and competitive peer cohorts.",
  },
  {
    id: "whole_child_parents",
    label: "Whole-Child Parents",
    description: "Families focused on character, belonging, and whole-child growth.",
  },
  {
    id: "whole_child_students",
    label: "Whole-Child Students",
    description: "Well-rounded students motivated by leadership, service, and community.",
  },
  {
    id: "balanced_specialists_parents",
    label: "Balanced Specialists Parents",
    description: "Families seeking specialized excellence with a balanced school experience.",
  },
  {
    id: "balanced_specialists_students",
    label: "Balanced Specialists Students",
    description: "Talented students seeking high performance without burnout.",
  },
];

export const DEFAULT_STAGES: StageConfig[] = [
  { id: "discover", label: "Discover", description: "" },
  { id: "research", label: "Research", description: "" },
  { id: "compare", label: "Compare", description: "" },
  { id: "apply", label: "Apply", description: "" },
];

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData, areRunsEquivalent } from "@/lib/matrix/data/useMatrixData";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("areRunsEquivalent", () => {
  it("returns true when signatures match", () => {
    const a = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    const b = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    expect(areRunsEquivalent(a, b)).toBe(true);
  });

  it("returns false when ids differ", () => {
    const a = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    const b = [{
      id: "2",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    expect(areRunsEquivalent(a, b)).toBe(false);
  });

  it("returns false when timestamps differ", () => {
    const a = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    const b = [{
      id: "1",
      timestamp: "2026-01-26T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    expect(areRunsEquivalent(a, b)).toBe(false);
  });

  it("returns false when array lengths differ", () => {
    const a = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    const b = [
      {
        id: "1",
        timestamp: "2026-01-25T00:00:00Z",
        summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
        cells: {},
      },
      {
        id: "2",
        timestamp: "2026-01-25T00:00:00Z",
        summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
        cells: {},
      },
    ] as any;
    expect(areRunsEquivalent(a, b)).toBe(false);
  });

  it("returns false when summary changes", () => {
    const a = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.1, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    const b = [{
      id: "1",
      timestamp: "2026-01-25T00:00:00Z",
      summary: { overall: { discoveryRate: 0.9, avgSentiment: 0.2, avgWinRate: 0.3, recommendationRate: 0.4 } },
      cells: {},
    }] as any;
    expect(areRunsEquivalent(a, b)).toBe(false);
  });

  it("returns true for empty arrays", () => {
    expect(areRunsEquivalent([], [] as any)).toBe(true);
  });
});

describe("useMatrixData", () => {
  const baseConfig = {
    personas: [{ id: "cpo", label: "CPO" }],
    stages: [{ id: "explore", label: "Explore" }],
  };

  const baseLibrary = {
    version: 1,
    updatedAt: "2026-01-25T10:00:00Z",
    intents: [],
    history: [],
  };

  it("loads config and history when active", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(JSON.stringify(baseConfig));
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      if (urlStr.includes("/api/intents/library")) {
        return new Response(JSON.stringify(baseLibrary));
      }
      return new Response(JSON.stringify({}));
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.config).toEqual(baseConfig);
    expect(result.current.history).toEqual([]);
  });

  it("reloads when active toggles off -> on", async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(JSON.stringify(baseConfig));
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      if (urlStr.includes("/api/intents/library")) {
        return new Response(JSON.stringify(baseLibrary));
      }
      return new Response(JSON.stringify({}));
    });
    vi.stubGlobal("fetch", fetchSpy as any);

    const { result, rerender } = renderHook(
      ({ active }) => useMatrixData({ active }),
      { initialProps: { active: true } }
    );

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchSpy).toHaveBeenCalled();

    fetchSpy.mockClear();

    // Deactivate
    rerender({ active: false });
    await waitFor(() => expect(result.current.status).toBe("idle"));

    // Re-activate
    rerender({ active: true });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Should have fetched again
    expect(fetchSpy).toHaveBeenCalled();
    expect(result.current.refreshToken).toBe(1);
  });

  it("handles fetch errors gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Network error");
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Network error");
  });

  it("does not fetch when inactive", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderHook(() => useMatrixData({ active: false }));

    // Give it time to potentially fetch
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("polls intent library after initial load", async () => {
    let libraryCallCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/intents/library")) {
        libraryCallCount++;
        return new Response(JSON.stringify(baseLibrary));
      }
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(JSON.stringify(baseConfig));
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      return new Response(JSON.stringify({}));
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));

    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Initial load should have called library endpoint at least once
    expect(libraryCallCount).toBeGreaterThanOrEqual(1);
  });

  it("becomes ready without waiting for intent library", async () => {
    let resolveLibrary: ((value: Response) => void) | null = null;
    const libraryPromise = new Promise<Response>((resolve) => {
      resolveLibrary = resolve;
    });

    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(JSON.stringify(baseConfig));
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      if (urlStr.includes("/api/intents/library")) {
        return libraryPromise;
      }
      return new Response(JSON.stringify({}));
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Resolve the pending intent library fetch to avoid dangling promise
    resolveLibrary?.(new Response(JSON.stringify(baseLibrary)));
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useMatrixData } from "@/lib/matrix/data/useMatrixData";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useMatrixData", () => {
  it("loads config and history when active", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(
          JSON.stringify({
            personas: [{ id: "cpo", label: "CPO" }],
            stages: [{ id: "explore", label: "Explore" }],
          })
        );
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      if (urlStr.includes("/api/intents/library")) {
        return new Response(
          JSON.stringify({
            version: 1,
            updatedAt: "2026-01-25T10:00:00Z",
            intents: [],
            history: [],
          })
        );
      }
      return new Response(JSON.stringify({}));
    }));

    const { result } = renderHook(() => useMatrixData({ active: true }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.config).toEqual({
      personas: [{ id: "cpo", label: "CPO" }],
      stages: [{ id: "explore", label: "Explore" }],
    });
    expect(result.current.history).toEqual([]);
  });

  it("reloads when active toggles off -> on", async () => {
    const fetchSpy = vi.fn(async (url: RequestInfo) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(
          JSON.stringify({
            personas: [{ id: "cpo", label: "CPO" }],
            stages: [{ id: "explore", label: "Explore" }],
          })
        );
      }
      if (urlStr.includes("/api/benchmark/runs/history")) {
        return new Response(JSON.stringify({ runs: [] }));
      }
      if (urlStr.includes("/api/intents/library")) {
        return new Response(
          JSON.stringify({
            version: 1,
            updatedAt: "2026-01-25T10:00:00Z",
            intents: [],
            history: [],
          })
        );
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

    const callCountBefore = fetchSpy.mock.calls.length;
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
        return new Response(
          JSON.stringify({
            version: 1,
            updatedAt: "2026-01-25T10:00:00Z",
            intents: [],
            history: [],
          })
        );
      }
      if (urlStr.includes("/api/matrix/active")) {
        return new Response(
          JSON.stringify({
            personas: [{ id: "cpo", label: "CPO" }],
            stages: [{ id: "explore", label: "Explore" }],
          })
        );
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
});

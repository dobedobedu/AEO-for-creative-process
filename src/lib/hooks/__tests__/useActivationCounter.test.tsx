import { describe, it, expect } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useActivationCounter } from "@/lib/hooks/useActivationCounter";

describe("useActivationCounter", () => {
  it("increments on initial active state and when re-activated", async () => {
    const { result, rerender } = renderHook(
      ({ active }) => useActivationCounter(active),
      { initialProps: { active: true } }
    );

    await waitFor(() => expect(result.current).toBe(1));

    rerender({ active: false });
    await waitFor(() => expect(result.current).toBe(1));

    rerender({ active: true });
    await waitFor(() => expect(result.current).toBe(2));
  });

  it("does not increment when inactive", async () => {
    const { result, rerender } = renderHook(
      ({ active }) => useActivationCounter(active),
      { initialProps: { active: false } }
    );

    await waitFor(() => expect(result.current).toBe(0));

    rerender({ active: false });
    await waitFor(() => expect(result.current).toBe(0));
  });
});

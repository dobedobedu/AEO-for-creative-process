/**
 * Progress tracking tests
 *
 * Since progress is now DB-backed, we mock the database layer.
 * These tests verify the progress API logic without requiring a real database.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock the database module
vi.mock("@/lib/db", () => {
  // In-memory store to simulate database
  const store = new Map<string, {
    run_id: string;
    status: string;
    total_steps: number;
    completed_steps: number;
    unit: string;
    updated_at: Date;
    events: unknown[];
    started_by: string | null;
    created_at: Date;
  }>();

  return {
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("?");

      // Handle CREATE TABLE (schema)
      if (query.includes("CREATE TABLE")) {
        return Promise.resolve([]);
      }

      // Handle INSERT
      if (query.includes("INSERT INTO run_progress")) {
        const runId = values[0] as string;
        const cleanRunId = runId.replace("::uuid", "");

        // Check for ON CONFLICT (upsert)
        // Values order: runId, totalSteps, unit, eventsJson, startedBy, (repeated in ON CONFLICT)
        if (query.includes("ON CONFLICT")) {
          store.set(cleanRunId, {
            run_id: cleanRunId,
            status: "running",
            total_steps: values[1] as number,
            completed_steps: 0,
            unit: values[2] as string,
            updated_at: new Date(),
            events: JSON.parse(values[3] as string),
            started_by: values[4] as string | null,
            created_at: new Date(),
          });
        }
        return Promise.resolve([]);
      }

      // Handle SELECT
      if (query.includes("SELECT * FROM run_progress")) {
        const runId = (values[0] as string).replace("::uuid", "");
        const row = store.get(runId);
        return Promise.resolve(row ? [row] : []);
      }

      // Handle UPDATE
      if (query.includes("UPDATE run_progress")) {
        // Find which run we're updating
        const runIdMatch = query.match(/run_id = \?/);
        if (runIdMatch) {
          // Find the runId in values - it's usually the last ::uuid value
          const lastValue = values[values.length - 1];
          const runId = typeof lastValue === "string" ? lastValue.replace("::uuid", "") : "";

          const row = store.get(runId);
          if (row) {
            // Handle completed_steps update
            if (query.includes("completed_steps = LEAST")) {
              const increment = values[0] as number;
              row.completed_steps = Math.min(row.total_steps, row.completed_steps + increment);
              row.updated_at = new Date();
            }

            // Handle status update
            if (query.includes("status = 'complete'")) {
              row.status = "complete";
              row.completed_steps = row.total_steps;
              row.updated_at = new Date();
              const event = JSON.parse(values[0] as string);
              row.events = [...row.events, event].slice(-80);
            }

            if (query.includes("status = 'error'")) {
              row.status = "error";
              row.updated_at = new Date();
              const event = JSON.parse(values[0] as string);
              row.events = [...row.events, event].slice(-80);
            }

            // Handle events update
            if (query.includes("events =") && !query.includes("status =")) {
              const event = JSON.parse(values[0] as string);
              row.events = [...row.events, event].slice(-80);
              row.updated_at = new Date();
            }

            store.set(runId, row);
          }
        }
        return Promise.resolve([]);
      }

      // Handle DELETE
      if (query.includes("DELETE FROM run_progress")) {
        if (query.includes("WHERE run_id")) {
          const runId = (values[0] as string).replace("::uuid", "");
          store.delete(runId);
        } else {
          store.clear();
        }
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    }),
    getSql: vi.fn(() => ({
      begin: vi.fn(),
    })),
  };
});

import {
  initProgress,
  incrementProgress,
  completeProgress,
  failProgress,
  getProgress,
  clearProgressStore,
} from "../progress";

describe("progress tracking (DB-backed)", () => {
  beforeEach(async () => {
    await clearProgressStore();
  });

  describe("initProgress", () => {
    it("initializes progress with default values", async () => {
      const progress = await initProgress("run-1", 10);

      expect(progress.runId).toBe("run-1");
      expect(progress.totalSteps).toBe(10);
      expect(progress.completedSteps).toBe(0);
      expect(progress.unit).toBe("queries");
      expect(progress.status).toBe("running");
      expect(progress.events).toHaveLength(1);
      expect(progress.events[0].message).toBe("Benchmark started");
      expect(progress.events[0].status).toBe("running");
    });

    it("initializes progress with custom unit", async () => {
      const progress = await initProgress("run-2", 16, "cells");

      expect(progress.unit).toBe("cells");
      expect(progress.totalSteps).toBe(16);
    });

    it("stores progress retrievable by getProgress", async () => {
      await initProgress("run-3", 5);
      const retrieved = await getProgress("run-3");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.runId).toBe("run-3");
    });
  });

  describe("incrementProgress", () => {
    it("increments completed steps by 1 by default", async () => {
      await initProgress("run-1", 10);

      await incrementProgress("run-1");

      const progress = await getProgress("run-1");
      expect(progress?.completedSteps).toBe(1);
    });

    it("increments by specified amount", async () => {
      await initProgress("run-1", 10);

      await incrementProgress("run-1", 3);

      const progress = await getProgress("run-1");
      expect(progress?.completedSteps).toBe(3);
    });
  });

  describe("completeProgress", () => {
    it("sets status to complete", async () => {
      await initProgress("run-1", 10);
      await incrementProgress("run-1", 5);

      await completeProgress("run-1");

      const progress = await getProgress("run-1");
      expect(progress?.status).toBe("complete");
    });

    it("sets completedSteps to totalSteps", async () => {
      await initProgress("run-1", 10);
      await incrementProgress("run-1", 5);

      await completeProgress("run-1");

      const progress = await getProgress("run-1");
      expect(progress?.completedSteps).toBe(10);
    });
  });

  describe("failProgress", () => {
    it("sets status to error", async () => {
      await initProgress("run-1", 10);

      await failProgress("run-1", "API rate limit exceeded");

      const progress = await getProgress("run-1");
      expect(progress?.status).toBe("error");
    });
  });

  describe("getProgress", () => {
    it("returns null for non-existent runId", async () => {
      expect(await getProgress("non-existent")).toBeNull();
    });

    it("returns progress for existing runId", async () => {
      await initProgress("run-1", 10);

      const progress = await getProgress("run-1");
      expect(progress).not.toBeNull();
      expect(progress?.runId).toBe("run-1");
    });
  });

  describe("clearProgressStore", () => {
    it("removes all progress entries", async () => {
      await initProgress("run-1", 10);
      await initProgress("run-2", 20);

      await clearProgressStore();

      expect(await getProgress("run-1")).toBeNull();
      expect(await getProgress("run-2")).toBeNull();
    });
  });
});

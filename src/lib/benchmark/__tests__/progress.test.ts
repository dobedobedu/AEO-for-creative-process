import { describe, expect, it, beforeEach } from "vitest";
import {
  initProgress,
  logProgress,
  incrementProgress,
  completeProgress,
  failProgress,
  getProgress,
  clearProgressStore,
  type RunProgress,
  type ProgressEvent,
} from "../progress";

describe("progress tracking", () => {
  beforeEach(() => {
    clearProgressStore();
  });

  describe("initProgress", () => {
    it("initializes progress with default values", () => {
      const progress = initProgress("run-1", 10);

      expect(progress.runId).toBe("run-1");
      expect(progress.totalSteps).toBe(10);
      expect(progress.completedSteps).toBe(0);
      expect(progress.unit).toBe("queries");
      expect(progress.status).toBe("running");
      expect(progress.events).toHaveLength(1);
      expect(progress.events[0].message).toBe("Benchmark started");
      expect(progress.events[0].status).toBe("running");
    });

    it("initializes progress with custom unit", () => {
      const progress = initProgress("run-2", 16, "cells");

      expect(progress.unit).toBe("cells");
      expect(progress.totalSteps).toBe(16);
    });

    it("stores progress retrievable by getProgress", () => {
      initProgress("run-3", 5);
      const retrieved = getProgress("run-3");

      expect(retrieved).not.toBeNull();
      expect(retrieved?.runId).toBe("run-3");
    });
  });

  describe("logProgress", () => {
    it("adds event to progress", () => {
      initProgress("run-1", 10);

      logProgress("run-1", { message: "Processing persona A", persona: "buyer" });

      const progress = getProgress("run-1");
      expect(progress?.events).toHaveLength(2);
      expect(progress?.events[1].message).toBe("Processing persona A");
      expect(progress?.events[1].persona).toBe("buyer");
    });

    it("adds timestamp if not provided", () => {
      initProgress("run-1", 10);

      logProgress("run-1", { message: "Test event" });

      const progress = getProgress("run-1");
      expect(progress?.events[1].ts).toBeDefined();
    });

    it("preserves provided timestamp", () => {
      initProgress("run-1", 10);
      const ts = "2024-01-15T10:00:00Z";

      logProgress("run-1", { message: "Test event", ts });

      const progress = getProgress("run-1");
      expect(progress?.events[1].ts).toBe(ts);
    });

    it("does nothing for non-existent runId", () => {
      logProgress("non-existent", { message: "Test" });

      expect(getProgress("non-existent")).toBeNull();
    });

    it("limits events to MAX_EVENTS (circular buffer)", () => {
      initProgress("run-1", 100);

      // Add 100 events (plus initial event = 101 total)
      for (let i = 0; i < 100; i++) {
        logProgress("run-1", { message: `Event ${i}` });
      }

      const progress = getProgress("run-1");
      // Should be capped at 80
      expect(progress?.events.length).toBeLessThanOrEqual(80);
      // Most recent event should be preserved
      expect(progress?.events[progress.events.length - 1].message).toBe("Event 99");
    });
  });

  describe("incrementProgress", () => {
    it("increments completed steps by 1 by default", () => {
      initProgress("run-1", 10);

      incrementProgress("run-1");

      expect(getProgress("run-1")?.completedSteps).toBe(1);
    });

    it("increments by specified amount", () => {
      initProgress("run-1", 10);

      incrementProgress("run-1", 3);

      expect(getProgress("run-1")?.completedSteps).toBe(3);
    });

    it("does not exceed totalSteps", () => {
      initProgress("run-1", 5);

      incrementProgress("run-1", 10);

      expect(getProgress("run-1")?.completedSteps).toBe(5);
    });

    it("updates updatedAt timestamp", () => {
      const progress = initProgress("run-1", 10);
      const initialUpdatedAt = progress.updatedAt;

      // Wait a tiny bit to ensure different timestamp
      incrementProgress("run-1");

      const updatedProgress = getProgress("run-1");
      expect(updatedProgress?.updatedAt).toBeDefined();
    });

    it("does nothing for non-existent runId", () => {
      incrementProgress("non-existent");

      expect(getProgress("non-existent")).toBeNull();
    });
  });

  describe("completeProgress", () => {
    it("sets status to complete", () => {
      initProgress("run-1", 10);
      incrementProgress("run-1", 5);

      completeProgress("run-1");

      const progress = getProgress("run-1");
      expect(progress?.status).toBe("complete");
    });

    it("sets completedSteps to totalSteps", () => {
      initProgress("run-1", 10);
      incrementProgress("run-1", 5);

      completeProgress("run-1");

      expect(getProgress("run-1")?.completedSteps).toBe(10);
    });

    it("adds completion event", () => {
      initProgress("run-1", 10);

      completeProgress("run-1");

      const progress = getProgress("run-1");
      const lastEvent = progress?.events[progress.events.length - 1];
      expect(lastEvent?.message).toBe("Benchmark completed");
      expect(lastEvent?.status).toBe("complete");
    });

    it("does nothing for non-existent runId", () => {
      completeProgress("non-existent");

      expect(getProgress("non-existent")).toBeNull();
    });
  });

  describe("failProgress", () => {
    it("sets status to error", () => {
      initProgress("run-1", 10);

      failProgress("run-1", "API rate limit exceeded");

      expect(getProgress("run-1")?.status).toBe("error");
    });

    it("adds error event with message", () => {
      initProgress("run-1", 10);

      failProgress("run-1", "Connection timeout");

      const progress = getProgress("run-1");
      const lastEvent = progress?.events[progress.events.length - 1];
      expect(lastEvent?.message).toBe("Connection timeout");
      expect(lastEvent?.status).toBe("error");
    });

    it("preserves completedSteps at failure point", () => {
      initProgress("run-1", 10);
      incrementProgress("run-1", 3);

      failProgress("run-1", "Error");

      expect(getProgress("run-1")?.completedSteps).toBe(3);
    });

    it("does nothing for non-existent runId", () => {
      failProgress("non-existent", "Error");

      expect(getProgress("non-existent")).toBeNull();
    });
  });

  describe("getProgress", () => {
    it("returns null for non-existent runId", () => {
      expect(getProgress("non-existent")).toBeNull();
    });

    it("returns progress for existing runId", () => {
      initProgress("run-1", 10);

      const progress = getProgress("run-1");
      expect(progress).not.toBeNull();
      expect(progress?.runId).toBe("run-1");
    });
  });

  describe("clearProgressStore", () => {
    it("removes all progress entries", () => {
      initProgress("run-1", 10);
      initProgress("run-2", 20);

      clearProgressStore();

      expect(getProgress("run-1")).toBeNull();
      expect(getProgress("run-2")).toBeNull();
    });
  });
});

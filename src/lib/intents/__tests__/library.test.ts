/**
 * Tests for DB-backed Intent Library
 *
 * These tests mock the database layer to verify library logic.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("../db", () => ({
  fetchLibraryMeta: vi.fn(),
  fetchAllIntents: vi.fn(),
  fetchIntentsForCell: vi.fn(),
  fetchIntentById: vi.fn(),
  insertIntent: vi.fn(),
  updateIntentInDb: vi.fn(),
  fetchHistory: vi.fn(),
  insertHistoryEntry: vi.fn(),
  incrementVersion: vi.fn(),
  atomicCreateIntent: vi.fn(),
  atomicUpdateIntent: vi.fn(),
}));

import {
  loadIntentLibrary,
  getIntentsForCell,
  getIntentById,
  createIntent,
  updateIntent,
  deactivateIntent,
  reactivateIntent,
  getIntentChangesForVersion,
  getVersionsWithChanges,
} from "../library";
import type { Intent, IntentHistoryEntry } from "../types";
import {
  fetchLibraryMeta,
  fetchAllIntents,
  fetchIntentsForCell,
  fetchIntentById,
  fetchHistory,
  atomicCreateIntent,
  atomicUpdateIntent,
} from "../db";

const mockedFetchLibraryMeta = vi.mocked(fetchLibraryMeta);
const mockedFetchAllIntents = vi.mocked(fetchAllIntents);
const mockedFetchIntentsForCell = vi.mocked(fetchIntentsForCell);
const mockedFetchIntentById = vi.mocked(fetchIntentById);
const mockedFetchHistory = vi.mocked(fetchHistory);
const mockedAtomicCreateIntent = vi.mocked(atomicCreateIntent);
const mockedAtomicUpdateIntent = vi.mocked(atomicUpdateIntent);

// Sample test data
const sampleIntent: Intent = {
  id: "int_move_up_explore_abc123",
  persona: "move_up",
  stage: "explore",
  text: "Growing family exploring Florida relocation options",
  role: "cpo",
  queryStyle: 0.75,
  createdAt: "2026-01-05T14:00:01.085Z",
  active: true,
};

const sampleHistoryEntry: IntentHistoryEntry = {
  version: 1,
  date: "2026-01-05",
  changes: [{ action: "created", intentId: "int_move_up_explore_abc123" }],
};

describe("Intent Library (Database)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockedFetchLibraryMeta.mockResolvedValue({
      version: 1,
      updatedAt: "2026-01-05T14:00:01.085Z",
    });
    mockedFetchAllIntents.mockResolvedValue([sampleIntent]);
    mockedFetchHistory.mockResolvedValue([sampleHistoryEntry]);
  });

  describe("loadIntentLibrary", () => {
    it("returns empty library when no intents exist", async () => {
      mockedFetchLibraryMeta.mockResolvedValue({
        version: 1,
        updatedAt: new Date().toISOString(),
      });
      mockedFetchAllIntents.mockResolvedValue([]);
      mockedFetchHistory.mockResolvedValue([]);

      const library = await loadIntentLibrary();

      expect(library.version).toBe(1); // Schema requires version > 0
      expect(library.intents).toHaveLength(0);
      expect(library.history).toHaveLength(0);
    });

    it("loads all intents from database", async () => {
      const library = await loadIntentLibrary();

      expect(library.intents).toHaveLength(1);
      expect(library.intents[0].id).toBe(sampleIntent.id);
      expect(library.intents[0].text).toBe(sampleIntent.text);
    });

    it("includes library version and updatedAt", async () => {
      const library = await loadIntentLibrary();

      expect(library.version).toBe(1);
      expect(library.updatedAt).toBe("2026-01-05T14:00:01.085Z");
    });

    it("includes history entries", async () => {
      const library = await loadIntentLibrary();

      expect(library.history).toHaveLength(1);
      expect(library.history[0].version).toBe(1);
    });
  });

  describe("getIntentsForCell", () => {
    it("returns intents for specific persona/stage", async () => {
      mockedFetchIntentsForCell.mockResolvedValue([sampleIntent]);

      const intents = await getIntentsForCell("move_up", "explore");

      expect(mockedFetchIntentsForCell).toHaveBeenCalledWith("move_up", "explore");
      expect(intents).toHaveLength(1);
      expect(intents[0].persona).toBe("move_up");
      expect(intents[0].stage).toBe("explore");
    });

    it("returns empty array when no intents for cell", async () => {
      mockedFetchIntentsForCell.mockResolvedValue([]);

      const intents = await getIntentsForCell("luxury", "decide");

      expect(intents).toHaveLength(0);
    });
  });

  describe("getIntentById", () => {
    it("returns intent when found", async () => {
      mockedFetchIntentById.mockResolvedValue(sampleIntent);

      const intent = await getIntentById(sampleIntent.id);

      expect(intent).not.toBeNull();
      expect(intent?.id).toBe(sampleIntent.id);
    });

    it("returns null when not found", async () => {
      mockedFetchIntentById.mockResolvedValue(null);

      const intent = await getIntentById("nonexistent");

      expect(intent).toBeNull();
    });
  });

  describe("createIntent", () => {
    beforeEach(() => {
      mockedAtomicCreateIntent.mockResolvedValue(2);
    });

    it("inserts new intent into database", async () => {
      await createIntent({
        persona: "retiree",
        stage: "consider",
        text: "Retiree considering active adult communities",
        role: "cpo",
        queryStyle: 0.75,
      });

      expect(mockedAtomicCreateIntent).toHaveBeenCalledTimes(1);
      const [insertedIntent] = mockedAtomicCreateIntent.mock.calls[0];
      expect(insertedIntent.persona).toBe("retiree");
      expect(insertedIntent.stage).toBe("consider");
      expect(insertedIntent.text).toBe("Retiree considering active adult communities");
      expect(insertedIntent.active).toBe(true);
    });

    it("generates unique intent ID", async () => {
      await createIntent({
        persona: "luxury",
        stage: "explore",
        text: "Luxury home search",
        role: "cpo",
        queryStyle: 0.75,
      });

      const [insertedIntent] = mockedAtomicCreateIntent.mock.calls[0];
      expect(insertedIntent.id).toMatch(/^int_luxury_explore_/);
    });

    it("uses atomic operation for version and history", async () => {
      await createIntent({
        persona: "first_time",
        stage: "decide",
        text: "First-time buyer decision",
        role: "cpo",
        queryStyle: 0.75,
      });

      expect(mockedAtomicCreateIntent).toHaveBeenCalledTimes(1);
      // Verify the change record is passed
      const [, change] = mockedAtomicCreateIntent.mock.calls[0];
      expect(change.action).toBe("created");
    });
  });

  describe("updateIntent", () => {
    beforeEach(() => {
      mockedFetchIntentById.mockResolvedValue(sampleIntent);
      mockedAtomicUpdateIntent.mockResolvedValue(2);
    });

    it("updates intent text", async () => {
      await updateIntent(sampleIntent.id, {
        text: "Updated intent text",
      });

      expect(mockedAtomicUpdateIntent).toHaveBeenCalledTimes(1);
      const [intentId, updates] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(intentId).toBe(sampleIntent.id);
      expect(updates.text).toBe("Updated intent text");
    });

    it("updates generated queries", async () => {
      const queries = ["query 1", "query 2", "query 3"];
      await updateIntent(sampleIntent.id, {
        generatedQueries: queries,
      });

      const [, updates] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(updates.generatedQueries).toEqual(queries);
    });

    it("uses atomic operation for updates", async () => {
      await updateIntent(sampleIntent.id, {
        text: "New text",
      });

      expect(mockedAtomicUpdateIntent).toHaveBeenCalledTimes(1);
    });

    it("does not call atomic update when no changes", async () => {
      // Same values as existing intent
      await updateIntent(sampleIntent.id, {
        text: sampleIntent.text,
        role: sampleIntent.role,
      });

      expect(mockedAtomicUpdateIntent).not.toHaveBeenCalled();
    });

    it("throws error when intent not found", async () => {
      mockedFetchIntentById.mockResolvedValue(null);

      await expect(
        updateIntent("nonexistent", { text: "New text" })
      ).rejects.toThrow("Intent not found: nonexistent");
    });

    it("passes field changes to atomic operation", async () => {
      await updateIntent(sampleIntent.id, {
        text: "Updated text",
        queryStyle: 0.9,
      });

      expect(mockedAtomicUpdateIntent).toHaveBeenCalledTimes(1);
      const [, , changes] = mockedAtomicUpdateIntent.mock.calls[0];

      expect(changes).toHaveLength(2);
      expect(changes.find((c: { field?: string }) => c.field === "text")).toBeDefined();
      expect(changes.find((c: { field?: string }) => c.field === "queryStyle")).toBeDefined();
    });
  });

  describe("deactivateIntent", () => {
    beforeEach(() => {
      mockedFetchIntentById.mockResolvedValue(sampleIntent);
      mockedAtomicUpdateIntent.mockResolvedValue(2);
    });

    it("sets active to false via atomic operation", async () => {
      await deactivateIntent(sampleIntent.id);

      expect(mockedAtomicUpdateIntent).toHaveBeenCalledTimes(1);
      const [intentId, updates] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(intentId).toBe(sampleIntent.id);
      expect(updates.active).toBe(false);
    });

    it("records deactivation change in atomic operation", async () => {
      await deactivateIntent(sampleIntent.id);

      const [, , changes] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(changes[0].action).toBe("deactivated");
    });

    it("does nothing if already inactive", async () => {
      mockedFetchIntentById.mockResolvedValue({ ...sampleIntent, active: false });

      await deactivateIntent(sampleIntent.id);

      expect(mockedAtomicUpdateIntent).not.toHaveBeenCalled();
    });

    it("throws error when intent not found", async () => {
      mockedFetchIntentById.mockResolvedValue(null);

      await expect(deactivateIntent("nonexistent")).rejects.toThrow(
        "Intent not found: nonexistent"
      );
    });
  });

  describe("reactivateIntent", () => {
    beforeEach(() => {
      mockedFetchIntentById.mockResolvedValue({ ...sampleIntent, active: false });
      mockedAtomicUpdateIntent.mockResolvedValue(2);
    });

    it("sets active to true via atomic operation", async () => {
      await reactivateIntent(sampleIntent.id);

      expect(mockedAtomicUpdateIntent).toHaveBeenCalledTimes(1);
      const [intentId, updates] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(intentId).toBe(sampleIntent.id);
      expect(updates.active).toBe(true);
    });

    it("records reactivation change in atomic operation", async () => {
      await reactivateIntent(sampleIntent.id);

      const [, , changes] = mockedAtomicUpdateIntent.mock.calls[0];
      expect(changes[0].action).toBe("reactivated");
    });

    it("does nothing if already active", async () => {
      mockedFetchIntentById.mockResolvedValue(sampleIntent); // active: true

      await reactivateIntent(sampleIntent.id);

      expect(mockedAtomicUpdateIntent).not.toHaveBeenCalled();
    });
  });

  describe("getIntentChangesForVersion", () => {
    it("returns changes for specific version", async () => {
      const changes = await getIntentChangesForVersion(1);

      expect(changes).toHaveLength(1);
      expect(changes[0].action).toBe("created");
    });

    it("returns empty array for non-existent version", async () => {
      const changes = await getIntentChangesForVersion(999);

      expect(changes).toHaveLength(0);
    });
  });

  describe("getVersionsWithChanges", () => {
    it("returns all version numbers with recorded changes", async () => {
      mockedFetchHistory.mockResolvedValue([
        { version: 1, date: "2026-01-01", changes: [] },
        { version: 2, date: "2026-01-02", changes: [] },
        { version: 3, date: "2026-01-03", changes: [] },
      ]);

      const versions = await getVersionsWithChanges();

      expect(versions).toEqual([1, 2, 3]);
    });
  });
});

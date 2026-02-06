/**
 * Tests for Persona Management Module
 */

import { describe, it, expect, vi } from "vitest";
import {
  Persona,
  DEFAULT_PERSONAS,
  generatePersonaId,
  addPersona,
  updatePersona,
  deletePersona,
  findPersona,
  validatePersona,
  createInitialState,
} from "../personaManager";

describe("Persona Manager", () => {
  describe("DEFAULT_PERSONAS", () => {
    it("should have 6 default personas", () => {
      expect(DEFAULT_PERSONAS).toHaveLength(6);
    });

    it("should include all required persona types", () => {
      const names = DEFAULT_PERSONAS.map((p) => p.name);
      expect(names).toContain("Move Up");
      expect(names).toContain("Empty Nester / Retiree");
      expect(names).toContain("Luxury");
      expect(names).toContain("First-Time");
      expect(names).toContain("Relocating Pro");
      expect(names).toContain("Investor");
    });

    it("should have unique IDs for all personas", () => {
      const ids = DEFAULT_PERSONAS.map((p) => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(DEFAULT_PERSONAS.length);
    });

    it("each persona should have non-empty text", () => {
      DEFAULT_PERSONAS.forEach((persona) => {
        expect(persona.text.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe("generatePersonaId", () => {
    it("should generate unique IDs even when called in same millisecond", () => {
      const spy = vi.spyOn(Date, "now");
      spy.mockReturnValue(1700000000000);

      const id1 = generatePersonaId();
      const id2 = generatePersonaId();

      expect(id1).not.toBe(id2);

      spy.mockRestore();
    });

    it("should generate IDs with persona- prefix", () => {
      const id = generatePersonaId();
      expect(id.startsWith("persona-")).toBe(true);
    });
  });

  describe("addPersona", () => {
    const testPersonas: Persona[] = [
      { id: "p1", name: "Test Persona", text: "Test description" },
    ];

    it("should add a new persona with valid data", () => {
      const result = addPersona(testPersonas, "New Persona", "New description");
      expect(result).not.toBeNull();
      expect(result!.personas).toHaveLength(2);
      expect(result!.personas[1].name).toBe("New Persona");
      expect(result!.personas[1].text).toBe("New description");
    });

    it("should return null for empty name", () => {
      const result = addPersona(testPersonas, "", "Description");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only name", () => {
      const result = addPersona(testPersonas, "   ", "Description");
      expect(result).toBeNull();
    });

    it("should return null for empty text", () => {
      const result = addPersona(testPersonas, "Name", "");
      expect(result).toBeNull();
    });

    it("should return null for whitespace-only text", () => {
      const result = addPersona(testPersonas, "Name", "   ");
      expect(result).toBeNull();
    });

    it("should trim name and text", () => {
      const result = addPersona(testPersonas, "  Trimmed Name  ", "  Trimmed Text  ");
      expect(result).not.toBeNull();
      expect(result!.personas[1].name).toBe("Trimmed Name");
      expect(result!.personas[1].text).toBe("Trimmed Text");
    });

    it("should return the new persona ID", () => {
      const result = addPersona(testPersonas, "New", "Description");
      expect(result!.newId).toBeTruthy();
      expect(result!.newId.startsWith("persona-")).toBe(true);
    });

    it("should not mutate original array", () => {
      const original = [...testPersonas];
      addPersona(testPersonas, "New", "Description");
      expect(testPersonas).toEqual(original);
    });
  });

  describe("updatePersona", () => {
    const testPersonas: Persona[] = [
      { id: "p1", name: "Original", text: "Original text" },
      { id: "p2", name: "Second", text: "Second text" },
    ];

    it("should update an existing persona", () => {
      const result = updatePersona(testPersonas, "p1", "Updated", "Updated text");
      expect(result[0].name).toBe("Updated");
      expect(result[0].text).toBe("Updated text");
    });

    it("should not affect other personas", () => {
      const result = updatePersona(testPersonas, "p1", "Updated", "Updated text");
      expect(result[1]).toEqual(testPersonas[1]);
    });

    it("should keep original name if empty name provided", () => {
      const result = updatePersona(testPersonas, "p1", "", "New text");
      expect(result[0].name).toBe("Original");
      expect(result[0].text).toBe("New text");
    });

    it("should keep original text if empty text provided", () => {
      const result = updatePersona(testPersonas, "p1", "New name", "");
      expect(result[0].name).toBe("New name");
      expect(result[0].text).toBe("Original text");
    });

    it("should trim values", () => {
      const result = updatePersona(testPersonas, "p1", "  Trimmed  ", "  Trimmed  ");
      expect(result[0].name).toBe("Trimmed");
      expect(result[0].text).toBe("Trimmed");
    });

    it("should return unchanged array if persona not found", () => {
      const result = updatePersona(testPersonas, "nonexistent", "New", "New");
      expect(result).toEqual(testPersonas);
    });

    it("should not mutate original array", () => {
      const original = JSON.parse(JSON.stringify(testPersonas));
      updatePersona(testPersonas, "p1", "New", "New");
      expect(testPersonas).toEqual(original);
    });
  });

  describe("deletePersona", () => {
    const testPersonas: Persona[] = [
      { id: "p1", name: "First", text: "First text" },
      { id: "p2", name: "Second", text: "Second text" },
      { id: "p3", name: "Third", text: "Third text" },
    ];

    it("should delete a persona", () => {
      const result = deletePersona(testPersonas, "p2", "p1");
      expect(result).not.toBeNull();
      expect(result!.personas).toHaveLength(2);
      expect(result!.personas.find((p) => p.id === "p2")).toBeUndefined();
    });

    it("should return null when trying to delete the last persona", () => {
      const singlePersona: Persona[] = [{ id: "p1", name: "Only", text: "Only one" }];
      const result = deletePersona(singlePersona, "p1", "p1");
      expect(result).toBeNull();
    });

    it("should keep active persona ID when deleting a different persona", () => {
      const result = deletePersona(testPersonas, "p2", "p1");
      expect(result!.newActiveId).toBe("p1");
    });

    it("should switch to first remaining persona when deleting active persona", () => {
      const result = deletePersona(testPersonas, "p1", "p1");
      expect(result!.newActiveId).toBe("p2");
    });

    it("should switch to first remaining when active is deleted and was first", () => {
      const result = deletePersona(testPersonas, "p1", "p1");
      expect(result!.newActiveId).toBe(result!.personas[0].id);
    });

    it("should not mutate original array", () => {
      const original = [...testPersonas];
      deletePersona(testPersonas, "p2", "p1");
      expect(testPersonas).toEqual(original);
    });
  });

  describe("findPersona", () => {
    const testPersonas: Persona[] = [
      { id: "p1", name: "First", text: "First text" },
      { id: "p2", name: "Second", text: "Second text" },
    ];

    it("should find an existing persona", () => {
      const result = findPersona(testPersonas, "p1");
      expect(result).toEqual(testPersonas[0]);
    });

    it("should return undefined for non-existent persona", () => {
      const result = findPersona(testPersonas, "nonexistent");
      expect(result).toBeUndefined();
    });

    it("should return undefined for empty array", () => {
      const result = findPersona([], "p1");
      expect(result).toBeUndefined();
    });
  });

  describe("validatePersona", () => {
    it("should validate a valid persona", () => {
      const result = validatePersona("Valid Name", "Valid description");
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject empty name", () => {
      const result = validatePersona("", "Description");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Persona name is required");
    });

    it("should reject empty text", () => {
      const result = validatePersona("Name", "");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Persona description is required");
    });

    it("should reject name over 50 characters", () => {
      const longName = "a".repeat(51);
      const result = validatePersona(longName, "Description");
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Persona name must be 50 characters or less");
    });

    it("should accept name of exactly 50 characters", () => {
      const exactName = "a".repeat(50);
      const result = validatePersona(exactName, "Description");
      expect(result.valid).toBe(true);
    });

    it("should reject text over 500 characters", () => {
      const longText = "a".repeat(501);
      const result = validatePersona("Name", longText);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Persona description must be 500 characters or less");
    });

    it("should accept text of exactly 500 characters", () => {
      const exactText = "a".repeat(500);
      const result = validatePersona("Name", exactText);
      expect(result.valid).toBe(true);
    });

    it("should collect multiple errors", () => {
      const result = validatePersona("", "");
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    it("should trim values before validation", () => {
      const result = validatePersona("  Name  ", "  Description  ");
      expect(result.valid).toBe(true);
    });
  });

  describe("createInitialState", () => {
    it("should create state with default personas", () => {
      const state = createInitialState();
      expect(state.personas).toEqual(DEFAULT_PERSONAS);
    });

    it("should set first persona as active", () => {
      const state = createInitialState();
      expect(state.activePersonaId).toBe(DEFAULT_PERSONAS[0].id);
    });

    it("should create state with custom personas", () => {
      const customPersonas: Persona[] = [
        { id: "custom1", name: "Custom", text: "Custom text" },
      ];
      const state = createInitialState(customPersonas);
      expect(state.personas).toEqual(customPersonas);
      expect(state.activePersonaId).toBe("custom1");
    });

    it("should handle empty personas array", () => {
      const state = createInitialState([]);
      expect(state.personas).toHaveLength(0);
      expect(state.activePersonaId).toBe("");
    });
  });
});

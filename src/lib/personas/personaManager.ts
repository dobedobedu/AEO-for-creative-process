/**
 * Persona Management Module
 *
 * Provides types and functions for managing personas in the AI Visibility Baseline app.
 */

export type Persona = {
  id: string;
  name: string;
  text: string;
};

export type PersonaState = {
  personas: Persona[];
  activePersonaId: string;
};

/**
 * Generic default personas used when no tenant-specific personas are configured.
 */
export const DEFAULT_PERSONAS: Persona[] = [
  { id: "persona-1", name: "Persona 1", text: "Primary target audience segment." },
  { id: "persona-2", name: "Persona 2", text: "Secondary target audience segment." },
];

/**
 * Generate a unique persona ID
 */
let lastPersonaIdTimestamp = 0;
let lastPersonaIdCounter = 0;

export function generatePersonaId(): string {
  const now = Date.now();
  if (now === lastPersonaIdTimestamp) {
    lastPersonaIdCounter += 1;
  } else {
    lastPersonaIdTimestamp = now;
    lastPersonaIdCounter = 0;
  }

  const suffix = lastPersonaIdCounter > 0 ? `-${lastPersonaIdCounter}` : "";
  return `persona-${now}${suffix}`;
}

/**
 * Add a new persona to the list
 */
export function addPersona(
  personas: Persona[],
  name: string,
  text: string
): { personas: Persona[]; newId: string } | null {
  const trimmedName = name.trim();
  const trimmedText = text.trim();

  if (!trimmedName || !trimmedText) {
    return null;
  }

  const newId = generatePersonaId();
  const newPersona: Persona = {
    id: newId,
    name: trimmedName,
    text: trimmedText,
  };

  return {
    personas: [...personas, newPersona],
    newId,
  };
}

/**
 * Update an existing persona
 */
export function updatePersona(
  personas: Persona[],
  personaId: string,
  name: string,
  text: string
): Persona[] {
  const trimmedName = name.trim();
  const trimmedText = text.trim();

  return personas.map((p) =>
    p.id === personaId
      ? {
          ...p,
          name: trimmedName || p.name,
          text: trimmedText || p.text,
        }
      : p
  );
}

/**
 * Delete a persona by ID
 * Returns null if trying to delete the last persona
 */
export function deletePersona(
  personas: Persona[],
  personaId: string,
  activePersonaId: string
): { personas: Persona[]; newActiveId: string } | null {
  // Cannot delete the last persona
  if (personas.length <= 1) {
    return null;
  }

  const next = personas.filter((p) => p.id !== personaId);

  // If we deleted the active persona, switch to the first remaining one
  const newActiveId =
    activePersonaId === personaId && next.length > 0
      ? next[0].id
      : activePersonaId;

  return {
    personas: next,
    newActiveId,
  };
}

/**
 * Find a persona by ID
 */
export function findPersona(
  personas: Persona[],
  personaId: string
): Persona | undefined {
  return personas.find((p) => p.id === personaId);
}

/**
 * Validate persona data
 */
export function validatePersona(name: string, text: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!name.trim()) {
    errors.push("Persona name is required");
  }

  if (!text.trim()) {
    errors.push("Persona description is required");
  }

  if (name.trim().length > 50) {
    errors.push("Persona name must be 50 characters or less");
  }

  if (text.trim().length > 500) {
    errors.push("Persona description must be 500 characters or less");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create initial persona state
 */
export function createInitialState(
  personas: Persona[] = DEFAULT_PERSONAS
): PersonaState {
  return {
    personas,
    activePersonaId: personas.length > 0 ? personas[0].id : "",
  };
}

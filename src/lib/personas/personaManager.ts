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
 * Default personas for Lakewood Ranch real estate context
 */
export const DEFAULT_PERSONAS: Persona[] = [
  {
    id: "persona-1",
    name: "Move Up",
    text: "Millennial or Gen X, college education, HHI $100-200K, married with children. Seeking a larger home with more amenities for their growing family. Image focused, buying designer clothes. Wants to eat healthy but often grabs takeout for ease. Thrives in social settings.",
  },
  {
    id: "persona-2",
    name: "Empty Nester / Retiree",
    text: "Gen X or Boomer, college education, HHI $100-$200K, married without children at home. Seeking to downsize as they become empty nesters or retire. Purchases high quality brands, particularly if they support a cause. Frequently diets to stay in shape. Likely to use smart home devices.",
  },
  {
    id: "persona-3",
    name: "Luxury",
    text: "Millennial or Gen X, college or grad school education, HHI $200K+, married, potentially with children. Seeking a custom home in an esteemed community. Career-focused and a natural leader. An early adopter of products and services. Intelligent and well-informed.",
  },
  {
    id: "persona-4",
    name: "First-Time",
    text: "Gen Z or Millennial, college or high school education, HHI $100-200K, some married with kids, some single. Seeking their first home in a community where they can grow. Follows trends and celebrities. Eager to get ahead and become successful. A risk taker and thrill seeker.",
  },
  {
    id: "persona-5",
    name: "Relocating Pro",
    text: "Millennial or Gen X, college or grad school education, HHI $150-300K, often married. Relocating for a new job opportunity or remote work flexibility. Researches extensively online before making decisions. Values convenience, schools, and proximity to airports. Tech-savvy and relies on digital tools for the home search.",
  },
  {
    id: "persona-6",
    name: "Investor",
    text: "Gen X or Boomer, college education, HHI $200K+, experienced in real estate or financial investments. Looking for rental properties, vacation homes, or appreciation potential. Analyzes market data, cap rates, and rental yields. Prefers communities with strong HOAs and appreciating property values. May own multiple properties.",
  },
];

/**
 * Generate a unique persona ID
 */
export function generatePersonaId(): string {
  return `persona-${Date.now()}`;
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

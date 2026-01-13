import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import {
  IntentLibrary,
  IntentLibrarySchema,
  Intent,
  IntentSchema,
  IntentChange,
  Persona,
  Stage,
  generateIntentId,
} from "./types";

const DATA_DIR = join(process.cwd(), "data", "intents");
const LIBRARY_PATH = join(DATA_DIR, "library.json");

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadIntentLibrary(): IntentLibrary {
  ensureDataDir();

  if (!existsSync(LIBRARY_PATH)) {
    const empty: IntentLibrary = {
      version: 0,
      updatedAt: new Date().toISOString(),
      intents: [],
      history: [],
    };
    return empty;
  }

  const raw = readFileSync(LIBRARY_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return IntentLibrarySchema.parse(parsed);
}

export function saveIntentLibrary(library: IntentLibrary): void {
  ensureDataDir();
  const validated = IntentLibrarySchema.parse(library);
  writeFileSync(LIBRARY_PATH, JSON.stringify(validated, null, 2), "utf-8");
}

export function getIntentsForCell(
  library: IntentLibrary,
  persona: Persona,
  stage: Stage
): Intent[] {
  return library.intents.filter(
    (i) => i.persona === persona && i.stage === stage && i.active
  );
}

export function getIntentById(library: IntentLibrary, intentId: string): Intent | undefined {
  return library.intents.find((i) => i.id === intentId);
}

export function createIntent(
  library: IntentLibrary,
  input: Omit<Intent, "id" | "createdAt" | "active">
): IntentLibrary {
  const validated = IntentSchema.omit({ id: true, createdAt: true, active: true }).parse(input);

  const newIntent: Intent = {
    ...validated,
    id: generateIntentId(validated.persona, validated.stage),
    createdAt: new Date().toISOString(),
    active: true,
  };

  const change: IntentChange = {
    action: "created",
    intentId: newIntent.id,
  };

  const newVersion = library.version + 1;
  const now = new Date();

  return {
    version: newVersion,
    updatedAt: now.toISOString(),
    intents: [...library.intents, newIntent],
    history: [
      ...library.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes: [change],
      },
    ],
  };
}

export function updateIntent(
  library: IntentLibrary,
  intentId: string,
  updates: Partial<Pick<Intent, "text" | "role" | "queryStyle">>
): IntentLibrary {
  const existingIndex = library.intents.findIndex((i) => i.id === intentId);
  if (existingIndex === -1) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  const existing = library.intents[existingIndex];
  const changes: IntentChange[] = [];

  if (updates.text !== undefined && updates.text !== existing.text) {
    changes.push({
      action: "modified",
      intentId,
      field: "text",
      oldValue: existing.text,
      newValue: updates.text,
    });
  }

  if (updates.role !== undefined && updates.role !== existing.role) {
    changes.push({
      action: "modified",
      intentId,
      field: "role",
      oldValue: existing.role,
      newValue: updates.role,
    });
  }

  if (updates.queryStyle !== undefined && updates.queryStyle !== existing.queryStyle) {
    changes.push({
      action: "modified",
      intentId,
      field: "queryStyle",
      oldValue: existing.queryStyle,
      newValue: updates.queryStyle,
    });
  }

  if (changes.length === 0) {
    return library;
  }

  const updated: Intent = { ...existing, ...updates };
  const newIntents = [...library.intents];
  newIntents[existingIndex] = updated;

  const newVersion = library.version + 1;
  const now = new Date();

  return {
    version: newVersion,
    updatedAt: now.toISOString(),
    intents: newIntents,
    history: [
      ...library.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes,
      },
    ],
  };
}

export function deactivateIntent(library: IntentLibrary, intentId: string): IntentLibrary {
  const existingIndex = library.intents.findIndex((i) => i.id === intentId);
  if (existingIndex === -1) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  const existing = library.intents[existingIndex];
  if (!existing.active) {
    return library;
  }

  const change: IntentChange = {
    action: "deactivated",
    intentId,
  };

  const updated: Intent = { ...existing, active: false };
  const newIntents = [...library.intents];
  newIntents[existingIndex] = updated;

  const newVersion = library.version + 1;
  const now = new Date();

  return {
    version: newVersion,
    updatedAt: now.toISOString(),
    intents: newIntents,
    history: [
      ...library.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes: [change],
      },
    ],
  };
}

export function reactivateIntent(library: IntentLibrary, intentId: string): IntentLibrary {
  const existingIndex = library.intents.findIndex((i) => i.id === intentId);
  if (existingIndex === -1) {
    throw new Error(`Intent not found: ${intentId}`);
  }

  const existing = library.intents[existingIndex];
  if (existing.active) {
    return library;
  }

  const change: IntentChange = {
    action: "reactivated",
    intentId,
  };

  const updated: Intent = { ...existing, active: true };
  const newIntents = [...library.intents];
  newIntents[existingIndex] = updated;

  const newVersion = library.version + 1;
  const now = new Date();

  return {
    version: newVersion,
    updatedAt: now.toISOString(),
    intents: newIntents,
    history: [
      ...library.history,
      {
        version: newVersion,
        date: now.toISOString().split("T")[0],
        changes: [change],
      },
    ],
  };
}

export function getIntentChangesForVersion(
  library: IntentLibrary,
  version: number
): IntentChange[] {
  const entry = library.history.find((h) => h.version === version);
  return entry?.changes ?? [];
}

export function getVersionsWithChanges(library: IntentLibrary): number[] {
  return library.history.map((h) => h.version);
}

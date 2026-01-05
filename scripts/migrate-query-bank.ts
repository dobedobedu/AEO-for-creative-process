/**
 * Migration Script: Convert QUERY_BANK to Intent Library
 * 
 * This script converts the hardcoded QUERY_BANK from visibility-matrix/page.tsx
 * into the new Intent Library format stored in /data/intents/library.json
 * 
 * Run with: npx tsx scripts/migrate-query-bank.ts
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Types (copied from src/lib/intents/types.ts to avoid import issues during migration)
type Persona = "move_up" | "retiree" | "luxury" | "first_time";
type Stage = "explore" | "consider" | "compare" | "decide";

interface Intent {
  id: string;
  persona: Persona;
  stage: Stage;
  text: string;
  defaultQueries: string[];
  temperature: number;
  createdAt: string;
  active: boolean;
}

interface IntentLibrary {
  version: number;
  updatedAt: string;
  intents: Intent[];
  history: Array<{
    version: number;
    date: string;
    changes: Array<{ action: string; intentId: string }>;
  }>;
}

// The QUERY_BANK from visibility-matrix/page.tsx
const QUERY_BANK: Record<Persona, Record<Stage, string[]>> = {
  move_up: {
    explore: [
      "best places in florida for growing families",
      "whats the best place in florida to raise a family",
      "is tampa a good place to raise a family",
    ],
    consider: [
      "master planned communities florida families",
      "best family neighborhoods and schools in orlando area",
      "florida communities with good schools not too expensive",
    ],
    compare: [
      "lakewood ranch vs nocatee for families",
      "wellen park vs lakewood ranch schools",
      "tampa vs orlando for young families",
    ],
    decide: [
      "best neighborhoods in lakewood ranch for families",
      "nocatee schools vs lakewood ranch schools",
    ],
  },
  retiree: {
    explore: [
      "best places to retire in florida 2025",
      "best places to retire in florida that arent too hot",
      "how much do i really need to retire in florida",
    ],
    consider: [
      "55 plus communities florida amenities",
      "what 55+ communities in florida have lots of clubs and activities",
      "active adult communities southwest florida",
    ],
    compare: [
      "lakewood ranch vs the villages for retirees",
      "the villages vs sun city center",
      "the villages vs on top of the world retirement",
    ],
    decide: [
      "is it hard to find doctors accepting medicare in the villages",
      "cresswind lakewood ranch reviews",
    ],
  },
  luxury: {
    explore: [
      "luxury communities florida gulf coast",
      "upscale master planned communities florida",
      "best florida retirement cities culture theater museums restaurants",
    ],
    consider: [
      "florida communities with golf courses",
      "waterfront homes master planned florida",
      "sarasota vs naples for retirement",
    ],
    compare: [
      "lakewood ranch country club vs tpc prestancia",
      "lakewood ranch waterside vs regular lwr",
      "sarasota vs lakewood ranch traffic and beach access",
    ],
    decide: [
      "luxury homes lakewood ranch waterside",
      "why is lakewood ranch so expensive",
    ],
  },
  first_time: {
    explore: [
      "affordable places to live in florida 2025",
      "best florida cities for young professionals",
      "cheapest places to live in florida with good schools",
    ],
    consider: [
      "florida communities low hoa fees",
      "whats the deal with cdd fees in florida communities",
      "hidden costs of living in florida besides rent and food",
    ],
    compare: [
      "hoa community vs no hoa in florida",
      "buying new construction vs older home in florida",
      "living in tampa vs suburbs like wesley chapel",
    ],
    decide: [
      "new construction under 400k florida",
      "is it better to rent first before buying in florida 2025",
    ],
  },
};

// Intent text templates for each persona × stage
const INTENT_TEXTS: Record<Persona, Record<Stage, string>> = {
  move_up: {
    explore: "Growing family exploring Florida relocation options",
    consider: "Family evaluating master-planned communities with good schools",
    compare: "Family comparing specific communities for schools and lifestyle",
    decide: "Family ready to choose a neighborhood in their top community",
  },
  retiree: {
    explore: "Retiree exploring Florida retirement destinations",
    consider: "Retiree evaluating 55+ communities and active adult options",
    compare: "Retiree comparing specific retirement communities",
    decide: "Retiree ready to choose and gathering final validation",
  },
  luxury: {
    explore: "Affluent buyer exploring upscale Florida communities",
    consider: "Luxury buyer evaluating golf, waterfront, and cultural amenities",
    compare: "Luxury buyer comparing premium communities and country clubs",
    decide: "Luxury buyer ready to invest in specific high-end options",
  },
  first_time: {
    explore: "First-time buyer exploring affordable Florida options",
    consider: "First-time buyer understanding costs, fees, and hidden expenses",
    compare: "First-time buyer comparing new construction vs existing homes",
    decide: "First-time buyer ready to purchase within budget",
  },
};

function generateIntentId(persona: Persona, stage: Stage): string {
  const timestamp = Date.now().toString(36);
  return `int_${persona}_${stage}_${timestamp}`;
}

function migrate(): void {
  const now = new Date();
  const intents: Intent[] = [];
  const changes: Array<{ action: string; intentId: string }> = [];

  const personas: Persona[] = ["move_up", "retiree", "luxury", "first_time"];
  const stages: Stage[] = ["explore", "consider", "compare", "decide"];

  for (const persona of personas) {
    for (const stage of stages) {
      const id = generateIntentId(persona, stage);
      const intent: Intent = {
        id,
        persona,
        stage,
        text: INTENT_TEXTS[persona][stage],
        defaultQueries: QUERY_BANK[persona][stage],
        temperature: 0.5,
        createdAt: now.toISOString(),
        active: true,
      };
      intents.push(intent);
      changes.push({ action: "created", intentId: id });
    }
  }

  const library: IntentLibrary = {
    version: 1,
    updatedAt: now.toISOString(),
    intents,
    history: [
      {
        version: 1,
        date: now.toISOString().split("T")[0],
        changes,
      },
    ],
  };

  // Ensure data directory exists
  const dataDir = join(process.cwd(), "data", "intents");
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Write library
  const libraryPath = join(dataDir, "library.json");
  writeFileSync(libraryPath, JSON.stringify(library, null, 2), "utf-8");

  console.log(`✅ Migration complete!`);
  console.log(`   Created ${intents.length} intents (${personas.length} personas × ${stages.length} stages)`);
  console.log(`   Library saved to: ${libraryPath}`);
  console.log(`   Version: ${library.version}`);
  
  // Summary
  console.log(`\n📊 Intent Summary:`);
  for (const persona of personas) {
    const personaIntents = intents.filter(i => i.persona === persona);
    const queryCount = personaIntents.reduce((sum, i) => sum + i.defaultQueries.length, 0);
    console.log(`   ${persona}: ${personaIntents.length} intents, ${queryCount} queries`);
  }
}

// Run migration
migrate();

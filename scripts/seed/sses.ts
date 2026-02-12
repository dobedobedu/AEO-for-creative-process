// scripts/seed/sses.ts
// Usage: npx tsx scripts/seed/sses.ts [--database-url <url>]
//
// Applies SSES (Saint Stephen's Episcopal School) tenant seed data to the database.
// Run AFTER canonical migrations have been applied.
//
// This is the single source of truth for SSES tenant configuration.
// It consolidates logic previously spread across:
//   - scripts/direct-update-sses.ts
//   - scripts/manual-sses-update.ts
//   - scripts/update-sses-detailed-personas.ts
//   - scripts/update-sses-config.ts

import postgres from "postgres";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonaSeed {
  id: string;
  label: string;
  description: string;
  fullText: string;
  orderIndex: number;
}

interface StageSeed {
  id: string;
  label: string;
  description: string;
  orderIndex: number;
  coreStageMapping: string;
  primaryMetric: string;
}

interface EntityCategorySeed {
  id: string;
  label: string;
  terms: string[];
}

interface BrandSeed {
  name: string;
  aliases: string[];
  domain: string;
  highlightColor: string;
}

interface CompetitorSeed {
  name: string;
  aliases: string[];
  isPrimary: boolean;
}

interface GeographySeed {
  region: string;
  localities: string[];
  nearbyMetros: string[];
}

// ---------------------------------------------------------------------------
// SSES Seed Data (sourced from config/templates/education-k12-elite.json
// and existing seed scripts)
// ---------------------------------------------------------------------------

const SSES_BRAND: BrandSeed = {
  name: "Saint Stephen's Episcopal School",
  aliases: ["SSES", "Saint Stephen's Bradenton", "Saint Stephens"],
  domain: "saintstephens.org",
  highlightColor: "#1f3b2c",
};

const SSES_COMPETITORS: CompetitorSeed[] = [
  { name: "The Out-of-Door Academy", aliases: ["ODA"], isPrimary: true },
  { name: "IMG Academy", aliases: [], isPrimary: true },
  { name: "Pine View School", aliases: [], isPrimary: true },
  { name: "Sarasota Christian School", aliases: [], isPrimary: false },
  { name: "Cardinal Mooney High School", aliases: [], isPrimary: false },
  { name: "Berkeley Preparatory School", aliases: ["Berkeley Prep"], isPrimary: false },
];

const SSES_GEOGRAPHY: GeographySeed = {
  region: "Florida Gulf Coast",
  localities: ["Bradenton", "Sarasota", "Lakewood Ranch"],
  nearbyMetros: ["Tampa Bay"],
};

const SSES_PERSONAS: PersonaSeed[] = [
  {
    id: "wealthy_migrant",
    label: "The Wealthy Migrant",
    description:
      "High-net-worth families relocating from NY/CA/NJ seeking prestige and community integration.",
    fullText:
      "High-net-worth families relocating from tax-heavy states (NY, NJ, CA) to the Florida Gulf Coast. These families prioritize academic prestige, community integration, and social networking. They view education as both an investment in their children's future and a mechanism for establishing themselves in regional elite circles.",
    orderIndex: 0,
  },
  {
    id: "neurodivergent_advocate",
    label: "The Neurodivergent Advocate",
    description:
      'Parents of gifted or "spiky" kids looking for the "Vibrant Anomaly" environment that celebrates neurodiversity.',
    fullText:
      'Parents of children who are gifted, twice-exceptional (2e), or neurodivergent (ADHD, ASD, dyslexia). These families have often had negative experiences with traditional schools that prioritize conformity over cognitive diversity. They seek environments that celebrate the "Vibrant Anomaly" - students with unusual intellectual profiles who think differently.',
    orderIndex: 1,
  },
  {
    id: "innovation_seeker",
    label: "The Innovation Seeker",
    description:
      'Tech-forward parents prioritizing STEAM, "Mini Xerox PARC" labs, and Artrepreneurship.',
    fullText:
      'Technology-forward parents who want their children to develop skills for the innovation economy. These families are often in tech, engineering, or entrepreneurial fields themselves. They seek schools with "Mini Xerox PARC" characteristics: slack for exploration, high-ceiling tools, first-principles thinking, and cross-pollination between disciplines.',
    orderIndex: 2,
  },
  {
    id: "heritage_guardian",
    label: "The Heritage Guardian",
    description:
      "Established regional families valuing Episcopal tradition, social networking, and ethical leadership.",
    fullText:
      "Long-time regional families who value tradition, character education, and institutional heritage. These families often have multi-generational connections to the school and view it as a steward of community values. They prioritize Episcopal traditions, ethical leadership development, and the social networks that private schools cultivate.",
    orderIndex: 3,
  },
];

const SSES_STAGES: StageSeed[] = [
  {
    id: "discover",
    label: "Discover",
    description: "Finding top-tier education in the Florida Gulf Coast region.",
    orderIndex: 0,
    coreStageMapping: "discover",
    primaryMetric: "discovery_rate",
  },
  {
    id: "research",
    label: "Culture & Curriculum",
    description:
      "Deep dive into innovation labs, neurodiversity support, and academic rigor.",
    orderIndex: 1,
    coreStageMapping: "consider",
    primaryMetric: "mention_rate",
  },
  {
    id: "compare",
    label: "Benchmarking",
    description:
      "How SSES compares to ODA, Pine View, and national elite schools.",
    orderIndex: 2,
    coreStageMapping: "compare",
    primaryMetric: "win_rate",
  },
  {
    id: "apply",
    label: "Affordability & ROI",
    description:
      "Evaluating indexed tuition, universal vouchers, and long-term network value.",
    orderIndex: 3,
    coreStageMapping: "decide",
    primaryMetric: "recommendation_rate",
  },
];

const SSES_ENTITY_CATEGORIES: EntityCategorySeed[] = [
  {
    id: "innovation",
    label: "Innovation Labs",
    terms: ["STEAM Center", "Mini Xerox PARC", "Artrepreneurship", "3D Printing"],
  },
  {
    id: "neurodiversity",
    label: "Learning Capital",
    terms: ["Vibrant Anomaly", "ADHD support", "Gifted program", "personalized learning"],
  },
  {
    id: "community",
    label: "Social Ecosystem",
    terms: ["Lakewood Ranch", "Sarasota Yacht Club", "Episcopal values", "HNW network"],
  },
  {
    id: "financials",
    label: "Fiscal Architecture",
    terms: ["Indexed Tuition", "Universal Vouchers", "School Choice", "Scholarships"],
  },
  {
    id: "outcomes",
    label: "Leadership Heritage",
    terms: ["College placement", "Entrepreneurial success", "Alumni network"],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === name) {
      return argv[i + 1];
    }
  }
  return undefined;
}

function needsSsl(connectionString: string): boolean {
  return !/localhost|127\.0\.0\.1/.test(connectionString);
}

// ---------------------------------------------------------------------------
// Seed Logic
// ---------------------------------------------------------------------------

async function seed(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, {
    ssl: needsSsl(databaseUrl) ? "require" : undefined,
    max: 1,
  });

  try {
    // ---- 1. Upsert personas ----
    console.log("\n📚 Seeding SSES personas...");
    for (const persona of SSES_PERSONAS) {
      await sql`
        INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)
        VALUES (
          ${persona.id},
          ${persona.label},
          ${persona.description},
          ${persona.fullText},
          ${persona.orderIndex},
          true
        )
        ON CONFLICT (persona_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          full_text = EXCLUDED.full_text,
          order_index = EXCLUDED.order_index,
          active = true
      `;
      console.log(`  ✅ ${persona.label}`);
    }

    // ---- 2. Upsert stages ----
    console.log("\n📊 Seeding SSES stages...");
    for (const stage of SSES_STAGES) {
      await sql`
        INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
        VALUES (
          ${stage.id},
          ${stage.label},
          ${stage.description},
          ${stage.orderIndex},
          true,
          true,
          ${stage.coreStageMapping},
          ${stage.primaryMetric}
        )
        ON CONFLICT (stage_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          order_index = EXCLUDED.order_index,
          active = true,
          core_stage = true,
          core_stage_mapping = EXCLUDED.core_stage_mapping,
          primary_metric = EXCLUDED.primary_metric
      `;
      console.log(`  ✅ ${stage.label}`);
    }

    // ---- 3. Upsert entity categories and terms ----
    console.log("\n🏷️  Seeding SSES entity categories and terms...");
    for (const category of SSES_ENTITY_CATEGORIES) {
      // Upsert category
      await sql`
        INSERT INTO matrix_entity_categories (id, label)
        VALUES (${category.id}, ${category.label})
        ON CONFLICT (id) DO UPDATE SET
          label = EXCLUDED.label
      `;

      // Upsert terms for this category
      for (const term of category.terms) {
        await sql`
          INSERT INTO matrix_entity_terms (category_id, canonical_name)
          VALUES (${category.id}, ${term})
          ON CONFLICT (category_id, canonical_name) DO NOTHING
        `;
      }
      console.log(`  ✅ ${category.label} (${category.terms.length} terms)`);
    }

    // ---- 4. Update tenant_config with SSES brand, competitors, geography ----
    console.log("\n⚙️  Updating tenant_config...");
    const brandJson = JSON.stringify(SSES_BRAND);
    const competitorsJson = JSON.stringify(SSES_COMPETITORS);
    const geographyJson = JSON.stringify(SSES_GEOGRAPHY);

    await sql`
      UPDATE tenant_config
      SET
        brand_json = ${brandJson}::jsonb,
        competitors_json = ${competitorsJson}::jsonb,
        geography_json = ${geographyJson}::jsonb,
        industry = 'education',
        updated_at = NOW()
      WHERE id = 'default'
    `;
    console.log("  ✅ tenant_config updated with SSES brand, competitors, geography");

    console.log("\n✨ SSES seed complete!");
  } finally {
    await sql.end();
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function run(): Promise<number> {
  console.log("🌱 SSES Tenant Seed Script");
  console.log("   Applies SSES-specific personas, stages, entities, and brand config.");

  const databaseUrl = getArg("--database-url") ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("[seed:sses] DATABASE_URL is not set. Pass --database-url or set env.");
    return 2;
  }

  try {
    await seed(databaseUrl);
    return 0;
  } catch (err) {
    console.error(`[seed:sses] fatal: ${(err as Error).message}`);
    return 1;
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`[seed:sses] fatal: ${(err as Error).message}`);
    process.exit(1);
  });

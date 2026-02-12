// ⚠️ DEPRECATED: This file is no longer the source of truth.
// Use `scripts/seed/sses.ts` instead.
// See docs/runbook.md for canonical tenant seed process.

import fs from 'fs';
import path from 'path';
import { sql } from '../src/lib/db';

async function runMigration() {
  try {
    console.log('🔄 Running SSES personas and stages migration...');

    const migrationPath = path.join(process.cwd(), 'sql/migrations/006_update_sses_personas_stages.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Updated Personas:');
    console.log('  - The Wealthy Migrant (HNW families from NY/CA/NJ)');
    console.log('  - The Neurodivergent Advocate (gifted/2e families)');
    console.log('  - The Innovation Seeker (tech-forward, STEAM focus)');
    console.log('  - The Heritage Guardian (tradition, Episcopal values)');
    console.log('');
    console.log('Updated Stages:');
    console.log('  - Discover (initial research)');
    console.log('  - Culture & Curriculum (deep dive)');
    console.log('  - Benchmarking (competitor comparison)');
    console.log('  - Affordability & ROI (tuition, vouchers)');
    console.log('');
    console.log('Entity Categories: Innovation, Neurodiversity, Community, Financials, Outcomes');
    console.log('');
    console.log('You can now edit these in the Admin panel at /admin/matrix');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

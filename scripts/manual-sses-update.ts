#!/usr/bin/env node

/**
 * Manual SSES Personas & Stages Update Script
 * Run this with: node scripts/manual-sses-update.js
 */

const SSES_PERSONAS = [
  {
    id: 'wealthy_migrant',
    label: 'The Wealthy Migrant',
    description: 'High-net-worth families relocating from NY/CA/NJ seeking prestige and community integration.',
    fullText: 'High-net-worth families relocating from tax-heavy states (NY, NJ, CA) to the Florida Gulf Coast. These families prioritize academic prestige, community integration, and social networking.',
    orderIndex: 0,
    active: true
  },
  {
    id: 'neurodivergent_advocate',
    label: 'The Neurodivergent Advocate',
    description: 'Parents of gifted or "spiky" kids looking for the "Vibrant Anomaly" environment.',
    fullText: 'Parents of children who are gifted, twice-exceptional (2e), or neurodivergent (ADHD, ASD, dyslexia). They seek environments that celebrate the "Vibrant Anomaly".',
    orderIndex: 1,
    active: true
  },
  {
    id: 'innovation_seeker',
    label: 'The Innovation Seeker',
    description: 'Tech-forward parents prioritizing STEAM, "Mini Xerox PARC" labs, and Artrepreneurship.',
    fullText: 'Technology-forward parents who want their children to develop skills for the innovation economy. They seek schools with "Mini Xerox PARC" characteristics.',
    orderIndex: 2,
    active: true
  },
  {
    id: 'heritage_guardian',
    label: 'The Heritage Guardian',
    description: 'Established regional families valuing Episcopal tradition, social networking, and ethical leadership.',
    fullText: 'Long-time regional families who value tradition, character education, and institutional heritage. They prioritize Episcopal traditions and ethical leadership.',
    orderIndex: 3,
    active: true
  }
];

const SSES_STAGES = [
  {
    id: 'discover',
    label: 'Discover',
    description: 'Finding top-tier education in the Florida Gulf Coast region.',
    orderIndex: 0,
    active: true,
    coreStage: true,
    coreStageMapping: 'discover',
    primaryMetric: 'discovery_rate'
  },
  {
    id: 'research',
    label: 'Culture & Curriculum',
    description: 'Deep dive into innovation labs, neurodiversity support, and academic rigor.',
    orderIndex: 1,
    active: true,
    coreStage: true,
    coreStageMapping: 'consider',
    primaryMetric: 'mention_rate'
  },
  {
    id: 'compare',
    label: 'Benchmarking',
    description: 'How SSES compares to ODA, Pine View, and national elite schools.',
    orderIndex: 2,
    active: true,
    coreStage: true,
    coreStageMapping: 'compare',
    primaryMetric: 'win_rate'
  },
  {
    id: 'apply',
    label: 'Affordability & ROI',
    description: 'Evaluating indexed tuition, universal vouchers, and long-term network value.',
    orderIndex: 3,
    active: true,
    coreStage: true,
    coreStageMapping: 'decide',
    primaryMetric: 'recommendation_rate'
  }
];

console.log('📚 SSES Personas & Stages Manual Update');
console.log('');
console.log('This script provides the SQL commands you can run manually in Supabase:');
console.log('');
console.log('1. Go to your Supabase dashboard');
console.log('2. Navigate to SQL Editor');
console.log('3. Run the commands below:');
console.log('');
console.log('='.repeat(80));
console.log('');

// Generate SQL commands
console.log('-- Update Personas');
console.log('');
SSES_PERSONAS.forEach(p => {
  console.log(`-- ${p.label}`);
  console.log(`INSERT INTO matrix_personas (persona_id, label, description, full_text, order_index, active)`);
  console.log(`VALUES (`);
  console.log(`  '${p.id}',`);
  console.log(`  '${p.label}',`);
  console.log(`  '${p.description}',`);
  console.log(`  '${p.fullText.replace(/'/g, "''")}',`);
  console.log(`  ${p.orderIndex},`);
  console.log(`  ${p.active}`);
  console.log(`)`);
  console.log(`ON CONFLICT (persona_id) DO UPDATE SET`);
  console.log(`  label = EXCLUDED.label,`);
  console.log(`  description = EXCLUDED.description,`);
  console.log(`  full_text = EXCLUDED.full_text,`);
  console.log(`  order_index = EXCLUDED.order_index,`);
  console.log(`  active = EXCLUDED.active;`);
  console.log('');
});

console.log('-- Update Stages');
console.log('');
SSES_STAGES.forEach(s => {
  console.log(`-- ${s.label}`);
  console.log(`INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)`);
  console.log(`VALUES (`);
  console.log(`  '${s.id}',`);
  console.log(`  '${s.label}',`);
  console.log(`  '${s.description}',`);
  console.log(`  ${s.orderIndex},`);
  console.log(`  ${s.active},`);
  console.log(`  ${s.coreStage},`);
  console.log(`  '${s.coreStageMapping}',`);
  console.log(`  '${s.primaryMetric}'`);
  console.log(`)`);
  console.log(`ON CONFLICT (stage_id) DO UPDATE SET`);
  console.log(`  label = EXCLUDED.label,`);
  console.log(`  description = EXCLUDED.description,`);
  console.log(`  order_index = EXCLUDED.order_index,`);
  console.log(`  active = EXCLUDED.active,`);
  console.log(`  core_stage = EXCLUDED.core_stage,`);
  console.log(`  core_stage_mapping = EXCLUDED.core_stage_mapping,`);
  console.log(`  primary_metric = EXCLUDED.primary_metric;`);
  console.log('');
});

console.log('-- Deactivate old personas/stages');
console.log(`UPDATE matrix_personas SET active = false WHERE persona_id IN ('move_up', 'retiree', 'luxury', 'first_time');`);
console.log(`UPDATE matrix_stages SET active = false WHERE stage_id IN ('explore', 'consider');`);
console.log('');
console.log('='.repeat(80));
console.log('');
console.log('After running these commands:');
console.log('1. Go to /admin/matrix in your app');
console.log('2. You should see the updated personas and stages');
console.log('3. Click "Publish" to make them live');
console.log('');

import { sql } from '../src/lib/db';

async function updateSSESConfig() {
  try {
    console.log('🔄 Updating SSES Personas and Stages...');

    // Update Personas
    console.log('\n📚 Updating Personas...');

    const personasData = [
      {
        id: 'wealthy_migrant',
        label: 'The Wealthy Migrant',
        description: 'High-net-worth families relocating from NY/CA/NJ seeking prestige and community integration.',
        fullText: 'High-net-worth families relocating from tax-heavy states (NY, NJ, CA) to the Florida Gulf Coast. These families prioritize academic prestige, community integration, and social networking. They view education as both an investment in their children\'s future and a mechanism for establishing themselves in regional elite circles.',
        orderIndex: 0
      },
      {
        id: 'neurodivergent_advocate',
        label: 'The Neurodivergent Advocate',
        description: 'Parents of gifted or "spiky" kids looking for the "Vibrant Anomaly" environment that celebrates neurodiversity.',
        fullText: 'Parents of children who are gifted, twice-exceptional (2e), or neurodivergent (ADHD, ASD, dyslexia). These families have often had negative experiences with traditional schools that prioritize conformity over cognitive diversity. They seek environments that celebrate the "Vibrant Anomaly" - students with unusual intellectual profiles who think differently.',
        orderIndex: 1
      },
      {
        id: 'innovation_seeker',
        label: 'The Innovation Seeker',
        description: 'Tech-forward parents prioritizing STEAM, "Mini Xerox PARC" labs, and Artrepreneurship.',
        fullText: 'Technology-forward parents who want their children to develop skills for the innovation economy. These families are often in tech, engineering, or entrepreneurial fields themselves. They seek schools with "Mini Xerox PARC" characteristics: slack for exploration, high-ceiling tools, first-principles thinking, and cross-pollination between disciplines.',
        orderIndex: 2
      },
      {
        id: 'heritage_guardian',
        label: 'The Heritage Guardian',
        description: 'Established regional families valuing Episcopal tradition, social networking, and ethical leadership.',
        fullText: 'Long-time regional families who value tradition, character education, and institutional heritage. These families often have multi-generational connections to the school and view it as a steward of community values. They prioritize Episcopal traditions, ethical leadership development, and the social networks that private schools cultivate.',
        orderIndex: 3
      }
    ];

    for (const persona of personasData) {
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
      console.log(`  ✅ Updated: ${persona.label}`);
    }

    // Update Stages
    console.log('\n📊 Updating Stages...');

    const stagesData = [
      {
        id: 'discover',
        label: 'Discover',
        description: 'Finding top-tier education in the Florida Gulf Coast region.',
        orderIndex: 0,
        coreStage: true,
        coreStageMapping: 'discover',
        primaryMetric: 'discovery_rate'
      },
      {
        id: 'research',
        label: 'Culture & Curriculum',
        description: 'Deep dive into innovation labs, neurodiversity support, and academic rigor.',
        orderIndex: 1,
        coreStage: true,
        coreStageMapping: 'consider',
        primaryMetric: 'mention_rate'
      },
      {
        id: 'compare',
        label: 'Benchmarking',
        description: 'How SSES compares to ODA, Pine View, and national elite schools.',
        orderIndex: 2,
        coreStage: true,
        coreStageMapping: 'compare',
        primaryMetric: 'win_rate'
      },
      {
        id: 'apply',
        label: 'Affordability & ROI',
        description: 'Evaluating indexed tuition, universal vouchers, and long-term network value.',
        orderIndex: 3,
        coreStage: true,
        coreStageMapping: 'decide',
        primaryMetric: 'recommendation_rate'
      }
    ];

    for (const stage of stagesData) {
      await sql`
        INSERT INTO matrix_stages (stage_id, label, description, order_index, active, core_stage, core_stage_mapping, primary_metric)
        VALUES (
          ${stage.id},
          ${stage.label},
          ${stage.description},
          ${stage.orderIndex},
          true,
          ${stage.coreStage},
          ${stage.coreStageMapping},
          ${stage.primaryMetric}
        )
        ON CONFLICT (stage_id) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          order_index = EXCLUDED.order_index,
          active = true,
          core_stage = EXCLUDED.core_stage,
          core_stage_mapping = EXCLUDED.core_stage_mapping,
          primary_metric = EXCLUDED.primary_metric
      `;
      console.log(`  ✅ Updated: ${stage.label}`);
    }

    // Deactivate old personas and stages
    console.log('\n🗑️  Deactivating old personas and stages...');
    await sql`UPDATE matrix_personas SET active = false WHERE persona_id IN ('move_up', 'retiree', 'luxury', 'first_time')`;
    await sql`UPDATE matrix_stages SET active = false WHERE stage_id IN ('explore', 'consider')`;
    console.log('  ✅ Deactivated old real estate personas and stages');

    // Create new published version
    console.log('\n📝 Creating new published version...');

    // Get ordered personas
    const personas = await sql`
      SELECT persona_id as id, label, description, full_text as "fullText", order_index as "orderIndex", active
      FROM matrix_personas
      WHERE active = true
      ORDER BY order_index
    `;

    // Get ordered stages
    const stages = await sql`
      SELECT stage_id as id, label, description, order_index as "orderIndex", active,
             core_stage as "coreStage", core_stage_mapping as "coreStageMapping", primary_metric as "primaryMetric"
      FROM matrix_stages
      WHERE active = true
      ORDER BY order_index
    `;

    const nextVersion = await sql`
      SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM matrix_config_versions
    `;

    await sql`
      INSERT INTO matrix_config_versions (version, status, personas_json, stages_json, published_at)
      VALUES (${nextVersion[0].next_version}, 'published', ${JSON.stringify(personas)}::jsonb, ${JSON.stringify(stages)}::jsonb, NOW())
    `;
    console.log('  ✅ Published new version');

    console.log('\n✨ All updates completed successfully!');
    console.log('\n📱 Next steps:');
    console.log('  1. Go to http://localhost:3000/visibility-matrix');
    console.log('  2. You should see the updated personas and stages');
    console.log('  3. The matrix now reflects SSES-specific buyer journey');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating config:', error);
    process.exit(1);
  }
}

updateSSESConfig();

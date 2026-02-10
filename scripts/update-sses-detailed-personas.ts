import { sql } from '../src/lib/db';

async function updateSSESDetailedPersonas() {
  try {
    console.log('🔄 Updating SSES Personas with Research-Based Detail...');

    // Updated, more nuanced personas based on "The Institutional Vanguard" research
    const personas = [
      {
        id: 'wealthy_migrant',
        label: 'The Wealthy Migrant',
        description: 'HNW families relocating from NY/CA/NJ tax-exodus seeking prestige, community integration, and social positioning.',
        fullText: 'High-net-worth families (HHI $500K-$2M+) relocating from high-tax states (NY, NJ, CA) to Florida Gulf Coast through "affordability exodus." These families view education as both an investment in their children\'s future and a mechanism for establishing themselves in regional elite circles. They prioritize college placement outcomes, alumni network quality, and association with other prominent families. They are often executives, entrepreneurs, or professionals in finance, tech, or healthcare seeking lifestyle-oriented community infrastructure without sacrificing institutional excellence.',
        orderIndex: 0
      },
      {
        id: 'eccentric_genius',
        label: 'The Eccentric Genius',
        description: 'Socially unconventional, obsessive intellectual interests, "spiky" profiles seeking niche peer groups.',
        fullText: 'Students with exceptionally high aptitude in mathematical, verbal, or spatial reasoning who exhibit social behaviors that conflict with conventional school norms. These are the "vibrant anomalies" - children with intense, focused interests who may struggle with social conformity but excel in deep intellectual pursuits. Their families seek environments that provide uninterrupted work periods, niche peer groups, and recognition that unconventional thinkers are the engines of innovation. They often have profiles that would qualify for gifted programs but may also be diagnosed with ADHD, ASD, or be "twice-exceptional."',
        orderIndex: 1
      },
      {
        id: 'multidisciplinary_explorer',
        label: 'The Multi-Disciplinary Explorer',
        description: 'Late-blooming generalists resisting early specialization, seeking diverse exposure across fields.',
        fullText: 'Students who are "M-shaped" - developing deep expertise across multiple domains rather than T-shaped specialization. These are often late bloomers who explore diverse, seemingly unrelated disciplines in their early years rather than specializing early. Research shows that world-class achievers often improve gradually and explore widely before finding their niche. Families of these students seek flexible curriculum, exposure to disparate fields (arts + sciences + humanities), and environments that resist forcing premature specialization. They value holistic problem-solving and bridge-building between departments.',
        orderIndex: 2
      },
      {
        id: 'neurodivergent_strategist',
        label: 'The Neurodivergent Strategist',
        description: 'ADHD/Dyslexic thinkers with nonlinear cognitive approaches seeking adaptive learning systems.',
        fullText: 'Students with ADHD, dyslexia, or other learning differences who have developed compensatory strategies and unique problem-solving approaches. These "neurodivergent strategists" often show high creativity and resilience under uncertainty when their cognitive differences are viewed as advantages rather than deficits. Their families seek adaptive learning systems, empathetic mentorship, strength-based labels that reframe disability as "learning capital," and personalized learning plans. They want environments where their children are seen as disruptive thinkers who can tackle complex, 21st-century challenges.',
        orderIndex: 3
      },
      {
        id: 'dorky_technologist',
        label: 'The Dorky Technologist',
        description: 'High technical proficiency introverts seeking maker spaces and high-ceiling tools.',
        fullText: 'Students with high technical proficiency who are often introverted and embrace a "maker" mindset. These students thrive in environments with "high ceilings" - tools and software that grow with student complexity (Maya 3D, AI tools, programming environments). They seek prototyping and manufacturing opportunities where "making" is at the core of the curriculum. Their families want schools where their children can be prototype architects and drivers of campus tech-literacy, not just consumers of technology. They value spaces like the $13M Dr. Janet S. Pullen S.T.E.A.M. Center with 3D printing, drones, and build facilities.',
        orderIndex: 4
      },
      {
        id: 'innovation_seeker',
        label: 'The Innovation Seeker',
        description: 'Tech-forward families prioritizing "Mini Xerox PARC" model with slack, conundrums, and first-principles thinking.',
        fullText: 'Technology-forward parents who want their children to develop skills for the innovation economy through "skunkworks" education. They seek schools modeled after industrial research labs like Xerox PARC and Bell Labs, characterized by "slack" for exploration (unstructured time), "high ceilings" (professional tools), "targeted piddling around" (unstructured play), and "conundrums" that challenge basic assumptions. They value first-principles thinking, cross-pollination between disparate fields, and the "anomaly dividend" - the ability to investigate unexpected results without rigid metrics. They often work in tech, engineering, or entrepreneurship themselves.',
        orderIndex: 5
      },
      {
        id: 'artrepreneur',
        label: 'The Artrepreneur',
        description: 'Creative families seeking arts as innovation labs for venture building and business integration.',
        fullText: 'Families who view creative arts not just as electives but as innovation labs for entrepreneurship - the "artrepreneurship" nexus. They seek the "One Body Three in One" model integrating artistic education with entrepreneurship incubation, industry collaboration, and creative practice. They want their children learning to design business models around creative products, working with industry mentors, and engaging in "art thinking" that questions habitual ways of being. They look for schools where students produce podcasts, design public murals requiring permits and budgets, and create 3D models for historical artifacts - arts as laboratories for 21st-century skills.',
        orderIndex: 6
      },
      {
        id: 'heritage_guardian',
        label: 'The Heritage Guardian',
        description: 'Multi-generational regional families valuing Episcopal tradition, character education, and ethical leadership.',
        fullText: 'Long-time regional families with multi-generational connections to SSES who view the school as a steward of community values and Episcopal heritage. They prioritize tradition, character education, ethical leadership development, and the social networks that private schools cultivate. They value the "every child will be known and every child will be valued" promise and see the school as a sentinel of intellectual heritage that preserves traditional integrity while pioneering new models. They care deeply about indexed tuition as a mechanism for social justice and the school\'s role as a community anchor.',
        orderIndex: 7
      },
      {
        id: 'opportunity_seeker',
        label: 'The Opportunity Seeker',
        description: 'Middle-income families exploring school choice vouchers and indexed tuition for accessibility.',
        fullText: 'Families making $150K-$350K who may not traditionally qualify for financial aid but are seeking "radical accessibility" through Florida\'s new universal voucher programs (2027). They are evaluating indexed tuition models, family empowerment scholarships, and school choice options that make private education accessible. They want to understand the "psychology of inclusion" - moving beyond "financial aid" stigma to "sliding scale" pricing. These families are often first-time private school seekers attracted by SSES\'s public mission and commitment to socioeconomic diversity.',
        orderIndex: 8
      }
    ];

    console.log('\n📚 Updating detailed personas...');
    for (const persona of personas) {
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

    // Deactivate old personas
    await sql`UPDATE matrix_personas SET active = false WHERE persona_id IN ('neurodivergent_advocate', 'innovation_seeker')`;
    console.log('\n  🗑️  Deactivated previous simplified personas');

    // Create published version
    console.log('\n📝 Creating new published version...');
    const personasList = await sql`
      SELECT persona_id as id, label, description, full_text as "fullText", order_index as "orderIndex", active
      FROM matrix_personas
      WHERE active = true
      ORDER BY order_index
    `;

    const stagesList = await sql`
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
      VALUES (${nextVersion[0].next_version}, 'published', ${JSON.stringify(personasList)}::jsonb, ${JSON.stringify(stagesList)}::jsonb, NOW())
    `;
    console.log('  ✅ Published new version');

    console.log('\n✨ All personas updated with research-based detail!');
    console.log('\n📊 Updated Personas (9 total):');
    console.log('  1. The Wealthy Migrant - HNW tax exodus families');
    console.log('  2. The Eccentric Genius - Unconventional intellectuals');
    console.log('  3. The Multi-Disciplinary Explorer - M-shaped generalists');
    console.log('  4. The Neurodivergent Strategist - ADHD/dyslexic thinkers');
    console.log('  5. The Dorky Technologist - Maker-minded introverts');
    console.log('  6. The Innovation Seeker - Mini Xerox PARC families');
    console.log('  7. The Artrepreneur - Creative entrepreneurs');
    console.log('  8. The Heritage Guardian - Tradition-based families');
    console.log('  9. The Opportunity Seeker - Voucher/indexed tuition families');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating personas:', error);
    process.exit(1);
  }
}

updateSSESDetailedPersonas();

# How to Update Personas & Stages for SSES

## Option 1: Use the Admin Panel (Recommended)

Once your database is set up, you can use the admin panel at `/admin/matrix`:

1. Go to http://localhost:3000/admin/matrix
2. Click "Edit" on any persona or stage
3. Update the following values:

### Personas to Update:

**1. The Wealthy Migrant**
- Label: "The Wealthy Migrant"
- Description: "High-net-worth families relocating from NY/CA/NJ seeking prestige and community integration."
- Full Text: "High-net-worth families relocating from tax-heavy states (NY, NJ, CA) to the Florida Gulf Coast. These families prioritize academic prestige, community integration, and social networking."

**2. The Neurodivergent Advocate**
- Label: "The Neurodivergent Advocate"
- Description: "Parents of gifted or 'spiky' kids looking for the 'Vibrant Anomaly' environment that celebrates neurodiversity."
- Full Text: "Parents of children who are gifted, twice-exceptional (2e), or neurodivergent (ADHD, ASD, dyslexia). They seek environments that celebrate the 'Vibrant Anomaly'."

**3. The Innovation Seeker**
- Label: "The Innovation Seeker"
- Description: "Tech-forward parents prioritizing STEAM, 'Mini Xerox PARC' labs, and Artrepreneurship."
- Full Text: "Technology-forward parents who want their children to develop skills for the innovation economy. They seek schools with 'Mini Xerox PARC' characteristics."

**4. The Heritage Guardian**
- Label: "The Heritage Guardian"
- Description: "Established regional families valuing Episcopal tradition, social networking, and ethical leadership."
- Full Text: "Long-time regional families who value tradition, character education, and institutional heritage."

### Stages to Update:

**1. Discover**
- Label: "Discover"
- Description: "Finding top-tier education in the Florida Gulf Coast region."
- Core Stage Mapping: discover
- Primary Metric: discovery_rate

**2. Culture & Curriculum**
- Label: "Culture & Curriculum"
- Description: "Deep dive into innovation labs, neurodiversity support, and academic rigor."
- Core Stage Mapping: consider
- Primary Metric: mention_rate

**3. Benchmarking**
- Label: "Benchmarking"
- Description: "How SSES compares to ODA, Pine View, and national elite schools."
- Core Stage Mapping: compare
- Primary Metric: win_rate

**4. Affordability & ROI**
- Label: "Affordability & ROI"
- Description: "Evaluating indexed tuition, universal vouchers, and long-term network value."
- Core Stage Mapping: decide
- Primary Metric: recommendation_rate

4. Click "Publish" to make changes live

---

## Option 2: Run SQL in Supabase

If you prefer to update directly via SQL:

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy and paste the SQL from `sql/migrations/006_update_sses_personas_stages.sql`
6. Click "Run" (or Cmd/Ctrl + Enter)

This will automatically update all personas and stages to match the SSES research.

---

## Verify Changes

After updating:

1. Go to http://localhost:3000/visibility-matrix
2. Check that you see:
   - 4 personas (Wealthy Migrant, Neurodivergent Advocate, Innovation Seeker, Heritage Guardian)
   - 4 stages (Discover, Culture & Curriculum, Benchmarking, Affordability & ROI)
3. The matrix should now reflect SSES-specific buyer journey

---

## Research Alignment

These updates align with "The Institutional Vanguard" research:

- **Wealthy Migrant**: Captures the FL wealth migration from NY/CA/NJ
- **Neurodivergent Advocate**: Embraces the "Vibrant Anomaly" concept
- **Innovation Seeker**: Reflects "Mini Xerox PARC" and Artrepreneurship focus
- **Heritage Guardian**: Honors Episcopal tradition and community values

The stages map to the SSES-specific buyer journey from discovery through enrollment.

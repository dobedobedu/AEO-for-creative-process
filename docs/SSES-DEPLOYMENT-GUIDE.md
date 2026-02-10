# SSES Deployment Guide
## AI Visibility Matrix for Saint Stephen's Episcopal School

This guide covers deploying the AI Visibility Matrix for SSES with proper database isolation, expanded query library aligned to "The Institutional Vanguard" research, and admin panel integration.

---

## Prerequisites

- Supabase account (free tier works)
- Vercel account (for deployment)
- Google Cloud project (for Gemini API)
- AI provider API keys (OpenAI, Anthropic, xAI, or at least one)
- Access to SSES Google Workspace (for OAuth setup)

---

## Phase 1: Supabase Setup

### 1.1 Create New Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Configure:
   - **Name**: `sses-ai-visibility` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users (e.g., `Southeast (US)`)
   - **Pricing Plan**: Free tier is sufficient for testing

4. Wait for project to provision (~2 minutes)

### 1.2 Enable Google OAuth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** provider and click to enable
3. Configure OAuth settings:
   - **Client ID**: Get from Google Cloud Console (see below)
   - **Client Secret**: Get from Google Cloud Console
   - **Redirect URL**: Add your Vercel deployment URL + `/auth/callback`
     - Example: `https://sses-ai-visibility.vercel.app/auth/callback`

#### Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (local development)
   - `https://your-vercel-app.vercel.app/auth/callback` (production)
7. Save the **Client ID** and **Client Secret**

### 1.3 Run Database Migrations

Get your database connection string from Supabase:
1. Go to **Settings** → **Database**
2. Copy the **Connection string** (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password

Run migrations in order:

```bash
# Set database URL
export DATABASE_URL="postgres://postgres:[password]@db.xxx.supabase.co:5432/postgres"

# Run migrations
psql $DATABASE_URL -f sql/schema.sql
psql $DATABASE_URL -f sql/2026-01-20-supabase-auth.sql
psql $DATABASE_URL -f sql/2026-01-22-matrix-config.sql
psql $DATABASE_URL -f sql/2026-01-24-entity-tables.sql
psql $DATABASE_URL -f sql/migrations/001_add_tenant_id.sql
psql $DATABASE_URL -f sql/migrations/002_create_tenant_configs.sql
psql $DATABASE_URL -f sql/migrations/003_backfill_tenant_id.sql
psql $DATABASE_URL -f sql/migrations/004_add_tenant_indexes.sql
psql $DATABASE_URL -f sql/migrations/005_add_prompt_version.sql
```

### 1.4 Get Supabase Credentials

From Supabase dashboard **Settings** → **API**:
- Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- Copy `anon/public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy connection string → `DATABASE_URL`

---

## Phase 2: Environment Configuration

### 2.1 Create `.env.local` File

```bash
# Supabase (from Phase 1)
NEXT_PUBLIC_SUPABASE_URL=https://sses-xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
DATABASE_URL=postgres://postgres:xxx@db.xxx.supabase.co:5432/postgres

# AI Providers (add at least one)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
ANTHROPIC_API_KEY=sk-ant-...
XAI_API_KEY=xai-...

# Admin Panel
NEXT_PUBLIC_ADMIN_ENABLED=true

# Cron (optional - for scheduled benchmarks)
CRON_SECRET=your-random-secret-string
```

### 2.2 Verify Config

Check `config/tenant.json` - it should already have SSES configuration:
- Brand: "Saint Stephen's Episcopal School"
- Competitors: Out-of-Door Academy, IMG Academy, Pine View School
- Personas: Wealthy Migrant, Neurodivergent Advocate, Innovation Seeker, Heritage Guardian
- Stages: Discover, Research, Compare, Apply

---

## Phase 3: Deploy to Vercel

### 3.1 Create New Vercel Project

1. Go to https://vercel.com/new
2. Import your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 3.2 Add Environment Variables

In Vercel project settings, add all variables from `.env.local`:

**Required**:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- At least one AI provider API key

**Optional**:
- `NEXT_PUBLIC_ADMIN_ENABLED=true` (to enable admin panel)
- `CRON_SECRET` (for scheduled benchmarks)

### 3.3 Deploy

1. Click **Deploy**
2. Wait for deployment to complete
3. Visit your deployed URL

### 3.4 Configure Custom Domain (Optional)

1. In Vercel project **Settings** → **Domains**
2. Add custom domain: `ai-visibility.sses.org` (or your preferred domain)
3. Update DNS records as instructed by Vercel
4. Update Google OAuth redirect URI to include custom domain

---

## Phase 4: Initial Setup & Verification

### 4.1 Test Authentication

1. Visit your deployed site
2. You should be redirected to `/login`
3. Click "Sign in with Google"
4. Authenticate with your SSES Google account
5. You should be redirected to the visibility matrix

### 4.2 Verify Configuration

Check that the matrix displays:
- **Brand**: Saint Stephen's Episcopal School
- **4 Personas**: Wealthy Migrant, Neurodivergent Advocate, Innovation Seeker, Heritage Guardian
- **4 Stages**: Discover, Research, Compare, Apply
- **View Toggle**: Matrix | Kanban | Admin

### 4.3 Test Admin Panel

1. Click "Admin" in the view toggle
2. You should see the Matrix Studio admin panel
3. Try editing a persona or stage
4. Click "Save Draft" then "Publish"
5. Return to Matrix view - changes should be reflected

### 4.4 Load Expanded Query Library

The expanded intent library (`data/intents/education-k12-elite-expanded.json`) includes 14 intents aligned to "The Institutional Vanguard" research:

**Personas Covered**:
- **Wealthy Migrant**: Community integration, prestige factors, ROI evaluation
- **Neurodivergent Advocate**: Vibrant Anomaly, twice-exceptional support
- **Innovation Seeker**: Mini Xerox PARC, Artrepreneurship, STEAM facilities
- **Heritage Guardian**: Episcopal values, indexed tuition, universal vouchers

**To Import** (via API or UI - depends on your workflow):
```bash
# If you have an import script
npm run import:intents
```

Or manually create intents via the Intent Library modal in the Matrix UI.

### 4.5 Run First Benchmark

1. In Matrix view, select any cell (persona × stage)
2. Click "Run Benchmark" button
3. Wait for completion (~2-5 minutes depending on query count)
4. View results in the insight panels

---

## Troubleshooting

### Admin Panel Not Showing

**Symptom**: "Admin" button doesn't appear in view toggle

**Solutions**:
1. Check `NEXT_PUBLIC_ADMIN_ENABLED=true` is set in environment variables
2. Redeploy Vercel after adding environment variable
3. Clear browser cache

### Authentication Failures

**Symptom**: Redirected to login repeatedly

**Solutions**:
1. Verify Supabase URL and keys are correct
2. Check Google OAuth redirect URI matches your deployment URL
3. Ensure user has access to allowed Google workspace (if configured)

### Benchmark Failures

**Symptom**: Benchmark errors or no responses

**Solutions**:
1. Check AI provider API keys are valid
2. Verify Database connection string is correct
3. Check Supabase logs for database errors
4. Ensure all migrations ran successfully

### Database Connection Issues

**Symptom**: "Database connection failed" errors

**Solutions**:
1. Verify `DATABASE_URL` format: `postgres://postgres:[password]@db.xxx.supabase.co:5432/postgres`
2. Check password doesn't contain special characters that need URL encoding
3. Ensure database migrations ran successfully
4. Check Supabase dashboard for database status

---

## Post-Deployment Enhancements

### Scheduled Benchmarks

To run automatic benchmarks (e.g., weekly):

1. Set `CRON_SECRET` environment variable
2. Update `vercel.json` with desired schedule
3. Redeploy to Vercel

Current schedule (can be customized):
```json
{
  "crons": [
    { "path": "/api/benchmark/scheduled/discover", "schedule": "0 2 * * *" },
    { "path": "/api/benchmark/scheduled/research", "schedule": "5 2 * * *" },
    { "path": "/api/benchmark/scheduled/compare", "schedule": "10 2 * * *" },
    { "path": "/api/benchmark/scheduled/apply", "schedule": "15 2 * * *" }
  ]
}
```

### Historical Tracking

The platform automatically stores all benchmark runs. To view history:
1. In Matrix view, use the time slider (top right)
2. Select a previous date to see historical data

### Competitor Alerts

Set up notifications when competitor mentions spike:
1. Integrate with email service (e.g., Resend)
2. Add alerts in `/api/benchmark/run` route
3. Configure thresholds for notification

---

## Support & Maintenance

### Regular Maintenance Tasks

- **Weekly**: Review benchmark results for insights
- **Monthly**: Update intent library based on new themes
- **Quarterly**: Review and optimize query list
- **Annually**: Review competitor list and personas

### Updating the App

1. Pull latest changes from GitHub
2. Test locally: `npm run build && npm run dev`
3. Deploy to Vercel (automatic on merge to main branch)

### Backup Strategy

Supabase automatically backs up your database. To export intent library:
```bash
# Export intents to JSON
curl https://your-app.vercel.app/api/intents/library > intents-backup.json
```

---

## Research Alignment

This deployment supports "The Institutional Vanguard" strategic goals:

| Research Theme | App Feature |
|---------------|-------------|
| **Wealth Migration** | "Wealthy Migrant" persona tracking community integration and prestige |
| **Vibrant Anomaly** | "Neurodivergent Advocate" persona with ADHD, twice-exceptional queries |
| **Mini Xerox PARC** | "Innovation Seeker" persona tracking STEAM Center and Artrepreneurship |
| **Radical Accessibility** | "Heritage Guardian" persona tracking Indexed Tuition and vouchers |
| **Power Player Network** | Entity categories for Sarasota Yacht Club, HNW network |
| **Competitive Intelligence** | Benchmarking against ODA, IMG Academy, Pine View |

---

## Next Steps

1. **Customize Personas**: Edit personas in Admin panel to match SSES families
2. **Add More Queries**: Expand intent library based on real parent questions
3. **Set Up Alerts**: Configure notifications for visibility changes
4. **Train Users**: Share guide with admissions and marketing teams
5. **Review Results**: Use insights to inform marketing strategy

---

## Additional Resources

- **App Documentation**: `docs/PRD.md`, `docs/UI.md`
- **Configuration Guide**: `config/templates/education-k12-elite.json`
- **Research Summary**: `docs/plans/2026-01-26-k12-market-analysis.md`
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs

---

**Last Updated**: 2026-01-26
**Version**: 1.0.0

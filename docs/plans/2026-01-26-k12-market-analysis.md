# K-12 Market Analysis Implementation Plan: The Institutional Vanguard

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure the AI Visibility Matrix to help Saint Stephen’s Episcopal School (SSES) identify marketing strengths and opportunities using the "Institutional Vanguard" persona.

**Architecture:** Create a specialized K-12 Elite configuration template and a corresponding intent library seeded with queries derived from the "Institutional Vanguard" research. This leverages the platform's white-label capabilities without modifying core logic.

**Tech Stack:** Next.js 16, JSON Configuration, SQL (for intent seeding)

---

## Task 1: Create Elite K-12 Template

**Why:** The generic "Higher Education" template does not capture the nuances of elite K-12 education, specifically the "Institutional Vanguard" themes (wealth migration, neurodiversity, innovation).

**Files:**
- Create: `config/templates/education-k12-elite.json`

**Details:**
- **Brand**: Saint Stephen’s Episcopal School
- **Competitors**: Out-of-Door Academy, IMG Academy, Pine View School, Sarasota Christian School, Cardinal Mooney.
- **Personas**:
  1.  **The Wealthy Migrant** (NY/CA/NJ transplants, HNW, value prestige & community).
  2.  **The Neurodivergent Advocate** (Parents of "spiky" kids, seeking "Vibrant Anomaly" environment).
  3.  **The Innovation Seeker** (Tech-focused, wants "Mini Xerox PARC", Artrepreneurship).
  4.  **The Heritage Guardian** (Locals, values tradition + modern skills).
- **Stages**: Discover, Research (Curriculum/Culture), Compare (vs Competitors), Apply (Tuition/Vouchers).
- **Entity Categories**:
  - **Academic Distinction** (STEAM, Artrepreneurship, "Conundrums")
  - **Student Support** (Neurodiversity, Mental Health, "Slack")
  - **Campus & Community** (Lakewood Ranch, Yacht Club network, Facilities)
  - **Admissions & Value** (Indexed Tuition, Vouchers, ROI)

---

## Task 2: Create Intent Seed Data

**Why:** To benchmark visibility, we need specific queries that these personas would ask AI. These must reflect the language of the "Institutional Vanguard" research.

**Files:**
- Create: `data/intents/education-k12-elite-seed.json`

**Details:**
- **Wealthy Migrant Queries**:
  - "Best private schools near Lakewood Ranch for NY transplants"
  - "Elite K-12 schools Sarasota vs Bradenton"
  - "Saint Stephen’s Episcopal School reputation wealthy families"
- **Neurodivergent Advocate Queries**:
  - "Private schools in Florida for gifted ADHD students"
  - "Schools supporting twice-exceptional students Sarasota"
  - "Saint Stephen’s Episcopal School neurodiversity program reviews"
- **Innovation Seeker Queries**:
  - "K-12 schools with innovation labs Florida Gulf Coast"
  - "Schools offering entrepreneurship for kids Sarasota"
  - "Saint Stephen’s Episcopal School STEAM facilities"
- **Heritage/Value Queries**:
  - "Florida school voucher accepted private schools list"
  - "Saint Stephen’s Episcopal School indexed tuition"
  - "Is Saint Stephen’s Episcopal School worth the tuition?"

---

## Task 3: Import and Run

**Why:** The data needs to be loaded into the system to be actionable.

**Steps:**
1.  Apply the template: `./scripts/apply-template.sh education-k12-elite`
2.  (Manual Step) User will need to run the benchmark from the UI or via API.

**Verification Checklist:**
- `config/templates/education-k12-elite.json` is valid JSON and matches schema.
- Template can be applied via script.
- Matrix UI loads with SSES brand and new personas.

---

## Notes for Droid
- Ensure competitor list is regionally accurate for Sarasota/Manatee counties.
- Use the specific terms "Artrepreneurship", "Vibrant Anomaly", and "Indexed Tuition" in the intent generation where appropriate to test if AI models pick up on these specific brand pillars.

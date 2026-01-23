/**
 * Seed Entity Terms for Kanban
 *
 * Run with: npx tsx scripts/seed-entities.ts
 *
 * This populates matrix_entity_terms with trackable entities for each category.
 * Categories are created by the SQL migration.
 */

import { sql } from "../src/lib/db";

interface EntitySeed {
  canonical_name: string;
  aliases?: string[];
}

const ENTITY_SEEDS: Record<string, EntitySeed[]> = {
  amenities: [
    { canonical_name: "Golf", aliases: ["golf courses", "golfing", "golf club"] },
    { canonical_name: "Polo", aliases: ["polo club", "polo field"] },
    { canonical_name: "Tennis", aliases: ["tennis courts", "tennis club"] },
    { canonical_name: "Pickleball", aliases: ["pickleball courts"] },
    { canonical_name: "Padel", aliases: ["padel courts"] },
    { canonical_name: "Shopping", aliases: ["retail", "shops", "stores"] },
    { canonical_name: "Restaurants", aliases: ["dining", "eateries", "food"] },
    { canonical_name: "Health Care", aliases: ["medical", "hospitals", "doctors", "healthcare"] },
    { canonical_name: "UTC", aliases: ["University Town Center", "mall"] },
    { canonical_name: "The Lake Club", aliases: ["Lake Club"] },
    { canonical_name: "Waterside Place", aliases: ["Waterside Town Center"] },
    { canonical_name: "Fitness Centers", aliases: ["gym", "fitness", "workout"] },
    { canonical_name: "Pools", aliases: ["swimming pools", "pool"] },
    { canonical_name: "Club Houses", aliases: ["clubhouse", "community center"] },
  ],

  activities: [
    { canonical_name: "Farmers Market", aliases: ["farmer's market", "farmers' market"] },
    { canonical_name: "Music on Main", aliases: ["live music", "concerts on main"] },
    { canonical_name: "Arts & Culture", aliases: ["art", "cultural events", "galleries"] },
    { canonical_name: "Clubs & Activities", aliases: ["social clubs", "community groups"] },
    { canonical_name: "LWR Community Foundation", aliases: ["community foundation"] },
    { canonical_name: "LWR Business Alliance", aliases: ["business alliance"] },
    { canonical_name: "LWR Community Activities", aliases: ["community activities"] },
    { canonical_name: "Professional Sports Events", aliases: ["pro sports", "spring training"] },
    { canonical_name: "Holiday Celebrations", aliases: ["holiday events", "festivals"] },
  ],

  schools: [
    { canonical_name: "Manatee County Schools", aliases: ["Manatee schools", "Manatee district"] },
    { canonical_name: "Sarasota County Schools", aliases: ["Sarasota schools", "Sarasota district"] },
    { canonical_name: "B.D. Gullett Elementary", aliases: ["Gullett Elementary"] },
    { canonical_name: "Dr. Mona Jain Middle School", aliases: ["Mona Jain", "Jain Middle"] },
    { canonical_name: "Gilbert W. McNeal Elementary", aliases: ["McNeal Elementary"] },
    { canonical_name: "Imagine School LWR", aliases: ["Imagine School"] },
    { canonical_name: "Lake Manatee K-8", aliases: ["Lake Manatee"] },
    { canonical_name: "Lakewood Ranch High School", aliases: ["LWR High", "LRHS"] },
    { canonical_name: "Lakewood Ranch Preparatory Academy", aliases: ["LWR Prep"] },
    { canonical_name: "R. Dan Nolan Middle School", aliases: ["Nolan Middle", "Dan Nolan"] },
    { canonical_name: "Robert E. Willis Elementary", aliases: ["Willis Elementary"] },
    { canonical_name: "Beyond the Spectrum", aliases: [] },
    { canonical_name: "New Gate Montessori", aliases: ["Newgate Montessori"] },
    { canonical_name: "Out-of-Door Academy", aliases: ["ODA", "Out of Door"] },
    { canonical_name: "Risen Savior Academy", aliases: [] },
    { canonical_name: "Sea of Strengths Academy", aliases: [] },
    { canonical_name: "The Pinnacle Academy", aliases: ["Pinnacle Academy"] },
    { canonical_name: "Lakewood Ranch Christian School", aliases: ["LWR Christian"] },
    { canonical_name: "A-Rated Schools", aliases: ["A+ schools", "top-rated schools"] },
  ],

  nature: [
    { canonical_name: "150 Miles of Trails", aliases: ["150 miles", "trail system", "miles of trails"] },
    { canonical_name: "46% Green Space", aliases: ["green space", "open space", "preserved land"] },
    { canonical_name: "Bob Gardner Community Park", aliases: ["Bob Gardner Park"] },
    { canonical_name: "Braden River Nature Park", aliases: ["Braden River Park"] },
    { canonical_name: "Greenbrook Adventure Park", aliases: ["Greenbrook Park"] },
    { canonical_name: "Heron's Nest Nature Park", aliases: ["Herons Nest", "Heron's Nest"] },
    { canonical_name: "James L. Patton Park", aliases: ["Patton Park"] },
    { canonical_name: "Roger Hill Park", aliases: [] },
    { canonical_name: "Silver Falls Nature Park", aliases: ["Silver Falls"] },
    { canonical_name: "Summerfield Community Park", aliases: ["Summerfield Park"] },
    { canonical_name: "Waterside Park", aliases: [] },
    { canonical_name: "Country Club/Edgewater Park", aliases: ["Edgewater Park"] },
    { canonical_name: "Preserves", aliases: ["nature preserves", "conservation"] },
    { canonical_name: "Walking Trails", aliases: ["trails", "hiking", "walking paths"] },
  ],

  villages: [
    { canonical_name: "Waterside", aliases: ["Waterside at Lakewood Ranch"] },
    { canonical_name: "Cresswind", aliases: ["Cresswind Lakewood Ranch", "Cresswind at LWR"] },
    { canonical_name: "Del Webb Catalina", aliases: ["Del Webb", "Catalina"] },
    { canonical_name: "Country Club East", aliases: ["CCE"] },
    { canonical_name: "Esplanade", aliases: ["Esplanade at Azario", "Azario Esplanade"] },
    { canonical_name: "Lakewood National", aliases: ["LWN"] },
    { canonical_name: "The Isles", aliases: ["Isles at Lakewood Ranch"] },
    { canonical_name: "Lorraine Lakes", aliases: [] },
    { canonical_name: "Sapphire Point", aliases: [] },
    { canonical_name: "Star Farms", aliases: [] },
    { canonical_name: "Solera", aliases: [] },
    { canonical_name: "Sweetwater", aliases: [] },
    { canonical_name: "Windward", aliases: [] },
    { canonical_name: "Aurora", aliases: [] },
    { canonical_name: "Amber Creek", aliases: [] },
    { canonical_name: "Avalon Woods", aliases: [] },
    { canonical_name: "Calusa Country Club", aliases: [] },
    { canonical_name: "Monarch Acres", aliases: [] },
    { canonical_name: "Monterey", aliases: ["Monterey at Lakewood Ranch"] },
    { canonical_name: "Palm Grove", aliases: [] },
    { canonical_name: "Waterbury Park", aliases: [] },
  ],

  builders: [
    { canonical_name: "Taylor Morrison", aliases: [] },
    { canonical_name: "Toll Brothers", aliases: [] },
    { canonical_name: "Pulte Homes", aliases: ["Pulte"] },
    { canonical_name: "Lennar Homes", aliases: ["Lennar"] },
    { canonical_name: "M/I Homes", aliases: ["MI Homes"] },
    { canonical_name: "Del Webb", aliases: [] },
    { canonical_name: "David Weekley Homes", aliases: ["David Weekley"] },
    { canonical_name: "D.R. Horton", aliases: ["DR Horton"] },
    { canonical_name: "Neal Communities", aliases: ["Neal"] },
    { canonical_name: "Neal Signature Homes", aliases: [] },
    { canonical_name: "Kolter Homes", aliases: ["Kolter"] },
    { canonical_name: "John Cannon Homes", aliases: ["John Cannon"] },
    { canonical_name: "Lee Wetherington Homes", aliases: ["Lee Wetherington"] },
    { canonical_name: "Homes by WestBay", aliases: ["WestBay"] },
    { canonical_name: "Homes by Towne", aliases: [] },
    { canonical_name: "Dream Finders Homes", aliases: ["Dream Finders"] },
    { canonical_name: "AR Homes", aliases: ["Arthur Rutenberg"] },
    { canonical_name: "Anchor Builders", aliases: [] },
    { canonical_name: "Stock Luxury Homes", aliases: ["Stock Homes"] },
    { canonical_name: "Ryan Homes", aliases: [] },
    { canonical_name: "Perry Homes", aliases: [] },
  ],

  location: [
    { canonical_name: "I-75 Access", aliases: ["I-75", "interstate 75", "highway access"] },
    { canonical_name: "Beach Proximity", aliases: ["beaches", "beach access", "coastal"] },
    { canonical_name: "Tampa Bay", aliases: ["Tampa", "Tampa area"] },
    { canonical_name: "Sarasota", aliases: ["Sarasota area", "downtown Sarasota"] },
    { canonical_name: "SRQ Airport", aliases: ["Sarasota airport", "Sarasota-Bradenton airport"] },
    { canonical_name: "Best Location", aliases: ["prime location", "convenient location"] },
    { canonical_name: "Central Florida", aliases: ["Florida location"] },
  ],

  accolades: [
    { canonical_name: "#1 Multi-Generational Community", aliases: ["multi-gen", "multigenerational", "number one community"] },
    { canonical_name: "#1 Selling Community", aliases: ["best-selling", "top-selling"] },
    { canonical_name: "100 Years of Stewardship", aliases: ["100 years", "century of stewardship"] },
    { canonical_name: "NAHB Awards", aliases: ["national home builders", "home builder awards"] },
    { canonical_name: "Best Master-Planned Community", aliases: ["master-planned", "best planned community"] },
    { canonical_name: "#1 Farmer's Market in Florida", aliases: ["best farmers market"] },
  ],
};

async function seedEntities() {
  console.log("Seeding entity terms...\n");

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const [categoryId, entities] of Object.entries(ENTITY_SEEDS)) {
    console.log(`\n${categoryId.toUpperCase()} (${entities.length} entities)`);

    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      try {
        await sql`
          INSERT INTO matrix_entity_terms (category_id, canonical_name, aliases, display_order)
          VALUES (${categoryId}, ${entity.canonical_name}, ${sql.json(entity.aliases || [])}, ${i + 1})
          ON CONFLICT (category_id, canonical_name) DO UPDATE SET
            aliases = ${sql.json(entity.aliases || [])},
            display_order = ${i + 1},
            updated_at = NOW()
        `;
        console.log(`  + ${entity.canonical_name}`);
        totalInserted++;
      } catch (err) {
        console.log(`  x ${entity.canonical_name}: ${(err as Error).message}`);
        totalSkipped++;
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`Total inserted/updated: ${totalInserted}`);
  console.log(`Total skipped: ${totalSkipped}`);
  console.log(`========================================\n`);

  process.exit(0);
}

seedEntities().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

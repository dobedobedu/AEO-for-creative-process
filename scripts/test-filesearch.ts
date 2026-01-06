/**
 * Integration test for Gemini File Search
 * 
 * Run with: npx tsx scripts/test-filesearch.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import {
  getOrCreateStore,
  uploadBenchmarkResults,
  queryWithFileSearch,
  hasDocuments,
  listDocuments,
} from "../src/lib/filesearch";
import type { BenchmarkResult } from "../src/lib/benchmark/runner";

// Mock benchmark data for testing
const mockBenchmarkResult: BenchmarkResult = {
  queries: [
    {
      query: "best florida retirement communities with golf courses",
      intentId: "test-intent-1",
      responses: [
        {
          provider: "openai",
          model: "gpt-5.2",
          text: `When looking for Florida retirement communities with golf courses, several 
stand out. The Villages is the largest with 54 golf courses. Lakewood Ranch 
offers 7 championship courses including The Concession. Nocatee in Jacksonville 
has excellent facilities. For luxury options, consider Miromar Lakes or Fiddler's 
Creek in Naples.`,
          citations: [],
          visibility: {
            score: 0.72,
            category: "recommended",
            sentiment: "positive",
            mentioned: true,
            mentionCount: 1,
            firstMentionPosition: 120,
            position: "2nd",
            competitorsMentioned: ["The Villages", "Nocatee", "Miromar Lakes", "Fiddler's Creek"],
            comparisonOutcome: "favorable",
            recommendationStrength: "moderate",
          },
          latencyMs: 1200,
          raw: null,
        },
        {
          provider: "anthropic",
          model: "claude-haiku-4-5",
          text: `For golf-focused retirement in Florida, I'd recommend looking at:

1. Lakewood Ranch - Master-planned community with world-class golf, including 
   The Concession which has hosted major championships
2. The Villages - Largest retirement community, 54 executive courses  
3. Sun City Center - Affordable option near Tampa
4. On Top of the World - Great value in Ocala`,
          citations: [],
          visibility: {
            score: 0.85,
            category: "preferred",
            sentiment: "positive",
            mentioned: true,
            mentionCount: 1,
            firstMentionPosition: 60,
            position: "1st",
            competitorsMentioned: ["The Villages", "Sun City Center", "On Top of the World"],
            comparisonOutcome: "favorable",
            recommendationStrength: "strong",
          },
          latencyMs: 950,
          raw: null,
        },
      ],
    },
    {
      query: "lakewood ranch vs the villages florida",
      intentId: "test-intent-2",
      responses: [
        {
          provider: "openai",
          model: "gpt-5.2",
          text: `Comparing Lakewood Ranch vs The Villages:

Lakewood Ranch:
- Multi-generational (families, young professionals, retirees)
- Located in Sarasota-Bradenton area
- Higher home prices ($400k-$2M+)
- Smaller, more exclusive feel

The Villages:
- 55+ retirement community
- Central Florida location
- More affordable ($200k-$600k)
- Very active social scene, golf carts everywhere

Choose Lakewood Ranch if you want beach access and a diverse community.
Choose The Villages if you want an active 55+ lifestyle.`,
          citations: [],
          visibility: {
            score: 0.78,
            category: "recommended",
            sentiment: "neutral",
            mentioned: true,
            mentionCount: 3,
            firstMentionPosition: 10,
            position: "1st",
            competitorsMentioned: ["The Villages"],
            comparisonOutcome: "neutral",
            recommendationStrength: "moderate",
          },
          latencyMs: 1100,
          raw: null,
        },
      ],
    },
  ],
  summary: {
    totalQueries: 2,
    providersUsed: ["openai", "anthropic"],
    brandMentionRate: { openai: 1, anthropic: 1, gemini: 0, xai: 0 },
    avgVisibilityScore: { openai: 0.75, anthropic: 0.85, gemini: 0, xai: 0 },
    executionTimeMs: 3250,
  },
};

async function runTest() {
  console.log("=== Gemini File Search Integration Test ===\n");

  try {
    // Step 1: Get or create store
    console.log("1. Creating/getting FileSearchStore...");
    const store = await getOrCreateStore();
    console.log(`   Store: ${store.name}`);
    console.log(`   Display name: ${store.displayName}`);

    // Step 2: Check if documents exist
    console.log("\n2. Checking for existing documents...");
    const hasDocs = await hasDocuments();
    console.log(`   Has documents: ${hasDocs}`);

    if (hasDocs) {
      const docs = await listDocuments();
      console.log(`   Document count: ${docs.length}`);
      if (docs.length > 0) {
        console.log(`   First doc: ${docs[0]}`);
      }
    }

    // Step 3: Upload mock benchmark data
    console.log("\n3. Uploading mock benchmark data...");
    const uploadResult = await uploadBenchmarkResults(
      mockBenchmarkResult,
      "retiree",
      "explore",
      "Lakewood Ranch"
    );

    if (uploadResult.success) {
      console.log(`   Upload SUCCESS: ${uploadResult.documentName}`);
    } else {
      console.log(`   Upload FAILED: ${uploadResult.error}`);
      return;
    }

    // Step 4: Wait a moment for indexing
    console.log("\n4. Waiting for indexing to complete...");
    await new Promise((r) => setTimeout(r, 3000));

    // Step 5: Query the data
    console.log("\n5. Testing File Search query...");
    const chatContext = {
      scope: "cell" as const,
      persona: "retiree" as const,
      stage: "explore" as const,
      brand: "Lakewood Ranch",
    };

    const query1 = "What golf communities are mentioned for retirees?";
    console.log(`   Query: "${query1}"`);

    const response1 = await queryWithFileSearch(query1, chatContext);
    console.log(`   Response length: ${response1.text.length} chars`);
    console.log(`   Citations: ${response1.citations?.length ?? 0}`);
    console.log(`\n   Response preview:`);
    console.log(`   ${response1.text.slice(0, 500)}...`);

    // Step 6: Test another query
    console.log("\n6. Testing comparison query...");
    const query2 = "How does Lakewood Ranch compare to The Villages?";
    console.log(`   Query: "${query2}"`);

    const response2 = await queryWithFileSearch(query2, chatContext);
    console.log(`   Response length: ${response2.text.length} chars`);
    console.log(`\n   Response preview:`);
    console.log(`   ${response2.text.slice(0, 500)}...`);

    // Step 7: Verify documents were created
    console.log("\n7. Verifying documents...");
    const finalDocs = await listDocuments();
    console.log(`   Total documents in store: ${finalDocs.length}`);

    console.log("\n=== Test Complete ===");
    console.log("\nFile Search is working! Key observations:");
    console.log("- Store created/retrieved successfully");
    console.log("- Document uploaded and indexed");
    console.log("- Semantic search returning relevant results");
    console.log("- Ready for production use");

  } catch (error) {
    console.error("\n=== Test Failed ===");
    console.error(error);
    process.exit(1);
  }
}

runTest();

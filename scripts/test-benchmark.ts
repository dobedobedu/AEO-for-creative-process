/**
 * Quick smoke test for benchmark runner
 * Run with: npx tsx scripts/test-benchmark.ts
 * 
 * Tests a single query against all 4 providers to verify API connectivity
 */

import { runBenchmark } from "../src/lib/benchmark";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log("🧪 Testing benchmark runner with 1 query across 4 providers...\n");

  const testQuery = "what are the best master-planned communities in Florida for families";
  const brand = "Lakewood Ranch";

  console.log(`Query: "${testQuery}"`);
  console.log(`Brand: "${brand}"\n`);

  try {
    const result = await runBenchmark({
      stage: "explore",
      queries: [testQuery],
      brand,
      brandAliases: ["LWR"],
      providers: [
        { provider: "openai", model: "gpt-4o" },
        { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        { provider: "gemini", model: "gemini-2.0-flash" },
        { provider: "xai", model: "grok-3" },
      ],
      concurrency: 2,
    });

    console.log("=".repeat(60));
    console.log("RESULTS");
    console.log("=".repeat(60));

    for (const qr of result.queries) {
      console.log(`\nQuery: ${qr.query}\n`);

      for (const resp of qr.responses) {
        const status = resp.error ? "❌" : "✅";
        const mentioned = resp.visibility.mentioned ? "🎯 MENTIONED" : "👻 NOT MENTIONED";

        console.log(`${status} ${resp.provider} (${resp.model})`);
        console.log(`   ${mentioned} | Score: ${resp.visibility.score.toFixed(2)} | Sentiment: ${resp.visibility.sentiment}`);
        console.log(`   Latency: ${resp.latencyMs}ms`);

        if (resp.error) {
          console.log(`   Error: ${resp.error}`);
        } else {
          const preview = resp.text.slice(0, 200).replace(/\n/g, " ");
          console.log(`   Preview: ${preview}...`);
        }
        console.log();
      }
    }

    console.log("=".repeat(60));
    console.log("SUMMARY");
    console.log("=".repeat(60));
    console.log(`Total queries: ${result.summary.totalQueries}`);
    console.log(`Execution time: ${result.summary.executionTimeMs}ms`);
    console.log("\nBrand mention rate by provider:");
    for (const [provider, rate] of Object.entries(result.summary.brandMentionRate)) {
      console.log(`  ${provider}: ${(rate * 100).toFixed(0)}%`);
    }
    console.log("\nAvg visibility score by provider:");
    for (const [provider, score] of Object.entries(result.summary.avgVisibilityScore)) {
      console.log(`  ${provider}: ${score.toFixed(2)}`);
    }

  } catch (err) {
    console.error("Error running benchmark:", err);
    process.exit(1);
  }
}

main();

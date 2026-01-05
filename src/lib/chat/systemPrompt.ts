import type { ChatContext } from "./types";

const BASE_PROMPT = `You are a field intelligence analyst helping a marketer understand their AI visibility benchmark data for a master-planned community brand.

Your role is to CONTEXTUALIZE the data - explain what it shows, what patterns you see, what's interesting or concerning.

Guidelines:
- Ground EVERY claim in the actual benchmark responses provided below
- Quote or paraphrase specific AI responses when making observations
- Use phrases like "Here's what I'm seeing..." and "What stands out is..."
- If asked about something not in the data, say "I don't have data on that"
- Don't make recommendations or suggest actions - just help them understand the landscape
- Be concise - 2-3 paragraphs max unless asked for more detail

Key metrics to consider:
- Position: Where the brand appears in AI responses (1st, 2nd, 3rd, later, absent)
- Sentiment: How the brand is portrayed (positive, neutral, negative)
- Competitors: Which competitors are mentioned alongside the brand
- Recommendation strength: How strongly the AI recommends the brand`;

function getScopeContext(context: ChatContext): string {
  const personaLabels: Record<string, string> = {
    move_up: "Move-Up Buyers (upgrading from starter home)",
    retiree: "Retirees (55+ active lifestyle)",
    luxury: "Luxury Buyers (high-end amenities focus)",
    first_time: "First-Time Buyers (entry-level, value-conscious)",
  };
  
  const stageLabels: Record<string, string> = {
    explore: "Explore (starting research)",
    consider: "Consider (evaluating options)",
    compare: "Compare (narrowing choices)",
    decide: "Decide (ready to buy)",
  };

  switch (context.scope) {
    case "cell":
      return `\n\nSCOPE: ${personaLabels[context.persona || ""] || context.persona} in the ${stageLabels[context.stage || ""] || context.stage} stage.`;
    
    case "row":
      return `\n\nSCOPE: ${personaLabels[context.persona || ""] || context.persona} across all journey stages.`;
    
    case "column":
      return `\n\nSCOPE: ${stageLabels[context.stage || ""] || context.stage} stage across all buyer personas.`;
    
    case "evidence":
      return `\n\nSCOPE: Exploring ${context.evidenceType} evidence from benchmark data.`;
    
    case "global":
    default:
      return `\n\nSCOPE: Full AI visibility matrix across all personas and stages.`;
  }
}

function formatBenchmarkData(context: ChatContext): string {
  if (!context.queryResults || context.queryResults.length === 0) {
    return "\n\nNO BENCHMARK DATA AVAILABLE - Tell the user to run a benchmark first.";
  }

  const brand = context.brand || "Lakewood Ranch";
  let output = `\n\nBRAND: ${brand}`;
  output += `\n\n=== BENCHMARK RESPONSES ===\n`;

  for (const qr of context.queryResults) {
    output += `\nQUERY: "${qr.query}"\n`;
    
    for (const resp of qr.responses) {
      if (resp.error) {
        output += `  [${resp.provider.toUpperCase()}] Error: ${resp.error}\n`;
        continue;
      }
      
      const v = resp.visibility;
      output += `  [${resp.provider.toUpperCase()} - ${resp.model}]\n`;
      output += `    Position: ${v.position} | Mentioned: ${v.mentioned ? "Yes" : "No"} | Score: ${(v.score * 100).toFixed(0)}%\n`;
      output += `    Sentiment: ${v.sentiment} | Recommendation: ${v.recommendationStrength}\n`;
      if (v.competitorsMentioned.length > 0) {
        output += `    Competitors mentioned: ${v.competitorsMentioned.join(", ")}\n`;
      }
      // Truncate long responses but include enough context
      const truncatedText = resp.text.length > 800 
        ? resp.text.slice(0, 800) + "..." 
        : resp.text;
      output += `    Response: ${truncatedText}\n`;
    }
  }

  return output;
}

function getMetricsContext(context: ChatContext): string {
  if (!context.metrics) return "";
  
  const { score, sentiment, topCompetitors } = context.metrics;
  const parts: string[] = [];
  
  if (score !== undefined) {
    parts.push(`Visibility score: ${(score * 100).toFixed(0)}%`);
  }
  
  if (sentiment !== undefined) {
    const sentimentLabel = sentiment > 0.6 ? "positive" : sentiment < 0.4 ? "negative" : "mixed";
    parts.push(`Sentiment: ${sentimentLabel}`);
  }
  
  if (topCompetitors && topCompetitors.length > 0) {
    parts.push(`Top competitors: ${topCompetitors.slice(0, 3).join(", ")}`);
  }
  
  if (parts.length === 0) return "";
  
  return `\n\nAGGREGATE METRICS: ${parts.join(" | ")}`;
}

function getStageHints(context: ChatContext): string {
  if (!context.stage) return "";
  
  const hints: Record<string, string> = {
    explore: "\n\nKEY QUESTIONS FOR EXPLORE STAGE: Are we being discovered? Where do we appear in lists? What's the first impression?",
    consider: "\n\nKEY QUESTIONS FOR CONSIDER STAGE: What sentiment do AI models express? Are we portrayed positively? What concerns are raised?",
    compare: "\n\nKEY QUESTIONS FOR COMPARE STAGE: How do we stack up against competitors? Are comparisons favorable? Who wins head-to-head?",
    decide: "\n\nKEY QUESTIONS FOR DECIDE STAGE: Are we being recommended? How strong are the recommendations? What's the final impression?",
  };
  
  return hints[context.stage] || "";
}

export function buildSystemPrompt(context: ChatContext): string {
  return (
    BASE_PROMPT + 
    getScopeContext(context) + 
    getStageHints(context) +
    formatBenchmarkData(context) + 
    getMetricsContext(context)
  );
}

/**
 * Build system prompt for File Search mode (no embedded data, uses RAG)
 */
export function buildFileSearchSystemPrompt(context: ChatContext): string {
  const FILE_SEARCH_PROMPT = `You are a field intelligence analyst helping a marketer understand their AI visibility benchmark data for a master-planned community brand.

Your role is to ANALYZE the benchmark data retrieved from the knowledge base and provide actionable insights.

Guidelines:
- Ground EVERY claim in the benchmark data retrieved via File Search
- Quote or paraphrase specific AI responses when making observations
- Reference the source documents when making claims (e.g., "In the Jan 5th benchmark...")
- If the retrieved data doesn't answer the question, say "I couldn't find relevant data for that"
- Be concise - 2-3 paragraphs max unless asked for more detail

Key metrics to look for in the data:
- Position: Where the brand appears in AI responses (1st, 2nd, 3rd, later, absent)
- Sentiment: How the brand is portrayed (positive, neutral, negative)
- Competitors: Which competitors are mentioned alongside the brand
- Recommendation strength: How strongly the AI recommends the brand

When answering:
1. Start with the key finding
2. Support with specific data points from the benchmark responses
3. Note any patterns or trends across providers`;

  return FILE_SEARCH_PROMPT + getScopeContext(context) + getStageHints(context);
}

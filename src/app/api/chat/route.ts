import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildSystemPrompt, buildFileSearchSystemPrompt, buildInsightSystemPrompt, buildFileSearchInsightPrompt } from "@/lib/chat/systemPrompt";
import type { ChatContext } from "@/lib/chat/types";
import { streamQueryWithFileSearch, hasDocuments } from "@/lib/filesearch";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

// Timeout for File Search streaming (50s with 10s buffer before Vercel's 60s limit)
const FILE_SEARCH_TIMEOUT_MS = 50000;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, context, useFileSearch } = body as {
      messages: UIMessage[];
      context: ChatContext;
      useFileSearch?: boolean;
    };

    // Debug: log what we're receiving
    console.log("[Chat API] Context received:", {
      scope: context?.scope,
      persona: context?.persona,
      stage: context?.stage,
      hasQueryResults: !!context?.queryResults,
      queryResultsCount: context?.queryResults?.length ?? 0,
      useFileSearch,
    });

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Hybrid mode: Use File Search if requested AND no current session data
    const hasCurrentData = context?.queryResults && context.queryResults.length > 0;
    const shouldUseFileSearch = useFileSearch && !hasCurrentData;

    if (shouldUseFileSearch) {
      // PERSONA-REQUIRED RULE: File Search needs persona context for efficient queries
      // Without persona context, queries are too broad and may timeout
      const needsPersonaContext = context.scope === "global" && !context.persona;

      if (needsPersonaContext) {
        console.log("[Chat API] No persona selected for File Search - returning guidance message");
        const partId = randomUUID();

        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            writer.write({ type: "text-start", id: partId });
            writer.write({
              type: "text-delta",
              id: partId,
              delta: `## Select a Persona First

I need specific context to search historical data efficiently.

**How to get insights:**
1. **Click a cell** in the matrix (e.g., Retiree × Compare) for focused analysis
2. **Click a row header** to analyze one persona across all stages
3. **Click a column header** to compare all personas in one stage

Once you select a scope, I can analyze:
- **Narrative Displacement**: Why competitors win the story
- **Authority Gap**: Why AI trusts their sources over ours
- **Content Action**: What to publish or update next`
            });
            writer.write({ type: "text-end", id: partId });
          },
        });

        return createUIMessageStreamResponse({ stream });
      }

      // Check if FileSearchStore has documents
      const hasDocs = await hasDocuments();

      if (hasDocs) {
        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        const userText = lastMessage?.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ") ?? "";

        // Use insight prompt for persona-scoped queries, basic prompt for global
        const hasPersonaContext = context.persona || context.scope === "cell" || context.scope === "row";
        console.log("[Chat API] Using File Search mode (streaming)", { hasPersonaContext });
        const systemPrompt = hasPersonaContext
          ? buildFileSearchInsightPrompt(context)
          : buildFileSearchSystemPrompt(context);
        const partId = randomUUID();

        // Stream the File Search response using AI SDK UIMessage format
        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            // Start the text part
            writer.write({ type: "text-start", id: partId });

            // Use Promise.race for deterministic timeout that handles stalled streams
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error("TIMEOUT")), FILE_SEARCH_TIMEOUT_MS);
            });

            try {
              // Wrap the async iterator consumption in a promise
              const streamPromise = (async () => {
                for await (const chunk of streamQueryWithFileSearch(userText, context, systemPrompt)) {
                  writer.write({ type: "text-delta", id: partId, delta: chunk });
                }
              })();

              // Race between stream completion and timeout
              await Promise.race([streamPromise, timeoutPromise]);
            } catch (err) {
              const isTimeout = err instanceof Error && err.message === "TIMEOUT";
              console.error("[Chat API] File Search streaming error:", isTimeout ? "Timeout" : err);
              writer.write({
                type: "text-delta",
                id: partId,
                delta: isTimeout
                  ? "\n\n---\n\n*The search took too long. Try clicking a specific cell or row first to narrow your query scope.*"
                  : "\n\n---\n\n*An error occurred. Try selecting a specific cell or row to narrow the search scope.*"
              });
            }

            // Mark text as done
            writer.write({ type: "text-end", id: partId });
          },
        });

        return createUIMessageStreamResponse({ stream });
      } else {
        console.log("[Chat API] File Search requested but no documents found, falling back to context injection");
      }
    }

    // Default: Context injection mode (current session data)
    // Use insight prompt when we have persona context for actionable analysis
    const hasPersonaContext = context.persona || context.scope === "cell" || context.scope === "row";
    console.log("[Chat API] Using context injection mode", { hasPersonaContext });
    const systemPrompt = hasPersonaContext
      ? buildInsightSystemPrompt(context)
      : buildSystemPrompt(context);

    // Convert UIMessage format to ModelMessage format for streamText
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: google("gemini-3-flash-preview"),
      system: systemPrompt,
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

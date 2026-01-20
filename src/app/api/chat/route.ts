import { streamText, convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildSystemPrompt, buildFileSearchSystemPrompt } from "@/lib/chat/systemPrompt";
import type { ChatContext } from "@/lib/chat/types";
import { streamQueryWithFileSearch, hasDocuments } from "@/lib/filesearch";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

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
      // Check if FileSearchStore has documents
      const hasDocs = await hasDocuments();
      
      if (hasDocs) {
        console.log("[Chat API] Using File Search mode (streaming)");

        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        const userText = lastMessage?.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ") ?? "";

        const systemPrompt = buildFileSearchSystemPrompt(context);
        const partId = randomUUID();

        // Stream the File Search response using AI SDK UIMessage format
        const stream = createUIMessageStream({
          execute: async ({ writer }) => {
            // Start the text part
            writer.write({ type: "text-start", id: partId });

            // Stream text deltas
            for await (const chunk of streamQueryWithFileSearch(userText, context, systemPrompt)) {
              writer.write({ type: "text-delta", id: partId, delta: chunk });
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
    console.log("[Chat API] Using context injection mode");
    const systemPrompt = buildSystemPrompt(context);

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

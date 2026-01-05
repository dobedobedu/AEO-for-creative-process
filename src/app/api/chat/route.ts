import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { buildSystemPrompt, buildFileSearchSystemPrompt } from "@/lib/chat/systemPrompt";
import type { ChatContext } from "@/lib/chat/types";
import { queryWithFileSearch, hasDocuments } from "@/lib/filesearch";

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
        console.log("[Chat API] Using File Search mode");
        
        // Get the last user message
        const lastMessage = messages[messages.length - 1];
        const userText = lastMessage?.parts
          ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join(" ") ?? "";

        const systemPrompt = buildFileSearchSystemPrompt(context);
        const response = await queryWithFileSearch(userText, context, systemPrompt);

        // Return as a simple JSON response (non-streaming for File Search)
        return new Response(
          JSON.stringify({
            text: response.text,
            citations: response.citations,
            mode: "file_search",
          }),
          { headers: { "Content-Type": "application/json" } }
        );
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

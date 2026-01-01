import { loadProjectFromFile, runGraph } from "@ironclad/rivet-node";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { personaText, triggerStage, geo, queryLength, triggers, count } = body;

    // Path to the Rivet project file
    // In production Next.js, this might need adjustment depending on how assets are bundled.
    // For local dev, process.cwd() usually works.
    const projectPath = path.join(process.cwd(), "graphs", "query-generator.rivet-project");

    console.log(`Loading Rivet graph from: ${projectPath}`);

    const project = await loadProjectFromFile(projectPath);

    const inputs = {
      personaText: { type: "string" as const, value: personaText },
      triggerStage: { type: "string" as const, value: triggerStage },
      geo: { type: "string" as const, value: geo || "" },
      queryLength: { type: "string" as const, value: queryLength || "auto" },
      triggers: { type: "string" as const, value: Array.isArray(triggers) ? triggers.join(", ") : (triggers || "") },
      count: { type: "number" as const, value: Number(count) || 5 },
    };

    console.log("Running Rivet graph with inputs:", JSON.stringify(inputs, null, 2));

    const result = await runGraph(project, {
      graph: "Query Generator", // Name of the graph we created
      inputs,
      openAiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
    });

    const output = result["jsonOutput"];

    if (!output) {
      return NextResponse.json({ error: "No output from graph" }, { status: 500 });
    }

    // The output from the Chat node in Rivet is usually a string (the message content).
    // Our existing frontend expects JSON { queries: [...] }
    // The Prompt we designed asks for JSON.
    // So we try to parse it.

    let content = output.value as string;
    let parsed;
    try {
      // Basic JSON extraction if markdown code blocks are present
      content = content.replace(/```json\n|\n```/g, "").trim();
      parsed = JSON.parse(content);
    } catch (e) {
      console.warn("Failed to parse Rivet output as JSON:", content);
      parsed = { queries: [], raw: content };
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("Error running Rivet graph:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

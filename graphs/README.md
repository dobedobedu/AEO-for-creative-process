# Rivet Integration

This directory contains the Rivet project files.

## Getting Started

1.  Download **Rivet** from [https://rivet.ironcladapp.com/](https://rivet.ironcladapp.com/).
2.  Open Rivet and click **Open Project**.
3.  Select `query-generator.rivet-project` in this directory.
4.  You will see a "Query Generator" graph.
5.  To run it within Rivet, you may need to add your OpenAI API Key in the **Settings** (gear icon) -> **Plugins** or environment variables, or configured on the Chat Node.

## Integration

The integration code is located at `src/app/api/query/generate-rivet/route.ts`.
It uses `@ironclad/rivet-node` to load this file and execute the graph.

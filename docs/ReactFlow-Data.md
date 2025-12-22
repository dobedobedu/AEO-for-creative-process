# React Flow Data Shape

## Node types
- persona
- trigger
- query
- response
- insight

## Status values
- draft
- queued
- running
- done
- failed

## TypeScript interfaces
```ts
export type NodeStatus = "draft" | "queued" | "running" | "done" | "failed";

export type NodeKind =
  | "persona"
  | "trigger"
  | "query"
  | "response"
  | "insight";

export type RunGraphNodeData = {
  kind: NodeKind;
  label: string;
  status?: NodeStatus;
  runId: string;
  personaId?: string;
  triggerId?: string;
  queryId?: string;
  responseId?: string;
  model?: string;
  provider?: "openai" | "gemini";
  payload?: Record<string, unknown>;
  meta?: {
    latencyMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  };
};

export type RunGraphNode = {
  id: string;
  type: NodeKind;
  position: { x: number; y: number };
  data: RunGraphNodeData;
};

export type RunGraphEdge = {
  id: string;
  source: string;
  target: string;
  type?: "smoothstep" | "bezier" | "straight";
  animated?: boolean;
  label?: string;
};

export type RunGraph = {
  nodes: RunGraphNode[];
  edges: RunGraphEdge[];
};
```

## Suggested ids
- Persona: `persona:{personaId}`
- Trigger: `trigger:{triggerId}`
- Query: `query:{queryId}`
- Response: `response:{responseId}`
- Insight: `insight:{runId}`

## Edge rules
- persona -> trigger
- trigger -> query
- query -> response
- response -> insight

## Layout
Use a fixed grid or dagre layout. Suggested column x positions:
- persona: 0
- trigger: 260
- query: 520
- response: 820
- insight: 1180


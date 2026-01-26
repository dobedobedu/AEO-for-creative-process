import type { ProviderKey } from "@/lib/matrix/weights";

export type MentionResponse = {
  provider: ProviderKey;
  visibility: { mentioned: boolean };
  error?: string;
};

export type MentionQuery = { responses: MentionResponse[] };

export type MentionCell = {
  stage: string;
  results: MentionQuery[];
};

export function getExploreMentionStats(
  cell: MentionCell,
  enabledProviders?: Set<ProviderKey>
): { mentionCount: number; mentionTotalResponses: number; mentionRate: number | null } {
  if (cell.stage !== "explore") {
    return { mentionCount: 0, mentionTotalResponses: 0, mentionRate: null };
  }

  let mentionCount = 0;
  let mentionTotalResponses = 0;

  for (const qr of cell.results) {
    for (const resp of qr.responses) {
      if (resp.error) continue;
      if (enabledProviders && !enabledProviders.has(resp.provider)) continue;
      mentionTotalResponses++;
      if (resp.visibility.mentioned) mentionCount++;
    }
  }

  const mentionRate = mentionTotalResponses > 0 ? mentionCount / mentionTotalResponses : null;
  return { mentionCount, mentionTotalResponses, mentionRate };
}

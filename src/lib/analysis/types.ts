export type InsightType = 
  | "intent_gap" 
  | "opportunity_prioritization" 
  | "anomaly_explanation" 
  | "competitor_displacement" 
  | "citation_quality" 
  | "content_iteration_feedback";

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  persona?: string;
  stage?: string;
  score: number; // Importance score (0-1)
  evidence: {
    label: string;
    value: string | number;
    url?: string;
    snippet?: string;
  }[];
  action: {
    label: string;
    description: string;
    assetType?: "faq" | "landing_page" | "blog" | "comparison_table";
  };
  created_at: string;
}

export interface InsightGenerator {
  generate(runs: any[]): Promise<Insight[]>;
}

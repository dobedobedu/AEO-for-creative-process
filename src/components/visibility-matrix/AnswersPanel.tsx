"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { Provider } from "./types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2, Bot, User, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeekNavigator } from "./WeekNavigator";
import { ProviderRow } from "./ProviderRow";
import { StageMetricsSummary } from "./StageMetricsSummary";
import { CellCitationSummary } from "./CellCitationSummary";
import type { ChatContext, QueryResultData, ResponseData, VisibilityData } from "@/lib/chat/types";
import type { Citation } from "@/lib/parsers/types";

interface QueryResult {
  query: string;
  responses: {
    provider: Provider;
    model: string;
    text: string;
    visibility: {
      score: number;
      mentioned: boolean;
      sentiment: "positive" | "negative" | "neutral";
      position: string;
      competitorsMentioned: string[];
      comparisonOutcome?: string;
      recommendationStrength?: string;
    };
    citations?: Citation[];
    latencyMs: number;
    error?: string;
  }[];
}

interface AnswersPanelProps {
  open: boolean;
  onClose: () => void;
  persona: string;
  stage: string;
  personaLabel: string;
  stageLabel: string;
  results: QueryResult[];
  brand: string;
  brandAliases?: string[];
  isHistorical?: boolean; // true if viewing a historical run
  runTimestamp?: string; // ISO timestamp of the run being viewed (for historical runs)
  availableRunDates?: string[]; // All dates (YYYY-MM-DD) that have runs available
  onDateChange?: (date: string) => void; // Callback when user selects a different date
  onRunCell?: () => void;
  isRunning?: boolean;
}

const PROVIDERS_CONFIG: { id: Provider; label: string; model: string; logo: string }[] = [
  { id: "openai", label: "OpenAI", model: "GPT 5.2", logo: "/OpenAI-black-monoblossom.svg" },
  { id: "anthropic", label: "Anthropic", model: "Haiku 4.5", logo: "/claude-color.svg" },
  { id: "gemini", label: "Google", model: "Gemini 3", logo: "/gemini-color.svg" },
  { id: "xai", label: "xAI", model: "Grok 4", logo: "/Grok_Logomark_Dark.svg" },
];

// Helper to extract text from message parts (AI SDK 6 format)
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return "";
  return message.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

export function AnswersPanel({
  open,
  onClose,
  persona,
  stage,
  personaLabel,
  stageLabel,
  results,
  brand,
  brandAliases = [],
  isHistorical = false,
  runTimestamp,
  availableRunDates = [],
  onDateChange,
  onRunCell,
  isRunning = false,
}: AnswersPanelProps) {
  // Combine brand and aliases for highlighting
  const brandTerms = [brand, ...brandAliases];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [expandedProvider, setExpandedProvider] = useState<Provider | null>(null);

  // Derive selected date from run timestamp (controlled by parent)
  const selectedDate = runTimestamp?.split("T")[0] || new Date().toISOString().split("T")[0];

  // Handle date selection - call parent callback if provided
  const handleDateSelect = (date: string) => {
    if (onDateChange) {
      onDateChange(date);
    }
  };

  // Group responses by provider
  const responsesByProvider = useMemo(() => {
    const grouped: Record<Provider, { query: string; response: QueryResult["responses"][0] }[]> = {
      openai: [],
      anthropic: [],
      gemini: [],
      xai: [],
    };

    for (const result of results) {
      for (const response of result.responses) {
        if (grouped[response.provider]) {
          grouped[response.provider].push({
            query: result.query,
            response,
          });
        }
      }
    }

    return grouped;
  }, [results]);

  // Aggregate all citations across all providers for this cell
  const allCellCitations = useMemo(() => {
    const citations: Citation[] = [];
    for (const result of results) {
      for (const response of result.responses) {
        if (response.citations) {
          citations.push(...response.citations);
        }
      }
    }
    return citations;
  }, [results]);

  // Prepare Context for Chat
  const queryResults: QueryResultData[] = useMemo(() => {
    return results.map((r) => ({
      query: r.query,
      responses: (r.responses || []).map((resp) => ({
        provider: resp.provider,
        model: resp.model,
        text: resp.text,
        visibility: {
          score: resp.visibility?.score || 0,
          mentioned: resp.visibility?.mentioned || false,
          position: resp.visibility?.position || "absent",
          sentiment: resp.visibility?.sentiment || "neutral",
          competitorsMentioned: resp.visibility?.competitorsMentioned || [],
          recommendationStrength: resp.visibility?.recommendationStrength || "none",
          comparisonOutcome: resp.visibility?.comparisonOutcome || "none",
        } as VisibilityData,
        error: resp.error,
      } as ResponseData)),
    } as QueryResultData));
  }, [results]);

  const context: ChatContext = useMemo(
    () => ({
      scope: "cell",
      persona,
      stage,
      brand,
      queryResults,
    }),
    [persona, stage, brand, queryResults]
  );

  const hasCurrentData = queryResults.length > 0;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({ context, useFileSearch: !hasCurrentData }),
      }),
    [context, hasCurrentData]
  );

  const { messages, sendMessage, status, setMessages } = useChat({ transport });

  const isLoading = status === "submitted" || status === "streaming";

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      onClose();
      setMessages([]);
      setInput("");
      setExpandedProvider(null);
    }
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ parts: [{ type: "text", text: input }] });
    setInput("");
  };

  const quickPrompts = [
    "What patterns do you see?",
    "Provider comparison",
    "Which providers mention us most?",
    "Sentiment analysis",
  ];

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-brand-secondary bg-[#faf9f6] flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30">
                {stageLabel} × LLM Answers
              </span>
              <DialogTitle className="text-2xl font-light tracking-tight text-black">
                {personaLabel}
              </DialogTitle>
              <DialogDescription className="sr-only">
                View LLM responses for {personaLabel} persona in {stageLabel} stage
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              {onRunCell && (
                <Button
                  size="sm"
                  onClick={onRunCell}
                  disabled={isRunning}
                  className="bg-[#6e7c5b] hover:bg-[#5e6c4b] text-white text-[10px] uppercase tracking-wider h-7 px-3 rounded-none"
                >
                  {isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  ) : (
                    <Play className="h-3 w-3 mr-1.5" />
                  )}
                  {isRunning ? "Running..." : "Run"}
                </Button>
              )}
              <Badge
                variant="outline"
                className={`border-transparent rounded-none text-[10px] uppercase font-bold ${
                  hasCurrentData
                    ? "bg-brand-primary/10 text-brand-primary"
                    : "bg-[#6e7c5b]/15 text-[#6e7c5b]"
                }`}
              >
                {hasCurrentData ? `${results.length} Queries` : "No Data"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden">
          {/* Left side - Provider Matrix */}
          <div className="w-1/2 overflow-y-auto border-r border-brand-secondary bg-[#faf9f6]/30">
            {/* Week Navigator - shows available run dates */}
            <WeekNavigator
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              availableDates={availableRunDates.length > 0 ? availableRunDates : [selectedDate]}
            />

            {/* Stage Metrics Summary */}
            <StageMetricsSummary stage={stage} results={results} />

            {/* Cell-level Citation Summary */}
            {allCellCitations.length > 0 || isHistorical ? (
              <div className="px-6 pt-4">
                <CellCitationSummary
                  citations={allCellCitations}
                  brandDomain="lakewoodranch.com"
                  maxSources={8}
                  isHistorical={isHistorical}
                />
              </div>
            ) : null}

            {/* Provider Rows */}
            <div className="p-6 space-y-4">
              {PROVIDERS_CONFIG.map((provider) => {
                const providerResponses = responsesByProvider[provider.id];
                const mentionCount = providerResponses.filter(
                  (r) => r.response.visibility?.mentioned
                ).length;
                const isExpanded = expandedProvider === provider.id;

                return (
                  <ProviderRow
                    key={provider.id}
                    provider={provider.id}
                    label={provider.label}
                    model={provider.model}
                    logo={provider.logo}
                    responses={providerResponses}
                    mentionCount={mentionCount}
                    totalCount={providerResponses.length}
                    isExpanded={isExpanded}
                    onToggleExpand={() =>
                      setExpandedProvider(isExpanded ? null : provider.id)
                    }
                    brandTerms={brandTerms}
                    stage={stage}
                  />
                );
              })}

              {results.length === 0 && (
                <div className="py-24 text-center space-y-4 border border-dashed border-brand-secondary">
                  <Bot className="w-12 h-12 text-black/10 mx-auto" />
                  <p className="font-serif italic text-black/30 text-lg">
                    No LLM responses yet. Run benchmark to see answers.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Chat Panel */}
          <div className="w-1/2 flex flex-col bg-white">
            <div className="p-4 border-b border-black/5 bg-white flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-black/20 flex items-center gap-2">
                <MessageSquare className="w-3 h-3" />
                Ask About Responses
              </h4>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0 bg-white">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-black/20 mb-6">
                    Analyze LLM responses
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {quickPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-brand-secondary text-black/60 hover:bg-[#efe6d9] hover:text-black transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => {
                  const text = getMessageText(message);
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center mt-1">
                          <Bot className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] px-4 py-3 text-xs leading-relaxed ${
                          message.role === "user"
                            ? "bg-brand-primary text-white"
                            : "bg-[#faf9f6] border border-black/5 text-black"
                        }`}
                      >
                        {message.role === "user" ? (
                          <p className="whitespace-pre-wrap">{text}</p>
                        ) : (
                          <div className="prose prose-xs prose-stone max-w-none font-serif">
                            <ReactMarkdown>{text}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                      {message.role === "user" && (
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black/5 flex items-center justify-center mt-1">
                          <User className="h-3 w-3 text-black/40" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center">
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                  <div className="bg-[#faf9f6] border border-black/5 px-4 py-3">
                    <Loader2 className="h-3 w-3 animate-spin text-black/20" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-brand-secondary bg-white">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about LLM responses..."
                  className="flex-1 px-4 py-3 bg-[#faf9f6] border border-black/5 rounded-none text-xs text-black placeholder:text-black/20 focus:outline-none focus:border-black transition-colors"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="bg-black hover:bg-black/90 text-white px-5 rounded-none h-auto"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatContext, QueryResultData, ResponseData, VisibilityData } from "@/lib/chat/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, Send, Loader2, Bot, User, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { computeInsightMetrics, type CompareMetrics, type DecideMetrics } from "@/lib/matrix/insightMetrics";
import type { ProviderKey } from "@/lib/matrix/weights";
import { InsightCards } from "@/components/chat/InsightCards";

interface InsightModalProps {
    open: boolean;
    onClose: () => void;
    persona: string;
    stage: string;
    personaLabel: string;
    stageLabel: string;
    results: any[]; // QueryResult[]
    brand: string;
    onRunCell?: () => void;
    isRunning?: boolean;
    personas?: string[];
}

// Helper to extract text from message parts (AI SDK 6 format)
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
    if (!message.parts) return "";
    return message.parts
        .filter((part) => part.type === "text" && part.text)
        .map((part) => part.text)
        .join("");
}

export function InsightModal({
    open,
    onClose,
    persona,
    stage,
    personaLabel,
    stageLabel,
    results,
    brand,
    onRunCell,
    isRunning = false,
    personas = [],
}: InsightModalProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState("");
    const [ragStatus, setRagStatus] = useState<{ hasDocuments: boolean } | null>(null);
    const [ragError, setRagError] = useState<string | null>(null);

    // Prepare Context for Chat
    const queryResults: QueryResultData[] = useMemo(() => {
        return results.map(r => ({
            query: r.query,
            responses: (r.responses || []).map((resp: any) => ({
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
                error: resp.error
            } as ResponseData))
        } as QueryResultData));
    }, [results]);

    const context: ChatContext = useMemo(() => ({
        scope: "cell",
        persona,
        stage,
        brand,
        queryResults
    }), [persona, stage, brand, queryResults]);

    const hasCurrentData = queryResults.length > 0;

    const transport = useMemo(
        () =>
            new DefaultChatTransport({
                api: "/api/chat",
                body: () => ({ context, useFileSearch: !hasCurrentData }),
            }),
        [context, hasCurrentData]
    );

    const {
        messages,
        sendMessage,
        status,
        setMessages,
    } = useChat({ transport });

    const isLoading = status === "submitted" || status === "streaming";

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            onClose();
        }
        setMessages([]);
        setInput("");
        setRagError(null);
        setRagStatus(null);
    };

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        fetch("/api/benchmark/rag/status")
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error("RAG status unavailable"))))
            .then((data: { hasDocuments: boolean }) => {
                if (cancelled) return;
                setRagStatus(data);
            })
            .catch((err) => {
                if (cancelled) return;
                setRagError(err instanceof Error ? err.message : String(err));
                setRagStatus(null);
            });
        return () => {
            cancelled = true;
        };
    }, [open]);

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

    // Extract top competitors from results for InsightCards
    const topCompetitors = useMemo(() => {
        const competitorCounts = new Map<string, number>();
        for (const r of results) {
            for (const resp of r.responses || []) {
                for (const comp of resp.visibility?.competitorsMentioned || []) {
                    competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
                }
            }
        }
        return [...competitorCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name]) => name);
    }, [results]);

    // Handler for InsightCards submission
    const handleInsightSubmit = (prompt: string) => {
        sendMessage({ parts: [{ type: "text", text: prompt }] });
    };

    // Compute metrics using the helper - MUST be before early return to maintain hooks order
    const metrics = useMemo(() => computeInsightMetrics(stage, results), [stage, results]);

    if (!open) return null;

    // Render provider breakdown table - always show all providers
    const PROVIDER_ORDER: ProviderKey[] = ["openai", "anthropic", "gemini", "xai"];

    const renderProviderBreakdown = () => {
        return (
            <div className="mt-6 space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40">By Provider</h4>
                <div className="border border-black/5 bg-white">
                    {/* Header row */}
                    <div className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 border-b border-black/5 bg-[#faf9f6]">
                        <span className="text-[10px] font-semibold text-black/50">Provider</span>
                        {stage === "explore" && (
                            <>
                                <span className="text-[10px] font-semibold text-black/50 text-right">Mention</span>
                                <span className="text-[10px] font-semibold text-black/50 text-right">Top-3</span>
                            </>
                        )}
                        {stage === "consider" && (
                            <span className="text-[10px] font-semibold text-black/50 text-right col-span-2">Sentiment</span>
                        )}
                        {stage === "compare" && (
                            <span className="text-[10px] font-semibold text-black/50 text-right col-span-2">Win Rate</span>
                        )}
                        {stage === "decide" && (
                            <span className="text-[10px] font-semibold text-black/50 text-right col-span-2">Rec Rate</span>
                        )}
                    </div>
                    {/* Provider rows - always show all providers */}
                    {PROVIDER_ORDER.map((provider) => {
                        const providerMetrics = metrics.byProvider[provider] as Record<string, number | null> | undefined;
                        return (
                            <div key={provider} className="grid grid-cols-[80px_1fr_1fr] gap-2 px-3 py-2 border-b border-black/5 last:border-b-0 hover:bg-[#faf9f6]/50">
                                <span className="text-[10px] font-semibold capitalize text-black/70">{provider}</span>
                                {stage === "explore" && (
                                    <>
                                        <span className="text-[10px] text-black/70 text-right">
                                            {providerMetrics?.mentionRate !== null && providerMetrics?.mentionRate !== undefined ? `${Math.round(providerMetrics.mentionRate * 100)}%` : "N/A"}
                                        </span>
                                        <span className="text-[10px] text-black/70 text-right">
                                            {providerMetrics?.top3Rate !== null && providerMetrics?.top3Rate !== undefined ? `${Math.round(providerMetrics.top3Rate * 100)}%` : "N/A"}
                                        </span>
                                    </>
                                )}
                                {stage === "consider" && (
                                    <span className="text-[10px] text-black/70 text-right col-span-2">
                                        {providerMetrics?.avgSentiment !== null && providerMetrics?.avgSentiment !== undefined ? providerMetrics.avgSentiment.toFixed(2) : "N/A"}
                                    </span>
                                )}
                                {stage === "compare" && (
                                    <span className="text-[10px] text-black/70 text-right col-span-2">
                                        {providerMetrics?.winRate !== null && providerMetrics?.winRate !== undefined ? `${Math.round(providerMetrics.winRate * 100)}%` : "N/A"}
                                    </span>
                                )}
                                {stage === "decide" && (
                                    <span className="text-[10px] text-black/70 text-right col-span-2">
                                        {providerMetrics?.recommendationRate !== null && providerMetrics?.recommendationRate !== undefined ? `${Math.round(providerMetrics.recommendationRate * 100)}%` : "N/A"}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Stage Specific Logic - show N/A when data is unavailable
    const renderExplore = () => {
        if (metrics.stage !== "explore") return null;
        const mentionRate = metrics.overall.mentionRate !== null ? `${Math.round(metrics.overall.mentionRate * 100)}%` : "N/A";
        const top3Rate = metrics.overall.top3Rate !== null ? `${Math.round(metrics.overall.top3Rate * 100)}%` : "N/A";

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#faf9f6] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Mention Rate</span>
                        <p className="text-4xl font-light text-black mt-2">{mentionRate}</p>
                    </div>
                    <div className="bg-[#faf9f6] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Top 3 Ranking</span>
                        <p className="text-4xl font-light text-black mt-2">{top3Rate}</p>
                    </div>
                </div>
                {renderProviderBreakdown()}
            </div>
        );
    };

    const renderConsider = () => {
        if (metrics.stage !== "consider") return null;
        const avgSentiment = metrics.overall.avgSentiment;
        const sentimentDisplay = avgSentiment !== null ? avgSentiment.toFixed(2) : "N/A";
        const sentimentLabel = avgSentiment !== null
            ? (avgSentiment > 0.3 ? "Positive" : avgSentiment < -0.3 ? "Negative" : "Neutral")
            : "";

        return (
            <div className="space-y-6">
                {/* Sentiment Breakdown */}
                <div className="bg-[#faf9f6] p-6 border border-black/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Avg Sentiment</span>
                    <p className="text-4xl font-light text-black mt-2">{sentimentDisplay} {sentimentLabel && <span className="text-lg text-black/50">({sentimentLabel})</span>}</p>
                </div>
                {renderProviderBreakdown()}
            </div>
        );
    };

    const renderCompare = () => {
        if (metrics.stage !== "compare") return null;
        const overall = metrics.overall as CompareMetrics;
        const winRate = overall.winRate !== null ? `${Math.round(overall.winRate * 100)}%` : "N/A";

        return (
            <div className="space-y-6">
                <div className="bg-[#dcf3dc] p-6 border border-black/5 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Head-to-Head Win Rate</span>
                    <p className="text-5xl font-light text-black tracking-tighter mt-1">{winRate}</p>
                </div>
                {renderProviderBreakdown()}
            </div>
        );
    };

    const renderDecide = () => {
        if (metrics.stage !== "decide") return null;
        const overall = metrics.overall as DecideMetrics;
        const recRate = overall.recommendationRate !== null ? `${Math.round(overall.recommendationRate * 100)}%` : "N/A";

        return (
            <div className="space-y-6">
                <div className="bg-[#faf9f6] p-6 border border-black/5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Recommendation Rate</span>
                    <p className="text-4xl font-light text-black mt-2">{recRate}</p>
                </div>
                {renderProviderBreakdown()}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-brand-secondary bg-[#faf9f6] flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30">{stageLabel} Intelligence</span>
                            <DialogTitle className="text-2xl font-light tracking-tight text-black">
                                {personaLabel}
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                View {stageLabel} stage insights and chat for {personaLabel} persona
                            </DialogDescription>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] uppercase font-bold text-black/40">
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
                                className={`border-transparent rounded-none ${hasCurrentData ? "bg-brand-primary/10 text-brand-primary" : "bg-[#6e7c5b]/15 text-[#6e7c5b]"
                                    }`}
                            >
                                {hasCurrentData ? "Mode: Session" : "Mode: File Search"}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={`border-transparent rounded-none ${ragError
                                        ? "bg-[#b86f3a]/15 text-[#b86f3a]"
                                        : ragStatus?.hasDocuments
                                            ? "bg-brand-primary/10 text-brand-primary"
                                            : "bg-[#efe6d9] text-[#1e1b16]/60"
                                    }`}
                            >
                                {ragError ? "RAG: Error" : ragStatus?.hasDocuments ? "RAG: Ready" : "RAG: Checking"}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Top half (Left side in this layout for better space usage) - Metrics & Insights */}
                    <div className="w-1/2 overflow-y-auto border-r border-brand-secondary bg-[#faf9f6]/30 p-8 space-y-8">
                        <div>
                            {stage === "explore" && renderExplore()}
                            {stage === "consider" && renderConsider()}
                            {stage === "compare" && renderCompare()}
                            {stage === "decide" && renderDecide()}

                            {results.length === 0 && (
                                <div className="py-24 text-center space-y-4 border border-dashed border-brand-secondary">
                                    <AlertCircle className="w-12 h-12 text-black/10 mx-auto" />
                                    <p className="font-serif italic text-black/30 text-lg">Benchmark data unavailable.</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Queries Preview */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-black/40">Recent Queries</h4>
                            <div className="space-y-2">
                                {results.slice(0, 3).map((r, idx) => (
                                    <div key={idx} className="bg-white border border-black/5 p-3">
                                        <p className="text-[11px] font-serif text-black/60 italic">"{r.query}"</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bottom half (Right side in this layout) - Chat Panel */}
                    <div className="w-1/2 flex flex-col bg-white">
                        <div className="p-4 border-b border-black/5 bg-white flex justify-between items-center">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-black/20 flex items-center gap-2">
                                <MessageSquare className="w-3 h-3" />
                                Insight Chat
                            </h4>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-white">
                            {messages.length === 0 ? (
                                <div className="py-2">
                                    <InsightCards
                                        context={context}
                                        topCompetitors={topCompetitors}
                                        personas={personas}
                                        onSubmit={handleInsightSubmit}
                                        layout="vertical"
                                    />
                                </div>
                            ) : (
                                messages.map((message) => {
                                    const text = getMessageText(message);
                                    return (
                                        <div
                                            key={message.id}
                                            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            {message.role === "assistant" && (
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center mt-1">
                                                    <Bot className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[85%] px-4 py-3 text-xs leading-relaxed ${message.role === "user"
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
                                    placeholder="Ask for deeper patterns..."
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

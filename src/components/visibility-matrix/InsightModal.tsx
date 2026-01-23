"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { ChatContext, QueryResultData, ResponseData, VisibilityData } from "@/lib/chat/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, AlertCircle, Send, Loader2, Bot, User, Play } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

// Types - using string to support dynamic config
type Persona = string;
type Stage = string;

interface ResponseObject {
    text: string;
    visibility: {
        mentioned: boolean;
        position: string;
        score: number;
        sentiment: string;
        competitorsMentioned: string[];
        comparisonOutcome?: string;
        recommendationStrength?: string;
    };
}

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

    const quickPrompts = [
        "What patterns do you see?",
        "Where are we strong?",
        "Where are we exposed?",
        "How do providers compare?",
    ];

    if (!open) return null;

    // Aggregate stats for the metrics section
    const totalResponses = results.reduce((acc, r) => acc + (r.responses?.length || 0), 0);
    const mentions = results.flatMap(r => r.responses || []).filter((resp: ResponseObject) => resp.visibility?.mentioned);
    const reach = totalResponses > 0 ? (mentions.length / totalResponses) * 100 : 0;

    // Stage Specific Logic (same as before)
    const renderExplore = () => {
        const inTopThree = mentions.filter((m: ResponseObject) => m.visibility?.position === "1st" || m.visibility?.position === "2nd" || m.visibility?.position === "3rd").length;
        const topThreeRate = mentions.length > 0 ? (inTopThree / mentions.length) * 100 : 0;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#faf9f6] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Mention Rate</span>
                        <p className="text-4xl font-light text-black mt-2">{Math.round(reach)}%</p>
                    </div>
                    <div className="bg-[#faf9f6] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Top 3 Ranking</span>
                        <p className="text-4xl font-light text-black mt-2">{Math.round(topThreeRate)}%</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderConsider = () => {
        // Calculate sentiment breakdown
        const allResponses = results.flatMap(r => r.responses || []);
        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        allResponses.forEach((resp: ResponseObject) => {
            const sentiment = resp.visibility?.sentiment || "neutral";
            if (sentiment in sentimentCounts) {
                sentimentCounts[sentiment as keyof typeof sentimentCounts]++;
            }
        });
        const totalSentimentResponses = allResponses.length;
        const positiveRate = totalSentimentResponses > 0 ? (sentimentCounts.positive / totalSentimentResponses) * 100 : 0;
        const neutralRate = totalSentimentResponses > 0 ? (sentimentCounts.neutral / totalSentimentResponses) * 100 : 0;
        const negativeRate = totalSentimentResponses > 0 ? (sentimentCounts.negative / totalSentimentResponses) * 100 : 0;

        return (
            <div className="space-y-6">
                {/* Sentiment Breakdown */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-[#dcf3dc] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Positive</span>
                        <p className="text-4xl font-light text-black mt-2">{Math.round(positiveRate)}%</p>
                        <p className="text-[10px] text-black/40 mt-1">{sentimentCounts.positive} responses</p>
                    </div>
                    <div className="bg-[#faf9f6] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Neutral</span>
                        <p className="text-4xl font-light text-black mt-2">{Math.round(neutralRate)}%</p>
                        <p className="text-[10px] text-black/40 mt-1">{sentimentCounts.neutral} responses</p>
                    </div>
                    <div className="bg-[#fce9e9] p-6 border border-black/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-black/30">Negative</span>
                        <p className="text-4xl font-light text-black mt-2">{Math.round(negativeRate)}%</p>
                        <p className="text-[10px] text-black/40 mt-1">{sentimentCounts.negative} responses</p>
                    </div>
                </div>
            </div>
        );
    };

    const renderCompare = () => {
        const outcomes = mentions.filter((m: ResponseObject) => m.visibility?.comparisonOutcome === "favorable").length;
        const winRate = mentions.length > 0 ? (outcomes / mentions.length) * 100 : 0;

        return (
            <div className="space-y-6">
                <div className="bg-[#dcf3dc] p-6 border border-black/5 text-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-black/40">Head-to-Head Win Rate</span>
                    <p className="text-5xl font-light text-black tracking-tighter mt-1">{Math.round(winRate)}%</p>
                </div>
            </div>
        );
    };

    const renderDecide = () => {
        const weakRecommendations = results.filter(r =>
            r.responses?.some((resp: ResponseObject) => resp.visibility?.recommendationStrength === "none" || resp.visibility?.recommendationStrength === "weak")
        );

        return (
            <div className="space-y-6">
                <div className="bg-[#fce9e9] p-6 border border-black/5">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Unaddressed Objections</span>
                    </div>
                    <p className="text-xs font-serif text-black/80 leading-relaxed">
                        The AI is struggling to resolve transactional hurdles for this persona.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0 border-none bg-white">
                {/* Header */}
                <DialogHeader className="p-6 pb-4 border-b border-[#e3dacb] bg-[#faf9f6] flex-shrink-0">
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
                                className={`border-transparent rounded-none ${hasCurrentData ? "bg-[#1f3b2c]/10 text-[#1f3b2c]" : "bg-[#6e7c5b]/15 text-[#6e7c5b]"
                                    }`}
                            >
                                {hasCurrentData ? "Mode: Session" : "Mode: File Search"}
                            </Badge>
                            <Badge
                                variant="outline"
                                className={`border-transparent rounded-none ${ragError
                                        ? "bg-[#b86f3a]/15 text-[#b86f3a]"
                                        : ragStatus?.hasDocuments
                                            ? "bg-[#1f3b2c]/10 text-[#1f3b2c]"
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
                    <div className="w-1/2 overflow-y-auto border-r border-[#e3dacb] bg-[#faf9f6]/30 p-8 space-y-8">
                        <div>
                            {stage === "explore" && renderExplore()}
                            {stage === "consider" && renderConsider()}
                            {stage === "compare" && renderCompare()}
                            {stage === "decide" && renderDecide()}

                            {totalResponses === 0 && (
                                <div className="py-24 text-center space-y-4 border border-dashed border-[#e3dacb]">
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
                                Interactive Audit
                            </h4>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 min-h-0 bg-white">
                            {messages.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-[11px] font-bold uppercase tracking-widest text-black/20 mb-6">
                                        Ask me about this data
                                    </p>
                                    <div className="flex flex-wrap gap-2 justify-center">
                                        {quickPrompts.map((prompt) => (
                                            <button
                                                key={prompt}
                                                type="button"
                                                onClick={() => setInput(prompt)}
                                                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-white border border-[#e3dacb] text-black/60 hover:bg-[#efe6d9] hover:text-black transition-colors"
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
                                            className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                                        >
                                            {message.role === "assistant" && (
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-black flex items-center justify-center mt-1">
                                                    <Bot className="h-3 w-3 text-white" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[85%] px-4 py-3 text-xs leading-relaxed ${message.role === "user"
                                                        ? "bg-[#1f3b2c] text-white"
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
                        <div className="p-6 border-t border-[#e3dacb] bg-white">
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

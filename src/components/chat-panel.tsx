"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Loader2, User, Bot } from "lucide-react";
import type { ChatContext } from "@/lib/chat/types";

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ChatContext;
}

function getScopeLabel(context: ChatContext): string {
  switch (context.scope) {
    case "cell":
      return `${context.persona} × ${context.stage}`;
    case "row":
      return `${context.persona} (all stages)`;
    case "column":
      return `${context.stage} (all personas)`;
    case "evidence":
      return `${context.evidenceType} evidence`;
    case "global":
    default:
      return "Full Matrix";
  }
}

// Helper to extract text from message parts (AI SDK 6 format)
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts) return "";
  return message.parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text)
    .join("");
}

export function ChatPanel({ open, onOpenChange, context }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [ragStatus, setRagStatus] = useState<{ hasDocuments: boolean } | null>(null);
  const [ragError, setRagError] = useState<string | null>(null);

  // Enable File Search when there's no current query results (use historical RAG data)
  const hasCurrentData = context.queryResults && context.queryResults.length > 0;
  
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
    onOpenChange(nextOpen);
    if (nextOpen) {
      setMessages([]);
      setInput("");
      setRagError(null);
      setRagStatus(null);
    }
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="h-[82vh] w-full max-w-[calc(100%-var(--dialog-gutter))] sm:max-w-[calc(100%-var(--dialog-gutter))] bg-[#fffaf2] border-[#e3dacb] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-[#e3dacb] flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[#1e1b16]">Field Intelligence</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-[#efe6d9] border-transparent text-[#1e1b16]/70">
                {getScopeLabel(context)}
              </Badge>
              <Badge
                variant="outline"
                className={`border-transparent ${
                  hasCurrentData ? "bg-[#1f3b2c]/10 text-[#1f3b2c]" : "bg-[#6e7c5b]/15 text-[#6e7c5b]"
                }`}
              >
                {hasCurrentData ? "Mode: Session" : "Mode: File Search"}
              </Badge>
              <Badge
                variant="outline"
                className={`border-transparent ${
                  ragError
                    ? "bg-[#b86f3a]/15 text-[#b86f3a]"
                    : ragStatus?.hasDocuments
                    ? "bg-[#1f3b2c]/10 text-[#1f3b2c]"
                    : "bg-[#efe6d9] text-[#1e1b16]/60"
                }`}
              >
                {ragError
                  ? "RAG: Error"
                  : ragStatus
                  ? ragStatus.hasDocuments
                    ? "RAG: Ready"
                    : "RAG: No docs"
                  : "RAG: Checking"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#1e1b16]/50 mb-4">
                Ask me about your AI visibility data
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="px-3 py-1.5 text-sm bg-white border border-[#e3dacb] rounded-full text-[#1e1b16]/70 hover:bg-[#efe6d9] hover:text-[#1e1b16] transition-colors"
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
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1f3b2c] flex items-center justify-center">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-[#1f3b2c] text-white"
                        : "bg-white border border-[#e3dacb] text-[#1e1b16]"
                    }`}
                  >
                    {message.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">
                        {text}
                      </p>
                    ) : (
                      <div className="text-sm leading-relaxed prose prose-sm prose-stone max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-[#1e1b16]">
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#efe6d9] flex items-center justify-center">
                      <User className="h-4 w-4 text-[#1e1b16]" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1f3b2c] flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white border border-[#e3dacb] rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-[#1e1b16]/40" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-[#e3dacb] flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your visibility data..."
              className="flex-1 px-4 py-2.5 bg-white border border-[#e3dacb] rounded-xl text-[#1e1b16] placeholder:text-[#1e1b16]/40 focus:outline-none focus:ring-2 focus:ring-[#1f3b2c]/20 focus:border-[#1f3b2c]"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-[#1f3b2c] hover:bg-[#2a4d3a] text-white px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
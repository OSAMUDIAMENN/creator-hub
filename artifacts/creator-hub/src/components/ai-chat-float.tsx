import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiMessagesQueryKey,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Copy, MessageSquare, Minus, Plus, Send, Sparkles, User, X, GripHorizontal, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10"
    >
      {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

export default function AIChatFloat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const { data: conversations, isLoading: loadingConvs } = useListOpenaiConversations({ query: { queryKey: getListOpenaiConversationsQueryKey(), enabled: open } });
  const createConversation = useCreateOpenaiConversation();
  const { data: messages, isLoading: loadingMsgs } = useListOpenaiMessages(
    activeConvId!,
    { query: { queryKey: getListOpenaiMessagesQueryKey(activeConvId!), enabled: !!activeConvId } }
  );

  const initPosition = useCallback(() => {
    if (position.x === -1) {
      setPosition({ x: window.innerWidth - 380, y: window.innerHeight - 80 });
    }
  }, [position.x]);

  useEffect(() => { initPosition(); }, [initPosition]);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingMessage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const x = Math.max(0, Math.min(window.innerWidth - 360, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffset.current.y));
      setPosition({ x, y });
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleNewChat = () => {
    createConversation.mutate(
      { data: { title: "New Chat" } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
          setActiveConvId(conv.id);
        },
      }
    );
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeConvId || isStreaming) return;
    const text = chatInput;
    setChatInput("");
    setIsStreaming(true);
    setStreamingMessage("");
    try {
      const response = await fetch(`/api/openai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: text }),
      });
      if (!response.ok || !response.body) throw new Error("Failed");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let acc = "";
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) { acc += data.content; setStreamingMessage(acc); }
              } catch { /* ignore */ }
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: [`/api/openai/conversations/${activeConvId}/messages`] });
    } catch {
      toast({ title: "Error sending message", variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const toggleOpen = () => {
    setOpen((prev) => !prev);
    setMinimized(false);
  };

  const buttonStyle: React.CSSProperties = {
    position: "fixed",
    left: `${position.x}px`,
    top: `${position.y}px`,
    zIndex: 9999,
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
  };

  if (!open) {
    return (
      <div
        ref={panelRef}
        style={buttonStyle}
        onMouseDown={handleMouseDown}
        className="touch-none"
      >
        <button
          onClick={() => !isDragging && toggleOpen()}
          className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-shadow font-medium text-sm"
        >
          <MessageSquare className="h-4 w-4" />
          <span>AI Chat</span>
        </button>
      </div>
    );
  }

  const panelStyle: React.CSSProperties = {
    position: "fixed",
    left: `${Math.min(position.x, window.innerWidth - 360)}px`,
    top: `${Math.max(0, position.y - (minimized ? 52 : 500))}px`,
    width: "360px",
    zIndex: 9999,
  };

  return (
    <div ref={panelRef} style={panelStyle} className="flex flex-col rounded-xl border bg-background shadow-2xl overflow-hidden">
      {/* Header — drag handle */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal className="h-4 w-4 opacity-60" />
        <Bot className="h-4 w-4" />
        <span className="text-sm font-semibold flex-1">AI Assistant</span>
        <button onClick={() => setMinimized(!minimized)} className="p-1 rounded hover:bg-white/20 transition-colors">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={toggleOpen} className="p-1 rounded hover:bg-white/20 transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <div className="flex flex-col" style={{ height: "480px" }}>
          {/* Conversation selector */}
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Select
              value={activeConvId?.toString() ?? ""}
              onValueChange={(v) => setActiveConvId(parseInt(v))}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select conversation..." />
              </SelectTrigger>
              <SelectContent>
                {loadingConvs ? (
                  <SelectItem value="loading" disabled>Loading...</SelectItem>
                ) : (
                  conversations?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      <MessageSquare className="h-3 w-3 inline mr-1.5" />
                      {c.title}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 flex-shrink-0" onClick={handleNewChat} disabled={createConversation.isPending}>
              {createConversation.isPending ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" ref={scrollRef}>
            {!activeConvId ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-3">
                <Bot className="h-10 w-10 opacity-20" />
                <p className="text-sm">Start a new chat or select a conversation</p>
                <Button size="sm" variant="outline" onClick={handleNewChat}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Chat
                </Button>
              </div>
            ) : loadingMsgs ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-3/4 ml-auto" />
                <Skeleton className="h-16 w-3/4" />
              </div>
            ) : (
              <>
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex flex-col gap-1 rounded-lg px-3 py-2 text-sm max-w-[88%] group",
                      msg.role === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-1.5 opacity-60">
                      {msg.role === "user" ? <User className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                      <span className="text-[10px] capitalize">{msg.role}</span>
                      {msg.role === "assistant" && <CopyBtn text={msg.content} />}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                ))}
                {streamingMessage && (
                  <div className="flex flex-col gap-1 rounded-lg px-3 py-2 text-sm max-w-[88%] bg-muted">
                    <div className="flex items-center gap-1.5 opacity-60">
                      <Bot className="h-2.5 w-2.5 animate-pulse" />
                      <span className="text-[10px]">Typing...</span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{streamingMessage}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-background">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isStreaming || !activeConvId}
                className="h-9 text-sm"
              />
              <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={!chatInput.trim() || isStreaming || !activeConvId}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

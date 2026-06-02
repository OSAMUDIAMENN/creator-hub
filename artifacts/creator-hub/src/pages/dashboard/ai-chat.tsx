import React, { useState, useRef, useEffect } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  getListOpenaiMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bot, Copy, MessageSquare, Plus, Send, Sparkles, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10"
    >
      {copied
        ? <span className="text-green-500 text-xs">✓</span>
        : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

export default function AIChatPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: loadingConvs } = useListOpenaiConversations();
  const createConversation = useCreateOpenaiConversation();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const { data: messages, isLoading: loadingMsgs } = useListOpenaiMessages(
    activeConvId!,
    { query: { queryKey: getListOpenaiMessagesQueryKey(activeConvId!), enabled: !!activeConvId } }
  );

  const [chatInput, setChatInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingMessage]);

  const handleNewChat = () => {
    createConversation.mutate(
      { data: { title: `Chat ${new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}` } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
          setActiveConvId(conv.id);
        },
      }
    );
  };

  const handleDeleteConv = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/openai/conversations/${convId}`, { method: "DELETE", credentials: "include" });
    queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
    if (activeConvId === convId) setActiveConvId(null);
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
        credentials: "include",
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

  return (
    <div className="animate-in fade-in duration-500" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="flex flex-col gap-4 h-full">
        {/* Page Title */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Chat</h1>
            <p className="text-muted-foreground mt-1">Chat with your AI creator assistant.</p>
          </div>
          <Button onClick={handleNewChat} disabled={createConversation.isPending}>
            {createConversation.isPending
              ? <Sparkles className="h-4 w-4 mr-2 animate-spin" />
              : <Plus className="h-4 w-4 mr-2" />}
            New Chat
          </Button>
        </div>

        {/* Chat Layout */}
        <div className="flex gap-4 flex-1 min-h-0">
          {/* Conversations Sidebar */}
          <Card className="w-64 flex flex-col flex-shrink-0 overflow-hidden hidden md:flex">
            <div className="p-3 border-b flex-shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Conversations</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {loadingConvs ? (
                  [...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1" />)
                ) : conversations?.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-4 text-center">No conversations yet</p>
                ) : (
                  (Array.isArray(conversations) ? conversations : []).map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={cn(
                        "flex items-center gap-2 w-full text-left px-3 py-2 text-sm rounded-md transition-colors cursor-pointer group",
                        activeConvId === conv.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate text-xs">{conv.title}</span>
                      <button
                        onClick={(e) => handleDeleteConv(conv.id, e)}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity",
                          activeConvId === conv.id ? "hover:bg-white/20" : "hover:bg-destructive/10 hover:text-destructive"
                        )}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center gap-4 p-8">
                <Bot className="h-14 w-14 opacity-20" />
                <div>
                  <p className="font-semibold text-lg">Start a conversation</p>
                  <p className="text-sm mt-1 opacity-70">Click "New Chat" or select a conversation to begin</p>
                </div>
                <Button onClick={handleNewChat} variant="outline">
                  <Plus className="h-4 w-4 mr-2" /> New Chat
                </Button>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                  {loadingMsgs ? (
                    <div className="space-y-4 p-4">
                      <Skeleton className="h-12 w-2/3 ml-auto" />
                      <Skeleton className="h-20 w-2/3" />
                      <Skeleton className="h-12 w-1/2 ml-auto" />
                    </div>
                  ) : messages?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-3 py-12">
                      <Bot className="h-10 w-10 opacity-20" />
                      <p className="text-sm">Type a message to start the conversation</p>
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(messages) ? messages : []).map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col gap-1.5 rounded-xl px-4 py-3 text-sm max-w-[75%] group",
                            msg.role === "user"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2 opacity-60">
                            {msg.role === "user"
                              ? <User className="h-3 w-3" />
                              : <Bot className="h-3 w-3" />}
                            <span className="text-[10px] capitalize font-medium">{msg.role === "user" ? "You" : "Assistant"}</span>
                            {msg.role === "assistant" && <CopyButton text={msg.content} />}
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        </div>
                      ))}
                      {streamingMessage && (
                        <div className="flex flex-col gap-1.5 rounded-xl px-4 py-3 text-sm max-w-[75%] bg-muted">
                          <div className="flex items-center gap-2 opacity-60">
                            <Bot className="h-3 w-3 animate-pulse" />
                            <span className="text-[10px] font-medium">Typing...</span>
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{streamingMessage}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t flex-shrink-0">
                  <form onSubmit={handleSend} className="flex gap-3">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask me anything about content creation..."
                      disabled={isStreaming}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={!chatInput.trim() || isStreaming} className="flex-shrink-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

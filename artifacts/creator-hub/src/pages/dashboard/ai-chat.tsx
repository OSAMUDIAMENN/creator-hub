import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot, Copy, MessageSquare, Plus, Send, Sparkles, Trash2, User,
  Pencil, Check, X, Search, ChevronLeft, Menu, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="font-bold text-sm mt-2 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="font-bold text-base mt-3 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      elements.push(<p key={i} className="font-semibold">{line.slice(2, -2)}</p>);
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(<li key={i} className="ml-4 list-disc">{line.slice(2)}</li>);
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={i} className="bg-black/10 rounded p-2 text-xs overflow-x-auto font-mono my-1 whitespace-pre-wrap">
          {codeLines.join("\n")}
        </pre>
      );
    } else if (line === "") {
      elements.push(<br key={i} />);
    } else {
      const inlineParsed = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/`(.*?)`/g, "<code class='bg-black/10 px-1 rounded text-xs'>$1</code>");
      elements.push(<p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineParsed }} />);
    }
    i++;
  }
  return <>{elements}</>;
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
  const [aiError, setAiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, streamingMessage]);

  const filteredConvs = (Array.isArray(conversations) ? conversations : []).filter(
    (c) => !search || c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleNewChat = () => {
    createConversation.mutate(
      { data: { title: `Chat — ${new Date().toLocaleDateString("en-NG", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
          setActiveConvId(conv.id);
          setShowMobileSidebar(false);
        },
      }
    );
  };

  const handleSelectConv = (id: number) => {
    setActiveConvId(id);
    setShowMobileSidebar(false);
    setAiError(null);
  };

  const handleDeleteConv = async (convId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`${BASE_URL}/api/openai/conversations/${convId}`, { method: "DELETE", credentials: "include" });
    queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
    if (activeConvId === convId) setActiveConvId(null);
  };

  const startRename = (conv: { id: number; title: string }, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const commitRename = async (convId: number, e?: React.FormEvent) => {
    e?.preventDefault();
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await fetch(`${BASE_URL}/api/openai/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: renameValue.trim() }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
    } catch {
      toast({ title: "Could not rename conversation", variant: "destructive" });
    } finally {
      setRenamingId(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeConvId || isStreaming) return;
    const text = chatInput;
    setChatInput("");
    setIsStreaming(true);
    setStreamingMessage("");
    setAiError(null);

    try {
      const response = await fetch(`${BASE_URL}/api/openai/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: "user", content: text }),
      });
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error ?? `Server error (${response.status})`);
      }

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
      queryClient.invalidateQueries({ queryKey: ["/api/openai/conversations"] });
    } catch (err: any) {
      const msg = err.message ?? "Unknown error";
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        setAiError("AI rate limit reached. Please wait a moment and try again.");
      } else if (msg.includes("500") || msg.toLowerCase().includes("server error")) {
        setAiError("AI service is temporarily unavailable. Please try again shortly.");
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        setAiError("Network error. Please check your connection.");
      } else {
        setAiError(`Could not get a response: ${msg}`);
      }
      toast({ title: "Error sending message", description: msg, variant: "destructive" });
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const ConversationList = () => (
    <>
      <div className="p-3 border-b flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Memory</p>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
            {filteredConvs.length}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search chats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loadingConvs ? (
            [...Array(5)].map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1" />)
          ) : filteredConvs.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-6 text-center">
              {search ? "No chats match your search" : "No conversations yet"}
            </p>
          ) : (
            filteredConvs.map((conv) => (
              <div
                key={conv.id}
                onClick={() => renamingId !== conv.id && handleSelectConv(conv.id)}
                className={cn(
                  "flex items-start gap-2 w-full text-left px-2.5 py-2 rounded-md transition-colors cursor-pointer group",
                  activeConvId === conv.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 opacity-70" />
                <div className="flex-1 min-w-0">
                  {renamingId === conv.id ? (
                    <form onSubmit={(e) => commitRename(conv.id, e)} onClick={(e) => e.stopPropagation()} className="flex gap-1">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        className="h-5 text-xs px-1 py-0 text-foreground"
                        onBlur={() => commitRename(conv.id)}
                      />
                      <button type="submit" className="text-green-500"><Check className="h-3 w-3" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setRenamingId(null); }} className="text-muted-foreground"><X className="h-3 w-3" /></button>
                    </form>
                  ) : (
                    <>
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <p className={cn("text-[10px] mt-0.5", activeConvId === conv.id ? "text-primary-foreground/60" : "text-muted-foreground/60")}>
                        {formatRelativeDate(conv.createdAt)}
                      </p>
                    </>
                  )}
                </div>
                {renamingId !== conv.id && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startRename(conv, e)}
                      className={cn("p-0.5 rounded", activeConvId === conv.id ? "hover:bg-white/20" : "hover:bg-primary/10 hover:text-primary")}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteConv(conv.id, e)}
                      className={cn("p-0.5 rounded", activeConvId === conv.id ? "hover:bg-white/20" : "hover:bg-destructive/10 hover:text-destructive")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );

  return (
    <div className="animate-in fade-in duration-500" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="flex flex-col gap-4 h-full">
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-8 w-8"
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
            >
              {showMobileSidebar ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Chat</h1>
              <p className="text-muted-foreground text-sm mt-0.5 hidden sm:block">Your AI memory — conversations are saved automatically.</p>
            </div>
          </div>
          <Button onClick={handleNewChat} disabled={createConversation.isPending} size="sm">
            {createConversation.isPending
              ? <Sparkles className="h-4 w-4 mr-1.5 animate-spin" />
              : <Plus className="h-4 w-4 mr-1.5" />}
            New Chat
          </Button>
        </div>

        <div className="flex gap-4 flex-1 min-h-0 relative">
          {/* Mobile sidebar overlay */}
          {showMobileSidebar && (
            <div className="absolute inset-0 z-20 flex md:hidden">
              <Card className="w-64 flex flex-col overflow-hidden shadow-xl">
                <ConversationList />
              </Card>
              <div className="flex-1 bg-black/30" onClick={() => setShowMobileSidebar(false)} />
            </div>
          )}

          {/* Desktop sidebar */}
          <Card className="w-64 flex-col flex-shrink-0 overflow-hidden hidden md:flex">
            <ConversationList />
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {!activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center gap-5 p-8">
                <div className="p-5 rounded-full bg-muted">
                  <Bot className="h-12 w-12 opacity-30" />
                </div>
                <div>
                  <p className="font-semibold text-lg">Your AI Memory is Ready</p>
                  <p className="text-sm mt-1 opacity-70 max-w-xs">Start a new chat or pick a previous conversation to continue where you left off.</p>
                </div>
                <Button onClick={handleNewChat} className="gap-2">
                  <Plus className="h-4 w-4" /> Start a New Chat
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
                  ) : (Array.isArray(messages) ? messages : []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-4 py-12">
                      <Bot className="h-10 w-10 opacity-20" />
                      <div>
                        <p className="text-sm font-medium">Chat started</p>
                        <p className="text-xs opacity-70 mt-1">Type a message below to begin</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-w-sm w-full mt-2">
                        {["Give me 5 viral TikTok ideas", "Write a caption for my new product", "How do I grow on Instagram?", "Suggest hashtags for fashion content"].map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => { setChatInput(prompt); }}
                            className="text-left text-xs p-2.5 rounded-lg border hover:bg-muted transition-colors"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {(Array.isArray(messages) ? messages : []).map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col gap-1.5 rounded-xl px-4 py-3 text-sm max-w-[80%] group",
                            msg.role === "user"
                              ? "ml-auto bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <div className="flex items-center gap-2 opacity-60">
                            {msg.role === "user"
                              ? <User className="h-3 w-3" />
                              : <Bot className="h-3 w-3" />}
                            <span className="text-[10px] capitalize font-medium">{msg.role === "user" ? "You" : "CreatorHub AI"}</span>
                            {msg.role === "assistant" && <CopyButton text={msg.content} />}
                          </div>
                          <div className="text-sm leading-relaxed">
                            {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
                          </div>
                        </div>
                      ))}
                      {streamingMessage && (
                        <div className="flex flex-col gap-1.5 rounded-xl px-4 py-3 text-sm max-w-[80%] bg-muted">
                          <div className="flex items-center gap-2 opacity-60">
                            <Bot className="h-3 w-3 animate-pulse text-primary" />
                            <span className="text-[10px] font-medium">CreatorHub AI is typing…</span>
                          </div>
                          <div className="text-sm leading-relaxed">{renderMarkdown(streamingMessage)}</div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* AI Error Banner */}
                {aiError && (
                  <div className="mx-4 mb-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{aiError}</span>
                    <button className="ml-auto opacity-60 hover:opacity-100" onClick={() => setAiError(null)}><X className="h-3 w-3" /></button>
                  </div>
                )}

                {/* Input */}
                <div className="p-3 border-t flex-shrink-0">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask me anything about content creation…"
                      disabled={isStreaming}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); }
                      }}
                    />
                    <Button type="submit" disabled={!chatInput.trim() || isStreaming} size="icon" className="shrink-0">
                      {isStreaming ? <Sparkles className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </form>
                  <p className="text-[10px] text-muted-foreground mt-1.5 text-center">Conversations are saved to your account memory</p>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Activity, Users, Bell, CheckCircle2, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListTeams } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Message = {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  senderName: string;
  senderUsername: string;
  senderProfileImage: string | null;
};

type ActivityLog = {
  id: number;
  action: string;
  description: string;
  entityType: string | null;
  createdAt: string;
  userName: string;
  userUsername: string;
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  message_sent: MessageSquare,
  member_joined: CheckCircle2,
  member_invited: Bell,
};

export default function MessagingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: teams = [], isLoading: loadingTeams } = useListTeams();
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedTeam = (teams as { id: number; name: string }[]).find((t) => t.id === selectedTeamId);

  useEffect(() => {
    if ((teams as { id: number }[]).length > 0 && !selectedTeamId) {
      setSelectedTeamId((teams as { id: number }[])[0].id);
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [selectedTeamId]);

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: [`/teams/${selectedTeamId}/messages`],
    queryFn: () => fetch(`${BASE_URL}/api/teams/${selectedTeamId}/messages`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!selectedTeamId,
    refetchInterval: 5000,
  });

  const { data: activity = [], isLoading: loadingActivity } = useQuery<ActivityLog[]>({
    queryKey: [`/teams/${selectedTeamId}/activity`],
    queryFn: () => fetch(`${BASE_URL}/api/teams/${selectedTeamId}/activity`, { credentials: "include" }).then((r) => r.json()),
    enabled: !!selectedTeamId,
    refetchInterval: 10000,
  });

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${BASE_URL}/api/teams/${selectedTeamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/teams/${selectedTeamId}/messages`] });
      queryClient.invalidateQueries({ queryKey: [`/teams/${selectedTeamId}/activity`] });
      setInput("");
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedTeamId) return;
    sendMessage.mutate(input.trim());
  };

  if (loadingTeams) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full rounded-xl" />
      </div>
    );
  }

  if ((teams as { id: number }[]).length === 0) {
    return (
      <div className="animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" /> Team Messaging
          </h1>
          <p className="text-muted-foreground mt-1">Communicate and collaborate with your team.</p>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-muted-foreground text-center gap-4 mt-12">
          <Users className="h-14 w-14 opacity-20" />
          <div>
            <p className="font-semibold text-lg">No teams yet</p>
            <p className="text-sm mt-1">Create or join a team to start messaging.</p>
          </div>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard/teams"}>
            <Users className="h-4 w-4 mr-2" /> Go to Teams
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <MessageSquare className="h-8 w-8 text-primary" /> Team Messaging
          </h1>
          <p className="text-muted-foreground mt-1">Communicate and collaborate with your team.</p>
        </div>
      </div>

      <DashboardAdBanner count={1} />

      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0" style={{ minHeight: "calc(100vh - 14rem)" }}>
        {/* Team List Sidebar — compact strip on mobile, sidebar on desktop */}
        <Card className="w-full md:w-52 flex-shrink-0 flex flex-col overflow-hidden">
          <CardHeader className="p-3 pb-2 border-b flex-shrink-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              My Teams
            </CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1 max-h-[100px] md:max-h-none">
            <div className="p-2 space-y-0.5 flex md:flex-col flex-row gap-1 md:gap-0 overflow-x-auto md:overflow-x-visible">
              {(teams as { id: number; name: string }[]).map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  className={cn(
                    "shrink-0 md:w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2",
                    selectedTeamId === team.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                    selectedTeamId === team.id ? "bg-white/20" : "bg-primary/10 text-primary"
                  )}>
                    {team.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-xs font-medium">{team.name}</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        {/* Main Content */}
        {selectedTeam ? (
          <Card className="flex-1 flex flex-col overflow-hidden min-w-0">
            <CardHeader className="p-4 pb-3 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                  {selectedTeam.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedTeam.name}</p>
                  <p className="text-xs text-muted-foreground">Team workspace</p>
                </div>
              </div>
            </CardHeader>

            <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
              <TabsList className="mx-4 mt-3 flex-shrink-0 w-fit">
                <TabsTrigger value="chat" className="text-xs gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Activity Log
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0 px-0 data-[state=active]:flex">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
                  {loadingMessages ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-2/3" />)}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center gap-3 py-12">
                      <MessageSquare className="h-10 w-10 opacity-20" />
                      <p className="text-sm">No messages yet — say hello!</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className="flex items-start gap-2.5">
                        <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
                          <AvatarImage src={msg.senderProfileImage ?? undefined} />
                          <AvatarFallback className="text-[10px]">{msg.senderName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold">{msg.senderName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(msg.createdAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p className="text-sm mt-0.5 leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input */}
                <div className="p-4 border-t flex-shrink-0">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={`Message ${selectedTeam.name}...`}
                      disabled={sendMessage.isPending}
                      className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={!input.trim() || sendMessage.isPending}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </TabsContent>

              <TabsContent value="activity" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0 data-[state=active]:block">
                {loadingActivity ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : activity.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center gap-3">
                    <Activity className="h-10 w-10 opacity-20" />
                    <p className="text-sm">No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activity.map((log) => {
                      const Icon = ACTION_ICONS[log.action] ?? Info;
                      return (
                        <div key={log.id} className="flex items-start gap-3 py-2.5 border-b last:border-0">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{log.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {new Date(log.createdAt).toLocaleDateString("en-NG", {
                                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

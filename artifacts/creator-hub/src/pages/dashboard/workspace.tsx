import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Bookmark, Trash2, Copy, CheckCircle, FileText, Anchor, ImageIcon, Sparkles,
  Clock, Loader2, Brain, Wand2, MessageSquare, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

type SavedItem = {
  id: number;
  type: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
};

const TYPE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  hooks: { icon: Anchor, label: "Hooks", color: "bg-red-500/10 text-red-600 border-red-500/20" },
  script: { icon: FileText, label: "Script", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  thumbnail_analysis: { icon: ImageIcon, label: "Analysis", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" },
  content_ideas: { icon: Sparkles, label: "Content Ideas", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
};

const AI_TEMPLATES = [
  {
    category: "Hooks",
    icon: Anchor,
    templates: [
      { title: "The Curiosity Hook", prompt: "Generate TikTok hooks using a curiosity gap about [topic] that makes viewers need to watch to the end" },
      { title: "The Pain Point Hook", prompt: "Generate hooks that call out a painful problem [your audience] faces and promise a solution" },
      { title: "The Contrarian Hook", prompt: "Generate contrarian hooks that challenge a popular belief in the [niche] space" },
      { title: "The Social Proof Hook", prompt: "Generate hooks using social proof — numbers, testimonials, or transformations related to [topic]" },
    ],
  },
  {
    category: "Scripts",
    icon: FileText,
    templates: [
      { title: "The 3-Act Story", prompt: "Write a storytelling script with: Act 1 (relatable setup), Act 2 (turning point), Act 3 (result + lesson) about [topic]" },
      { title: "The List Video", prompt: "Write a '5 things you didn't know about [topic]' script with a hook, 5 rapid-fire points, and CTA" },
      { title: "The Tutorial", prompt: "Write a step-by-step tutorial script teaching how to [skill/task] in under 60 seconds" },
      { title: "The Reaction Video", prompt: "Write a talking-head reaction script responding to a common myth or misconception about [topic]" },
    ],
  },
  {
    category: "Content Ideas",
    icon: Sparkles,
    templates: [
      { title: "30-Day Content Plan", prompt: "Give me 30 content ideas for a [niche] creator targeting [audience] across TikTok and YouTube Shorts" },
      { title: "Trending Repurpose", prompt: "Show me how to repurpose a trending [topic] into 5 different content formats for 5 different platforms" },
      { title: "Series Ideas", prompt: "Generate 10 ideas for a content series a [niche] creator could post weekly for 3 months" },
      { title: "Viral Angles", prompt: "Give me 10 viral content angles for the [topic] that would work in the Nigerian/African creator space" },
    ],
  },
  {
    category: "Growth",
    icon: TrendingUp,
    templates: [
      { title: "Caption with CTA", prompt: "Write 5 Instagram/TikTok captions for a post about [topic] that drive comments and shares" },
      { title: "Hashtag Strategy", prompt: "Give me a hashtag strategy for a [niche] creator with [X] followers — mix of big, medium, and niche tags" },
      { title: "Collab Pitch", prompt: "Write a short collaboration pitch DM for a [niche] creator to send to brands or other creators" },
      { title: "Bio Optimizer", prompt: "Rewrite my social media bio to attract [target audience]. Current bio: [your bio]" },
    ],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost" size="sm"
      className="h-7 px-2"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
    >
      {copied ? <CheckCircle className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function SavedItemCard({ item, onDelete }: { item: SavedItem; onDelete: (id: number) => void }) {
  const meta = TYPE_META[item.type] ?? { icon: Bookmark, label: item.type, color: "bg-muted text-muted-foreground border-border" };
  const Icon = meta.icon;
  const [expanded, setExpanded] = useState(false);

  const previewText = (() => {
    const c = item.content as any;
    if (item.type === "hooks" && c.platform) {
      const hooks = c[c.platform] ?? c.hooks ?? [];
      return hooks.slice(0, 2).join(" • ");
    }
    if (item.type === "script") return c.hook ?? c.fullScript ?? "";
    return JSON.stringify(c).slice(0, 120);
  })();

  const fullText = (() => {
    const c = item.content as any;
    if (item.type === "script") return c.fullScript ?? `${c.hook}\n\n${c.body}\n\n${c.cta}`;
    if (item.type === "hooks") {
      const allHooks = Object.entries(c)
        .filter(([k]) => !["topic","niche","platform"].includes(k))
        .map(([k, v]) => `[${k.toUpperCase()}]\n${(v as string[]).join("\n")}`)
        .join("\n\n");
      return allHooks;
    }
    return JSON.stringify(c, null, 2);
  })();

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("p-1.5 rounded-md border flex-shrink-0", meta.color)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{item.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <CopyButton text={fullText} />
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {previewText && (
          <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{previewText}</p>
        )}
        <Button
          variant="ghost" size="sm"
          className="text-xs mt-2 h-7 px-0 text-primary hover:text-primary/80"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "View full content"}
        </Button>
      </div>
      {expanded && (
        <div className="border-t bg-muted/30 p-4">
          <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">{fullText}</pre>
        </div>
      )}
    </div>
  );
}

function SavedGenerations() {
  const [filter, setFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items = [], isLoading } = useQuery<SavedItem[]>({
    queryKey: ["ai-workspace-saved", filter],
    queryFn: async () => {
      const url = filter === "all" ? "/api/ai-workspace/saved" : `/api/ai-workspace/saved?type=${filter}`;
      const r = await fetch(url);
      return r.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/ai-workspace/saved/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-workspace-saved"] });
      toast({ title: "Deleted" });
    },
  });

  const filters = [
    { value: "all", label: "All" },
    { value: "hooks", label: "Hooks" },
    { value: "script", label: "Scripts" },
    { value: "content_ideas", label: "Content Ideas" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bookmark className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No saved generations yet</p>
          <p className="text-sm mt-1">Use the AI Tools to generate and save hooks, scripts, and more.</p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href="/dashboard/ai-tools">Open AI Tools</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <SavedItemCard key={item.id} item={item} onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AITemplates() {
  const { toast } = useToast();

  const handleUseTemplate = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast({ title: "Prompt copied!", description: "Paste it into AI Assistant or AI Tools to use it." });
  };

  return (
    <div className="space-y-6">
      {AI_TEMPLATES.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.category}>
            <div className="flex items-center gap-2 mb-3">
              <GroupIcon className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{group.category} Templates</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {group.templates.map((t) => (
                <div key={t.title} className="border rounded-lg p-4 hover:border-primary/40 transition-colors group">
                  <p className="text-sm font-semibold mb-1">{t.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.prompt}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                    onClick={() => handleUseTemplate(t.prompt)}
                  >
                    <Copy className="h-3 w-3 mr-1" /> Copy Prompt
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AIHistory() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage-history"],
    queryFn: async () => {
      const r = await fetch("/api/ai-credits");
      return r.json();
    },
  });

  const TOOL_LABELS: Record<string, { label: string; icon: React.ElementType; credits: number }> = {
    hook_generator: { label: "Hook Generator", icon: Anchor, credits: 2 },
    script_generator: { label: "Script Generator", icon: FileText, credits: 3 },
    thumbnail_analyzer: { label: "Thumbnail Analyzer", icon: ImageIcon, credits: 2 },
    content_generator: { label: "Content Generator", icon: Sparkles, credits: 2 },
    ai_chat: { label: "AI Chat", icon: MessageSquare, credits: 1 },
    trends: { label: "Trend Alerts", icon: TrendingUp, credits: 1 },
    purchase: { label: "Credits Purchased", icon: Wand2, credits: 0 },
  };

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-primary">{data?.remainingCredits ?? 0}</p>
          <p className="text-xs text-muted-foreground">Credits Left</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data?.usedCredits ?? 0}</p>
          <p className="text-xs text-muted-foreground">Used This Month</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{data?.purchasedCredits ?? 0}</p>
          <p className="text-xs text-muted-foreground">Purchased</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{data?.totalCredits ?? 0}</p>
          <p className="text-xs text-muted-foreground">Total Available</p>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-3">
        <p className="text-sm font-semibold">Usage by Tool</p>
        {Object.entries(TOOL_LABELS).map(([key, meta]) => {
          const Icon = meta.icon;
          return (
            <div key={key} className="flex items-center gap-3 text-sm">
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="flex-1">{meta.label}</span>
              <span className="text-muted-foreground text-xs">{meta.credits} credits/use</span>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-4">
        <Button variant="outline" asChild>
          <Link href="/dashboard/credits">
            <Wand2 className="h-4 w-4 mr-2" /> Buy More Credits
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default function AIWorkspacePage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Workspace</h1>
        <p className="text-muted-foreground mt-1">Your saved generations, AI templates, and credit history — all in one place.</p>
      </div>

      <Tabs defaultValue="saved">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="saved"><Bookmark className="h-4 w-4 mr-1.5 hidden sm:inline" />Saved</TabsTrigger>
          <TabsTrigger value="templates"><Brain className="h-4 w-4 mr-1.5 hidden sm:inline" />Templates</TabsTrigger>
          <TabsTrigger value="history"><Clock className="h-4 w-4 mr-1.5 hidden sm:inline" />Credits</TabsTrigger>
        </TabsList>

        <TabsContent value="saved">
          <Card>
            <CardHeader>
              <CardTitle>Saved Generations</CardTitle>
              <CardDescription>Hooks, scripts, and analyses you've saved from AI Tools.</CardDescription>
            </CardHeader>
            <CardContent><SavedGenerations /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>AI Prompt Templates</CardTitle>
              <CardDescription>Ready-to-use prompts. Copy and paste into AI Assistant or AI Tools.</CardDescription>
            </CardHeader>
            <CardContent><AITemplates /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Credits & Usage</CardTitle>
              <CardDescription>Track your AI credit usage and purchase more when needed.</CardDescription>
            </CardHeader>
            <CardContent><AIHistory /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import React, { useState, useRef } from "react";
import {
  useGetAiCredits,
  useGenerateHooks,
  useGenerateScript,
  useAnalyzeThumbnail,
  useGetTrends,
  getGetTrendsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Anchor, FileText, ImageIcon, TrendingUp, Copy, Loader2, CheckCircle,
  Save, Hash, Upload, X, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NICHE_GROUPS = [
  {
    label: "Business & Money",
    niches: ["Digital marketing","Affiliate marketing","Freelancing","Side hustles","Dropshipping","Crypto & trading","AI tools","Online business tips","Personal finance","Investing"],
  },
  {
    label: "Tech",
    niches: ["Coding/programming","AI content","App reviews","Website development","Tech news","Smartphone tips","PC setup/content","Cybersecurity basics","Automation tools","SaaS reviews"],
  },
  {
    label: "Content Creator",
    niches: ["YouTube growth","TikTok growth hacks","Video editing","CapCut tutorials","Canva design tips","Faceless content ideas","Viral content strategies","Creator tools","Thumbnail design","Content repurposing"],
  },
  {
    label: "Entertainment",
    niches: ["Celebrity news","Music reactions","Comedy skits","Memes","Storytelling","Anime","Movie reviews","Football content","Gaming","Pranks"],
  },
  {
    label: "Lifestyle",
    niches: ["Fashion","Skincare","Haircare/barbering","Fitness","Gym motivation","Daily vlogs","Productivity","Motivation","Minimalism","Relationship advice"],
  },
  {
    label: "Education",
    niches: ["Study tips","Language learning","History facts","Science facts","Psychology","Business education","Career advice","Public speaking","AI learning","Graphic design tutorials"],
  },
  {
    label: "AI & Future",
    niches: ["AI tools for business","AI video creation","AI automation","AI for students","AI prompts","AI side hustles","AI influencers","AI image generation","AI productivity hacks","AI website builders"],
  },
];

function CreditsBar() {
  const { data: credits } = useGetAiCredits();
  if (!credits) return null;
  const pct = credits.totalCredits > 0 ? Math.round((credits.usedCredits / credits.totalCredits) * 100) : 0;
  return (
    <div className="bg-muted/50 border rounded-lg p-4 flex items-center gap-4">
      <Zap className="h-5 w-5 text-primary flex-shrink-0" />
      <div className="flex-1">
        <div className="flex justify-between text-sm mb-1">
          <span className="font-medium">AI Credits</span>
          <span className="text-muted-foreground">{credits.remainingCredits} / {credits.totalCredits} remaining</span>
        </div>
        <Progress value={pct} className="h-2" />
      </div>
      <Badge variant={credits.remainingCredits < 10 ? "destructive" : "secondary"} className="capitalize">
        {credits.plan}
      </Badge>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2 flex-shrink-0">
      {copied ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function NicheSelect({ value, onValueChange }: { value: string; onValueChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select a niche..." />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {NICHE_GROUPS.map((group) => (
          <SelectGroup key={group.label}>
            <SelectLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">
              {group.label}
            </SelectLabel>
            {group.niches.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

const PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  tiktok: { label: "TikTok", color: "bg-black text-white" },
  youtube: { label: "YouTube", color: "bg-red-600 text-white" },
  facebook: { label: "Facebook", color: "bg-blue-600 text-white" },
  instagram: { label: "Instagram", color: "bg-gradient-to-r from-purple-500 to-pink-500 text-white" },
  x: { label: "X (Twitter)", color: "bg-zinc-900 text-white" },
  reels: { label: "Reels", color: "bg-gradient-to-r from-orange-500 to-pink-500 text-white" },
  opening_lines: { label: "Viral Opening Lines", color: "bg-amber-500 text-white" },
};

function HookGenerator() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [result, setResult] = useState<Record<string, string[]>>({});
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const generateHooks = useGenerateHooks();
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!topic || !niche) { toast({ title: "Fill in topic and niche", variant: "destructive" }); return; }
    generateHooks.mutate(
      { data: { topic, niche, platform: "all" } as any },
      {
        onSuccess: (data: any) => {
          setResult(data ?? {});
          setExpandedPlatform("tiktok");
        },
        onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Generation failed", variant: "destructive" }),
      }
    );
  };

  const handleSave = async (platform: string, hooks: string[]) => {
    try {
      await fetch("/api/ai-workspace/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "hooks", title: `${platform} hooks: ${topic}`, content: { topic, niche, platform, hooks } }),
      });
      toast({ title: "Saved to AI Workspace!" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  const platforms = Object.keys(PLATFORM_LABELS);

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Topic</Label>
          <Input placeholder="e.g., How to save money in Nigeria" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Niche</Label>
          <NicheSelect value={niche} onValueChange={setNiche} />
        </div>
      </div>
      <Button onClick={handleGenerate} disabled={generateHooks.isPending} className="w-full sm:w-auto">
        {generateHooks.isPending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating all platforms...</>
          : <><Anchor className="h-4 w-4 mr-2" /> Generate Hooks for All Platforms</>}
      </Button>

      {Object.keys(result).length > 0 && (
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground font-medium">Hooks generated for {platforms.length} platforms:</p>
          {platforms.map((platform) => {
            const hooks = result[platform] ?? [];
            if (!hooks.length) return null;
            const meta = PLATFORM_LABELS[platform];
            const isOpen = expandedPlatform === platform;
            return (
              <div key={platform} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedPlatform(isOpen ? null : platform)}
                  className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", meta.color)}>{meta.label}</span>
                    <span className="text-sm text-muted-foreground">{hooks.length} hooks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={(e) => { e.stopPropagation(); handleSave(platform, hooks); }}
                    >
                      <Save className="h-3 w-3 mr-1" /> Save
                    </Button>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="p-3 pt-0 space-y-2 max-h-64 overflow-y-auto border-t">
                    {hooks.map((hook, i) => (
                      <div key={i} className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-sm">
                        <span className="flex-1">{hook}</span>
                        <CopyButton text={hook} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScriptGenerator() {
  const [topic, setTopic] = useState("");
  const [niche, setNiche] = useState("");
  const [duration, setDuration] = useState("60");
  const [platform, setPlatform] = useState("tiktok");
  const [scriptType, setScriptType] = useState("short-form");
  const [result, setResult] = useState<any>(null);
  const generateScript = useGenerateScript();
  const { toast } = useToast();

  const handleGenerate = () => {
    if (!topic || !niche) { toast({ title: "Fill in topic and niche", variant: "destructive" }); return; }
    generateScript.mutate(
      { data: { topic, niche, duration: Number(duration), platform, scriptType } as any },
      {
        onSuccess: (data: any) => setResult(data),
        onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Generation failed", variant: "destructive" }),
      }
    );
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      await fetch("/api/ai-workspace/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "script", title: `${scriptType} script: ${topic}`, content: { topic, niche, platform, scriptType, ...result } }),
      });
      toast({ title: "Script saved to AI Workspace!" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Topic</Label>
          <Input placeholder="e.g., 5 ways to grow on TikTok" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Niche</Label>
          <NicheSelect value={niche} onValueChange={setNiche} />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Script Type</Label>
          <Select value={scriptType} onValueChange={setScriptType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short-form">Short-form</SelectItem>
              <SelectItem value="talking-head">Talking-head</SelectItem>
              <SelectItem value="storytelling">Storytelling</SelectItem>
              <SelectItem value="cta-endings">CTA Endings</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
              <SelectItem value="90">90s</SelectItem>
              <SelectItem value="180">3 min</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleGenerate} disabled={generateScript.isPending}>
        {generateScript.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</> : <><FileText className="h-4 w-4 mr-2" /> Generate Script</>}
      </Button>

      {result && (
        <div className="space-y-3 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs capitalize">{result.scriptType ?? scriptType}</Badge>
              <span className="text-xs text-muted-foreground">Est. {result.estimatedDuration}s</span>
            </div>
            <div className="flex gap-2">
              <CopyButton text={result.fullScript ?? `${result.hook}\n\n${result.body}\n\n${result.cta}`} />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleSave}>
                <Save className="h-3 w-3 mr-1" /> Save Script
              </Button>
            </div>
          </div>
          {[
            { label: "Hook", text: result.hook, color: "border-l-4 border-l-red-500" },
            { label: "Body", text: result.body, color: "border-l-4 border-l-blue-500" },
            { label: "CTA", text: result.cta, color: "border-l-4 border-l-green-500" },
          ].map(({ label, text, color }) => (
            <div key={label} className={cn("bg-muted/50 rounded-lg p-3", color)}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</span>
                <CopyButton text={text} />
              </div>
              <p className="text-sm whitespace-pre-wrap">{text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThumbnailAnalyzer() {
  const [title, setTitle] = useState("");
  const [niche, setNiche] = useState("");
  const [thumbnailBase64, setThumbnailBase64] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const analyzeThumbnail = useAnalyzeThumbnail();
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { toast({ title: "Image too large (max 4MB)", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setThumbnailPreview(dataUrl);
      setThumbnailBase64(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = () => {
    if (!title) { toast({ title: "Enter a title to analyze", variant: "destructive" }); return; }
    analyzeThumbnail.mutate(
      { data: { title, niche, thumbnailBase64: thumbnailBase64 ?? undefined } as any },
      {
        onSuccess: (data: any) => setResult(data),
        onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Analysis failed", variant: "destructive" }),
      }
    );
  };

  const scoreColor = result?.score >= 80 ? "text-green-600" : result?.score >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Thumbnail Image <span className="text-muted-foreground text-xs">(optional — costs 3 credits with image, 2 without)</span></Label>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors flex items-center gap-4"
        >
          {thumbnailPreview ? (
            <>
              <img src={thumbnailPreview} alt="thumbnail" className="h-20 w-32 object-cover rounded" />
              <div className="flex-1">
                <p className="text-sm font-medium">Thumbnail loaded</p>
                <p className="text-xs text-muted-foreground">AI will analyze visual + title together</p>
              </div>
              <Button
                variant="ghost" size="icon" className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); setThumbnailPreview(null); setThumbnailBase64(null); }}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-3 text-muted-foreground w-full justify-center py-2">
              <Upload className="h-5 w-5" />
              <span className="text-sm">Click to upload thumbnail image</span>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>

      <div className="space-y-2">
        <Label>Video Title / Thumbnail Text</Label>
        <Input placeholder="e.g., I Made ₦1M in 30 Days Selling Digital Products" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Niche (optional)</Label>
        <NicheSelect value={niche} onValueChange={setNiche} />
      </div>
      <Button onClick={handleAnalyze} disabled={analyzeThumbnail.isPending}>
        {analyzeThumbnail.isPending
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing...</>
          : <><ImageIcon className="h-4 w-4 mr-2" /> Analyze {thumbnailBase64 ? "Thumbnail + Title" : "Title"}</>}
      </Button>

      {result && (
        <div className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-4 bg-muted/50 rounded-lg p-4">
            <div className="text-center">
              <p className={cn("text-5xl font-bold", scoreColor)}>{result.score}</p>
              <p className="text-xs text-muted-foreground">Score</p>
            </div>
            <div className="text-center">
              <p className={cn("text-5xl font-bold", scoreColor)}>{result.grade}</p>
              <p className="text-xs text-muted-foreground">Grade</p>
            </div>
            <div className="flex-1 min-w-32">
              <Progress value={result.score} className="h-3 mb-2" />
              <p className="text-xs text-muted-foreground">Click-through potential</p>
            </div>
            {result.clickability && (
              <div className="text-center">
                <p className="text-sm font-semibold">{result.clickability}</p>
                <p className="text-xs text-muted-foreground">Clickability</p>
              </div>
            )}
            {result.emotionalImpact && (
              <div className="text-center">
                <p className="text-sm font-semibold">{result.emotionalImpact}</p>
                <p className="text-xs text-muted-foreground">Emotion</p>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-green-600 mb-2 uppercase tracking-wide">Strengths</p>
              <ul className="space-y-1">
                {(result.strengths ?? []).map((s: string, i: number) => (
                  <li key={i} className="text-sm flex gap-2"><CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />{s}</li>
                ))}
              </ul>
            </div>
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-orange-600 mb-2 uppercase tracking-wide">Improvements</p>
              <ul className="space-y-1">
                {(result.improvements ?? []).map((s: string, i: number) => (
                  <li key={i} className="text-sm">• {s}</li>
                ))}
              </ul>
            </div>
          </div>
          {result.optimizedTitle && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-primary uppercase tracking-wide">Optimized Title</p>
                <CopyButton text={result.optimizedTitle} />
              </div>
              <p className="text-sm font-medium">{result.optimizedTitle}</p>
            </div>
          )}
          {result.thumbnailTips && Array.isArray(result.thumbnailTips) && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-wide">Thumbnail Tips</p>
              <ul className="space-y-1">
                {result.thumbnailTips.map((t: string, i: number) => (
                  <li key={i} className="text-sm">• {t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TrendAlerts() {
  const [niche, setNiche] = useState("");
  const nicheParam = { niche: niche || "general" };
  const { data: trends, refetch, isFetching } = useGetTrends(nicheParam, { query: { enabled: false, queryKey: getGetTrendsQueryKey(nicheParam) } });
  const { toast } = useToast();

  const handleFetch = () => {
    if (!niche) { toast({ title: "Select a niche first", variant: "destructive" }); return; }
    refetch().catch(() => toast({ title: "Failed to fetch trends", variant: "destructive" }));
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Your Niche</Label>
        <NicheSelect value={niche} onValueChange={setNiche} />
      </div>
      <Button onClick={handleFetch} disabled={isFetching || !niche} className="w-full sm:w-auto">
        {isFetching
          ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing trends...</>
          : <><TrendingUp className="h-4 w-4 mr-2" /> Get Trending Topics</>}
      </Button>

      {trends && (
        <div className="space-y-3 mt-2">
          <p className="text-sm text-muted-foreground">{(trends as any)?.trends?.length ?? 0} trending topics found for <span className="font-semibold text-foreground">{niche}</span></p>
          {((trends as any)?.trends ?? []).map((t: any, i: number) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{t.topic}</p>
                <Badge variant={t.engagement === "Very High" ? "default" : "secondary"} className="text-xs">{t.engagement}</Badge>
              </div>
              {t.viralKeywords && t.viralKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.viralKeywords.map((kw: string, j: number) => (
                    <span key={j} className="inline-flex items-center gap-1 text-[11px] bg-primary/10 text-primary rounded-full px-2 py-0.5">
                      <Hash className="h-2.5 w-2.5" />{kw}
                    </span>
                  ))}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Content Ideas</p>
                {(t.contentIdeas ?? []).map((idea: string, j: number) => (
                  <p key={j} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-primary">•</span>{idea}
                  </p>
                ))}
              </div>
              {t.contentAngles && t.contentAngles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Content Angles</p>
                  {t.contentAngles.map((angle: string, j: number) => (
                    <p key={j} className="text-sm text-muted-foreground flex gap-2">
                      <span className="text-amber-500">→</span>{angle}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIToolsPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">AI Tools</h1>
        <p className="text-muted-foreground mt-1">Advanced AI tools to supercharge your content creation.</p>
      </div>

      <CreditsBar />

      <Tabs defaultValue="hooks">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="hooks"><Anchor className="h-4 w-4 mr-1.5 hidden sm:inline" />Hooks</TabsTrigger>
          <TabsTrigger value="script"><FileText className="h-4 w-4 mr-1.5 hidden sm:inline" />Script</TabsTrigger>
          <TabsTrigger value="thumbnail"><ImageIcon className="h-4 w-4 mr-1.5 hidden sm:inline" />Thumbnail</TabsTrigger>
          <TabsTrigger value="trends"><TrendingUp className="h-4 w-4 mr-1.5 hidden sm:inline" />Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="hooks">
          <Card>
            <CardHeader>
              <CardTitle>Viral Hook Generator</CardTitle>
              <CardDescription>Generate scroll-stopping hooks for ALL platforms at once. Costs 2 credits.</CardDescription>
            </CardHeader>
            <CardContent><HookGenerator /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="script">
          <Card>
            <CardHeader>
              <CardTitle>Video Script Generator</CardTitle>
              <CardDescription>Generate short-form, talking-head, storytelling, or CTA scripts. Costs 3 credits.</CardDescription>
            </CardHeader>
            <CardContent><ScriptGenerator /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="thumbnail">
          <Card>
            <CardHeader>
              <CardTitle>Thumbnail & Title Analyzer</CardTitle>
              <CardDescription>Upload your thumbnail and title for a full CTR analysis. 2 credits (3 with image).</CardDescription>
            </CardHeader>
            <CardContent><ThumbnailAnalyzer /></CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Trend Alerts</CardTitle>
              <CardDescription>Discover viral keywords and trending topics in your niche. Costs 1 credit.</CardDescription>
            </CardHeader>
            <CardContent><TrendAlerts /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

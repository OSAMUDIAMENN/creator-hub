import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useGenerateContent } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Bot, Copy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const generatorSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  niche: z.string().min(1, "Niche is required"),
  audience: z.string().min(1, "Target audience is required"),
  platform: z.string().min(1, "Platform is required"),
});

type GeneratorData = z.infer<typeof generatorSchema>;

function ResultSection({ title, items, onCopy }: { title: string; items: string[]; onCopy: (text: string) => void }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{title}</h3>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="bg-muted/50 p-3 rounded-md flex justify-between gap-4 group">
            <p className="text-sm flex-1 whitespace-pre-wrap">{item}</p>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 h-8 w-8"
              onClick={() => onCopy(item)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const { toast } = useToast();
  const generateContent = useGenerateContent();
  const [generatedResults, setGeneratedResults] = useState<{
    ideas: string[];
    captions: string[];
    hooks: string[];
    hashtags: string[];
  } | null>(null);

  const form = useForm<GeneratorData>({
    resolver: zodResolver(generatorSchema),
    defaultValues: { topic: "", niche: "", audience: "", platform: "instagram" },
  });

  const onGenerate = (data: GeneratorData) => {
    generateContent.mutate(
      { data },
      {
        onSuccess: (res) => {
          setGeneratedResults(res);
          toast({ title: "Content generated!" });
        },
        onError: () => toast({ title: "Generation failed", variant: "destructive" }),
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Assistant</h1>
          <p className="text-muted-foreground mt-1">Generate content ideas, hooks, captions, and hashtags instantly.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/ai-chat">
            <Bot className="h-4 w-4 mr-2" />
            Open AI Chat
          </Link>
        </Button>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Generator Form — left column */}
        <div className="lg:col-span-2">
          <Card className="sticky top-4">
            <CardHeader className="pb-4 border-b">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Content Generator
              </CardTitle>
              <CardDescription>Instantly generate ideas, hooks, and captions</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={form.handleSubmit(onGenerate)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Input {...form.register("topic")} placeholder="e.g. 5 tips for productivity" />
                  {form.formState.errors.topic && (
                    <p className="text-xs text-destructive">{form.formState.errors.topic.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Niche</Label>
                  <Input {...form.register("niche")} placeholder="e.g. Tech / Lifestyle" />
                  {form.formState.errors.niche && (
                    <p className="text-xs text-destructive">{form.formState.errors.niche.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Target Audience</Label>
                  <Input {...form.register("audience")} placeholder="e.g. Beginners / Gen Z" />
                  {form.formState.errors.audience && (
                    <p className="text-xs text-destructive">{form.formState.errors.audience.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select
                    defaultValue={form.getValues("platform")}
                    onValueChange={(v) => form.setValue("platform", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="twitter">X (Twitter)</SelectItem>
                      <SelectItem value="blog">Blog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={generateContent.isPending}>
                  {generateContent.isPending ? "Generating..." : "Generate Content"}
                  <Sparkles className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results — right columns */}
        <div className="lg:col-span-3">
          {!generatedResults ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center text-muted-foreground border border-dashed rounded-xl p-8">
              <Sparkles className="h-12 w-12 mb-4 opacity-20" />
              <p className="font-medium">Your generated content will appear here</p>
              <p className="text-sm mt-1 opacity-70">Fill in the form and click Generate Content</p>
            </div>
          ) : (
            <Card>
              <CardHeader className="pb-4 border-b">
                <CardTitle>Generated Content</CardTitle>
                <CardDescription>Click any item to copy it</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-8">
                <ResultSection title="Content Ideas" items={generatedResults.ideas} onCopy={copyToClipboard} />
                <ResultSection title="Hooks" items={generatedResults.hooks} onCopy={copyToClipboard} />
                <ResultSection title="Captions" items={generatedResults.captions} onCopy={copyToClipboard} />
                <ResultSection
                  title="Hashtags"
                  items={[generatedResults.hashtags.join(" ")]}
                  onCopy={copyToClipboard}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

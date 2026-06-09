import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetProfile, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ArrowRight, Sparkles, User, Store, BarChart2 } from "lucide-react";

const NICHES = [
  "Fashion & Beauty", "Tech & Gadgets", "Food & Cooking", "Travel",
  "Finance & Business", "Health & Fitness", "Entertainment", "Education",
  "Gaming", "Lifestyle", "Music", "Art & Design", "Sports", "Parenting",
];

const STEPS = [
  { id: 1, title: "Welcome to CreatorHub!", subtitle: "Let's set up your creator profile in a few quick steps." },
  { id: 2, title: "Your creator identity", subtitle: "Tell your audience who you are." },
  { id: 3, title: "Pick your niche", subtitle: "Help us personalise your experience." },
  { id: 4, title: "You're all set! 🎉", subtitle: "Your creator profile is ready." },
];

export default function OnboardingPage() {
  const { user } = useUser();
  const [, setLocation] = useLocation();
  const { data: profile } = useGetProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: profile?.name || user?.fullName || "",
    username: profile?.username || "",
    bio: profile?.bio || "",
    niche: "",
  });

  const updateProfile = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed to update profile");
      }
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleNext = async () => {
    if (step === 2) {
      if (!form.username.trim()) { toast({ title: "Username required", variant: "destructive" }); return; }
      await updateProfile.mutateAsync({ name: form.name, username: form.username.trim(), bio: form.bio });
    }
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleFinish = () => {
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                step > s.id ? "bg-primary text-primary-foreground" :
                step === s.id ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {step > s.id ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              {s.id < 4 && <div className={`h-0.5 flex-1 rounded transition-all ${step > s.id ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">{STEPS[step - 1].title}</h1>
              <p className="text-muted-foreground">{STEPS[step - 1].subtitle}</p>
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { icon: User, title: "Creator Profile", desc: "Your public link-in-bio page" },
                    { icon: Store, title: "Digital Store", desc: "Sell products & services" },
                    { icon: BarChart2, title: "Analytics", desc: "Track your growth & earnings" },
                    { icon: Sparkles, title: "AI Tools", desc: "Generate content ideas instantly" },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="rounded-lg bg-primary/10 p-2"><Icon className="h-4 w-4 text-primary" /></div>
                      <div><p className="font-medium text-sm">{title}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={handleNext}>
                  Get started <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Display name</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label>Username <span className="text-destructive">*</span></Label>
                  <div className="flex">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
                      creatrhub.co/
                    </span>
                    <Input
                      className="rounded-l-none"
                      value={form.username}
                      onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                      placeholder="your_username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Bio</Label>
                  <Textarea
                    value={form.bio}
                    onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    placeholder="Tell your audience what you do..."
                    className="resize-none"
                    rows={3}
                  />
                </div>
                <Button className="w-full" onClick={handleNext} disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving…" : "Continue"} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Select your primary content niche:</p>
                <div className="flex flex-wrap gap-2">
                  {NICHES.map((n) => (
                    <Badge
                      key={n}
                      variant={form.niche === n ? "default" : "outline"}
                      className="cursor-pointer py-1.5 px-3 text-sm hover:bg-primary/10 transition-colors"
                      onClick={() => setForm((f) => ({ ...f, niche: n }))}
                    >
                      {n}
                    </Badge>
                  ))}
                </div>
                <Button className="w-full" onClick={handleNext}>
                  Continue <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={handleNext}>
                  Skip for now
                </Button>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 text-center">
                <div className="flex justify-center">
                  <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6">
                    <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="font-semibold text-lg">Welcome aboard, {form.name || "Creator"}!</p>
                  <p className="text-muted-foreground text-sm">
                    Your profile is live at <span className="font-medium text-primary">/{form.username || profile?.username}</span>
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 text-left">
                  {[
                    "Add your social media links",
                    "Upload your first digital product",
                    "Share your profile with your audience",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={handleFinish}>
                  Go to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

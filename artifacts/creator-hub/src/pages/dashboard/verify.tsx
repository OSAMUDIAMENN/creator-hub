import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, ShieldCheck, Info } from "lucide-react";

type Verification = {
  id: number;
  profileId: number;
  status: string;
  niche: string | null;
  socialProof: string | null;
  followerCount: string | null;
  isVerified: boolean;
  reason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  pending: { label: "Under Review", icon: Clock, color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  approved: { label: "Verified", icon: CheckCircle2, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10 border-green-500/20" },
  rejected: { label: "Not Approved", icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/20" },
};

export default function VerifyPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: verification, isLoading } = useQuery<Verification | null>({
    queryKey: ["verify-status"],
    queryFn: () => fetch("/api/verify", { credentials: "include" }).then((r) => r.json()),
  });

  const [form, setForm] = useState({ niche: "", socialProof: "", followerCount: "" });

  const submit = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/verify/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Submission failed");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["verify-status"] });
      toast({ title: "Verification request submitted", description: "We'll review your application and notify you." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-40 rounded-xl bg-muted" /><div className="h-40 rounded-xl bg-muted" /></div>;
  }

  const statusCfg = verification ? STATUS_INFO[verification.status] : null;

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Creator Verification
        </h1>
        <p className="text-muted-foreground mt-1">
          Get verified to build trust with your audience and unlock the verified badge on your profile.
        </p>
      </div>

      {verification && statusCfg && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${statusCfg.bg}`}>
          <statusCfg.icon className={`h-5 w-5 mt-0.5 shrink-0 ${statusCfg.color}`} />
          <div>
            <p className={`font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submitted {new Date(verification.submittedAt).toLocaleDateString()}
              {verification.reviewedAt && ` · Reviewed ${new Date(verification.reviewedAt).toLocaleDateString()}`}
            </p>
            {verification.reason && (
              <p className="text-sm mt-1">{verification.reason}</p>
            )}
          </div>
        </div>
      )}

      {verification?.isVerified ? (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-bold mb-2">You're Verified! ✓</h2>
            <p className="text-muted-foreground text-sm">
              Your profile displays a verified badge. Congratulations on this milestone!
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {(!verification || verification.status === "rejected") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {verification?.status === "rejected" ? "Reapply for Verification" : "Apply for Verification"}
                </CardTitle>
                <CardDescription>
                  Tell us about your creator presence. We review all applications within 2–5 business days.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Your content niche</Label>
                  <Input
                    placeholder="e.g. Fashion & Beauty, Tech, Finance…"
                    value={form.niche}
                    onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total follower count (across platforms)</Label>
                  <Input
                    placeholder="e.g. 15,000"
                    value={form.followerCount}
                    onChange={(e) => setForm((f) => ({ ...f, followerCount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Social media links / proof</Label>
                  <Textarea
                    placeholder="Share links to your Instagram, TikTok, YouTube, etc."
                    value={form.socialProof}
                    onChange={(e) => setForm((f) => ({ ...f, socialProof: e.target.value }))}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p>Creators with at least 1,000 followers and genuine content are typically approved. Growing creators are also considered.</p>
                </div>

                <Button className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending || !form.niche}>
                  {submit.isPending ? "Submitting…" : "Submit Verification Request"}
                </Button>
              </CardContent>
            </Card>
          )}

          {verification?.status === "pending" && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <p className="font-medium">Application under review</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  We typically review applications within 2–5 business days. You'll receive a notification with our decision.
                </p>
                {form.niche && <p className="text-sm mt-2"><span className="font-medium">Niche:</span> {verification.niche}</p>}
                {form.followerCount && <p className="text-sm"><span className="font-medium">Followers:</span> {verification.followerCount}</p>}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Verification Benefits</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            "Verified badge on your public profile",
            "Higher trust with buyers and collaborators",
            "Priority placement in search results",
            "Access to verified creator community",
          ].map((b) => (
            <div key={b} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>{b}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

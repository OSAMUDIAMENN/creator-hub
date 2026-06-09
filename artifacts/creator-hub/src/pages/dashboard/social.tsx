import React, { useState } from "react";
import { useListSocialAccounts, useDisconnectSocialAccount, useListPosts } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Loader2,
  Link2,
  Info,
  Calendar,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube, SiFacebook, SiX } from "react-icons/si";
import { cn } from "@/lib/utils";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PlatformConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  textColor: string;
  description: string;
  oauthNote: string;
}

const PLATFORM_CONFIG: Record<string, PlatformConfig> = {
  tiktok: {
    label: "TikTok",
    icon: SiTiktok,
    color: "bg-black",
    textColor: "text-white",
    description: "Share short-form videos with millions of creators.",
    oauthNote: "Enter your TikTok username to connect.",
  },
  instagram: {
    label: "Instagram",
    icon: SiInstagram,
    color: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
    textColor: "text-white",
    description: "Post photos, reels, and stories to your audience.",
    oauthNote: "Enter your Instagram username to connect.",
  },
  youtube: {
    label: "YouTube",
    icon: SiYoutube,
    color: "bg-red-600",
    textColor: "text-white",
    description: "Upload and schedule long-form video content.",
    oauthNote: "Enter your YouTube channel username to connect.",
  },
  facebook: {
    label: "Facebook",
    icon: SiFacebook,
    color: "bg-blue-600",
    textColor: "text-white",
    description: "Reach your Facebook Page followers.",
    oauthNote: "Enter your Facebook Page name to connect.",
  },
  twitter: {
    label: "X (Twitter)",
    icon: SiX,
    color: "bg-gray-950",
    textColor: "text-white",
    description: "Tweet and thread your content to followers.",
    oauthNote: "Enter your X/Twitter handle to connect.",
  },
};

const ALL_PLATFORMS = ["tiktok", "instagram", "youtube", "facebook", "twitter"];

const STATUS_COLORS: Record<string, string> = {
  published: "bg-green-500/10 text-green-600 border-green-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  draft: "bg-muted text-muted-foreground border-border",
  failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

function ConnectDialog({
  platform,
  onClose,
  onConnected,
}: {
  platform: string | null;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [username, setUsername] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!platform) return null;
  const cfg = PLATFORM_CONFIG[platform];

  const handleConnect = async () => {
    if (!username.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/social-accounts/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          platform,
          platformUsername: username.trim().replace(/^@/, ""),
          accessToken: accessToken.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to connect");
      toast({ title: `${cfg.label} connected!`, description: `@${username.trim().replace(/^@/, "")} is now linked.` });
      onConnected();
    } catch {
      toast({ title: "Connection failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const Icon = cfg.icon;

  return (
    <Dialog open={!!platform} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cfg.color)}>
              <Icon className={cn("h-5 w-5", cfg.textColor)} />
            </div>
            <DialogTitle>Connect {cfg.label}</DialogTitle>
          </div>
          <DialogDescription>{cfg.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-3 flex gap-2 text-sm text-blue-700 dark:text-blue-400">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Enter your {cfg.label} username to connect your account. Automatic OAuth login requires a platform developer app.
              <a
                href="https://developers.tiktok.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline ml-1 opacity-70"
              >
                Learn more
              </a>
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">
              {platform === "facebook" ? "Page Name" : "Username"}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground text-sm select-none">@</span>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={platform === "youtube" ? "channel-name" : "your_handle"}
                className="pl-7"
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accessToken">
              Access Token <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="accessToken"
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Paste your API access token for auto-publishing"
            />
            <p className="text-xs text-muted-foreground">
              Required for auto-publishing. Get it from your {cfg.label} developer app.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleConnect} disabled={saving || !username.trim()}>
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Connecting...</> : (
              <><Link2 className="h-4 w-4 mr-2" />Connect {cfg.label}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlatformCard({
  platform,
  account,
  onConnect,
  onDisconnect,
  isDisconnecting,
}: {
  platform: string;
  account: any;
  onConnect: () => void;
  onDisconnect: (id: number) => void;
  isDisconnecting: boolean;
}) {
  const cfg = PLATFORM_CONFIG[platform];
  const Icon = cfg.icon;
  const connected = !!account;

  return (
    <Card className={cn("overflow-hidden transition-all", connected && "border-primary/20 shadow-sm")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", cfg.color)}>
              <Icon className={cn("h-5 w-5", cfg.textColor)} />
            </div>
            <div>
              <CardTitle className="text-base">{cfg.label}</CardTitle>
              {connected ? (
                <CardDescription className="font-medium text-foreground/70">@{account.platformUsername}</CardDescription>
              ) : (
                <CardDescription>{cfg.description}</CardDescription>
              )}
            </div>
          </div>
          {connected ? (
            <Badge className="bg-green-500/10 text-green-600 border border-green-500/20 flex items-center gap-1 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="secondary" className="whitespace-nowrap">Not connected</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs text-muted-foreground">
              {account.accessToken ? (
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> Auto-publishing enabled
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-600">
                  <AlertCircle className="h-3 w-3" /> No access token — manual posting only
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5"
              onClick={() => onDisconnect(account.id)}
              disabled={isDisconnecting}
            >
              <Trash2 className="h-3 w-3 mr-1.5" /> Disconnect
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full" onClick={onConnect}>
            <Link2 className="h-3.5 w-3.5 mr-1.5" /> Connect {cfg.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PostQueueTab({ connectedPlatforms }: { connectedPlatforms: Set<string> }) {
  const { data: posts, isLoading } = useListPosts({ status: "scheduled" } as any);
  const { data: allPosts } = useListPosts({} as any);

  const scheduledPosts = ((posts as any[]) ?? []).filter((p: any) => p.status === "scheduled");
  const recentPublished = ((allPosts as any[]) ?? [])
    .filter((p: any) => p.status === "published")
    .sort((a: any, b: any) => new Date(b.publishedAt ?? b.updatedAt ?? b.createdAt).getTime() - new Date(a.publishedAt ?? a.updatedAt ?? a.createdAt).getTime())
    .slice(0, 10);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" /> Upcoming Queue ({scheduledPosts.length})
        </h3>
        {!scheduledPosts.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No scheduled posts. Head to the Planner to schedule content.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledPosts.map((post: any) => {
              const cfg = PLATFORM_CONFIG[post.platform];
              const Icon = cfg?.icon ?? Send;
              return (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg?.color ?? "bg-muted")}>
                    <Icon className={cn("h-4 w-4", cfg?.textColor ?? "text-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{post.title}</p>
                    {post.caption && <p className="text-xs text-muted-foreground line-clamp-1">{post.caption}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge className={cn("text-xs border", STATUS_COLORS[post.status] ?? STATUS_COLORS.draft)}>
                      {post.status}
                    </Badge>
                    {post.scheduledDate && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(post.scheduledDate).toLocaleString(undefined, {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recentPublished.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" /> Recently Published ({recentPublished.length})
          </h3>
          <div className="space-y-3">
            {recentPublished.map((post: any) => {
              const cfg = PLATFORM_CONFIG[post.platform];
              const Icon = cfg?.icon ?? Send;
              return (
                <div key={post.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card opacity-80">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", cfg?.color ?? "bg-muted")}>
                    <Icon className={cn("h-4 w-4", cfg?.textColor ?? "text-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{post.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{post.platform}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Badge className={cn("text-xs border", STATUS_COLORS.published)}>published</Badge>
                    {post.publishedAt && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(post.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SocialAccountsPage() {
  const { data: accounts, isLoading } = useListSocialAccounts();
  const disconnectAccount = useDisconnectSocialAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);

  const connectedPlatforms = new Set(((accounts as any[]) ?? []).map((a: any) => a.platform));
  const connectedCount = connectedPlatforms.size;

  const handleDisconnect = (id: number) => {
    disconnectAccount.mutate(
      { id },
      {
        onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Account disconnected" }); },
        onError: () => toast({ title: "Failed to disconnect", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Social Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Connect your platforms to schedule and auto-publish content.
          </p>
        </div>
        {connectedCount > 0 && (
          <Badge className="bg-primary/10 text-primary border border-primary/20 text-sm px-3 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            {connectedCount} platform{connectedCount > 1 ? "s" : ""} connected
          </Badge>
        )}
      </div>

      <DashboardAdBanner count={1} />

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Connections</TabsTrigger>
          <TabsTrigger value="queue">Post Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-6">
          {isLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-36" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {ALL_PLATFORMS.map((platform) => {
                const account = ((accounts as any[]) ?? []).find((a: any) => a.platform === platform);
                return (
                  <PlatformCard
                    key={platform}
                    platform={platform}
                    account={account}
                    onConnect={() => setConnectingPlatform(platform)}
                    onDisconnect={handleDisconnect}
                    isDisconnecting={disconnectAccount.isPending}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <PostQueueTab connectedPlatforms={connectedPlatforms} />
        </TabsContent>
      </Tabs>

      <ConnectDialog
        platform={connectingPlatform}
        onClose={() => setConnectingPlatform(null)}
        onConnected={() => {
          queryClient.invalidateQueries();
          setConnectingPlatform(null);
        }}
      />
    </div>
  );
}

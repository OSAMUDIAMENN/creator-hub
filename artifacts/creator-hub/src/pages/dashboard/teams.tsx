import React, { useState } from "react";
import {
  useListTeams,
  useCreateTeam,
  useGetTeam,
  useInviteTeamMember,
  useRemoveTeamMember,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, UserPlus, Trash2, Copy, Loader2, Building2, Crown } from "lucide-react";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  admin: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  editor: "bg-green-500/10 text-green-600 border-green-500/20",
  viewer: "bg-muted text-muted-foreground border-border",
};

function TeamDetail({ teamId }: { teamId: number }) {
  const { data: team, isLoading } = useGetTeam(teamId);
  const removeTeamMember = useRemoveTeamMember();
  const inviteTeamMember = useInviteTeamMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");

  const handleInvite = () => {
    if (!email.trim()) { toast({ title: "Enter an email", variant: "destructive" }); return; }
    inviteTeamMember.mutate(
      { id: teamId, data: { email, role } as any },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          setInviteOpen(false);
          setEmail("");
          toast({ title: "Invitation sent!" });
        },
        onError: () => toast({ title: "Failed to invite member", variant: "destructive" }),
      }
    );
  };

  const handleRemove = (memberId: number) => {
    removeTeamMember.mutate(
      { id: teamId, memberId },
      {
        onSuccess: () => { queryClient.invalidateQueries(); toast({ title: "Member removed" }); },
        onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
      }
    );
  };

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  if (!team) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {team.inviteCode && (
            <div className="flex items-center gap-2 bg-muted/50 rounded px-3 py-1.5 text-sm">
              <span className="text-muted-foreground">Invite code:</span>
              <span className="font-mono font-medium">{team.inviteCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(team.inviteCode ?? ""); toast({ title: "Copied!" }); }}>
                <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          )}
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Invite Member
        </Button>
      </div>

      <div className="divide-y border rounded-lg overflow-hidden">
        {((team as any).members ?? []).map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 p-4 bg-card">
            <Avatar className="h-9 w-9">
              <AvatarFallback>{m.name?.charAt(0) ?? "?"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{m.email}</p>
            </div>
            <Badge className={`border text-xs ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>{m.role}</Badge>
            {m.role !== "owner" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleRemove(m.id)}
                disabled={removeTeamMember.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite Team Member</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviteTeamMember.isPending}>
              {inviteTeamMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TeamsPage() {
  const { data: teams, isLoading } = useListTeams();
  const createTeam = useCreateTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");

  const handleCreate = () => {
    if (!teamName || !teamSlug) { toast({ title: "Name and slug required", variant: "destructive" }); return; }
    createTeam.mutate(
      { data: { name: teamName, slug: teamSlug } as any },
      {
        onSuccess: (data: any) => {
          queryClient.invalidateQueries();
          setCreateOpen(false);
          setTeamName("");
          setTeamSlug("");
          setSelectedTeam(data?.id ?? null);
          toast({ title: "Team created!" });
        },
        onError: () => toast({ title: "Failed to create team", variant: "destructive" }),
      }
    );
  };

  const teamsList = (teams as any[]) ?? [];
  const activeTeam = selectedTeam ?? teamsList[0]?.id ?? null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground mt-1">Collaborate with your team members.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create Team
        </Button>
      </div>

      <DashboardAdBanner count={1} />

      {isLoading ? (
        <div className="grid gap-4">{[1,2].map(i => <Skeleton key={i} className="h-32" />)}</div>
      ) : teamsList.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <h3 className="font-semibold text-lg mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-4">Create a team to collaborate with others on your creator brand.</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Create Your First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-2">
            {teamsList.map((team: any) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  activeTeam === team.id ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.memberCount} member{team.memberCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
          {activeTeam && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  {teamsList.find((t: any) => t.id === activeTeam)?.name}
                </CardTitle>
                <CardDescription>Manage team members and roles.</CardDescription>
              </CardHeader>
              <CardContent>
                <TeamDetail teamId={activeTeam} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create a Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input placeholder="My Brand Team" value={teamName} onChange={(e) => { setTeamName(e.target.value); setTeamSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL-safe)</Label>
              <Input placeholder="my-brand-team" value={teamSlug} onChange={(e) => setTeamSlug(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createTeam.isPending}>
              {createTeam.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

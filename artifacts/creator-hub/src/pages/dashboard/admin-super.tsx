import React, { useState, useEffect } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, Trash2, Edit, Search, ShieldAlert, Lock, Unlock,
  Globe, FileText, BookOpen, HelpCircle, Megaphone, AlignLeft,
  ToggleLeft, ArrowUp, ArrowDown, ExternalLink, Eye, EyeOff,
  Wallet, AlertTriangle, CheckCircle, RefreshCw, Terminal, Filter,
  Zap, Users, ShoppingBag, MessageSquare, Star, Newspaper, LayoutGrid,
  Shield, Activity, Menu, BarChart3, WalletCards, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...opts,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error ?? "Request failed");
  if (res.status === 204) return undefined as T;
  return res.json();
}

function fmt(n: number) { return n.toLocaleString("en-NG"); }
function fmtNGN(n: number) { return `₦${fmt(n)}`; }

const FLAG_STATUS_COLORS: Record<string, string> = {
  enabled: "bg-green-500/10 text-green-700 border-green-500/20",
  disabled: "bg-red-500/10 text-red-700 border-red-500/20",
  premium_only: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  beta: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  invite_only: "bg-purple-500/10 text-purple-700 border-purple-500/20",
};

const FLAG_STATUS_LABELS: Record<string, string> = {
  enabled: "Enabled",
  disabled: "Disabled",
  premium_only: "Premium Only",
  beta: "Beta",
  invite_only: "Invite Only",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  ai: Zap,
  commerce: ShoppingBag,
  collaboration: Users,
  growth: BarChart3,
  payments: Wallet,
  content: FileText,
  insights: Activity,
  social: MessageSquare,
  auth: Shield,
  platform: Globe,
  general: LayoutGrid,
};

type FeatureFlag = {
  id: number; key: string; label: string; description: string | null;
  status: string; category: string; updatedAt: string;
};

// ── Feature Flags Tab ─────────────────────────────────────────────────────────
export function FeatureFlagsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: flags = [], isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ["/admin/feature-flags"],
    queryFn: () => api("/admin/feature-flags"),
  });

  const updateFlag = useMutation({
    mutationFn: ({ key, status }: { key: string; status: string }) =>
      api(`/admin/feature-flags/${key}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/feature-flags"] }); toast({ title: "Feature flag updated" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const categories = ["all", ...Array.from(new Set(flags.map((f) => f.category))).sort()];
  const filtered = categoryFilter === "all" ? flags : flags.filter((f) => f.category === categoryFilter);
  const grouped = filtered.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    (acc[f.category] = acc[f.category] ?? []).push(f);
    return acc;
  }, {});

  if (isLoading) return <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(12)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">Global Feature Toggles</h3>
          <p className="text-sm text-muted-foreground">Control which features are available on the platform.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button key={cat} variant={categoryFilter === cat ? "default" : "outline"} size="sm" className="capitalize text-xs h-7"
              onClick={() => setCategoryFilter(cat)}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {Object.entries(grouped).map(([category, items]) => {
        const Icon = CATEGORY_ICONS[category] ?? LayoutGrid;
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold capitalize text-muted-foreground">{category}</h4>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((flag) => (
                <Card key={flag.key} className={cn("transition-all", flag.status === "disabled" && "opacity-70")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{flag.label}</p>
                        {flag.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{flag.description}</p>}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", FLAG_STATUS_COLORS[flag.status] ?? "")}>
                        {FLAG_STATUS_LABELS[flag.status] ?? flag.status}
                      </Badge>
                    </div>
                    <Select
                      value={flag.status}
                      onValueChange={(status) => updateFlag.mutate({ key: flag.key, status })}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Enabled</span></SelectItem>
                        <SelectItem value="disabled"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Disabled</span></SelectItem>
                        <SelectItem value="premium_only"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Premium Only</span></SelectItem>
                        <SelectItem value="beta"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Beta</span></SelectItem>
                        <SelectItem value="invite_only"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Invite Only</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Menu Builder Tab ──────────────────────────────────────────────────────────
type MenuItem = {
  id: number; menuType: string; label: string; url: string; icon: string | null;
  sortOrder: number; isExternal: boolean; isVisible: boolean;
  createdAt: string; updatedAt: string;
};

const MENU_TYPES = [
  { key: "header", label: "Header Menu", icon: AlignLeft },
  { key: "footer", label: "Footer Menu", icon: AlignLeft },
  { key: "dashboard", label: "Dashboard Menu", icon: LayoutGrid },
  { key: "mobile", label: "Mobile Menu", icon: Menu },
];

const emptyMenuItem = { label: "", url: "", icon: "", isExternal: false, isVisible: true };

export function MenuBuilderTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeMenu, setActiveMenu] = useState("header");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [form, setForm] = useState(emptyMenuItem);

  const { data: allItems = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["/admin/menus"],
    queryFn: () => api("/admin/menus"),
  });

  const items = allItems.filter((i) => i.menuType === activeMenu).sort((a, b) => a.sortOrder - b.sortOrder);

  const createItem = useMutation({
    mutationFn: (data: typeof form) => api("/admin/menus", { method: "POST", body: JSON.stringify({ menuType: activeMenu, ...data }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/menus"] }); toast({ title: "Menu item added" }); setDialogOpen(false); setForm(emptyMenuItem); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) =>
      api(`/admin/menus/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/menus"] }); toast({ title: "Menu item updated" }); setDialogOpen(false); setEditItem(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api(`/admin/menus/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/menus"] }); toast({ title: "Item removed" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const moveItem = (item: MenuItem, direction: "up" | "down") => {
    const newOrder = direction === "up" ? item.sortOrder - 1 : item.sortOrder + 1;
    updateItem.mutate({ id: item.id, data: { sortOrder: newOrder } });
  };

  const openCreate = () => { setEditItem(null); setForm(emptyMenuItem); setDialogOpen(true); };
  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setForm({ label: item.label, url: item.url, icon: item.icon ?? "", isExternal: item.isExternal, isVisible: item.isVisible });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Dynamic Menu Builder</h3>
          <p className="text-sm text-muted-foreground">Manage navigation menus across the platform.</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {MENU_TYPES.map((m) => {
          const count = allItems.filter((i) => i.menuType === m.key).length;
          return (
            <Button key={m.key} variant={activeMenu === m.key ? "default" : "outline"} size="sm" className="text-xs h-8 gap-2"
              onClick={() => setActiveMenu(m.key)}>
              {m.label}
              <Badge variant="secondary" className="text-[10px] h-4 px-1">{count}</Badge>
            </Button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            : items.length === 0
              ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Menu className="h-10 w-10 opacity-20 mx-auto mb-3" />
                  <p className="text-sm">No items in this menu yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add first item</Button>
                </div>
              )
              : (
                <div className="divide-y">
                  {items.map((item, idx) => (
                    <div key={item.id} className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors", !item.isVisible && "opacity-50")}>
                      <div className="flex flex-col gap-0.5">
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === 0} onClick={() => moveItem(item, "up")}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" disabled={idx === items.length - 1} onClick={() => moveItem(item, "down")}><ArrowDown className="h-3 w-3" /></Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.isExternal && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                          {!item.isVisible && <Badge variant="outline" className="text-[10px]">Hidden</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{item.url}</p>
                      </div>
                      {item.icon && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{item.icon}</span>}
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => updateItem.mutate({ id: item.id, data: { isVisible: !item.isVisible } })}>
                          {item.isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditItem(null); setForm(emptyMenuItem); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editItem ? "Edit Menu Item" : "New Menu Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Label</Label><Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Home" /></div>
              <div className="space-y-1.5"><Label>URL</Label><Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/dashboard" /></div>
            </div>
            <div className="space-y-1.5"><Label>Icon (Lucide name, optional)</Label><Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="e.g. Home, Users, Zap" /></div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2"><Switch checked={form.isExternal} onCheckedChange={(v) => setForm((f) => ({ ...f, isExternal: v }))} /><Label>External Link</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isVisible} onCheckedChange={(v) => setForm((f) => ({ ...f, isVisible: v }))} /><Label>Visible</Label></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.label || !form.url || createItem.isPending || updateItem.isPending}
              onClick={() => editItem ? updateItem.mutate({ id: editItem.id, data: form }) : createItem.mutate(form)}
            >
              {(createItem.isPending || updateItem.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editItem ? "Save Changes" : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── CMS Tab ───────────────────────────────────────────────────────────────────
type CmsItem = {
  id: number; type: string; title: string; slug: string; excerpt: string | null;
  status: string; publishedAt: string | null; createdAt: string; updatedAt: string;
};

const CMS_TYPES = [
  { key: "blog", label: "Blog Posts", icon: Newspaper },
  { key: "page", label: "Pages", icon: FileText },
  { key: "announcement", label: "Announcements", icon: Megaphone },
  { key: "faq", label: "FAQs", icon: HelpCircle },
  { key: "help", label: "Help Articles", icon: BookOpen },
];

export function CmsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState("blog");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<(CmsItem & { content?: string }) | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [form, setForm] = useState({ title: "", slug: "", content: "", excerpt: "", status: "draft" });

  const { data: items = [], isLoading } = useQuery<CmsItem[]>({
    queryKey: ["/admin/cms", activeType],
    queryFn: () => api(`/admin/cms?type=${activeType}`),
  });

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 80);

  const createItem = useMutation({
    mutationFn: (data: typeof form) => api("/admin/cms", { method: "POST", body: JSON.stringify({ type: activeType, ...data }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/cms", activeType] }); toast({ title: "Content created" }); setDialogOpen(false); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof form> }) =>
      api(`/admin/cms/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/cms", activeType] }); toast({ title: "Content updated" }); setDialogOpen(false); setEditItem(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteItem = useMutation({
    mutationFn: (id: number) => api(`/admin/cms/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/cms", activeType] }); toast({ title: "Content deleted" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditItem(null);
    setForm({ title: "", slug: "", content: "", excerpt: "", status: "draft" });
    setDialogOpen(true);
  };

  const openEdit = async (item: CmsItem) => {
    setLoadingContent(true);
    setDialogOpen(true);
    try {
      const full = await api<CmsItem & { content: string }>(`/admin/cms/${item.id}`);
      setEditItem(full);
      setForm({ title: full.title, slug: full.slug, content: full.content ?? "", excerpt: full.excerpt ?? "", status: full.status });
    } catch {
      toast({ title: "Failed to load content", variant: "destructive" });
    } finally {
      setLoadingContent(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Content Management System</h3>
          <p className="text-sm text-muted-foreground">Create and manage platform content.</p>
        </div>
        <Button onClick={openCreate} size="sm"><Plus className="h-4 w-4 mr-2" /> Create Content</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {CMS_TYPES.map((t) => {
          const count = activeType === t.key ? items.length : 0;
          return (
            <Button key={t.key} variant={activeType === t.key ? "default" : "outline"} size="sm" className="text-xs h-8 gap-1.5"
              onClick={() => setActiveType(t.key)}>
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </Button>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            : items.length === 0
              ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-20 mx-auto mb-3" />
                  <p className="text-sm">No {activeType} content yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" /> Create first item</Button>
                </div>
              )
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Published</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">{item.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{item.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", item.status === "published" ? "bg-green-500/10 text-green-700 border-green-500/20" : "")}>
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="text-xs h-7"
                              onClick={() => updateItem.mutate({ id: item.id, data: { status: item.status === "published" ? "draft" : "published" } })}>
                              {item.status === "published" ? "Unpublish" : "Publish"}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}><Edit className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem.mutate(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditItem(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Content" : "Create Content"}</DialogTitle>
            <DialogDescription>Fill in the details for this {activeType} content item.</DialogDescription>
          </DialogHeader>
          {loadingContent ? (
            <div className="space-y-3 py-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-32" /></div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => { const t = e.target.value; setForm((f) => ({ ...f, title: t, slug: editItem ? f.slug : generateSlug(t) })); }} placeholder="Enter title..." />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="url-friendly-slug" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Excerpt / Summary</Label>
                <Textarea value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} rows={2} placeholder="Brief description..." />
              </div>
              <div className="space-y-1.5">
                <Label>Content</Label>
                <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={10} placeholder="Write your content here..." className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.title || !form.slug || createItem.isPending || updateItem.isPending}
              onClick={() => editItem ? updateItem.mutate({ id: editItem.id, data: form }) : createItem.mutate(form)}
            >
              {(createItem.isPending || updateItem.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editItem ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Audit Logs Tab ────────────────────────────────────────────────────────────
type AuditLog = {
  id: number; adminId: number | null; adminEmail: string | null; adminName: string | null;
  action: string; entity: string | null; entityId: string | null; changes: string | null;
  ipAddress: string | null; createdAt: string;
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-700",
  update: "bg-blue-500/10 text-blue-700",
  delete: "bg-red-500/10 text-red-700",
  freeze: "bg-amber-500/10 text-amber-700",
  unfreeze: "bg-green-500/10 text-green-700",
  block: "bg-red-500/10 text-red-700",
  unblock: "bg-green-500/10 text-green-700",
  broadcast: "bg-purple-500/10 text-purple-700",
};

export function AuditLogsTab() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery<AuditLog[]>({
    queryKey: ["/admin/audit-logs", search],
    queryFn: () => api(`/admin/audit-logs?limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  const getActionColor = (action: string) => {
    const key = Object.keys(ACTION_COLORS).find((k) => action.startsWith(k));
    return key ? ACTION_COLORS[key] : "bg-muted text-muted-foreground";
  };

  const parseChanges = (changes: string | null) => {
    if (!changes) return null;
    try { return JSON.stringify(JSON.parse(changes), null, 2); }
    catch { return changes; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by action, entity, admin..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="h-10 w-10 opacity-20 mx-auto mb-3" />
              <p className="text-sm">No audit logs yet. Admin actions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs font-mono", getActionColor(log.action))}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.entity && <span>{log.entity}{log.entityId ? ` #${log.entityId}` : ""}</span>}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{log.adminName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{log.adminEmail}</p>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{log.ipAddress ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          {log.changes && <Button size="sm" variant="ghost" className="h-6 text-xs">{expandedId === log.id ? "Hide" : "View"}</Button>}
                        </TableCell>
                      </TableRow>
                      {expandedId === log.id && log.changes && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/50">
                            <pre className="text-xs font-mono p-3 overflow-x-auto whitespace-pre-wrap break-all">{parseChanges(log.changes)}</pre>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Wallet Management Tab ─────────────────────────────────────────────────────
type WalletEntry = {
  userId: number; name: string; email: string; username: string;
  balance: number; totalEarned: number; totalWithdrawn: number;
  isFrozen: boolean; frozenReason: string | null; walletId: number | null;
};

export function WalletMgmtTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<WalletEntry | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [freezeTarget, setFreezeTarget] = useState<WalletEntry | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [showFrozenOnly, setShowFrozenOnly] = useState(false);

  const { data: wallets = [], isLoading, refetch } = useQuery<WalletEntry[]>({
    queryKey: ["/admin/wallets", search],
    queryFn: () => api(`/admin/wallets?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`),
  });

  const updateWallet = useMutation({
    mutationFn: ({ userId, data }: { userId: number; data: Record<string, unknown> }) =>
      api(`/admin/wallets/${userId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/wallets"] }); toast({ title: "Wallet updated" }); setAdjustTarget(null); setFreezeTarget(null); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const filtered = showFrozenOnly ? wallets.filter((w) => w.isFrozen) : wallets;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, username..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={showFrozenOnly} onCheckedChange={setShowFrozenOnly} />
          <Label className="text-sm">Frozen only</Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <WalletCards className="h-10 w-10 opacity-20 mx-auto mb-3" />
              <p className="text-sm">No wallets found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Total Earned</TableHead>
                    <TableHead>Total Withdrawn</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((w) => (
                    <TableRow key={w.userId} className={w.isFrozen ? "bg-red-500/5" : ""}>
                      <TableCell>
                        <p className="font-medium text-sm">{w.name}</p>
                        <p className="text-xs text-muted-foreground">{w.email}</p>
                      </TableCell>
                      <TableCell className="font-semibold">{fmtNGN(w.balance)}</TableCell>
                      <TableCell className="text-sm text-green-600">{fmtNGN(w.totalEarned)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtNGN(w.totalWithdrawn)}</TableCell>
                      <TableCell>
                        {w.isFrozen ? (
                          <div>
                            <Badge variant="destructive" className="text-xs">Frozen</Badge>
                            {w.frozenReason && <p className="text-xs text-muted-foreground mt-0.5 max-w-[150px] truncate">{w.frozenReason}</p>}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="outline" className="text-xs h-7"
                            onClick={() => { setAdjustTarget(w); setAdjustAmount(""); setAdjustNote(""); }}>
                            Adjust
                          </Button>
                          <Button size="sm" variant="outline" className={cn("text-xs h-7", w.isFrozen ? "text-green-600" : "text-red-600")}
                            onClick={() => { if (w.isFrozen) { updateWallet.mutate({ userId: w.userId, data: { isFrozen: false } }); } else { setFreezeTarget(w); setFreezeReason(""); } }}>
                            {w.isFrozen ? <><Unlock className="h-3 w-3 mr-1" />Unfreeze</> : <><Lock className="h-3 w-3 mr-1" />Freeze</>}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!adjustTarget} onOpenChange={(o) => { if (!o) setAdjustTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
            <DialogDescription>Adjust <strong>{adjustTarget?.name}</strong>'s balance. Use negative numbers to deduct.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Current Balance: {adjustTarget ? fmtNGN(adjustTarget.balance) : "—"}</Label>
              <Input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="e.g. 500 or -200" />
              <p className="text-xs text-muted-foreground">New balance: {fmtNGN(Math.max(0, (adjustTarget?.balance ?? 0) + (parseFloat(adjustAmount) || 0)))}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Reason / Note</Label>
              <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} placeholder="e.g. Manual correction" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustTarget(null)}>Cancel</Button>
            <Button
              disabled={!adjustAmount || adjustAmount === "0" || updateWallet.isPending}
              onClick={() => adjustTarget && updateWallet.mutate({ userId: adjustTarget.userId, data: { adjustAmount: parseFloat(adjustAmount), adjustNote } })}
            >
              {updateWallet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!freezeTarget} onOpenChange={(o) => { if (!o) setFreezeTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4 text-destructive" /> Freeze Wallet</DialogTitle>
            <DialogDescription>This will prevent <strong>{freezeTarget?.name}</strong> from withdrawing funds.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Reason (optional)</Label><Input value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} placeholder="e.g. Suspicious activity" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={updateWallet.isPending}
              onClick={() => freezeTarget && updateWallet.mutate({ userId: freezeTarget.userId, data: { isFrozen: true, frozenReason: freezeReason || null } })}>
              {updateWallet.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Freeze Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Security Center Tab ───────────────────────────────────────────────────────
export function SecurityTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newIp, setNewIp] = useState("");

  const { data: blockedData, isLoading } = useQuery<{ blockedIps: string[] }>({
    queryKey: ["/admin/security/blocked-ips"],
    queryFn: () => api("/admin/security/blocked-ips"),
  });

  const blockIp = useMutation({
    mutationFn: (ip: string) => api("/admin/security/blocked-ips", { method: "POST", body: JSON.stringify({ ip }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/security/blocked-ips"] }); toast({ title: "IP blocked" }); setNewIp(""); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const unblockIp = useMutation({
    mutationFn: (ip: string) => api(`/admin/security/blocked-ips/${encodeURIComponent(ip)}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/security/blocked-ips"] }); toast({ title: "IP unblocked" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const blockedIps = blockedData?.blockedIps ?? [];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-semibold">Security Center</h3>
        <p className="text-sm text-muted-foreground">Manage platform security settings and blocked access.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Platform Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "Audit Logging", description: "All admin actions are tracked in the audit log", enabled: true },
            { label: "Clerk Authentication", description: "Enterprise auth with MFA support via Clerk", enabled: true },
            { label: "Session Management", description: "Secure HTTP-only session cookies", enabled: true },
            { label: "IP Rate Limiting", description: "Automatic rate limiting on all API endpoints", enabled: true },
            { label: "CORS Protection", description: "Cross-Origin Resource Sharing policy enforced", enabled: true },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Active
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> IP Block List</CardTitle>
          <CardDescription>Block specific IP addresses from accessing the platform.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={newIp} onChange={(e) => setNewIp(e.target.value)} placeholder="Enter IP address (e.g. 192.168.1.1)" className="font-mono" onKeyDown={(e) => { if (e.key === "Enter" && newIp.trim()) blockIp.mutate(newIp.trim()); }} />
            <Button onClick={() => newIp.trim() && blockIp.mutate(newIp.trim())} disabled={!newIp.trim() || blockIp.isPending}>
              {blockIp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block"}
            </Button>
          </div>

          {isLoading ? <Skeleton className="h-20" /> : blockedIps.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
              No blocked IPs. Platform is open to all.
            </div>
          ) : (
            <div className="space-y-2">
              {blockedIps.map((ip) => (
                <div key={ip} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-red-500/5 border-red-500/20">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-sm font-mono">{ip}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs h-6 text-muted-foreground hover:text-destructive" onClick={() => unblockIp.mutate(ip)}>
                    {unblockIp.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Unblock"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-4 flex gap-3 items-start">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-semibold">Security Recommendations</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Enable 2FA on your Clerk admin account at dashboard.clerk.com</li>
              <li>Rotate your API keys periodically in Replit Secrets</li>
              <li>Review audit logs weekly for suspicious activity</li>
              <li>Keep admin email list in ADMIN_EMAILS env var up to date</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

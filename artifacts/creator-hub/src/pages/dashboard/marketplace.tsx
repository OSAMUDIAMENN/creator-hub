import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  ShoppingBag, Plus, Star, Clock, Package, Trash2, Edit, Search,
  Video, Palette, FileText, Share2, MessageSquare, BookOpen, Briefcase, Eye,
} from "lucide-react";
import { FileUploader } from "@/components/file-uploader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "video_editing", label: "Video Editing", icon: Video },
  { value: "graphic_design", label: "Graphic Design", icon: Palette },
  { value: "script_writing", label: "Script Writing", icon: FileText },
  { value: "social_media_management", label: "Social Media Management", icon: Share2 },
];

const SERVICE_TYPES = [
  { value: "all", label: "All Types" },
  { value: "service", label: "Service", icon: Briefcase },
  { value: "shoutout", label: "Shoutout", icon: MessageSquare },
  { value: "template", label: "Template", icon: BookOpen },
  { value: "consultation", label: "Consultation", icon: Eye },
];

const CATEGORY_LABELS: Record<string, string> = {
  video_editing: "Video Editing",
  graphic_design: "Graphic Design",
  script_writing: "Script Writing",
  social_media_management: "Social Media Mgmt",
};

const TYPE_COLORS: Record<string, string> = {
  service: "bg-blue-500/10 text-blue-600",
  shoutout: "bg-purple-500/10 text-purple-600",
  template: "bg-green-500/10 text-green-600",
  consultation: "bg-amber-500/10 text-amber-600",
};

type Listing = {
  id: number;
  category: string;
  serviceType: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  deliveryDays: number;
  imageUrl: string | null;
  fileUrl: string | null;
  totalOrders: number;
  rating: number | null;
  sellerName?: string;
  sellerUsername?: string;
  sellerProfileImage?: string | null;
  createdAt: string;
  isActive?: boolean;
};

function ListingCard({ listing, mine, onEdit, onDelete }: {
  listing: Listing;
  mine?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Card className="overflow-hidden hover:border-primary/40 transition-colors group">
      {listing.imageUrl && (
        <div className="h-36 overflow-hidden bg-muted">
          <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold line-clamp-1 text-sm">{listing.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{listing.description}</p>
          </div>
          {mine && (
            <div className="flex gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-xs ${TYPE_COLORS[listing.serviceType] ?? ""}`}>
            {listing.serviceType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {CATEGORY_LABELS[listing.category] ?? listing.category}
          </Badge>
        </div>

        {!mine && listing.sellerName && (
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5">
              <AvatarImage src={listing.sellerProfileImage ?? undefined} />
              <AvatarFallback className="text-[9px]">{listing.sellerName[0]}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">@{listing.sellerUsername}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="font-bold text-primary text-sm">
              {listing.price === 0 ? "Free" : `₦${Number(listing.price).toLocaleString()}`}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{listing.deliveryDays}d delivery</span>
              {listing.totalOrders > 0 && <span className="flex items-center gap-1"><Package className="h-3 w-3" />{listing.totalOrders} orders</span>}
              {listing.rating && <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{listing.rating.toFixed(1)}</span>}
            </div>
          </div>
          {!mine && (
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => window.open(`/${listing.sellerUsername}`, "_blank")}>
              View Profile
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const emptyForm = {
  category: "video_editing", serviceType: "service", title: "", description: "",
  price: "", deliveryDays: "3", imageUrl: "", fileUrl: "",
};

export default function MarketplacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("browse");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const params = new URLSearchParams();
  if (categoryFilter !== "all") params.set("category", categoryFilter);
  if (typeFilter !== "all") params.set("serviceType", typeFilter);

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: [`/marketplace`, categoryFilter, typeFilter],
    queryFn: () => fetch(`${BASE_URL}/api/marketplace?${params}`).then((r) => r.json()),
  });

  const { data: myListings = [], isLoading: loadingMine } = useQuery<Listing[]>({
    queryKey: ["/marketplace/my"],
    queryFn: () => fetch(`${BASE_URL}/api/marketplace/my`, { credentials: "include" }).then((r) => r.json()),
    enabled: tab === "my",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const url = editId ? `${BASE_URL}/api/marketplace/${editId}` : `${BASE_URL}/api/marketplace`;
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, price: parseInt(data.price) || 0, deliveryDays: parseInt(data.deliveryDays) || 3 }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/marketplace/my"] });
      queryClient.invalidateQueries({ queryKey: ["/marketplace"] });
      toast({ title: editId ? "Listing updated!" : "Listing created!" });
      setDialogOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${BASE_URL}/api/marketplace/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/marketplace/my"] });
      queryClient.invalidateQueries({ queryKey: ["/marketplace"] });
      toast({ title: "Listing deleted" });
    },
  });

  const openEdit = (listing: Listing) => {
    setEditId(listing.id);
    setForm({
      category: listing.category,
      serviceType: listing.serviceType,
      title: listing.title,
      description: listing.description,
      price: String(listing.price),
      deliveryDays: String(listing.deliveryDays),
      imageUrl: listing.imageUrl ?? "",
      fileUrl: listing.fileUrl ?? "",
    });
    setDialogOpen(true);
  };

  const filtered = listings.filter((l) =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShoppingBag className="h-8 w-8 text-primary" /> Marketplace
          </h1>
          <p className="text-muted-foreground mt-1">Buy and sell creator services, templates, and shoutouts.</p>
        </div>
        <Button onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Listing
        </Button>
      </div>

      <DashboardAdBanner count={1} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="browse">Browse Marketplace</TabsTrigger>
          <TabsTrigger value="my">My Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search listings..." className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <ShoppingBag className="h-12 w-12 opacity-20 mx-auto mb-3" />
              <p className="font-medium">No listings found</p>
              <p className="text-sm mt-1">Be the first to list a service!</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my" className="mt-4">
          {loadingMine ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
            </div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Package className="h-12 w-12 opacity-20 mx-auto mb-3" />
              <p className="font-medium">No listings yet</p>
              <p className="text-sm mt-1">Create your first listing to start selling.</p>
              <Button className="mt-4" onClick={() => { setEditId(null); setForm(emptyForm); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" /> Create Listing
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myListings.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  mine
                  onEdit={() => openEdit(l)}
                  onDelete={() => deleteMutation.mutate(l.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Listing" : "Create New Listing"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter((c) => c.value !== "all").map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={form.serviceType} onValueChange={(v) => setForm((f) => ({ ...f, serviceType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.filter((t) => t.value !== "all").map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Professional video editing for creators" />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe your service in detail..." rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Price (₦)</Label>
                <Input type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label>Delivery (days)</Label>
                <Input type="number" min="1" max="30" value={form.deliveryDays} onChange={(e) => setForm((f) => ({ ...f, deliveryDays: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cover Image</Label>
              <FileUploader
                label="Upload cover image"
                accept="image/*"
                maxSizeMB={5}
                variant="image"
                currentUrl={form.imageUrl}
                onUpload={(f) => setForm((prev) => ({ ...prev, imageUrl: f.url }))}
              />
            </div>

            {form.serviceType === "template" && (
              <div className="space-y-1.5">
                <Label>Template File</Label>
                <FileUploader
                  label="Upload template file"
                  maxSizeMB={50}
                  currentUrl={form.fileUrl}
                  onUpload={(f) => setForm((prev) => ({ ...prev, fileUrl: f.url }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending || !form.title || !form.description}>
              {saveMutation.isPending ? "Saving..." : editId ? "Update" : "Create Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

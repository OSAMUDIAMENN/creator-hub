import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListPosts,
  useCreatePost,
  useUpdatePost,
  useDeletePost,
  getListPostsQueryKey,
  Post,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, Pencil, Trash2, Calendar as CalendarIcon, MoreHorizontal,
  ChevronLeft, ChevronRight, Clock, CheckCircle2, FileText, AlertCircle, ImageIcon, X, Upload,
} from "lucide-react";
import { SiTiktok, SiInstagram, SiYoutube, SiFacebook, SiX } from "react-icons/si";
import { cn } from "@/lib/utils";
import { FileUploader } from "@/components/file-uploader";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  caption: z.string().optional(),
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook", "twitter"] as const),
  scheduledDate: z.string().optional(),
  status: z.enum(["draft", "scheduled", "published"] as const),
});

type PostFormData = z.infer<typeof postSchema>;

const PLATFORM_FILTERS = [
  { id: "all", label: "All" },
  { id: "tiktok", label: "TikTok", icon: SiTiktok },
  { id: "instagram", label: "Instagram", icon: SiInstagram },
  { id: "youtube", label: "YouTube", icon: SiYoutube },
  { id: "facebook", label: "Facebook", icon: SiFacebook },
  { id: "twitter", label: "X", icon: SiX },
];

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  tiktok: SiTiktok,
  instagram: SiInstagram,
  youtube: SiYoutube,
  facebook: SiFacebook,
  twitter: SiX,
};

const PLATFORM_COLORS: Record<string, string> = {
  tiktok: "bg-black",
  instagram: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400",
  youtube: "bg-red-600",
  facebook: "bg-blue-600",
  twitter: "bg-gray-900",
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  published: { label: "Published", color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2 },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  draft: { label: "Draft", color: "bg-muted text-muted-foreground border-border", icon: FileText },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Content Heatmap ──────────────────────────────────────────────────────────
function ContentHeatmap({ posts }: { posts: Post[] }) {
  const WEEKS = 16;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const countByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const post of posts) {
      const raw = post.scheduledDate || post.createdAt;
      if (!raw) continue;
      const d = new Date(raw);
      d.setHours(0, 0, 0, 0);
      const key = toDateKey(d);
      map[key] = (map[key] || 0) + 1;
    }
    return map;
  }, [posts]);

  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - today.getDay() - (WEEKS - 1) * 7);

  const weeks: Date[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }

  const maxCount = Math.max(1, ...Object.values(countByDay));

  function intensity(count: number): string {
    if (count === 0) return "bg-muted hover:bg-muted/80";
    const level = Math.ceil((count / maxCount) * 4);
    if (level >= 4) return "bg-primary hover:bg-primary/80";
    if (level === 3) return "bg-primary/70 hover:bg-primary/60";
    if (level === 2) return "bg-primary/40 hover:bg-primary/30";
    return "bg-primary/20 hover:bg-primary/15";
  }

  const monthLabels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, i) => {
    const m = week[0].getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ label: MONTH_LABELS[m].slice(0, 3), weekIdx: i });
      lastMonth = m;
    }
  });

  const totalPosts = Object.values(countByDay).reduce((a, b) => a + b, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Content Activity</CardTitle>
          <span className="text-xs text-muted-foreground">{totalPosts} posts in the last {WEEKS} weeks</span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex flex-col gap-1 min-w-max">
              <div className="flex gap-1 pl-8">
                {weeks.map((week, wi) => {
                  const ml = monthLabels.find((m) => m.weekIdx === wi);
                  return <div key={wi} className="w-3.5 text-[10px] text-muted-foreground">{ml ? ml.label : ""}</div>;
                })}
              </div>
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                <div key={dayIdx} className="flex items-center gap-1">
                  <span className="w-7 text-[10px] text-muted-foreground text-right pr-1 select-none">
                    {dayIdx % 2 === 1 ? DAY_LABELS[dayIdx] : ""}
                  </span>
                  {weeks.map((week, wi) => {
                    const day = week[dayIdx];
                    const key = toDateKey(day);
                    const count = countByDay[key] || 0;
                    const isFuture = day > today;
                    const isToday = toDateKey(day) === toDateKey(today);
                    return (
                      <Tooltip key={wi}>
                        <TooltipTrigger asChild>
                          <div className={cn(
                            "w-3.5 h-3.5 rounded-sm transition-colors cursor-default",
                            isFuture ? "bg-muted/40" : intensity(count),
                            isToday && "ring-1 ring-primary ring-offset-1"
                          )} />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p>
                          <p className="text-muted-foreground">{count === 0 ? "No posts" : `${count} post${count > 1 ? "s" : ""}`}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-3">
            <span className="text-[10px] text-muted-foreground">Less</span>
            {["bg-muted", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"].map((cls) => (
              <div key={cls} className={cn("w-3 h-3 rounded-sm", cls)} />
            ))}
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}

// ── Month Calendar View ──────────────────────────────────────────────────────
function MonthCalendar({ posts, onDayClick }: { posts: Post[]; onDayClick: (date: Date) => void }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const postsByDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of posts) {
      const raw = post.scheduledDate ?? post.createdAt;
      if (!raw) continue;
      const key = toDateKey(new Date(raw));
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
    return map;
  }, [posts]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toDateKey(new Date());

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{MONTH_LABELS[month]} {year}</CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} />;
            const key = toDateKey(date);
            const dayPosts = postsByDay[key] ?? [];
            const isToday = key === today;
            return (
              <button
                key={key}
                onClick={() => dayPosts.length > 0 && onDayClick(date)}
                className={cn(
                  "relative min-h-[52px] rounded-lg p-1 text-left border transition-all text-xs",
                  isToday ? "border-primary bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/40",
                  dayPosts.length > 0 && "cursor-pointer",
                  dayPosts.length === 0 && "cursor-default",
                )}
              >
                <span className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold mb-0.5",
                  isToday ? "bg-primary text-primary-foreground" : "text-foreground/70"
                )}>
                  {date.getDate()}
                </span>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 2).map((post) => {
                    const Icon = PLATFORM_ICONS[post.platform] ?? MoreHorizontal;
                    const statusMeta = STATUS_META[post.status] ?? STATUS_META.draft;
                    return (
                      <div
                        key={post.id}
                        className={cn("flex items-center gap-0.5 rounded px-1 py-0.5 border text-[10px] truncate", statusMeta.color)}
                      >
                        <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{post.title}</span>
                      </div>
                    );
                  })}
                  {dayPosts.length > 2 && (
                    <div className="text-[10px] text-muted-foreground pl-1">+{dayPosts.length - 2} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Day detail popover (shown on calendar cell click) ──────────────────────
function DayPostsDialog({
  date,
  posts,
  onClose,
  onEdit,
}: {
  date: Date | null;
  posts: Post[];
  onClose: () => void;
  onEdit: (post: Post) => void;
}) {
  return (
    <Dialog open={!!date} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {date?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {posts.map((post) => {
            const Icon = PLATFORM_ICONS[post.platform] ?? MoreHorizontal;
            const statusMeta = STATUS_META[post.status] ?? STATUS_META.draft;
            const StatusIcon = statusMeta.icon;
            return (
              <div key={post.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", PLATFORM_COLORS[post.platform] ?? "bg-muted")}>
                  <Icon className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  {post.caption && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{post.caption}</p>}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge className={cn("text-xs border gap-1", statusMeta.color)}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {statusMeta.label}
                    </Badge>
                    {post.scheduledDate && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(post.scheduledDate).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onEdit(post)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Post Form Dialog ─────────────────────────────────────────────────────────
function PostFormDialog({
  open,
  editingPost,
  defaultPlatform,
  onClose,
  onSuccess,
}: {
  open: boolean;
  editingPost: Post | null;
  defaultPlatform: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const { toast } = useToast();
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaInput, setMediaInput] = useState("");

  const form = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: { title: "", caption: "", platform: defaultPlatform as any, status: "draft", scheduledDate: "" },
  });

  React.useEffect(() => {
    if (open) {
      if (editingPost) {
        form.reset({
          title: editingPost.title,
          caption: editingPost.caption || "",
          platform: editingPost.platform as any,
          status: editingPost.status as any,
          scheduledDate: editingPost.scheduledDate ? new Date(editingPost.scheduledDate).toISOString().slice(0, 16) : "",
        });
        setMediaUrls((editingPost as any).mediaUrls ?? []);
      } else {
        form.reset({ title: "", caption: "", platform: defaultPlatform as any, status: "draft", scheduledDate: "" });
        setMediaUrls([]);
      }
      setMediaInput("");
    }
  }, [open, editingPost, defaultPlatform]);

  const addMediaUrl = () => {
    const url = mediaInput.trim();
    if (url && !mediaUrls.includes(url)) {
      setMediaUrls([...mediaUrls, url]);
      setMediaInput("");
    }
  };

  const onSubmit = (data: PostFormData) => {
    const payload = {
      ...data,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate).toISOString() : undefined,
      mediaUrls,
    };
    if (editingPost) {
      updatePost.mutate(
        { id: editingPost.id, data: payload as any },
        {
          onSuccess: () => { toast({ title: "Post updated" }); onSuccess(); },
          onError: () => toast({ title: "Update failed", variant: "destructive" }),
        }
      );
    } else {
      createPost.mutate(
        { data: payload as any },
        {
          onSuccess: () => { toast({ title: "Post created" }); onSuccess(); },
          onError: () => toast({ title: "Create failed", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPost ? "Edit Post" : "Create Post"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} placeholder="Product Launch Video" />
            {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Caption</Label>
            <Textarea id="caption" {...form.register("caption")} placeholder="Write your caption..." rows={4} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select defaultValue={form.getValues("platform")} onValueChange={(v) => form.setValue("platform", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="youtube">YouTube</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="twitter">X (Twitter)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select defaultValue={form.getValues("status")} onValueChange={(v) => form.setValue("status", v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Schedule Date & Time</Label>
            <Input id="scheduledDate" type="datetime-local" {...form.register("scheduledDate")} />
          </div>

          <div className="space-y-2">
            <Label>Media Files</Label>
            <FileUploader
              variant="file"
              accept="image/*,video/*,application/pdf"
              maxSizeMB={50}
              label="Upload media (image, video, PDF)"
              onUpload={(file) => {
                if (!mediaUrls.includes(file.url)) {
                  setMediaUrls((prev) => [...prev, file.url]);
                }
              }}
            />
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Or paste a URL..."
                value={mediaInput}
                onChange={(e) => setMediaInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMediaUrl(); } }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addMediaUrl} className="whitespace-nowrap">
                <ImageIcon className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {mediaUrls.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {mediaUrls.map((url, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-lg px-3 py-1.5 text-sm">
                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                      ? <img src={url} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                      : <ImageIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    <span className="flex-1 truncate text-xs text-muted-foreground">{url.split("/").pop()}</span>
                    <button type="button" onClick={() => setMediaUrls(mediaUrls.filter((_, j) => j !== i))}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createPost.isPending || updatePost.isPending}>
              {editingPost ? "Save Changes" : "Create Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Queue List View ──────────────────────────────────────────────────────────
function QueueView({ posts, onEdit, onDelete, isLoading }: {
  posts: Post[];
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
  isLoading: boolean;
}) {
  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  const scheduled = posts.filter(p => p.status === "scheduled").sort((a, b) => {
    const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
    const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
    return aDate - bDate;
  });
  const drafts = posts.filter(p => p.status === "draft");
  const published = posts.filter(p => p.status === "published");

  const Section = ({ title, items, icon: Icon, iconColor }: { title: string; items: Post[]; icon: React.ElementType; iconColor: string }) => (
    <div>
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconColor)} /> {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-6">None</p>
      ) : (
        <div className="space-y-2">
          {items.map((post) => {
            const PIcon = PLATFORM_ICONS[post.platform] ?? MoreHorizontal;
            const statusMeta = STATUS_META[post.status] ?? STATUS_META.draft;
            return (
              <Card key={post.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="p-4 flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <PIcon className="h-4 w-4" />
                      <span className="capitalize">{post.platform}</span>
                      {post.scheduledDate && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {new Date(post.scheduledDate).toLocaleString(undefined, {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    <h4 className="font-semibold truncate">{post.title}</h4>
                    {post.caption && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{post.caption}</p>}
                    {(post as any).publishError && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {(post as any).publishError}
                      </p>
                    )}
                    {(post as any).mediaUrls?.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" /> {(post as any).mediaUrls.length} media file{(post as any).mediaUrls.length > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <div className="bg-muted/30 p-3 sm:border-l flex sm:flex-col gap-2 items-center justify-end sm:justify-center">
                    <Badge className={cn("text-xs border whitespace-nowrap", statusMeta.color)}>
                      {statusMeta.label}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(post)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(post)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      <Section title="Scheduled" items={scheduled} icon={Clock} iconColor="text-blue-500" />
      <Section title="Drafts" items={drafts} icon={FileText} iconColor="text-muted-foreground" />
      <Section title="Published" items={published} icon={CheckCircle2} iconColor="text-green-500" />
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ContentPlanner() {
  const [platformFilter, setPlatformFilter] = useState("all");
  const [view, setView] = useState<"queue" | "calendar">("queue");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [deletingPost, setDeletingPost] = useState<Post | null>(null);
  const [calendarDayPosts, setCalendarDayPosts] = useState<{ date: Date; posts: Post[] } | null>(null);

  const platform = platformFilter === "all" ? undefined : platformFilter;
  const { data: posts, isLoading } = useListPosts(
    { platform } as any,
    { query: { queryKey: [...getListPostsQueryKey({ platform } as any), platformFilter] } }
  );
  const { data: allPosts } = useListPosts({} as any, { query: { queryKey: getListPostsQueryKey({} as any) } });

  const deletePost = useDeletePost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpenForm = (post?: Post) => {
    setEditingPost(post ?? null);
    setIsFormOpen(true);
  };

  const handleDelete = () => {
    if (!deletingPost) return;
    deletePost.mutate(
      { id: deletingPost.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          setDeletingPost(null);
          toast({ title: "Post deleted" });
        },
      }
    );
  };

  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    setIsFormOpen(false);
    setEditingPost(null);
  };

  const postsByDay = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of (allPosts ?? [])) {
      const raw = post.scheduledDate ?? post.createdAt;
      if (!raw) continue;
      const key = toDateKey(new Date(raw));
      if (!map[key]) map[key] = [];
      map[key].push(post);
    }
    return map;
  }, [allPosts]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Content Planner</h1>
          <p className="text-muted-foreground mt-1">Schedule and auto-publish across all your platforms.</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Create Post
        </Button>
      </div>

      <ContentHeatmap posts={allPosts ?? []} />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="overflow-x-auto">
          <Tabs value={platformFilter} onValueChange={setPlatformFilter}>
            <TabsList className="w-max">
              {PLATFORM_FILTERS.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="flex items-center gap-1.5 text-xs">
                  {p.icon && <p.icon className="h-3.5 w-3.5" />}
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex gap-1 border rounded-lg p-0.5 flex-shrink-0">
          <Button
            variant={view === "queue" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setView("queue")}
          >
            Queue
          </Button>
          <Button
            variant={view === "calendar" ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setView("calendar")}
          >
            <CalendarIcon className="h-3.5 w-3.5 mr-1" /> Calendar
          </Button>
        </div>
      </div>

      {view === "queue" ? (
        <QueueView
          posts={posts ?? []}
          onEdit={handleOpenForm}
          onDelete={setDeletingPost}
          isLoading={isLoading}
        />
      ) : (
        <MonthCalendar
          posts={allPosts ?? []}
          onDayClick={(date) => {
            const key = toDateKey(date);
            const dayPosts = postsByDay[key] ?? [];
            if (dayPosts.length > 0) setCalendarDayPosts({ date, posts: dayPosts });
          }}
        />
      )}

      <PostFormDialog
        open={isFormOpen}
        editingPost={editingPost}
        defaultPlatform={platformFilter !== "all" ? platformFilter : "instagram"}
        onClose={() => { setIsFormOpen(false); setEditingPost(null); }}
        onSuccess={handleFormSuccess}
      />

      {calendarDayPosts && (
        <DayPostsDialog
          date={calendarDayPosts.date}
          posts={calendarDayPosts.posts}
          onClose={() => setCalendarDayPosts(null)}
          onEdit={(post) => { setCalendarDayPosts(null); handleOpenForm(post); }}
        />
      )}

      <AlertDialog open={!!deletingPost} onOpenChange={(open) => !open && setDeletingPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Delete "{deletingPost?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

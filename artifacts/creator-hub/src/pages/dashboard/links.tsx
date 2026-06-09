import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListLinks, 
  useCreateLink, 
  useUpdateLink, 
  useDeleteLink,
  useGetProfile,
  getListLinksQueryKey
} from "@workspace/api-client-react";
import { Link as ApiLink } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Plus, GripVertical, Pencil, Trash2, ExternalLink, MousePointerClick } from "lucide-react";
import { FreemiumGate, FeatureUsageBadge } from "@/components/feature-limit";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const linkSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Must be a valid URL starting with http/https"),
  icon: z.string().optional(),
});

type LinkFormData = z.infer<typeof linkSchema>;

export default function LinksManager() {
  const { data: profile } = useGetProfile();
  const { data: links, isLoading } = useListLinks();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createLink = useCreateLink();
  const updateLink = useUpdateLink();
  const deleteLink = useDeleteLink();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<ApiLink | null>(null);
  const [deletingLink, setDeletingLink] = useState<ApiLink | null>(null);

  const form = useForm<LinkFormData>({
    resolver: zodResolver(linkSchema),
    defaultValues: {
      title: "",
      url: "",
      icon: "",
    },
  });

  const handleOpenForm = (link?: ApiLink) => {
    if (link) {
      setEditingLink(link);
      form.reset({
        title: link.title,
        url: link.url,
        icon: link.icon || "",
      });
    } else {
      setEditingLink(null);
      form.reset({ title: "", url: "", icon: "" });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: LinkFormData) => {
    if (editingLink) {
      updateLink.mutate(
        { id: editingLink.id, data: { ...data, isActive: editingLink.isActive } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Link updated" });
          },
        }
      );
    } else {
      createLink.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Link created" });
          },
        }
      );
    }
  };

  const handleToggleActive = (link: ApiLink, isActive: boolean) => {
    updateLink.mutate(
      { id: link.id, data: { isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deletingLink) return;
    deleteLink.mutate(
      { id: deletingLink.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLinksQueryKey() });
          setDeletingLink(null);
          toast({ title: "Link deleted" });
        },
      }
    );
  };

  const publicUrl = profile ? `${window.location.origin}/p/${profile.username}` : "";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Links</h1>
            <FeatureUsageBadge current={links?.length ?? 0} limit={5} label="links" />
          </div>
          <p className="text-muted-foreground mt-1">Manage your public bio links.</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Link
        </Button>
      </div>

      <DashboardAdBanner count={1} />

      {profile && (
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium">Your Public Profile</span>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1 text-sm">
                {publicUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      <FreemiumGate feature="links" freeLimit={5} currentCount={links?.length ?? 0} proFeatures={["unlimited links", "click analytics"]}>
      <div className="space-y-3">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : links?.length === 0 ? (
          <div className="text-center p-12 border border-dashed rounded-lg text-muted-foreground">
            No links added yet. Click "Add Link" to get started.
          </div>
        ) : (
          (Array.isArray(links) ? links : []).map((link) => (
            <Card key={link.id} className={link.isActive ? "" : "opacity-60"}>
              <CardContent className="p-4 flex items-center gap-4">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab hidden sm:block" />
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{link.title}</h3>
                  <a href={link.url} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary hover:underline truncate block">
                    {link.url}
                  </a>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="hidden sm:flex flex-col items-end text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> {link.clicks} clicks</span>
                  </div>
                  
                  <Switch 
                    checked={link.isActive} 
                    onCheckedChange={(checked) => handleToggleActive(link, checked)} 
                  />
                  
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenForm(link)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingLink(link)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </FreemiumGate>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLink ? "Edit Link" : "Add Link"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...form.register("title")} placeholder="My Awesome Link" />
              {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input id="url" {...form.register("url")} placeholder="https://example.com" />
              {form.formState.errors.url && <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon">Icon URL (Optional)</Label>
              <Input id="icon" {...form.register("icon")} placeholder="https://example.com/icon.png" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createLink.isPending || updateLink.isPending}>
                {editingLink ? "Save Changes" : "Create Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingLink} onOpenChange={(open) => !open && setDeletingLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingLink?.title}"? This action cannot be undone.
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

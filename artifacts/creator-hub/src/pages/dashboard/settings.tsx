import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetProfile, 
  useUpdateProfile, 
  getGetProfileQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, User, Link as LinkIcon, Palette, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { FileUploader } from "@/components/file-uploader";
import { cn } from "@/lib/utils";

const PROFILE_THEMES = [
  { id: "default", name: "Default", desc: "Clean white background", preview: "bg-white border border-gray-200" },
  { id: "gradient", name: "Gradient", desc: "Warm orange gradient header", preview: "bg-gradient-to-br from-orange-500 to-amber-400" },
  { id: "dark", name: "Dark", desc: "Sleek dark background", preview: "bg-gray-950 border border-gray-700" },
  { id: "minimal", name: "Minimal", desc: "Ultra-clean typography", preview: "bg-gray-50 border border-gray-100" },
  { id: "vibrant", name: "Vibrant", desc: "Bold purple-to-orange", preview: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" },
];

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores allowed"),
  bio: z.string().max(160, "Bio max 160 characters").optional(),
  whatsappNumber: z.string().optional(),
  profileImage: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  theme: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export default function Settings() {
  const { data: profile, isLoading } = useGetProfile();
  const updateProfile = useUpdateProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      username: "",
      bio: "",
      whatsappNumber: "",
      profileImage: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        username: profile.username,
        bio: profile.bio || "",
        whatsappNumber: profile.whatsappNumber || "",
        profileImage: profile.profileImage || "",
        theme: (profile as any).theme || "default",
      });
    }
  }, [profile, form]);

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(
      { data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
          toast({ title: "Profile updated successfully" });
        },
        onError: () => {
          toast({ title: "Failed to update profile", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading settings...</div>;
  }

  const publicUrl = profile ? `${window.location.origin}/${profile.username}` : "";
  const previewName = form.watch("name") || "Your Name";
  const previewBio = form.watch("bio") || "Your bio will appear here...";
  const previewImage = form.watch("profileImage");

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your public profile and preferences.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_300px] gap-8">
        {/* Settings Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Public Profile
              </CardTitle>
              <CardDescription>
                This information will be displayed on your public link-in-bio page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-3">
                  <Label>Profile Picture</Label>
                  <div className="flex gap-4 items-start">
                    <Avatar className="h-20 w-20 border-2 border-border flex-shrink-0">
                      <AvatarImage src={previewImage || undefined} />
                      <AvatarFallback className="text-2xl">{previewName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <FileUploader
                        variant="image"
                        accept="image/*"
                        maxSizeMB={5}
                        label="Upload photo"
                        currentUrl={previewImage || undefined}
                        onUpload={(file) => form.setValue("profileImage", file.url, { shouldDirty: true })}
                      />
                      <p className="text-xs text-muted-foreground">Or paste a URL:</p>
                      <Input
                        id="profileImage"
                        {...form.register("profileImage")}
                        placeholder="https://..."
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  {form.formState.errors.profileImage && <p className="text-sm text-destructive">{form.formState.errors.profileImage.message}</p>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" {...form.register("name")} />
                    {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" {...form.register("username")} />
                    {form.formState.errors.username && <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea id="bio" {...form.register("bio")} rows={3} placeholder="Tell your audience about yourself..." />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>{form.formState.errors.bio?.message || ""}</span>
                    <span>{form.watch("bio")?.length || 0}/160</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsappNumber">WhatsApp Number (Optional)</Label>
                  <Input id="whatsappNumber" {...form.register("whatsappNumber")} placeholder="+1234567890" />
                  <p className="text-xs text-muted-foreground">Include country code. Adds a WhatsApp button to your profile.</p>
                </div>

                <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? "Saving..." : "Save Profile"}
                  <Save className="h-4 w-4 ml-2" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" /> Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dashboard Theme</Label>
                  <p className="text-sm text-muted-foreground mt-1">Select your preferred interface theme.</p>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" /> Profile Page Theme
              </CardTitle>
              <CardDescription>Choose how your public link-in-bio page looks to visitors.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PROFILE_THEMES.map((t) => {
                  const selected = (form.watch("theme") || "default") === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        form.setValue("theme", t.id, { shouldDirty: true });
                        updateProfile.mutate(
                          { data: { ...form.getValues(), theme: t.id } as any },
                          {
                            onSuccess: () => {
                              queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
                              toast({ title: `Profile theme changed to "${t.name}"` });
                            },
                          }
                        );
                      }}
                      className={cn(
                        "relative rounded-xl overflow-hidden border-2 transition-all text-left group",
                        selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className={`h-14 w-full ${t.preview}`} />
                      <div className="p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">{t.name}</p>
                          {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">Clicking a theme saves it immediately. <a href={`/${profile?.username}`} target="_blank" className="text-primary hover:underline">Preview your profile →</a></p>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview & Links */}
        <div className="space-y-6">
          <Card className="overflow-hidden border-2 border-primary/20">
            <div className="bg-primary/10 px-4 py-3 flex items-center justify-between text-sm font-medium border-b border-primary/20">
              <span className="flex items-center gap-2 text-primary"><LinkIcon className="h-4 w-4" /> Live Preview</span>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="hover:underline text-muted-foreground">View public</a>
            </div>
            <CardContent className="p-6 bg-card text-center flex flex-col items-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg mb-4">
                <AvatarImage src={previewImage || undefined} />
                <AvatarFallback className="text-2xl">{previewName.charAt(0)}</AvatarFallback>
              </Avatar>
              <h3 className="font-bold text-xl">{previewName}</h3>
              <p className="text-sm text-primary mb-3">@{form.watch("username") || "username"}</p>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-3">{previewBio}</p>
              
              <div className="w-full space-y-2 opacity-50 pointer-events-none">
                <div className="h-12 w-full bg-muted rounded-md flex items-center justify-center text-sm font-medium">Link 1</div>
                <div className="h-12 w-full bg-muted rounded-md flex items-center justify-center text-sm font-medium">Link 2</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

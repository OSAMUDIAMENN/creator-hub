import React, { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useGetPublicProfile, useTrackLinkClick, getGetPublicProfileQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MessageCircle, ExternalLink, Share2, ShoppingBag, Loader2, Download, Eye, Star, Play, FileText as FilePdf, ImageIcon, Film, Archive, FileType, BadgeCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SponsoredCard } from "@/components/ui/ad-slot";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Product = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  imageUrl?: string | null;
  fileUrl?: string | null;
};

function detectFileType(url?: string | null): "image" | "video" | "audio" | "pdf" | "zip" | "doc" | "unknown" {
  if (!url) return "unknown";
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(lower)) return "image";
  if (/\.(mp4|webm|ogg|mov|avi|mkv)$/.test(lower)) return "video";
  if (/\.(mp3|wav|aac|ogg|flac)$/.test(lower)) return "audio";
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) return "zip";
  if (/\.(doc|docx|txt|rtf|odt)$/.test(lower)) return "doc";
  return "unknown";
}

function FileTypePreview({ fileUrl, productName }: { fileUrl?: string | null; productName: string }) {
  const type = detectFileType(fileUrl);
  if (type === "video") {
    return (
      <div className="rounded-xl overflow-hidden bg-black">
        <video
          src={fileUrl!}
          controls
          preload="metadata"
          className="w-full max-h-48 object-contain"
        >
          Your browser does not support video preview.
        </video>
        <p className="text-[10px] text-white/50 text-center py-1">Preview clip — full file available after purchase</p>
      </div>
    );
  }
  const iconMap = {
    pdf: <FilePdf className="h-10 w-10 text-red-500" />,
    zip: <Archive className="h-10 w-10 text-yellow-500" />,
    doc: <FileType className="h-10 w-10 text-blue-500" />,
    audio: <Play className="h-10 w-10 text-purple-500" />,
    image: <ImageIcon className="h-10 w-10 text-green-500" />,
    unknown: <Film className="h-10 w-10 text-muted-foreground" />,
  };
  const labelMap = {
    pdf: "PDF Document",
    zip: "ZIP Archive",
    doc: "Document",
    audio: "Audio File",
    image: "Image File",
    unknown: "Digital File",
  };
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30 py-6">
      {iconMap[type as keyof typeof iconMap]}
      <div className="text-center">
        <p className="text-sm font-semibold">{labelMap[type as keyof typeof labelMap]}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{productName}</p>
      </div>
      <p className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Download after purchase</p>
    </div>
  );
}

type AdData = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaUrl: string;
  ctaText: string;
  advertiserName: string;
} | null;

const PROFILE_THEMES: Record<string, { bg: string; card: string; headerBg: string; text: string; subText: string; buttonClass: string; }> = {
  default: {
    bg: "bg-background text-foreground",
    headerBg: "",
    card: "bg-card border border-border/50",
    text: "text-foreground",
    subText: "text-muted-foreground",
    buttonClass: "",
  },
  gradient: {
    bg: "bg-gradient-to-b from-orange-50 to-background text-foreground",
    headerBg: "bg-gradient-to-br from-orange-500 to-amber-400 text-white rounded-3xl p-6 mb-2 -mx-0",
    card: "bg-white border border-orange-100 shadow-sm",
    text: "text-gray-900",
    subText: "text-gray-600",
    buttonClass: "bg-gradient-to-r from-orange-500 to-amber-400 text-white hover:opacity-90 border-0",
  },
  dark: {
    bg: "bg-gray-950 text-white",
    headerBg: "",
    card: "bg-gray-900 border border-gray-800",
    text: "text-white",
    subText: "text-gray-400",
    buttonClass: "bg-gray-800 text-white hover:bg-gray-700 border-gray-700",
  },
  minimal: {
    bg: "bg-white text-gray-900",
    headerBg: "",
    card: "bg-gray-50 border-0 shadow-none",
    text: "text-gray-900",
    subText: "text-gray-500",
    buttonClass: "bg-black text-white hover:bg-gray-800 border-0 rounded-none",
  },
  vibrant: {
    bg: "bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 text-white min-h-screen",
    headerBg: "",
    card: "bg-white/10 backdrop-blur border border-white/20",
    text: "text-white",
    subText: "text-white/70",
    buttonClass: "bg-white text-purple-700 hover:bg-white/90 border-0 font-bold",
  },
};

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const { data: profile, isLoading, isError } = useGetPublicProfile(username!, {
    query: {
      queryKey: getGetPublicProfileQueryKey(username!),
      retry: 1,
      enabled: !!username,
    }
  });

  const trackClick = useTrackLinkClick();
  const { toast } = useToast();

  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [ads, setAds] = useState<NonNullable<AdData>[]>([]);
  const [adIndex, setAdIndex] = useState(0);

  useEffect(() => {
    if (!username) return;
    fetch(`${BASE_URL}/api/public-ads/active?limit=5`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAds(data);
        else if (data && typeof data === "object" && data.id) setAds([data]);
      })
      .catch(() => {});
  }, [username]);

  // Rotate ads every 10 seconds
  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = setInterval(() => setAdIndex((i) => (i + 1) % ads.length), 10000);
    return () => clearInterval(timer);
  }, [ads.length]);

  const ad = ads[adIndex] ?? null;

  const handleLinkClick = (linkId: number, url: string) => {
    trackClick.mutate({ id: linkId });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: profile?.name || "Creator Profile", url }); }
      catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard" });
    }
  };

  const openPreview = (product: Product) => {
    setPreviewProduct(product);
  };

  const openCheckout = (product: Product) => {
    if (product.price === 0) {
      if (product.fileUrl) {
        window.open(product.fileUrl, "_blank");
        handleFreeDownload(product.id);
      } else {
        toast({ title: "No file attached to this product." });
      }
      return;
    }
    setPreviewProduct(null);
    setCheckoutProduct(product);
    setBuyerEmail("");
    setBuyerName("");
  };

  const handleFreeDownload = async (productId: number) => {
    try {
      await fetch(`${BASE_URL}/api/paystack/product/${productId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "free@download.app", buyerName: "Free Download" }),
      });
    } catch {}
  };

  const handleBuyNow = async () => {
    if (!checkoutProduct) return;
    if (!buyerName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }
    if (!buyerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail)) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    setCheckingOut(true);
    try {
      const res = await fetch(`${BASE_URL}/api/paystack/product/${checkoutProduct.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: buyerEmail, buyerName: buyerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      if (data.free && data.fileUrl) {
        window.open(data.fileUrl, "_blank");
        setCheckoutProduct(null);
        return;
      }
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
      setCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8 text-center animate-pulse">
          <Skeleton className="h-28 w-28 rounded-full mx-auto" />
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <div className="space-y-4 pt-8">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-4xl font-bold mb-2">Profile Not Found</h1>
        <p className="text-muted-foreground mb-8">This creator page doesn't exist or has been removed.</p>
        <Button onClick={() => window.location.href = "/"}>Go to CreatorHub</Button>
      </div>
    );
  }

  const themeKey = (profile as any).theme || "default";
  const t = PROFILE_THEMES[themeKey] ?? PROFILE_THEMES.default;

  return (
    <div className={`min-h-[100dvh] ${t.bg} py-12 px-4 selection:bg-primary selection:text-primary-foreground`}>
      <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Header */}
        <div className="text-center space-y-4 relative">
          <Button variant="ghost" size="icon" className="absolute right-0 top-0 rounded-full" onClick={handleShare}>
            <Share2 className="h-4 w-4" />
          </Button>

          <Avatar className="h-28 w-28 mx-auto border-4 border-background shadow-xl ring-2 ring-primary/20">
            <AvatarImage src={profile.profileImage || undefined} />
            <AvatarFallback className="text-3xl bg-primary/10 text-primary">
              {profile.name.charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
              {profile.name}
              {(profile as any).role === "verified_creator" && (
                <BadgeCheck className="h-5 w-5 text-primary shrink-0" title="Verified Creator" />
              )}
            </h1>
            <p className="text-sm font-medium text-primary mt-1">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="text-muted-foreground whitespace-pre-wrap px-4">{profile.bio}</p>
          )}

          {profile.whatsappNumber && (
            <div className="pt-2">
              <Button
                variant="outline"
                className="rounded-full border-green-500/30 hover:bg-green-500/10 hover:text-green-600 transition-colors"
                onClick={() => window.open(`https://wa.me/${profile.whatsappNumber?.replace(/\D/g, '')}`, '_blank')}
              >
                <MessageCircle className="h-4 w-4 mr-2 text-green-500" />
                Chat on WhatsApp
              </Button>
            </div>
          )}
        </div>

        {/* Links */}
        {profile.links && profile.links.length > 0 && (
          <div className="space-y-4 pt-4">
            {profile.links.map((link) => (
              <button
                key={link.id}
                onClick={() => handleLinkClick(link.id, link.url)}
                className={`w-full group relative flex items-center justify-center p-4 min-h-[60px] rounded-xl transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] ${t.buttonClass || "bg-card hover:bg-accent border border-border/50"}`}
              >
                <span className="font-semibold text-center w-full px-8">{link.title}</span>
                <ExternalLink className="absolute right-4 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {/* Sponsored Ad */}
        {ad && (
          <div className="pt-2">
            <SponsoredCard
              title={ad.title}
              description={ad.description ?? ""}
              ctaText={ad.ctaText}
              ctaUrl={ad.ctaUrl}
              imageUrl={ad.imageUrl ?? undefined}
              label={`Sponsored · ${ad.advertiserName}`}
            />
          </div>
        )}

        {/* Store */}
        {profile.products && profile.products.length > 0 && (
          <div className="pt-8 space-y-4">
            <div className="flex items-center gap-2 justify-center pb-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Store</h2>
            </div>

            <div className="grid gap-4">
              {profile.products.map((product) => (
                <Card
                  key={product.id}
                  className="overflow-hidden hover:border-primary/50 transition-colors group cursor-pointer"
                  onClick={() => openPreview(product as Product)}
                >
                  {product.imageUrl && (
                    <div className="h-48 w-full overflow-hidden bg-muted relative">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </div>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg line-clamp-1 pr-4">{product.name}</h3>
                      <span className="font-bold shrink-0 text-primary bg-primary/10 px-2 py-1 rounded-md text-sm">
                        {product.price === 0 ? "Free" : `₦${Number(product.price).toLocaleString()}`}
                      </span>
                    </div>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{product.description}</p>
                    )}
                    <Button
                      className="w-full rounded-xl"
                      variant={product.price === 0 ? "outline" : "default"}
                      onClick={(e) => { e.stopPropagation(); openPreview(product as Product); }}
                    >
                      {product.price === 0 ? (
                        <><Eye className="h-4 w-4 mr-2" />Preview & Download</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-2" />Preview — ₦{Number(product.price).toLocaleString()}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="pb-12 pt-8 text-center">
          <a href="/" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors font-medium flex items-center justify-center gap-2">
            <img src="/logo.svg" alt="CreatorHub" className="h-4 w-4 opacity-50" />
            Powered by CreatorHub
          </a>
        </div>
      </div>

      {/* Product Preview Dialog */}
      <Dialog open={!!previewProduct} onOpenChange={(open) => { if (!open) setPreviewProduct(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          {/* Cover image or file-type preview */}
          {previewProduct?.imageUrl ? (
            <div className="h-56 w-full overflow-hidden bg-muted">
              <img src={previewProduct.imageUrl} alt={previewProduct.name} className="w-full h-full object-cover" />
            </div>
          ) : previewProduct?.fileUrl ? (
            <div className="p-4 pb-0">
              <FileTypePreview fileUrl={previewProduct.fileUrl} productName={previewProduct.name} />
            </div>
          ) : null}

          <div className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold leading-tight">{previewProduct?.name}</h2>
              <Badge className="shrink-0 text-sm font-bold bg-primary/10 text-primary border-primary/20 px-2.5 py-1">
                {previewProduct?.price === 0 ? "Free" : `₦${Number(previewProduct?.price ?? 0).toLocaleString()}`}
              </Badge>
            </div>
            {previewProduct?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{previewProduct.description}</p>
            )}

            {/* File type badge */}
            {previewProduct?.fileUrl && (() => {
              const ft = detectFileType(previewProduct.fileUrl);
              const labels: Record<string, string> = { pdf: "PDF Document", video: "Video File", audio: "Audio File", zip: "ZIP Archive", doc: "Document", image: "Image File", unknown: "Digital File" };
              return (
                <div className="flex items-center gap-2 text-xs font-medium bg-muted/60 rounded-lg px-3 py-2">
                  <FileType className="h-3.5 w-3.5 text-primary" />
                  {labels[ft]} · {previewProduct.price === 0 ? "Download immediately" : "Download link sent by email"}
                </div>
              );
            })()}

            {!previewProduct?.fileUrl && previewProduct?.price !== 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <Star className="h-3.5 w-3.5 text-primary" />
                Digital product — download link sent to your email after payment
              </div>
            )}
          </div>

          <div className="px-5 pb-5 space-y-2">
            <Button className="w-full rounded-xl" onClick={() => previewProduct && openCheckout(previewProduct)}>
              {previewProduct?.price === 0 ? (
                <><Download className="h-4 w-4 mr-2" />Download Free</>
              ) : (
                <><ShoppingBag className="h-4 w-4 mr-2" />Buy Now — ₦{Number(previewProduct?.price ?? 0).toLocaleString()}</>
              )}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setPreviewProduct(null)}>Back</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={!!checkoutProduct} onOpenChange={(open) => { if (!open && !checkingOut) setCheckoutProduct(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Complete Your Purchase</DialogTitle>
            <DialogDescription>
              You're buying <span className="font-semibold text-foreground">{checkoutProduct?.name}</span> for{" "}
              <span className="font-semibold text-primary">₦{Number(checkoutProduct?.price ?? 0).toLocaleString()}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="buyer-name">Your Name</Label>
              <Input
                id="buyer-name"
                type="text"
                placeholder="John Doe"
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                disabled={checkingOut}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer-email">Your Email</Label>
              <Input
                id="buyer-email"
                type="email"
                placeholder="you@example.com"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleBuyNow()}
                disabled={checkingOut}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              You'll be redirected to Paystack to complete payment securely. Your download link will appear after payment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutProduct(null)} disabled={checkingOut}>Cancel</Button>
            <Button onClick={handleBuyNow} disabled={checkingOut}>
              {checkingOut ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Redirecting...</> : "Pay with Paystack"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

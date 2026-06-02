import React, { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type Ad = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ctaUrl: string;
  ctaText: string;
  advertiserName: string;
};

interface DashboardAdBannerProps {
  count?: number;
  className?: string;
  layout?: "row" | "card";
}

export function DashboardAdBanner({ count = 2, className, layout = "card" }: DashboardAdBannerProps) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${BASE_URL}/api/public-ads/active?limit=${count}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAds(data);
        else if (data && typeof data === "object") setAds([data]);
      })
      .catch(() => {});
  }, [count]);

  const visible = ads.filter((ad) => !dismissed.has(ad.id));
  if (visible.length === 0) return null;

  if (layout === "row") {
    return (
      <div className={cn("flex gap-3 overflow-x-auto pb-1", className)}>
        {visible.map((ad) => (
          <div
            key={ad.id}
            className="flex-shrink-0 flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 min-w-[260px] max-w-xs relative group"
          >
            <button
              onClick={() => setDismissed((d) => new Set(d).add(ad.id))}
              className="absolute top-2 right-2 h-5 w-5 rounded-full bg-muted/80 hover:bg-muted flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
            {ad.imageUrl && (
              <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                <img src={ad.imageUrl} alt={ad.title} className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Sponsored</span>
              </div>
              <p className="text-xs font-semibold truncate">{ad.title}</p>
              <a
                href={ad.ctaUrl}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
              >
                {ad.ctaText} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("grid gap-3", visible.length > 1 ? "sm:grid-cols-2" : "grid-cols-1", className)}>
      {visible.map((ad) => (
        <div
          key={ad.id}
          className="relative rounded-xl border border-border/50 bg-card overflow-hidden group hover:border-primary/30 transition-colors"
        >
          <button
            onClick={() => setDismissed((d) => new Set(d).add(ad.id))}
            className="absolute top-2 right-2 z-10 h-6 w-6 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
          {ad.imageUrl && (
            <div className="h-24 w-full bg-muted overflow-hidden">
              <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
          )}
          <div className="p-3">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider border border-border rounded px-1 py-0.5">
                Ad · {ad.advertiserName}
              </span>
            </div>
            <p className="text-sm font-semibold leading-snug mb-1">{ad.title}</p>
            {ad.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{ad.description}</p>
            )}
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {ad.ctaText} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

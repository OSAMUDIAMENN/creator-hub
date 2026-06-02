import React from "react";
import { cn } from "@/lib/utils";

export type AdSlotSize = "banner" | "leaderboard" | "rectangle" | "sidebar" | "sponsored";

const AD_SLOT_SIZES: Record<AdSlotSize, { width: number; height: number; label: string }> = {
  banner: { width: 468, height: 60, label: "Banner (468×60)" },
  leaderboard: { width: 728, height: 90, label: "Leaderboard (728×90)" },
  rectangle: { width: 300, height: 250, label: "Rectangle (300×250)" },
  sidebar: { width: 160, height: 600, label: "Sidebar (160×600)" },
  sponsored: { width: 0, height: 0, label: "Sponsored Placement" },
};

interface AdSlotProps {
  slotId: string;
  size?: AdSlotSize;
  className?: string;
  adminMode?: boolean;
  publisherCode?: string;
}

export function AdSlot({
  slotId,
  size = "rectangle",
  className,
  adminMode = false,
  publisherCode,
}: AdSlotProps) {
  const config = AD_SLOT_SIZES[size];

  if (adminMode) {
    return (
      <div
        className={cn(
          "border-2 border-dashed border-yellow-400/60 bg-yellow-400/5 rounded-lg flex flex-col items-center justify-center gap-1 text-yellow-600 dark:text-yellow-400 text-xs font-medium p-3",
          className
        )}
        style={size !== "sponsored" ? { minWidth: Math.min(config.width, 400), minHeight: config.height } : { minHeight: 80 }}
        data-ad-slot={slotId}
        data-ad-size={size}
      >
        <div className="font-bold uppercase tracking-wider text-[10px] opacity-70">Ad Slot</div>
        <div className="opacity-80">{config.label}</div>
        <div className="opacity-50 font-mono text-[9px]">{slotId}</div>
      </div>
    );
  }

  if (publisherCode) {
    return (
      <div
        className={cn("flex items-center justify-center overflow-hidden", className)}
        data-ad-slot={slotId}
        style={size !== "sponsored" ? { minHeight: config.height } : undefined}
      >
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: size !== "sponsored" ? config.width : "100%", height: size !== "sponsored" ? config.height : "auto" }}
          data-ad-client={publisherCode}
          data-ad-slot={slotId}
          data-ad-format={size === "leaderboard" || size === "banner" ? "horizontal" : "auto"}
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  return null;
}

interface SponsoredCardProps {
  title: string;
  description: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl?: string;
  label?: string;
  className?: string;
}

export function SponsoredCard({
  title,
  description,
  ctaText,
  ctaUrl,
  imageUrl,
  label = "Sponsored",
  className,
}: SponsoredCardProps) {
  return (
    <div className={cn("border rounded-lg overflow-hidden bg-card hover:border-primary/40 transition-colors", className)}>
      {imageUrl && (
        <div className="h-32 w-full bg-muted overflow-hidden">
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider border rounded px-1.5 py-0.5">
            {label}
          </span>
        </div>
        <h3 className="font-semibold text-sm mb-1">{title}</h3>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          {ctaText} →
        </a>
      </div>
    </div>
  );
}

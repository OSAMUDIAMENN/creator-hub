import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, Image, Film, Archive, Loader2, CheckCircle2, FileType, Music } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACCEPTED_TYPES: Record<string, string[]> = {
  "image/*": ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  "video/*": ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/avi"],
  "audio/*": ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac"],
  "application/pdf": ["application/pdf"],
  ".zip,.rar": ["application/zip", "application/x-rar-compressed", "application/x-zip-compressed"],
};

function expandAccept(accept?: string): string[] | null {
  if (!accept) return null;
  const parts = accept.split(",").map((s) => s.trim());
  const types: string[] = [];
  for (const part of parts) {
    if (ACCEPTED_TYPES[part]) types.push(...ACCEPTED_TYPES[part]);
    else types.push(part);
  }
  return types;
}

export interface UploadedFile {
  objectPath: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface FileUploaderProps {
  onUpload: (file: UploadedFile) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  currentUrl?: string;
  className?: string;
  variant?: "image" | "file";
  disabled?: boolean;
}

function getFileIcon(type: string, className = "h-5 w-5") {
  if (type.startsWith("image/")) return <Image className={className} />;
  if (type.startsWith("video/")) return <Film className={className} />;
  if (type.startsWith("audio/")) return <Music className={className} />;
  if (type === "application/pdf") return <FileType className={className} />;
  if (type.includes("zip") || type.includes("rar") || type.includes("archive") || type.includes("compressed"))
    return <Archive className={className} />;
  return <FileText className={className} />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export function FileUploader({
  onUpload,
  accept,
  maxSizeMB = 100,
  label = "Upload File",
  currentUrl,
  className,
  variant = "file",
  disabled = false,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const acceptedTypes = expandAccept(accept);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeMB * 1024 * 1024)
      return `File must be under ${maxSizeMB}MB (yours is ${formatBytes(file.size)})`;
    if (acceptedTypes && !acceptedTypes.includes(file.type))
      return `File type not allowed. Accepted: ${accept}`;
    return null;
  };

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); return; }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }

    setUploading(true);
    setProgress(2);

    try {
      const urlRes = await fetch(`${BASE_URL}/api/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });

      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.error ?? "Failed to get upload URL");
      }
      const { uploadURL, objectPath } = await urlRes.json();

      await uploadWithProgress(uploadURL, file, (pct) => {
        setProgress(Math.round(5 + pct * 0.88));
      });

      setProgress(95);

      const serveUrl = `${BASE_URL}/api/storage${objectPath}`;

      await fetch(`${BASE_URL}/api/uploads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fileName: objectPath.split("/").pop(),
          originalName: file.name,
          fileUrl: serveUrl,
          fileType: file.type.split("/")[0],
          mimeType: file.type,
          fileSize: file.size,
          folder: variant === "image" ? "images" : "products",
        }),
      });

      setProgress(100);
      const result: UploadedFile = { objectPath, url: serveUrl, name: file.name, size: file.size, type: file.type };
      setUploadedFile(result);
      onUpload(result);
    } catch (err: any) {
      setError(err.message ?? "Upload failed. Please try again.");
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, [accept, maxSizeMB, variant, onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, uploading, handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) setIsDragging(true);
  }, [disabled, uploading]);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const reset = () => {
    setUploadedFile(null);
    setProgress(0);
    setPreviewUrl(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const displayName = uploadedFile?.name ?? (currentUrl ? currentUrl.split("/").pop() ?? currentUrl : null);
  const hasFile = !!uploadedFile || !!currentUrl;

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!hasFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-all text-center min-h-[120px]",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            (disabled || uploading) ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          )}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          ) : isDragging ? (
            <Upload className="h-8 w-8 text-primary animate-bounce" />
          ) : (
            <div className="p-3 rounded-full bg-muted">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{uploading ? "Uploading…" : label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isDragging ? "Drop to upload" : `Drag & drop or click to browse · max ${maxSizeMB}MB`}
            </p>
            {accept && (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                Accepted: {accept.replace(/,/g, ", ")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-muted/20">
          {previewUrl && (
            <div className="h-40 w-full overflow-hidden bg-muted">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}
          {!previewUrl && uploadedFile?.type?.startsWith("video/") && (
            <div className="h-16 w-full bg-muted flex items-center justify-center">
              <Film className="h-6 w-6 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground ml-2">Video file</span>
            </div>
          )}
          <div className="flex items-center gap-3 p-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {uploadedFile ? getFileIcon(uploadedFile.type) : <FileText className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{displayName}</p>
              {uploadedFile && (
                <p className="text-xs text-muted-foreground">{formatBytes(uploadedFile.size)}</p>
              )}
            </div>
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={reset}
              disabled={uploading}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {uploading && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{progress}%</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
          <X className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}

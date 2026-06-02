import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, FileText, Image, Film, Archive, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

interface UploadedFile {
  objectPath: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

interface FileUploaderProps {
  onUpload: (file: UploadedFile) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  currentUrl?: string;
  className?: string;
  variant?: "image" | "file";
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (type.startsWith("video/")) return <Film className="h-4 w-4" />;
  if (type.includes("zip") || type.includes("archive") || type.includes("compressed")) return <Archive className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploader({
  onUpload,
  accept,
  maxSizeMB = 50,
  label = "Upload File",
  currentUrl,
  className,
  variant = "file",
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be under ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const urlRes = await fetch(`${BASE_URL}/api/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });

      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json();

      setProgress(30);

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      setProgress(80);

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
      setError(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const displayName = uploadedFile?.name ?? (currentUrl ? currentUrl.split("/").pop() ?? currentUrl : null);

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {!uploadedFile && !currentUrl ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-center",
            uploading && "pointer-events-none opacity-60"
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">or drag & drop · max {maxSizeMB}MB</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 border rounded-lg p-3 bg-muted/30">
          <div className="text-primary">
            {uploadedFile ? getFileIcon(uploadedFile.type) : <FileText className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {uploadedFile && (
              <p className="text-xs text-muted-foreground">{formatBytes(uploadedFile.size)}</p>
            )}
          </div>
          {uploadedFile && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => {
              setUploadedFile(null);
              setProgress(0);
              if (inputRef.current) inputRef.current.value = "";
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {uploading && progress > 0 && progress < 100 && (
        <Progress value={progress} className="h-1.5" />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

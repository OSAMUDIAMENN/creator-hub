import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Download, XCircle, ShoppingBag } from "lucide-react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type DownloadInfo = {
  productName: string;
  fileUrl: string;
  creatorName: string;
};

export default function ProductDownloadPage() {
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("ref");
    if (!reference) {
      setError("No reference found.");
      setLoading(false);
      return;
    }

    fetch(`${BASE_URL}/api/paystack/product-download-info?reference=${encodeURIComponent(reference)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setInfo(data);
      })
      .catch((err) => setError(err.message ?? "Failed to fetch download info."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {loading ? (
          <Card>
            <CardHeader className="text-center">
              <Skeleton className="h-12 w-12 rounded-full mx-auto mb-2" />
              <Skeleton className="h-6 w-48 mx-auto" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="border-destructive/30">
            <CardHeader className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-2" />
              <CardTitle className="text-destructive">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground text-sm space-y-4">
              <p>{error}</p>
              <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
            </CardContent>
          </Card>
        ) : info ? (
          <Card className="border-primary/30">
            <CardHeader className="text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
              <CardTitle>Payment Confirmed!</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Thank you for purchasing <span className="font-semibold text-foreground">{info.productName}</span> from{" "}
                <span className="font-semibold text-foreground">{info.creatorName}</span>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                size="lg"
                onClick={() => window.open(info.fileUrl, "_blank")}
              >
                <Download className="h-5 w-5 mr-2" />
                Download Your File
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Save your download link — this page is valid for your reference.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <div className="text-center">
          <a
            href="/"
            className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors font-medium inline-flex items-center gap-1"
          >
            <ShoppingBag className="h-3 w-3" />
            Powered by CreatorHub
          </a>
        </div>
      </div>
    </div>
  );
}

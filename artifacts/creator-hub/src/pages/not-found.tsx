import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-black text-primary/20 mb-4 select-none">404</div>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Go back
          </Button>
          <Link href="/dashboard">
            <Button>
              <Home className="h-4 w-4 mr-2" /> Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

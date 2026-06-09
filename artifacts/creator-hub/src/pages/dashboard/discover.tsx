import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Package, ExternalLink, Star } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

type SearchCreator = {
  id: number; name: string; username: string; bio: string | null; profileImage: string | null;
};
type SearchListing = {
  id: number; title: string; description: string; category: string; serviceType: string;
  price: number; currency: string; deliveryDays: number; imageUrl: string | null;
  totalOrders: number; rating: number | null; sellerName: string; sellerUsername: string;
};

function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: async (): Promise<{ creators: SearchCreator[]; listings: SearchListing[] }> => {
      if (!q || q.length < 2) return { creators: [], listings: [] };
      const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      return r.json();
    },
    enabled: q.length >= 2,
  });
}

function CreatorCard({ creator }: { creator: SearchCreator }) {
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-start gap-3">
        <Avatar className="h-12 w-12 border">
          <AvatarImage src={creator.profileImage ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {creator.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{creator.name}</p>
            <p className="text-xs text-muted-foreground">@{creator.username}</p>
          </div>
          {creator.bio && <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{creator.bio}</p>}
        </div>
        <a href={`/${creator.username}`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
            <ExternalLink className="h-3.5 w-3.5" /> View
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}

function ListingCard({ listing }: { listing: SearchListing }) {
  const price = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(listing.price / 100);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-3">
          {listing.imageUrl ? (
            <img src={listing.imageUrl} alt={listing.title} className="h-16 w-16 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-6 w-6 text-primary/50" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{listing.title}</h3>
            <p className="text-xs text-muted-foreground mb-1">by {listing.sellerName}</p>
            <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-bold text-primary">{price}</span>
              <Badge variant="outline" className="text-xs">{listing.category.replace(/_/g, " ")}</Badge>
              <span className="text-xs text-muted-foreground">{listing.deliveryDays}d delivery</span>
              {listing.rating && (
                <span className="text-xs flex items-center gap-0.5 text-amber-500">
                  <Star className="h-3 w-3 fill-current" /> {listing.rating.toFixed(1)}
                </span>
              )}
              {listing.totalOrders > 0 && (
                <span className="text-xs text-muted-foreground">{listing.totalOrders} orders</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 350);
  const { data, isLoading, isFetching } = useSearch(debouncedQ);

  const hasResults = data && (data.creators.length > 0 || data.listings.length > 0);
  const showEmpty = debouncedQ.length >= 2 && !isLoading && !hasResults;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discover</h1>
        <p className="text-muted-foreground">Search for creators and marketplace services.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 h-11 text-base"
          placeholder="Search creators, services, niches…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {!debouncedQ && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Start searching</p>
          <p className="text-sm">Find creators by name or username, or search for marketplace services.</p>
        </div>
      )}

      {showEmpty && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No results for "{debouncedQ}"</p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      )}

      {isLoading && debouncedQ.length >= 2 && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      )}

      {hasResults && (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({(data.creators.length) + (data.listings.length)})</TabsTrigger>
            <TabsTrigger value="creators" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Creators ({data.creators.length})
            </TabsTrigger>
            <TabsTrigger value="listings" className="gap-1.5">
              <Package className="h-3.5 w-3.5" /> Services ({data.listings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-4 space-y-3">
            {data.creators.map((c) => <CreatorCard key={`c-${c.id}`} creator={c} />)}
            {data.listings.map((l) => <ListingCard key={`l-${l.id}`} listing={l} />)}
          </TabsContent>

          <TabsContent value="creators" className="mt-4 space-y-3">
            {data.creators.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No creators found</p>
            ) : data.creators.map((c) => <CreatorCard key={c.id} creator={c} />)}
          </TabsContent>

          <TabsContent value="listings" className="mt-4 space-y-3">
            {data.listings.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">No services found</p>
            ) : data.listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

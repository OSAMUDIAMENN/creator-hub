import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Clock, Package, ShoppingCart, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type Booking = {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  status: string;
  message: string | null;
  requirements: string | null;
  price: number;
  currency: string;
  sellerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  listingTitle?: string;
  listingCategory?: string;
  listingServiceType?: string;
  sellerName?: string;
  sellerUsername?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Pending", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20", icon: Clock },
  accepted: { label: "Accepted", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20", icon: CheckCircle2 },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20", icon: XCircle },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function BookingCard({ booking, isSeller, onAction }: { booking: Booking; isSeller: boolean; onAction: (id: number, status: string, notes?: string) => void }) {
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const price = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(booking.price / 100);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{booking.listingTitle || `Booking #${booking.id}`}</h3>
              <StatusBadge status={booking.status} />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {isSeller ? "From buyer" : `From ${booking.sellerName || "seller"}`} · {price} · {formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true })}
            </p>
            {booking.message && (
              <p className="text-sm bg-muted/50 rounded-md px-3 py-2 border border-border">
                <span className="font-medium">Message: </span>{booking.message}
              </p>
            )}
            {booking.requirements && (
              <p className="text-sm mt-1 bg-muted/50 rounded-md px-3 py-2 border border-border">
                <span className="font-medium">Requirements: </span>{booking.requirements}
              </p>
            )}
            {booking.sellerNotes && (
              <p className="text-sm mt-1 text-muted-foreground italic">Note from seller: {booking.sellerNotes}</p>
            )}
          </div>

          {isSeller && booking.status === "pending" && (
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" onClick={() => {
                if (notes) onAction(booking.id, "accepted", notes);
                else setShowNotes(true);
              }}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Accept
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onAction(booking.id, "rejected")}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Decline
              </Button>
            </div>
          )}

          {isSeller && booking.status === "accepted" && (
            <Button size="sm" variant="outline" onClick={() => onAction(booking.id, "completed")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Mark Complete
            </Button>
          )}

          {!isSeller && booking.status === "pending" && (
            <Button size="sm" variant="destructive" onClick={() => onAction(booking.id, "cancelled")}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel
            </Button>
          )}
        </div>

        {showNotes && (
          <div className="mt-3 space-y-2">
            <Textarea
              placeholder="Add a note to the buyer (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { onAction(booking.id, "accepted", notes); setShowNotes(false); }}>Confirm Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNotes(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BookingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: myBookings = [], isLoading: loadingBuyer } = useQuery<Booking[]>({
    queryKey: ["bookings-my"],
    queryFn: () => fetch("/api/bookings/my", { credentials: "include" }).then((r) => r.json()),
  });

  const { data: myOrders = [], isLoading: loadingSeller } = useQuery<Booking[]>({
    queryKey: ["bookings-orders"],
    queryFn: () => fetch("/api/bookings/orders", { credentials: "include" }).then((r) => r.json()),
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, status, sellerNotes }: { id: number; status: string; sellerNotes?: string }) => {
      const r = await fetch(`/api/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, ...(sellerNotes && { sellerNotes }) }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["bookings-my"] });
      queryClient.invalidateQueries({ queryKey: ["bookings-orders"] });
      toast({ title: `Booking ${status}`, description: `The booking has been marked as ${status}.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleAction = (id: number, status: string, sellerNotes?: string) => {
    updateBooking.mutate({ id, status, sellerNotes });
  };

  const pendingOrders = myOrders.filter((b) => b.status === "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-muted-foreground">Manage service requests and orders.</p>
      </div>

      {pendingOrders.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">You have {pendingOrders.length} pending order{pendingOrders.length > 1 ? "s" : ""} awaiting your response.</p>
        </div>
      )}

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> My Orders
            {myOrders.filter((b) => b.status === "pending").length > 0 && (
              <Badge variant="destructive" className="h-4 w-4 p-0 text-[10px] flex items-center justify-center rounded-full">
                {myOrders.filter((b) => b.status === "pending").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="bookings" className="gap-1.5">
            <ShoppingCart className="h-3.5 w-3.5" /> My Bookings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="mt-4 space-y-3">
          {loadingSeller ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : myOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No orders yet</p>
              <p className="text-sm">Orders from your marketplace listings will appear here.</p>
            </div>
          ) : (
            myOrders.map((b) => (
              <BookingCard key={b.id} booking={b} isSeller onAction={handleAction} />
            ))
          )}
        </TabsContent>

        <TabsContent value="bookings" className="mt-4 space-y-3">
          {loadingBuyer ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)
          ) : myBookings.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No bookings yet</p>
              <p className="text-sm">Browse the marketplace and book a service to get started.</p>
            </div>
          ) : (
            myBookings.map((b) => (
              <BookingCard key={b.id} booking={b} isSeller={false} onAction={handleAction} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

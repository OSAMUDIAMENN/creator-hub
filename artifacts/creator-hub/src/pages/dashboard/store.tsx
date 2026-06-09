import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useListProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Product } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ShoppingBag, Package, Link2, Upload, Users } from "lucide-react";
import { FreemiumGate, FeatureUsageBadge } from "@/components/feature-limit";
import { FileUploader } from "@/components/file-uploader";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

const BASE_URL_STORE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SaleRecord = {
  id: number; reference: string; amount: number; currency: string;
  description: string | null; buyerName: string | null; buyerEmail: string | null;
  productId: number | null; createdAt: string;
};

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be >= 0"),
  currency: z.string().min(1, "Currency is required"),
  imageUrl: z.string().optional(),
  fileUrl: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function StoreManager() {
  const { data: products, isLoading } = useListProducts();
  const { data: sales, isLoading: salesLoading } = useQuery<SaleRecord[]>({
    queryKey: ["product-sales"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL_STORE}/api/products/sales`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sales");
      return res.json();
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [imageInputMode, setImageInputMode] = useState<"url" | "upload">("upload");
  const [fileInputMode, setFileInputMode] = useState<"url" | "upload">("upload");

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      currency: "NGN",
      imageUrl: "",
      fileUrl: "",
    },
  });

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      form.reset({
        name: product.name,
        description: product.description || "",
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl || "",
        fileUrl: product.fileUrl || "",
      });
    } else {
      setEditingProduct(null);
      form.reset({ name: "", description: "", price: 0, currency: "NGN", imageUrl: "", fileUrl: "" });
    }
    setIsFormOpen(true);
  };

  const onSubmit = (data: ProductFormData) => {
    if (editingProduct) {
      updateProduct.mutate(
        { id: editingProduct.id, data: { ...data, isActive: editingProduct.isActive } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Product updated" });
          },
          onError: (err: any) => {
            toast({ title: "Failed to update", description: err?.response?.data?.error, variant: "destructive" });
          },
        }
      );
    } else {
      createProduct.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
            setIsFormOpen(false);
            toast({ title: "Product created! 🎉" });
          },
          onError: (err: any) => {
            toast({ title: "Failed to create", description: err?.response?.data?.error, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleToggleActive = (product: Product, isActive: boolean) => {
    updateProduct.mutate(
      { id: product.id, data: { isActive } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }) }
    );
  };

  const handleDelete = () => {
    if (!deletingProduct) return;
    deleteProduct.mutate(
      { id: deletingProduct.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setDeletingProduct(null);
          toast({ title: "Product deleted" });
        },
      }
    );
  };

  const totalEarnings = products?.reduce((sum, p) => sum + p.price * p.salesCount, 0) || 0;
  const activeCount = products?.filter((p) => p.isActive).length || 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Store</h1>
            <FeatureUsageBadge current={products?.length ?? 0} limit={3} label="products" />
          </div>
          <p className="text-muted-foreground mt-1">Manage your digital products and files.</p>
        </div>
        <Button onClick={() => handleOpenForm()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" /> Add Product
        </Button>
      </div>

      <DashboardAdBanner count={1} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-primary">₦{totalEarnings.toLocaleString()}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Active</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Products</p>
              <p className="text-2xl font-bold">{products?.length || 0}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Package className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products & Sales Tabs */}
      <Tabs defaultValue="products">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="products" className="gap-1.5"><Package className="h-3.5 w-3.5" />Products</TabsTrigger>
          <TabsTrigger value="sales" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />Sales
            {!!sales?.length && <Badge variant="secondary" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{sales.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Sales Tab */}
        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Buyer History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {salesLoading ? (
                <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : !sales?.length ? (
                <div className="text-center py-16 text-muted-foreground">
                  <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No sales yet</p>
                  <p className="text-sm opacity-60 mt-1">Your buyer history will appear here once you make your first sale.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Buyer</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">
                            {s.buyerName || <span className="text-muted-foreground text-xs">Anonymous</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {s.buyerEmail || "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-[140px] truncate">
                            {s.description?.replace(/^Sale:\s*/, "").replace(/\s*\(after.*$/, "") || "Product"}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            ₦{s.amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(s.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="mt-4">
      <FreemiumGate feature="products" freeLimit={3} currentCount={products?.length ?? 0} proFeatures={["unlimited products", "advanced analytics"]}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 w-full" />)
        ) : !products?.length ? (
          <div className="col-span-full text-center py-16 border-2 border-dashed rounded-xl text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium mb-1">No products yet</p>
            <p className="text-sm mb-4 opacity-70">Add your first digital product to start selling.</p>
            <Button variant="outline" onClick={() => handleOpenForm()}>
              <Plus className="h-4 w-4 mr-2" /> Add Product
            </Button>
          </div>
        ) : (
          (Array.isArray(products) ? products : []).map((product) => (
            <Card
              key={product.id}
              className={`flex flex-col overflow-hidden transition-all hover:shadow-md ${!product.isActive ? "opacity-60" : ""}`}
            >
              {product.imageUrl ? (
                <div className="h-40 w-full overflow-hidden bg-muted relative">
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  {!product.isActive && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                      <Badge variant="secondary">Inactive</Badge>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 w-full bg-muted flex items-center justify-center text-muted-foreground relative">
                  <Package className="h-12 w-12 opacity-20" />
                  {!product.isActive && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    </div>
                  )}
                </div>
              )}
              <CardContent className="p-4 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-1.5">
                  <h3 className="font-semibold line-clamp-1 flex-1 pr-2">{product.name}</h3>
                  <span className="font-bold shrink-0 text-primary text-sm bg-primary/10 px-2 py-0.5 rounded">
                    {product.price === 0 ? "Free" : `₦${Number(product.price).toLocaleString()}`}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 flex-1">
                  {product.description || "No description"}
                </p>
                <div className="flex items-center justify-between mt-auto pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{product.salesCount}</span> sales
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={product.isActive}
                      onCheckedChange={(checked) => handleToggleActive(product, checked)}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(product)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingProduct(product)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </FreemiumGate>
        </TabsContent>
      </Tabs>

      {/* Product Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Edit Product" : "Add New Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input id="name" {...form.register("name")} placeholder="e.g. Social Media Starter Kit" />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="What does your customer get? What problems does it solve?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (₦)</Label>
                <Input id="price" type="number" step="1" min="0" {...form.register("price")} placeholder="0 for free" />
                {form.formState.errors.price && (
                  <p className="text-sm text-destructive">{form.formState.errors.price.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select defaultValue={form.getValues("currency")} onValueChange={(val) => form.setValue("currency", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="GHS">GHS (GH₵)</SelectItem>
                    <SelectItem value="KES">KES (KSh)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <Tabs value={imageInputMode} onValueChange={(v) => setImageInputMode(v as any)}>
                <TabsList className="h-8 w-fit">
                  <TabsTrigger value="upload" className="h-7 text-xs gap-1.5">
                    <Upload className="h-3 w-3" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="url" className="h-7 text-xs gap-1.5">
                    <Link2 className="h-3 w-3" /> URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-2">
                  <FileUploader
                    variant="image"
                    label="Upload cover image"
                    accept="image/*"
                    maxSizeMB={5}
                    currentUrl={form.getValues("imageUrl") || undefined}
                    onUpload={(f) => form.setValue("imageUrl", f.url)}
                  />
                </TabsContent>
                <TabsContent value="url" className="mt-2">
                  <Input
                    {...form.register("imageUrl")}
                    placeholder="https://example.com/cover.jpg"
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Product File */}
            <div className="space-y-2">
              <Label>Product File</Label>
              <p className="text-xs text-muted-foreground">The file buyers receive after purchase. PDF, ZIP, video, etc.</p>
              <Tabs value={fileInputMode} onValueChange={(v) => setFileInputMode(v as any)}>
                <TabsList className="h-8 w-fit">
                  <TabsTrigger value="upload" className="h-7 text-xs gap-1.5">
                    <Upload className="h-3 w-3" /> Upload
                  </TabsTrigger>
                  <TabsTrigger value="url" className="h-7 text-xs gap-1.5">
                    <Link2 className="h-3 w-3" /> URL
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="mt-2">
                  <FileUploader
                    variant="file"
                    label="Upload product file"
                    accept=".pdf,.zip,.mp4,.mp3,.docx,.xlsx,.png,.jpg"
                    maxSizeMB={50}
                    currentUrl={form.getValues("fileUrl") || undefined}
                    onUpload={(f) => form.setValue("fileUrl", f.url)}
                  />
                </TabsContent>
                <TabsContent value="url" className="mt-2">
                  <Input
                    {...form.register("fileUrl")}
                    placeholder="https://drive.google.com/file/..."
                  />
                </TabsContent>
              </Tabs>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {editingProduct ? "Save Changes" : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deletingProduct} onOpenChange={(open) => !open && setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingProduct?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import React from "react";
import { 
  useGetAnalyticsSummary, 
  useGetRevenueStats, 
  useGetTopLinks 
} from "@workspace/api-client-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { 
  Eye, 
  MousePointerClick, 
  DollarSign, 
  Link2,
  TrendingUp,
  ExternalLink
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardAdBanner } from "@/components/ui/dashboard-ad-banner";

export default function Analytics() {
  const { data: summary, isLoading: isLoadingSummary } = useGetAnalyticsSummary();
  const { data: revenueData, isLoading: isLoadingRevenue } = useGetRevenueStats();
  const { data: topLinks, isLoading: isLoadingTopLinks } = useGetTopLinks();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground mt-1">Track your performance and growth.</p>
      </div>

      <DashboardAdBanner count={1} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Profile Views" 
          value={summary?.profileViews} 
          icon={<Eye className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoadingSummary} 
        />
        <StatCard 
          title="Total Link Clicks" 
          value={summary?.totalLinkClicks} 
          icon={<MousePointerClick className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoadingSummary} 
        />
        <StatCard 
          title="Total Revenue" 
          value={summary ? `$${summary.totalRevenue.toFixed(2)}` : undefined} 
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoadingSummary} 
        />
        <StatCard 
          title="Active Links" 
          value={summary?.activeLinks} 
          icon={<Link2 className="h-4 w-4 text-muted-foreground" />} 
          isLoading={isLoadingSummary} 
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Revenue Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            {isLoadingRevenue ? (
              <Skeleton className="h-[350px] w-full" />
            ) : revenueData && revenueData.length > 0 ? (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dy={10}
                    />
                    <YAxis 
                      tickFormatter={(val) => `$${val}`}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      dx={-10}
                    />
                    <Tooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                      labelFormatter={(label) => new Date(label as string).toLocaleDateString()}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground border border-dashed rounded-lg">
                No revenue data available for this period.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Performing Links</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTopLinks ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topLinks && topLinks.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topLinks.map((link) => (
                    <TableRow key={link.id}>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium truncate">{link.title}</div>
                        <a href={link.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:underline flex items-center gap-1 truncate mt-1">
                          {link.url} <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {link.clicks}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center p-8 text-muted-foreground">
                No link clicks recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, isLoading }: { title: string; value?: string | number; icon: React.ReactNode; isLoading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value !== undefined ? value : 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

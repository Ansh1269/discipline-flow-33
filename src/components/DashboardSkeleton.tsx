import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-40 rounded-3xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-40 rounded-3xl" />
    </div>
  );
}
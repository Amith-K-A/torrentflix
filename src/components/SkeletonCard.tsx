import { cn } from "@/lib/utils";

export default function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("shrink-0", className)}>
      <div className="aspect-[2/3] animate-pulse rounded bg-elevated" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-elevated" />
      <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated" />
    </div>
  );
}

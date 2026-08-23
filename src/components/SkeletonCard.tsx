export default function SkeletonCard() {
  return (
    <div className="w-[130px] shrink-0 md:w-[170px]">
      <div className="aspect-[2/3] animate-pulse rounded bg-elevated" />
      <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-elevated" />
      <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-elevated" />
    </div>
  );
}

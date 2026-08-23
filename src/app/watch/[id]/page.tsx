import { notFound } from "next/navigation";
import { getDetails } from "@/lib/tmdb";
import WatchView from "@/components/WatchView";
import SetupNotice from "@/components/SetupNotice";

export const dynamic = "force-dynamic";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type: typeParam } = await searchParams;
  const type = typeParam === "tv" ? "tv" : "movie";

  if (!/^\d+$/.test(id)) notFound();

  let details;
  try {
    details = await getDetails(type, id);
  } catch (e: any) {
    return (
      <div className="grid min-h-screen place-items-center px-4 pt-20">
        <SetupNotice message={e?.message ?? "Could not load title details."} />
      </div>
    );
  }

  return <WatchView details={details} />;
}

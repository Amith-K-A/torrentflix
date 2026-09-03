"use client";

import { cn } from "@/lib/utils";

export default function SeasonTabs({
  seasons,
  active,
  onSelect,
}: {
  seasons: { season_number: number; name: string; episode_count: number }[];
  active: number;
  onSelect: (season: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
      {seasons.map((s) => (
        <button
          key={s.season_number}
          onClick={() => onSelect(s.season_number)}
          className={cn(
            "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition",
            s.season_number === active
              ? "bg-white text-black"
              : "bg-white/10 text-muted hover:bg-white/20 hover:text-white"
          )}
        >
          {s.name.replace("Season", "S")}
          <span className="ml-1.5 text-xs opacity-60">{s.episode_count} ep</span>
        </button>
      ))}
    </div>
  );
}

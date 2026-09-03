"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

import { useDebounce } from "@/hooks/useDebounce";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse?type=movie", label: "Movies" },
  { href: "/browse?type=tv", label: "TV Shows" },
  { href: "/watchlist", label: "My List" },
  { href: "/downloads", label: "Downloads" },
  { href: "/languages", label: "Browse by Languages" },
];

function NavbarInner() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(searchParams.get("q")));
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debouncedQuery = useDebounce(query, 500);
  const inputRef = useRef<HTMLInputElement>(null);

  const isActive = (href: string) => {
    const [basePath, search] = href.split("?");
    if (href === "/") return pathname === "/";
    if (!pathname.startsWith(basePath)) return false;
    
    if (search) {
      const params = new URLSearchParams(search);
      for (const [key, value] of Array.from(params.entries())) {
        if (searchParams.get(key) !== value) return false;
      }
    }
    return true;
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // "/" focuses the search box, Netflix style
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === "/" && target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Only sync the URL when the user is actively on the search page.
    // Without this guard, navigating away (e.g. clicking a result to /watch)
    // would be overridden by a replace() back to /search.
    if (pathname !== "/search" && pathname !== "/") return;

    const currentQ = searchParams.get("q") ?? "";
    if (debouncedQuery !== currentQ && searchOpen) {
      if (debouncedQuery.trim()) {
        router.replace(`/search?q=${encodeURIComponent(debouncedQuery.trim())}`);
      } else if (pathname === "/search") {
        router.replace("/");
      }
    }
  }, [debouncedQuery, searchParams, router, pathname, searchOpen]);

  const submit = (value: string) => {
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
    else router.push("/");
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-colors duration-300",
        scrolled || searchOpen
          ? "bg-surface-dim"
          : "bg-gradient-to-b from-black/80 to-transparent"
      )}
    >
      <nav className="flex items-center gap-6 px-4 py-3 md:px-10">
        <Link href="/" className="shrink-0 flex items-center gap-2.5 group">
          <div className="relative h-7 w-7 sm:h-8 sm:w-8 overflow-hidden rounded-lg shadow-sm shadow-brand/30 transition-transform group-hover:scale-105">
            <Image src="/logo.png" alt="TorrentFlix" fill sizes="32px" className="object-cover" priority />
          </div>
          <span className="text-xl font-black tracking-tight text-brand md:text-[24px]">
            TORRENTFLIX
          </span>
        </Link>

        <ul className="hidden items-center gap-5 text-sm md:flex">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "transition-colors hover:text-white",
                    active ? "font-semibold text-white" : "text-muted"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-3">
          {searchOpen ? (
            <div className="flex items-center gap-2 border border-white/30 bg-black/80 px-3 py-1.5">
              <Search size={16} className="shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit(query);
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                    setQuery("");
                  }
                }}
                onBlur={() => {
                  if (!query.trim()) setSearchOpen(false);
                }}
                placeholder="Titles, people, genres"
                className="w-40 bg-transparent text-sm outline-none placeholder:text-muted md:w-64"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={16} className="text-muted hover:text-white" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="text-muted transition-colors hover:text-white"
            >
              <Search size={20} />
            </button>
          )}

          <div className="hidden h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-brand to-brand-dark text-xs font-bold md:grid">
            A
          </div>
        </div>
      </nav>

      {/* mobile nav */}
      <ul className="flex items-center gap-4 overflow-x-auto px-4 pb-2 text-xs no-scrollbar md:hidden">
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                className={cn(
                  "transition-colors hover:text-white",
                  active ? "font-semibold text-white" : "text-muted"
                )}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<div className="fixed inset-x-0 top-0 z-40 h-14" />}>
      <NavbarInner />
    </Suspense>
  );
}

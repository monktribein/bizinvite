"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

export function Spinner({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${className} rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin`}
    />
  );
}

// Full-screen loader used while the app or a whole page is loading
export function PageLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{label}</p>
      </div>
    </div>
  );
}

// Loader that fills a content area (inside the dashboard shell)
export function ContentLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Spinner />
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">{label}</p>
      </div>
    </div>
  );
}

// Circular loader shown in the middle of the screen during page navigation and any API request
export function GlobalLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const currentUrl = `${pathname}?${searchParams.toString()}`;
  // URL the user was on when they clicked a link; navigation is done once the URL changes
  const [navigatingFrom, setNavigatingFrom] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Start as soon as an internal link is clicked
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setNavigatingFrom(`${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Clear the pending navigation once the URL changes, so going back to the old URL later does not show the loader
  useEffect(() => () => setNavigatingFrom(null), [currentUrl]);

  const navigating = navigatingFrom !== null && navigatingFrom === currentUrl;
  const active = navigating || isFetching > 0 || isMutating > 0;

  // Short delay so quick requests don't flash the loader
  useEffect(() => {
    if (!active) return;
    const show = setTimeout(() => setVisible(true), 250);
    return () => {
      clearTimeout(show);
      setVisible(false);
    };
  }, [active]);

  if (!active || !visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
      <div className="rounded-full bg-white p-3 shadow-lg">
        <Spinner />
      </div>
    </div>
  );
}

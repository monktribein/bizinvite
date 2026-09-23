"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_ITEMS } from "@/config/navigation";
import { useAuth } from "@/lib/auth/context";
import { cn } from "@/lib/utils/cn";
import { Sparkles, X } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { can } = useAuth();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-bold text-slate-900 tracking-tight">BizInvite</span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-indigo-600">
                Operations
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Platform Menu
          </div>
          {NAVIGATION_ITEMS.map((item) => {
            if (item.requiredPermission && !can(item.requiredPermission)) {
              return null;
            }

            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      "w-4 h-4 transition-colors",
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    )}
                  />
                  <span>{item.title}</span>
                </div>
                {item.badge && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* System Health / Footer */}
        <div className="border-t border-slate-200 p-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-slate-600">WhatsApp Gateway Live</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">M10 Cluster Isolated Tenant</p>
        </div>
      </aside>
    </>
  );
}

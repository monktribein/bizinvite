"use client";

import React, { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { useEvents } from "@/hooks/useEvents";
import { getRoleDisplayName } from "@/lib/auth/permissions";
import {
  Menu,
  Building2,
  Calendar,
  LogOut,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const { user, organization, logout, currentEventId, setCurrentEventId } = useAuth();
  const { events } = useEvents();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur-xs">
      {/* Left: Mobile Toggle & Context Selectors */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Current Organization Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 border border-slate-200">
          <Building2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-semibold text-slate-800">
            {organization?.name || "Aura Events & Hospitality"}
          </span>
          <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-700 uppercase">
            {organization?.plan || "Enterprise"}
          </span>
        </div>

        {/* Event Context Selector */}
        {events && events.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                aria-label="Active Event Scope"
                value={currentEventId || events[0]?.id}
                onChange={(e) => setCurrentEventId(e.target.value)}
                className="appearance-none rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-8 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer"
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.name}
                  </option>
                ))}
              </select>
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* Right: WhatsApp Health, User Menu */}
      <div className="flex items-center gap-3">
        {/* WhatsApp Channel Indicator */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 border border-emerald-200 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>WA: Active</span>
          <span className="text-[10px] text-emerald-600">Tier 100K</span>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 rounded-lg p-1.5 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs">
              {user?.name?.slice(0, 2).toUpperCase() || "KM"}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">
                {user?.name || "Kabir Malhotra"}
              </p>
              <p className="text-[10px] text-slate-500 font-medium leading-none">
                {user?.role ? getRoleDisplayName(user.role) : "Organization Owner"}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-semibold text-slate-900">{user?.name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-600">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{user?.role ? getRoleDisplayName(user.role) : "Owner"}</span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

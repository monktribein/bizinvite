"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatPhone } from "@/lib/utils/formatters";
import { Guest } from "@/types/guest";

/** Why WhatsApp messages are never sent to this guest, if anything. */
export function guestBlockReason(g: Guest): string | null {
  if (g.optedOut) return "Opted out";
  if (g.communicationSuppressed) return "Suppressed";
  if (g.mobileValid === false) return "Invalid number";
  return null;
}

/**
 * Searchable multi-select of the event's guests for the campaign form. Guests who cannot be
 * messaged are listed but cannot be ticked (the server would skip them anyway).
 */
export function GuestPicker({
  guests,
  selectedIds,
  onChange,
  isLoading,
}: {
  guests: Guest[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(selectedIds.length === 0);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = guests.filter(
    (g) => !q || g.name.toLowerCase().includes(q) || (digits.length > 0 && g.mobile.replace(/\D/g, "").includes(digits))
  );
  const selectableVisible = visible.filter((g) => !guestBlockReason(g));
  const allVisibleSelected = selectableVisible.length > 0 && selectableVisible.every((g) => selected.has(g.id));
  const selectedGuests = guests.filter((g) => selected.has(g.id));

  const toggle = (id: string) => onChange(selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const selectAllVisible = () => onChange([...new Set([...selectedIds, ...selectableVisible.map((g) => g.id)])]);
  const clearVisible = () => {
    const hide = new Set(visible.map((g) => g.id));
    onChange(selectedIds.filter((id) => !hide.has(id)));
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 hover:border-indigo-400 cursor-pointer"
      >
        <span className={selectedIds.length ? "font-semibold" : "text-slate-500"}>
          {selectedIds.length ? `${selectedIds.length} guest${selectedIds.length === 1 ? "" : "s"} selected` : "Choose guests to invite..."}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {!open && selectedGuests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGuests.slice(0, 8).map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-800">
              {g.name}
              <button type="button" aria-label={`Remove ${g.name}`} onClick={() => toggle(g.id)} className="cursor-pointer text-indigo-500 hover:text-indigo-800">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {selectedGuests.length > 8 && <span className="text-[11px] text-slate-500 self-center">+{selectedGuests.length - 8} more</span>}
        </div>
      )}

      {open && (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-100 p-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or phone..."
                aria-label="Search guests"
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            <button
              type="button"
              onClick={allVisibleSelected ? clearVisible : selectAllVisible}
              disabled={selectableVisible.length === 0}
              className="shrink-0 text-xs font-semibold text-indigo-700 hover:underline disabled:opacity-40 cursor-pointer"
            >
              {allVisibleSelected ? "Clear" : `Select all (${selectableVisible.length})`}
            </button>
          </div>

          <ul className="max-h-60 overflow-y-auto divide-y divide-slate-50" role="listbox" aria-multiselectable="true" aria-label="Guests">
            {isLoading ? (
              <li className="p-4 text-center text-xs text-slate-400">Loading guests...</li>
            ) : guests.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400">This event has no guests yet. Add them on the Guests page.</li>
            ) : visible.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400">No guest matches &quot;{query}&quot;</li>
            ) : (
              visible.map((g) => {
                const block = guestBlockReason(g);
                return (
                  <li key={g.id} role="option" aria-selected={selected.has(g.id)}>
                    <label className={`flex items-center gap-3 px-3 py-2 text-xs ${block ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-slate-50"}`}>
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        disabled={!!block && !selected.has(g.id)}
                        onChange={() => toggle(g.id)}
                        aria-label={`Invite ${g.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-slate-900 truncate">{g.name}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{formatPhone(g.mobile)}</span>
                      </span>
                      {block ? (
                        <Badge variant="warning" size="sm">
                          {block}
                        </Badge>
                      ) : g.rsvpStatus !== "no_response" ? (
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{g.rsvpStatus.replace("_", " ")}</span>
                      ) : null}
                    </label>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

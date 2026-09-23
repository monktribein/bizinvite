"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useRSVP } from "@/hooks/useRSVP";
import { useAuth } from "@/lib/auth/context";
import { RSVPRecord, GuestRequirement } from "@/types/rsvp";
import { RSVPStatus } from "@/types/guest";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
} from "@/components/ui/Table";
import { RSVP_STATUS_CONFIG } from "@/config/constants";
import { formatDate, formatNumber } from "@/lib/utils/formatters";
import {
  Utensils,
  Hotel,
  Car,
  Edit3,
  Search,
} from "lucide-react";

export default function RSVPPage() {
  const { currentEventId, can } = useAuth();
  const { rsvps, isLoadingRSVPs, summary, updateRSVP } = useRSVP(currentEventId);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Manual Correction Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RSVPRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<RSVPStatus>("attending");
  const [attendingPaxCount, setAttendingPaxCount] = useState(1);
  const [dietaryPreference, setDietaryPreference] = useState<GuestRequirement["dietaryPreference"]>("vegetarian");
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [needsAccommodation, setNeedsAccommodation] = useState(false);
  const [accommodationNotes, setAccommodationNotes] = useState("");
  const [needsTransport, setNeedsTransport] = useState(false);
  const [specialRequests, setSpecialRequests] = useState("");

  const filteredRSVPs = rsvps.filter((r) => {
    const matchesSearch =
      r.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.guestMobile.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openManualCorrection = (record: RSVPRecord) => {
    setEditingRecord(record);
    setSelectedStatus(record.status);
    setAttendingPaxCount(record.attendingCount);
    setDietaryPreference(record.requirements?.dietaryPreference || "vegetarian");
    setDietaryNotes(record.requirements?.dietaryNotes || "");
    setNeedsAccommodation(!!record.requirements?.needsAccommodation);
    setAccommodationNotes(record.requirements?.accommodationNotes || "");
    setNeedsTransport(!!record.requirements?.needsTransport);
    setSpecialRequests(record.requirements?.specialRequests || "");
    setIsEditModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    await updateRSVP({
      guestId: editingRecord.guestId,
      status: selectedStatus,
      count: selectedStatus === "declined" ? 0 : attendingPaxCount,
      requirements: {
        dietaryPreference,
        dietaryNotes,
        needsAccommodation,
        accommodationNotes,
        needsTransport,
        specialRequests,
      },
    });

    setIsEditModalOpen(false);
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            RSVP Operations & Headcount
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time confirmations, companions count, dietary preferences, and staff manual override.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Invited</span>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary?.totalInvited || 0)}</p>
          <span className="text-[10px] text-slate-400">Invitees Dispatched</span>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Attending</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{formatNumber(summary?.attending || 0)}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Confirmed Primary</span>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Total Footfall</span>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{formatNumber(summary?.expectedFootfall || 0)}</p>
          <span className="text-[10px] text-indigo-700 font-medium">Pax (With Companions)</span>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Declined</span>
          <p className="mt-1 text-2xl font-bold text-rose-700">{formatNumber(summary?.declined || 0)}</p>
          <span className="text-[10px] text-rose-600">With Regrets</span>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Tentative (Maybe)</span>
          <p className="mt-1 text-2xl font-bold text-amber-700">{formatNumber(summary?.maybe || 0)}</p>
          <span className="text-[10px] text-amber-600">Awaiting Schedule</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pending</span>
          <p className="mt-1 text-2xl font-bold text-slate-700">{formatNumber(summary?.noResponse || 0)}</p>
          <span className="text-[10px] text-slate-400">No Response</span>
        </div>
      </div>

      {/* Logistics Aggregates Bar */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Dietary Breakdown</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {summary?.dietaryCounts?.vegetarian || 0} Veg • {summary?.dietaryCounts?.non_vegetarian || 0} Non-Veg • {summary?.dietaryCounts?.jain || 0} Jain
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Hotel className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Hotel Accommodation</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {summary?.accommodationRequestedCount || 0} Rooms Requested
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">Airport / Station Transfers</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">
              {summary?.transportRequestedCount || 0} Pickups Scheduled
            </p>
          </div>
        </div>
      </div>

      {/* RSVP Data Table */}
      <Card>
        <CardHeader
          title="Guest RSVP Responses"
          subtitle="Detailed breakdown of confirmed heads, dietary notes, and channel source"
        />
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by guest name or mobile number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="w-full sm:w-48">
            <select
              aria-label="Filter by RSVP Response"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="all">All RSVP Responses</option>
              <option value="attending">Attending</option>
              <option value="declined">Declined</option>
              <option value="maybe">Maybe</option>
            </select>
          </div>
        </div>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest Name</TableHead>
                <TableHead>RSVP Status</TableHead>
                <TableHead>Confirmed Pax</TableHead>
                <TableHead>Dietary Preference</TableHead>
                <TableHead>Logistics (Stay / Cab)</TableHead>
                <TableHead>Response Source</TableHead>
                <TableHead className="text-right">Staff Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingRSVPs ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    Loading RSVP responses...
                  </td>
                </tr>
              ) : filteredRSVPs.length === 0 ? (
                <TableEmptyState message="No RSVP records found matching your filters" colSpan={7} />
              ) : (
                filteredRSVPs.map((r) => {
                  const statusCfg = RSVP_STATUS_CONFIG[r.status] || RSVP_STATUS_CONFIG.no_response;

                  return (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{r.guestName}</div>
                        <span className="text-[10px] text-slate-500 font-mono">{r.guestMobile}</span>
                      </TableCell>

                      <TableCell>
                        <Badge className={statusCfg.color} size="sm">
                          {statusCfg.label}
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          {formatDate(r.respondedAt)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-slate-900">{r.attendingCount} Pax</span>
                        {r.companionsCount > 0 && (
                          <span className="text-[10px] text-slate-500 block">
                            (+{r.companionsCount} companion{r.companionsCount === 1 ? "" : "s"})
                          </span>
                        )}
                      </TableCell>

                      <TableCell>
                        <span className="capitalize font-medium text-slate-800">
                          {r.requirements?.dietaryPreference || "Standard"}
                        </span>
                        {r.requirements?.dietaryNotes && (
                          <p className="text-[10px] text-slate-500 truncate max-w-xs">
                            {r.requirements.dietaryNotes}
                          </p>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex gap-1.5">
                          {r.requirements?.needsAccommodation && (
                            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                              Hotel Stay
                            </span>
                          )}
                          {r.requirements?.needsTransport && (
                            <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                              Airport Transfer
                            </span>
                          )}
                          {!r.requirements?.needsAccommodation && !r.requirements?.needsTransport && (
                            <span className="text-[10px] text-slate-400">None</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-slate-600 font-medium">
                          {r.source === "whatsapp_quick_reply"
                            ? "WhatsApp Button"
                            : r.source === "manual_staff_entry"
                            ? "Staff Override"
                            : "Phone Call"}
                        </span>
                        {r.updatedBy && (
                          <span className="text-[10px] text-slate-400 block">
                            By {r.updatedBy}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        {can("rsvp:update") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openManualCorrection(r)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Override
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manual RSVP Override Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Manual RSVP Correction"
        description={`Authorized staff correction for ${editingRecord?.guestName}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveCorrection} className="space-y-4">
          <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-800">
            Note: Updating status to Attending or Declined will automatically suppress upcoming reminder workflows for this guest.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="RSVP Status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as RSVPStatus)}
              options={[
                { label: "Attending", value: "attending" },
                { label: "Declined", value: "declined" },
                { label: "Maybe / Tentative", value: "maybe" },
                { label: "No Response", value: "no_response" },
              ]}
            />

            {selectedStatus !== "declined" && (
              <Input
                label="Total Attending Pax"
                type="number"
                min={1}
                max={10}
                required
                value={attendingPaxCount}
                onChange={(e) => setAttendingPaxCount(parseInt(e.target.value) || 1)}
              />
            )}
          </div>

          {selectedStatus !== "declined" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Dietary Preference"
                  value={dietaryPreference}
                  onChange={(e) => setDietaryPreference(e.target.value as GuestRequirement["dietaryPreference"])}
                  options={[
                    { label: "Vegetarian", value: "vegetarian" },
                    { label: "Non-Vegetarian", value: "non_vegetarian" },
                    { label: "Jain (No Root Veg)", value: "jain" },
                    { label: "Vegan", value: "vegan" },
                  ]}
                />
                <Input
                  label="Dietary Notes"
                  value={dietaryNotes}
                  onChange={(e) => setDietaryNotes(e.target.value)}
                  placeholder="e.g. Nut allergies"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="acc_box"
                    checked={needsAccommodation}
                    onChange={(e) => setNeedsAccommodation(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <label htmlFor="acc_box" className="text-xs font-semibold text-slate-800">
                    Requires Hotel Accommodation
                  </label>
                </div>

                {needsAccommodation && (
                  <Input
                    label="Accommodation Notes / Room #"
                    value={accommodationNotes}
                    onChange={(e) => setAccommodationNotes(e.target.value)}
                    placeholder="e.g. Taj Aravali Suite 104"
                  />
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="trans_box"
                  checked={needsTransport}
                  onChange={(e) => setNeedsTransport(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                <label htmlFor="trans_box" className="text-xs font-semibold text-slate-800">
                  Requires Airport / Railway Station Transfer
                </label>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save RSVP Correction
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}

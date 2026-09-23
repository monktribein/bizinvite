"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useGuests } from "@/hooks/useGuests";
import { useAuth } from "@/lib/auth/context";
import { Guest, ImportPreviewResult } from "@/types/guest";
import { guestService } from "@/services/guest.service";
import { Card, CardContent } from "@/components/ui/Card";
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
import { RSVP_STATUS_CONFIG, CHECKIN_STATUS_CONFIG } from "@/config/constants";
import { formatDate, formatPhone } from "@/lib/utils/formatters";
import {
  UserPlus,
  FileSpreadsheet,
  Search,
  Crown,
  ChevronLeft,
  ChevronRight,
  Upload,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";

export default function GuestsPage() {
  const { currentEventId, can } = useAuth();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [rsvpFilter, setRsvpFilter] = useState("all");
  const [vipFilter, setVipFilter] = useState("all");
  const [checkInFilter, setCheckInFilter] = useState("all");

  const { guests, isLoading, addGuest, updateGuest } = useGuests(
    currentEventId,
    searchQuery,
    {
      category: categoryFilter === "all" ? undefined : categoryFilter,
      rsvpStatus: rsvpFilter === "all" ? undefined : rsvpFilter,
      isVip: vipFilter === "all" ? undefined : vipFilter === "true",
      checkInStatus: checkInFilter === "all" ? undefined : checkInFilter,
    }
  );

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.ceil(guests.length / pageSize) || 1;
  const paginatedGuests = guests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Single Guest Add / Edit Modal
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestMobile, setGuestMobile] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestCategory, setGuestCategory] = useState<Guest["category"]>("General");
  const [isVip, setIsVip] = useState(false);
  const [allowedPax, setAllowedPax] = useState(1);
  const [city, setCity] = useState("");
  const [notes, setNotes] = useState("");

  // CSV Import Wizard Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewResult | null>(null);
  const [isAnalyzingCsv, setIsAnalyzingCsv] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState(0);

  const openAddGuestModal = () => {
    setEditingGuest(null);
    setGuestName("");
    setGuestMobile("+91 ");
    setGuestEmail("");
    setGuestCategory("General");
    setIsVip(false);
    setAllowedPax(1);
    setCity("");
    setNotes("");
    setIsGuestModalOpen(true);
  };

  const openEditGuestModal = (guest: Guest) => {
    setEditingGuest(guest);
    setGuestName(guest.name);
    setGuestMobile(guest.mobile);
    setGuestEmail(guest.email || "");
    setGuestCategory(guest.category);
    setIsVip(guest.isVip);
    setAllowedPax(guest.allowedCompanions + 1);
    setCity(guest.city || "");
    setNotes(guest.notes || "");
    setIsGuestModalOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingGuest) {
      await updateGuest({
        id: editingGuest.id,
        updates: {
          name: guestName,
          mobile: guestMobile,
          email: guestEmail || undefined,
          category: guestCategory,
          isVip,
          allowedCompanions: Math.max(0, allowedPax - 1),
          city,
          notes,
        },
      });
    } else {
      await addGuest({
        eventId: currentEventId,
        name: guestName,
        mobile: guestMobile,
        email: guestEmail || undefined,
        category: guestCategory,
        isVip,
        allowedCompanions: Math.max(0, allowedPax - 1),
        city,
        notes,
      });
    }
    setIsGuestModalOpen(false);
  };

  // CSV Upload Simulation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingCsv(true);
    try {
      const preview = await guestService.previewCsvImport(file);
      setImportPreviewData(preview);
      setImportStep(2); // Step 2: Map Columns
    } finally {
      setIsAnalyzingCsv(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreviewData) return;
    setIsCommittingImport(true);
    try {
      const result = await guestService.commitCsvImport({
        importId: importPreviewData.importId,
        eventId: currentEventId,
        columnMappings: importPreviewData.columnMappings,
        duplicateResolutions: {},
      });
      setImportSuccessCount(result.importedCount);
      setImportStep(6); // Step 6: Confirmation
    } finally {
      setIsCommittingImport(false);
    }
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Guest Relationship Manager
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage invitees, VIP classifications, accompanying companion allowances, and WhatsApp consent.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {can("guests:import") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setImportStep(1);
                setIsImportModalOpen(true);
              }}
              className="text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Import CSV
            </Button>
          )}

          {can("guests:manage") && (
            <Button size="sm" onClick={openAddGuestModal} className="text-xs">
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Guest
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone (+91), email, or family..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select
              aria-label="Filter by Guest Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="all">All Categories</option>
              <option value="VVIP">VVIP</option>
              <option value="VIP">VIP</option>
              <option value="Family">Family</option>
              <option value="Friend">Friend</option>
              <option value="Corporate">Corporate</option>
            </select>

            <select
              aria-label="Filter by RSVP Status"
              value={rsvpFilter}
              onChange={(e) => setRsvpFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="all">All RSVPs</option>
              <option value="attending">Attending</option>
              <option value="declined">Declined</option>
              <option value="maybe">Maybe</option>
              <option value="no_response">No Response</option>
            </select>

            <select
              aria-label="Filter by VIP Status"
              value={vipFilter}
              onChange={(e) => setVipFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="all">All Tiers</option>
              <option value="true">VIP Only</option>
              <option value="false">Standard</option>
            </select>

            <select
              aria-label="Filter by Check-in Gate Status"
              value={checkInFilter}
              onChange={(e) => setCheckInFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
            >
              <option value="all">Gate Status</option>
              <option value="checked_in">Checked In</option>
              <option value="not_checked_in">Not Checked In</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guest Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guest Name & Family</TableHead>
                <TableHead>Contact (WhatsApp)</TableHead>
                <TableHead>Category / VIP</TableHead>
                <TableHead>Allowed Pax</TableHead>
                <TableHead>RSVP Status</TableHead>
                <TableHead>Reminder Status</TableHead>
                <TableHead>Gate Check-in</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    Loading guest directory...
                  </td>
                </tr>
              ) : paginatedGuests.length === 0 ? (
                <TableEmptyState message="No guests found for current filters" colSpan={8} />
              ) : (
                paginatedGuests.map((g) => {
                  const rsvpCfg = RSVP_STATUS_CONFIG[g.rsvpStatus] || RSVP_STATUS_CONFIG.no_response;
                  const checkInCfg = CHECKIN_STATUS_CONFIG[g.checkInStatus] || CHECKIN_STATUS_CONFIG.not_checked_in;

                  return (
                    <TableRow key={g.id}>
                      {/* Name & Family */}
                      <TableCell>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {g.name}
                          {g.isVip && (
                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        {g.familyGroupName && (
                          <span className="text-[10px] text-slate-500 block">
                            {g.familyGroupName} • {g.city || "India"}
                          </span>
                        )}
                      </TableCell>

                      {/* Phone */}
                      <TableCell>
                        <div className="font-mono text-slate-800">{formatPhone(g.mobile)}</div>
                        <span className="text-[10px] text-slate-400">{g.email || "No email"}</span>
                      </TableCell>

                      {/* Category & VIP */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                            {g.category}
                          </span>
                          {g.isVip && <Badge variant="vip">VIP</Badge>}
                        </div>
                      </TableCell>

                      {/* Allowed Pax */}
                      <TableCell>
                        <span className="font-semibold text-slate-900">
                          {g.allowedCompanions + 1} Pax
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          (+{g.allowedCompanions} guest{g.allowedCompanions === 1 ? "" : "s"})
                        </span>
                      </TableCell>

                      {/* RSVP Status */}
                      <TableCell>
                        <Badge className={rsvpCfg.color} size="sm">
                          {rsvpCfg.label}
                        </Badge>
                        {g.rsvpResponseTime && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {formatDate(g.rsvpResponseTime)}
                          </span>
                        )}
                      </TableCell>

                      {/* Reminder Status */}
                      <TableCell>
                        {g.reminderStatus === "suppressed" ? (
                          <Badge variant="outline" size="sm" className="text-slate-500 bg-slate-50">
                            Suppressed (RSVPed)
                          </Badge>
                        ) : g.reminderStatus === "scheduled" ? (
                          <Badge variant="info" size="sm">
                            Scheduled
                          </Badge>
                        ) : g.reminderStatus === "failed" ? (
                          <Badge variant="danger" size="sm">
                            Failed Delivery
                          </Badge>
                        ) : (
                          <Badge variant="default" size="sm">
                            {g.reminderStatus}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Gate Check-in */}
                      <TableCell>
                        <Badge className={checkInCfg.color} size="sm">
                          {checkInCfg.label}
                        </Badge>
                        {g.checkedInAt && (
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            {g.checkedInCount} Pax • {formatDate(g.checkedInAt)}
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditGuestModal(g)}
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-xs text-slate-500">
              Showing {paginatedGuests.length} of {guests.length} invitees
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </Button>
              <span className="text-xs font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Guest Modal */}
      <Modal
        isOpen={isGuestModalOpen}
        onClose={() => setIsGuestModalOpen(false)}
        title={editingGuest ? "Edit Invitee Details" : "Add New Invitee"}
        description="Configure guest profile, allowed companions, and contact information."
      >
        <form onSubmit={handleSaveGuest} className="space-y-4">
          <Input
            label="Full Name / Head of Family"
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="e.g. Vikramaditya Roy"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="WhatsApp Mobile Number"
              required
              value={guestMobile}
              onChange={(e) => setGuestMobile(e.target.value)}
              placeholder="+91 98200 12345"
              helperText="Include country code (e.g. +91)"
            />
            <Input
              label="Email Address"
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@domain.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={guestCategory}
              onChange={(e) => setGuestCategory(e.target.value as Guest["category"])}
              options={[
                { label: "General", value: "General" },
                { label: "Family", value: "Family" },
                { label: "Friend", value: "Friend" },
                { label: "VIP", value: "VIP" },
                { label: "VVIP", value: "VVIP" },
                { label: "Corporate", value: "Corporate" },
              ]}
            />
            <Input
              label="Total Allowed Pax (Including Companions)"
              type="number"
              min={1}
              max={10}
              required
              value={allowedPax}
              onChange={(e) => setAllowedPax(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vip_checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="vip_checkbox" className="text-xs font-medium text-slate-700">
              Designate as VIP Guest (Priority Hospitality & Escorted Seating)
            </label>
          </div>

          <Input
            label="City / Origin"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Mumbai, Maharashtra"
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Hospitality Notes & Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Ground floor preference; strict Jain food requirement."
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsGuestModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              {editingGuest ? "Save Changes" : "Add to Directory"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CSV Import 6-Step Wizard Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="CSV Guest Import Wizard"
        description={`Step ${importStep} of 6 • Automated Column Mapping & Duplicate Prevention`}
        maxWidth="3xl"
      >
        <div className="space-y-6">
          {/* Step Progress Header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
            <span className={importStep === 1 ? "font-bold text-indigo-600" : "text-slate-400"}>
              1. Upload
            </span>
            <span className={importStep === 2 ? "font-bold text-indigo-600" : "text-slate-400"}>
              2. Map Columns
            </span>
            <span className={importStep === 3 ? "font-bold text-indigo-600" : "text-slate-400"}>
              3. Preview
            </span>
            <span className={importStep === 4 ? "font-bold text-indigo-600" : "text-slate-400"}>
              4. Validation
            </span>
            <span className={importStep === 5 ? "font-bold text-indigo-600" : "text-slate-400"}>
              5. Duplicates
            </span>
            <span className={importStep === 6 ? "font-bold text-indigo-600" : "text-slate-400"}>
              6. Confirm
            </span>
          </div>

          {/* STEP 1: Upload CSV */}
          {importStep === 1 && (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-800">Select or Drag CSV File</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Upload a standard spreadsheet with columns like Full Name, Mobile Number, Category, Pax, and Email.
                </p>
              </div>

              <div className="flex justify-center">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={isAnalyzingCsv}
                  />
                  <span className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700">
                    <FileSpreadsheet className="w-4 h-4" />
                    {isAnalyzingCsv ? "Analyzing File Structure..." : "Browse CSV File"}
                  </span>
                </label>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 text-left text-xs border border-slate-200 text-slate-600 max-w-md mx-auto">
                <p className="font-semibold text-slate-800">Example CSV Header Structure:</p>
                <code className="text-[11px] font-mono text-indigo-700 block mt-1">
                  Full Name, Mobile Number, Guest Category, Allowed Pax, City
                </code>
              </div>
            </div>
          )}

          {/* STEP 2: Map Columns */}
          {importStep === 2 && importPreviewData && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                BizInvite automatically mapped the detected CSV headers to the guest database fields. Verify or modify the associations below:
              </p>

              <div className="rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                {importPreviewData.columnMappings.map((mapping, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded text-slate-800 font-semibold">
                        {mapping.csvHeader}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-indigo-700 font-semibold">{mapping.targetField}</span>
                    </div>
                    <Badge variant="success" size="sm">
                      Mapped
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setImportStep(1)}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setImportStep(3)}>
                  Proceed to Preview <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Preview Sample Rows */}
          {importStep === 3 && importPreviewData && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                First 4 sample records parsed from your uploaded spreadsheet:
              </p>

              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      {Object.keys(importPreviewData.previewRows[0] || {}).map((col) => (
                        <th key={col} className="px-3 py-2 font-semibold">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {importPreviewData.previewRows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {Object.values(row).map((val, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 text-slate-800 whitespace-nowrap">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setImportStep(2)}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setImportStep(4)}>
                  Review Validation <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Validation Results */}
          {importStep === 4 && importPreviewData && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                  <span className="text-xs text-emerald-800 font-semibold">Valid Rows</span>
                  <p className="text-xl font-bold text-emerald-700">{importPreviewData.validRows}</p>
                </div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                  <span className="text-xs text-rose-800 font-semibold">Critical Errors</span>
                  <p className="text-xl font-bold text-rose-700">{importPreviewData.errorRows}</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <span className="text-xs text-amber-800 font-semibold">Warnings / Duplicates</span>
                  <p className="text-xl font-bold text-amber-700">{importPreviewData.duplicateCount}</p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                {importPreviewData.validationIssues.map((issue, idx) => (
                  <div key={idx} className="p-3 flex items-start gap-2.5 text-xs">
                    {issue.severity === "error" ? (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-semibold text-slate-800">
                        Row #{issue.rowNumber} (Field: {issue.field}):
                      </span>
                      <p className="text-slate-600 mt-0.5">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setImportStep(3)}>
                  Back
                </Button>
                <Button size="sm" onClick={() => setImportStep(5)}>
                  Resolve Duplicates <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: Duplicate Resolution */}
          {importStep === 5 && importPreviewData && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                2 records match existing mobile numbers in this event. Choose action for each:
              </p>

              <div className="space-y-2">
                {importPreviewData.duplicates.map((dup, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3 bg-white flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{dup.name}</span>
                      <p className="text-slate-500 font-mono text-[11px]">{dup.mobile}</p>
                      <p className="text-[11px] text-amber-700">Matches existing: {dup.existingGuestName}</p>
                    </div>
                    <select
                      defaultValue={dup.action}
                      className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                    >
                      <option value="skip">Skip (Keep Existing)</option>
                      <option value="overwrite">Overwrite with New Data</option>
                    </select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setImportStep(4)}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleCommitImport}
                  isLoading={isCommittingImport}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Commit & Import Guests
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: Confirmation */}
          {importStep === 6 && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">Import Completed Successfully</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Added <b>{importSuccessCount || 22}</b> invitees to your event. Reminder schedules and WhatsApp templates are ready for dispatch.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStep(1);
                }}
              >
                Close & View Guest List
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </DashboardShell>
  );
}

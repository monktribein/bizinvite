"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useEvents } from "@/hooks/useEvents";
import { useAuth } from "@/lib/auth/context";
import { Event, EventSession } from "@/types/event";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils/formatters";
import {
  Calendar,
  Plus,
  Search,
  MapPin,
  Clock,
  Layers,
  Phone,
  Tag,
  PenLine,
  X,
} from "lucide-react";

export const PREDEFINED_EVENT_CATEGORIES = [
  { label: "Wedding & Celebrations", value: "wedding" },
  { label: "Corporate Summit & Meeting", value: "corporate" },
  { label: "Conference & Seminar", value: "conference" },
  { label: "Social Gala & Party", value: "social" },
  { label: "Birthday Celebration", value: "birthday" },
  { label: "Anniversary Celebration", value: "anniversary" },
  { label: "Engagement Ceremony", value: "engagement" },
  { label: "Exhibition & Trade Show", value: "exhibition" },
  { label: "Festival & Cultural Gathering", value: "cultural" },
  { label: "Concert & Performance", value: "concert" },
  { label: "Sports & Tournament", value: "sports" },
  { label: "Product Launch", value: "launch" },
  { label: "Workshop & Training", value: "workshop" },
  { label: "Reunion & Get-together", value: "reunion" },
  { label: "Charity & Fundraiser", value: "charity" },
  { label: "Baby Shower / Naming Ceremony", value: "babyshower" },
  { label: "Housewarming & Pooja", value: "housewarming" },
  { label: "Other (write your own)", value: "custom" },
];

export function getCategoryLabel(categoryKey?: string): string {
  if (!categoryKey) return "General";
  const found = PREDEFINED_EVENT_CATEGORIES.find(
    (c) => c.value.toLowerCase() === categoryKey.toLowerCase()
  );
  if (found && found.value !== "custom") {
    return found.label;
  }
  return categoryKey
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const CATEGORY_SUGGESTIONS: Record<string, string[]> = {
  wedding: ["Mehendi", "Sangeet", "Haldi", "Cocktail Party", "Ring Ceremony", "Reception"],
  corporate: ["Keynote Address", "Panel Discussion", "Networking Lunch", "Gala Dinner", "Award Presentation"],
  conference: ["Keynote Address", "Paper Presentations", "Breakout Sessions", "Q&A Session", "Closing Remarks"],
  social: ["Welcome Drinks", "Cocktails & Dinner", "Dance Floor", "After Party"],
  birthday: ["Welcome & Mingling", "Cake Cutting", "Games & Activities", "Dinner & Desserts"],
  anniversary: ["Champagne Toast", "Vow Renewal", "Anniversary Dinner", "Speeches & Slideshow"],
  engagement: ["Ring Ceremony", "Blessings", "Cocktails & Dinner", "DJ & Dance"],
  exhibition: ["VIP Opening", "Exhibitor Showcase", "Product Demos", "Buyer-Seller Meet"],
  cultural: ["Inauguration", "Cultural Performances", "Traditional Feast", "Folk Music"],
  concert: ["Opening Act", "Main Performance", "Encore", "Meet & Greet"],
  sports: ["Opening Ceremony", "Qualifying Rounds", "Grand Finale", "Trophy Presentation"],
  launch: ["Keynote Reveal", "Live Demo", "Media Q&A", "Networking Cocktail"],
  workshop: ["Introduction & Goals", "Hands-on Lab", "Group Exercise", "Wrap-up & Q&A"],
  reunion: ["Registration & Mingling", "Group Photos", "Memory Sharing", "Dinner & Dance"],
  charity: ["Welcome Address", "Charity Auction", "Keynote Speaker", "Appreciation Gala"],
  babyshower: ["Welcome & Blessing", "Baby Shower Games", "Gift Opening", "High Tea / Lunch"],
  housewarming: ["Griha Pravesh Pooja", "House Tour", "Blessings", "Celebratory Feast"],
};

export default function EventsPage() {
  const { events, isLoading, createEvent, isCreating } = useEvents();
  const { can, setCurrentEventId } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Event Form State
  const [eventName, setEventName] = useState("");
  const [category, setCategory] = useState<string>("wedding");
  const [customCategory, setCustomCategory] = useState("");
  const [customCategoryError, setCustomCategoryError] = useState("");
  const [startDate, setStartDate] = useState("2026-11-20T10:00");
  const [endDate, setEndDate] = useState("2026-11-22T23:00");
  const [rsvpDeadline, setRsvpDeadline] = useState("2026-11-05T23:59");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [dressCode, setDressCode] = useState("");
  const [functionsToInitialize, setFunctionsToInitialize] = useState<string[]>([
    "Welcome Dinner",
    "Main Ceremony",
  ]);
  const [newFunctionName, setNewFunctionName] = useState("");
  const [formError, setFormError] = useState("");

  const handleAddFunction = () => {
    const trimmed = newFunctionName.trim();
    if (!trimmed) return;
    if (functionsToInitialize.length >= 30) return;
    if (!functionsToInitialize.some((fn) => fn.toLowerCase() === trimmed.toLowerCase())) {
      setFunctionsToInitialize([...functionsToInitialize, trimmed]);
    }
    setNewFunctionName("");
  };

  const handleRemoveFunction = (index: number) => {
    setFunctionsToInitialize(functionsToInitialize.filter((_, i) => i !== index));
  };

  const handleAddSuggestedFunction = (suggested: string) => {
    if (functionsToInitialize.length >= 30) return;
    if (!functionsToInitialize.some((fn) => fn.toLowerCase() === suggested.toLowerCase())) {
      setFunctionsToInitialize([...functionsToInitialize, suggested]);
    }
  };

  const resetForm = () => {
    setEventName("");
    setVenueName("");
    setCity("");
    setAddress("");
    setDressCode("");
    setCategory("wedding");
    setCustomCategory("");
    setCustomCategoryError("");
    setFunctionsToInitialize(["Welcome Dinner", "Main Ceremony"]);
    setNewFunctionName("");
    setFormError("");
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.venue.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    const matchesCategory =
      categoryFilter === "all" ||
      (e.category && e.category.toLowerCase() === categoryFilter.toLowerCase());
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    let resolvedCategory = category;
    if (category === "custom") {
      const trimmed = customCategory.trim();
      if (!trimmed) {
        setCustomCategoryError("Please enter your custom category name.");
        return;
      }
      resolvedCategory = trimmed;
    }

    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const deadlineMs = new Date(rsvpDeadline).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || Number.isNaN(deadlineMs)) {
      setFormError("Please fill in valid start, end and RSVP deadline dates.");
      return;
    }
    if (endMs < startMs) {
      setFormError("End date/time must be after the start date/time.");
      return;
    }
    if (deadlineMs > endMs) {
      setFormError("RSVP deadline must be before the event ends.");
      return;
    }
    setFormError("");

    // Spread the functions evenly across the event window so none fall outside it
    const slotMs = functionsToInitialize.length > 0 ? (endMs - startMs) / functionsToInitialize.length : 0;
    const newSessions: EventSession[] = functionsToInitialize.map((fnName, idx) => {
      const sessionStart = new Date(startMs + idx * slotMs);
      const sessionEnd = new Date(sessionStart.getTime() + Math.min(slotMs, 3 * 3600000));
      return {
        id: `sess_custom_${Date.now()}_${idx}`,
        eventId: "",
        name: fnName,
        startTime: sessionStart.toISOString(),
        endTime: sessionEnd.toISOString(),
      };
    });

    try {
    await createEvent({
      name: eventName.trim(),
      category: resolvedCategory,
      status: "upcoming",
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      rsvpDeadline: new Date(rsvpDeadline).toISOString(),
      venue: {
        name: venueName,
        city,
        address,
      },
      dressCode,
      sessions: newSessions,
      hosts: [{ name: "Organizing Committee", relationship: "Host" }],
      contactPersons: [{ name: "Hospitality Lead", role: "Manager", phone: "+91 98200 11223" }],
      languages: ["English", "Hindi"],
      checkInConfig: {
        allowMultipleEntries: true,
        requirePassVerification: true,
        activeGates: ["Gate 1 (Main)"],
      },
    });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not create the event. Please try again.");
      return;
    }

    setIsCreateModalOpen(false);
    resetForm();
  };

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            Event Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure multi-session celebrations, venue details, RSVP deadlines and gate setups.
          </p>
        </div>

        {can("events:create") && (
          <Button
            onClick={() => {
              resetForm();
              setIsCreateModalOpen(true);
            }}
            className="text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Create New Event
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by event title, venue, city, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="w-full md:w-56">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Categories</option>
            {PREDEFINED_EVENT_CATEGORIES.filter((c) => c.value !== "custom").map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-44">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading events...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="p-12 text-center text-xs text-slate-400 border border-slate-200 rounded-xl bg-white">
          No events match the specified filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const isCompleted = evt.status === "completed";
            const isActive = evt.status === "active";

            return (
              <Card key={evt.id} className="flex flex-col justify-between hover:border-slate-300 transition-all">
                <CardHeader className="pb-3 border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant={isActive ? "success" : isCompleted ? "default" : "info"}
                      size="sm"
                    >
                      {evt.status.toUpperCase()}
                    </Badge>
                    <span className="inline-flex items-center rounded-md bg-indigo-50/80 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 tracking-wide border border-indigo-100">
                      <Tag className="w-3 h-3 mr-1 text-indigo-500" />
                      {getCategoryLabel(evt.category)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-2 line-clamp-1">{evt.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-1">{evt.description}</p>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{formatDate(evt.startDate, false)} to {formatDate(evt.endDate, false)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{evt.venue.name}, {evt.venue.city}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{evt.sessions?.length || 0} Scheduled Functions / Sessions</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>RSVP Deadline: {formatDate(evt.rsvpDeadline)}</span>
                    </div>
                  </div>

                  {/* Multi-session Pills */}
                  {evt.sessions && evt.sessions.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {evt.sessions.map((sess) => (
                        <span
                          key={sess.id}
                          className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {sess.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setSelectedEventForDetail(evt)}
                    >
                      View Details
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="text-xs shrink-0"
                      onClick={() => setCurrentEventId(evt.id)}
                    >
                      Select Scope
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEventForDetail && (
        <Modal
          isOpen={!!selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          title={selectedEventForDetail.name}
          description={`${selectedEventForDetail.venue.name}, ${selectedEventForDetail.venue.city}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Category</span>
                <p className="font-semibold text-indigo-700">
                  {getCategoryLabel(selectedEventForDetail.category)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Dates</span>
                <p className="font-semibold text-slate-800">
                  {formatDate(selectedEventForDetail.startDate)} – {formatDate(selectedEventForDetail.endDate)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">RSVP Deadline</span>
                <p className="font-semibold text-slate-800">
                  {formatDate(selectedEventForDetail.rsvpDeadline)}
                </p>
              </div>
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Dress Code</span>
                <p className="font-semibold text-slate-800">{selectedEventForDetail.dressCode || "Not specified"}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Languages</span>
                <p className="font-semibold text-slate-800">{selectedEventForDetail.languages.join(", ")}</p>
              </div>
            </div>

            {/* Sessions Breakdown */}
            <div>
              <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2 tracking-wider">
                Event Functions & Sub-Sessions ({selectedEventForDetail.sessions.length}):
              </h4>
              <div className="space-y-2">
                {selectedEventForDetail.sessions.map((sess) => (
                  <div key={sess.id} className="rounded-lg border border-slate-200 p-3 bg-white">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{sess.name}</span>
                      <span className="text-slate-500 font-medium">
                        {formatDate(sess.startTime)}
                      </span>
                    </div>
                    {sess.venueName && <p className="text-slate-500 mt-1">Venue: {sess.venueName}</p>}
                    {sess.dressCode && <p className="text-slate-500">Dress: {sess.dressCode}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Hosts & Concierge */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1.5 tracking-wider">
                Hospitality & Concierge:
              </h4>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                {selectedEventForDetail.contactPersons?.map((cp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cp.name} ({cp.phone})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCurrentEventId(selectedEventForDetail.id);
                  setSelectedEventForDetail(null);
                }}
              >
                Set as Active Event
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Event Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Event"
        description="Set up an event with venue information, multiple functions, and deadlines."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <Input
            label="Event Name"
            required
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g. Kapoor & Sethi Wedding Celebrations"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Event Category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCustomCategoryError("");
                  if (e.target.value !== "custom") {
                    setCustomCategory("");
                  }
                }}
                options={PREDEFINED_EVENT_CATEGORIES}
              />
              {category === "custom" && (
                <div className="mt-2">
                  <Input
                    value={customCategory}
                    onChange={(e) => {
                      setCustomCategory(e.target.value);
                      if (customCategoryError) setCustomCategoryError("");
                    }}
                    placeholder="e.g. Hackathon, Fashion Show, Award Night"
                    maxLength={100}
                    required
                    autoFocus
                    error={customCategoryError}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Shown on passes, RSVP links and reports.</p>
                </div>
              )}
              {category !== "custom" && (
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">Not listed?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory("custom");
                      setCustomCategoryError("");
                    }}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                  >
                    <PenLine className="w-3 h-3" />
                    Write your own category
                  </button>
                </div>
              )}
            </div>

            <Input
              label="RSVP Deadline"
              type="datetime-local"
              required
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Start Date / Time"
              type="datetime-local"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End Date / Time"
              type="datetime-local"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Primary Venue Name"
              required
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. The Oberoi Udaivilas"
            />
            <Input
              label="City / Location"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Udaipur, Rajasthan"
            />
          </div>

          <Input
            label="Venue Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Haridas Ji Ki Magri, Udaipur"
          />

          <Input
            label="Dress Code / Theme"
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            placeholder="e.g. Traditional Royal / Festive Ethnic"
          />

          {/* Functions & Sessions to Initialize */}
          {(() => {
            const categoryKey = category.toLowerCase();
            const suggestions = (
              CATEGORY_SUGGESTIONS[categoryKey] || [
                "Opening Ceremony",
                "Welcome Reception",
                "Main Session",
                "Networking Dinner",
              ]
            ).filter(
              (sug) => !functionsToInitialize.some((fn) => fn.toLowerCase() === sug.toLowerCase())
            );

            return (
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                      Functions & Sessions to Initialize ({functionsToInitialize.length})
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Add sub-events such as Sangeet, Haldi, Reception, Keynote, or Dinner Party.
                    </p>
                  </div>
                  {functionsToInitialize.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFunctionsToInitialize([])}
                      className="text-[11px] text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Current functions chips with delete buttons */}
                <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
                  {functionsToInitialize.map((fnName, idx) => (
                    <span
                      key={fnName}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs text-indigo-800 font-medium shadow-2xs"
                    >
                      <span>{fnName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFunction(idx)}
                        className="rounded-full p-0.5 text-indigo-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title={`Remove ${fnName}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {functionsToInitialize.length === 0 && (
                    <span className="text-xs text-slate-400 italic">
                      No functions added yet. Type a function name below or pick a suggestion.
                    </span>
                  )}
                </div>

                {/* Input to add a new custom function */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFunctionName}
                    onChange={(e) => setNewFunctionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddFunction();
                      }
                    }}
                    placeholder="Type function name (e.g. Sangeet, Reception, Keynote)..."
                    maxLength={200}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddFunction}
                    className="text-xs shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Function
                  </Button>
                </div>

                {/* Quick Suggestions */}
                {suggestions.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/70">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Suggested for this event category:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.slice(0, 6).map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => handleAddSuggestedFunction(sug)}
                          className="rounded-md bg-white border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all font-medium inline-flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3 h-3 text-indigo-500" />
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isCreating}>
              Save & Create Event
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}

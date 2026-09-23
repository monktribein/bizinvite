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
} from "lucide-react";

export default function EventsPage() {
  const { events, isLoading, createEvent } = useEvents();
  const { can, setCurrentEventId } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<Event | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Event Form State
  const [eventName, setEventName] = useState("");
  const [category, setCategory] = useState<Event["category"]>("wedding");
  const [startDate, setStartDate] = useState("2026-11-20T10:00");
  const [endDate, setEndDate] = useState("2026-11-22T23:00");
  const [rsvpDeadline, setRsvpDeadline] = useState("2026-11-05T23:59");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [dressCode, setDressCode] = useState("");
  const defaultSessions = [
    { name: "Welcome Dinner", date: "2026-11-20T19:00" },
    { name: "Main Ceremony", date: "2026-11-21T18:00" },
  ];

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.venue.city.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSessions: EventSession[] = defaultSessions.map((s, idx) => ({
      id: `sess_custom_${Date.now()}_${idx}`,
      eventId: "",
      name: s.name,
      startTime: new Date(s.date).toISOString(),
      endTime: new Date(new Date(s.date).getTime() + 4 * 3600000).toISOString(),
    }));

    await createEvent({
      name: eventName,
      category,
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

    setIsCreateModalOpen(false);
    // Reset form
    setEventName("");
    setVenueName("");
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
          <Button onClick={() => setIsCreateModalOpen(true)} className="text-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Create New Event
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by event title, venue, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>

        <div className="w-full sm:w-48">
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
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {evt.category}
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
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
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
              <div>
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

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Event Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as Event["category"])}
              options={[
                { label: "Wedding", value: "wedding" },
                { label: "Corporate Summit", value: "corporate" },
                { label: "Conference", value: "conference" },
                { label: "Social Gala", value: "social" },
              ]}
            />
            <Input
              label="RSVP Deadline"
              type="datetime-local"
              required
              value={rsvpDeadline}
              onChange={(e) => setRsvpDeadline(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-xs font-semibold text-slate-800 block mb-2">
              Default Functions to initialize:
            </span>
            <div className="flex gap-2">
              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs text-indigo-700 font-medium">
                Welcome Dinner
              </span>
              <span className="rounded bg-indigo-50 border border-indigo-200 px-2 py-1 text-xs text-indigo-700 font-medium">
                Main Ceremony
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save & Create Event
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}

import type { EventDoc } from "../events/model";
import type { EventGuestDoc } from "../guests/model";
import type { VariableContext } from "./variables";

function formatDate(date: Date | undefined | null, timeZone: string, style: "date" | "time" | "datetime" = "date"): string {
  if (!date) return "";
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { dateStyle: "medium", timeZone }
      : style === "time"
        ? { timeStyle: "short", timeZone }
        : { dateStyle: "medium", timeStyle: "short", timeZone };
  return new Intl.DateTimeFormat("en-IN", options).format(date);
}

/** Values for template placeholders, derived from the event and invitation. */
export function buildVariableContext(input: {
  event: EventDoc;
  invitation?: Pick<EventGuestDoc, "name" | "allowedCompanions"> | null;
  organizationName?: string;
  sessionNames?: string[];
  pass?: { passCode: string; url?: string };
}): VariableContext {
  const { event } = input;
  const tz = event.timezone ?? "Asia/Kolkata";
  return {
    guest_name: input.invitation?.name ?? "Guest",
    event_name: event.name,
    event_date: formatDate(event.startDate, tz, "date"),
    event_time: formatDate(event.startDate, tz, "time"),
    venue: event.venue?.name ?? "",
    venue_address: [event.venue?.address, event.venue?.city].filter(Boolean).join(", "),
    venue_city: event.venue?.city ?? "",
    rsvp_deadline: formatDate(event.rsvpDeadline, tz, "date"),
    dress_code: event.dressCode ?? "",
    host_names: (event.hosts ?? []).map((h) => h.name).filter(Boolean).join(" & "),
    companions_allowed: String(input.invitation?.allowedCompanions ?? 0),
    session_names: (input.sessionNames ?? []).join(", "),
    organization_name: input.organizationName ?? "",
    pass_code: input.pass?.passCode ?? "",
    pass_url: input.pass?.url ?? "",
  };
}

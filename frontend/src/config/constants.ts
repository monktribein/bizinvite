export const APP_NAME = "BizInvite";
export const APP_TAGLINE = "Event Invitation, RSVP & Reminder Automation Platform";

export const RSVP_STATUS_CONFIG = {
  attending: { label: "Attending", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", color: "bg-rose-50 text-rose-700 border-rose-200" },
  maybe: { label: "Maybe", color: "bg-amber-50 text-amber-700 border-amber-200" },
  no_response: { label: "No Response", color: "bg-slate-100 text-slate-700 border-slate-200" },
  incomplete: { label: "Incomplete", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

export const CAMPAIGN_STATUS_CONFIG = {
  draft: { label: "Draft", color: "bg-slate-100 text-slate-700 border-slate-200" },
  scheduled: { label: "Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200" },
  running: { label: "Running", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  paused: { label: "Paused", color: "bg-amber-50 text-amber-700 border-amber-200" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", color: "bg-rose-50 text-rose-700 border-rose-200" },
  cancelled: { label: "Cancelled", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const CHECKIN_STATUS_CONFIG = {
  not_checked_in: { label: "Not Checked In", color: "bg-slate-100 text-slate-600 border-slate-200" },
  checked_in: { label: "Checked In", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  partially_checked_in: { label: "Partially Admitted", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export const PASS_STATUS_CONFIG = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  used: { label: "Admitted / Used", color: "bg-blue-50 text-blue-700 border-blue-200" },
  revoked: { label: "Revoked", color: "bg-rose-50 text-rose-700 border-rose-200" },
  expired: { label: "Expired", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

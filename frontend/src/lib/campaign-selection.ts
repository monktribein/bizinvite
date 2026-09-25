/**
 * Hands a guest selection from the Guests page to the campaign form.
 *
 * Selections can hold thousands of ids, too many for a URL, so they are kept in memory and
 * mirrored to sessionStorage to survive a page reload. The server re-validates every id.
 *
 * The "open the form" request travels with the selection instead of in the URL: on a client
 * navigation the App Router updates window.location only after the new page has rendered, so
 * the destination page cannot read a query string during its first render.
 */
export interface CampaignGuestSelection {
  eventId: string;
  eventGuestIds: string[];
  /** Set by "Send invitation to N selected"; cleared once the campaigns page opened the form. */
  openComposer?: boolean;
}

const STORAGE_KEY = "bizinvite_campaign_guest_selection";
let pending: CampaignGuestSelection | null = null;

function persist(selection: CampaignGuestSelection | null): void {
  try {
    if (selection) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode, quota): the in-memory copy still works for this visit.
  }
}

export function setCampaignSelection(selection: CampaignGuestSelection): void {
  pending = selection;
  persist(selection);
}

export function getCampaignSelection(): CampaignGuestSelection | null {
  if (pending) return pending;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignGuestSelection>;
    if (typeof parsed.eventId !== "string" || !Array.isArray(parsed.eventGuestIds)) return null;
    pending = {
      eventId: parsed.eventId,
      eventGuestIds: parsed.eventGuestIds.filter((id): id is string => typeof id === "string"),
      openComposer: parsed.openComposer === true,
    };
    return pending;
  } catch {
    return null;
  }
}

/** The selection, when the Guests page asked for the campaign form to open with it. */
export function getComposeRequest(): CampaignGuestSelection | null {
  const selection = getCampaignSelection();
  return selection?.openComposer ? selection : null;
}

/** Keeps the selection but stops it from reopening the form on later visits. */
export function markComposerOpened(): void {
  const selection = getCampaignSelection();
  if (selection?.openComposer) setCampaignSelection({ ...selection, openComposer: false });
}

export function clearCampaignSelection(): void {
  pending = null;
  persist(null);
}

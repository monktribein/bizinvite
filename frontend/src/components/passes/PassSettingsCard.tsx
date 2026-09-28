"use client";

import React, { useState } from "react";
import { Settings2, Save } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useEventDetail, useEvents } from "@/hooks/useEvents";
import { Event } from "@/types/event";
import { WhatsAppTemplate } from "@/types/campaign";

/** Whether a template can deliver a pass: the QR as IMAGE header, or the pass code / link in its text. */
export function templateCarriesPass(t: WhatsAppTemplate): boolean {
  if (t.headerType === "IMAGE") return true;
  const fields = [...t.variables, t.headerVariable, ...(t.buttons ?? []).map((b) => b.urlVariable)];
  return fields.some((f) => f === "pass_code" || f === "pass_url");
}

interface Props {
  eventId: string;
}

/** Event-level pass settings: the WhatsApp template used to send passes, and the gates used at check-in. */
export function PassSettingsCard({ eventId }: Props) {
  const { data: event } = useEventDetail(eventId);
  if (!event) return null;
  // Keyed by event so the form resets when the organizer switches events.
  return <PassSettingsForm key={`${event.id}:${event.updatedAt}`} event={event} />;
}

function PassSettingsForm({ event }: { event: Event }) {
  const { updateEvent, isUpdating } = useEvents();
  const { templates, isLoadingTemplates } = useCampaigns(event.id);
  const [open, setOpen] = useState(!event.communication?.passTemplateId);
  const [templateId, setTemplateId] = useState(event.communication?.passTemplateId ?? "");
  const [gatesText, setGatesText] = useState((event.checkInConfig?.activeGates ?? []).join("\n"));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const usable = templates.filter((t) => t.approvalStatus === "APPROVED" && !t.mappingProblems?.length);
  const current = templates.find((t) => t.id === templateId);

  const save = async () => {
    const activeGates = [...new Set(gatesText.split("\n").map((g) => g.trim()).filter(Boolean))];
    setMessage(null);
    try {
      await updateEvent({
        id: event.id,
        updates: {
          communication: { passTemplateId: templateId || null },
          checkInConfig: { ...event.checkInConfig, activeGates },
        },
      });
      setMessage({ ok: true, text: "Pass settings saved." });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Could not save the settings." });
    }
  };

  return (
    <Card className="mb-4">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 p-3.5 text-left text-xs cursor-pointer"
        >
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            <Settings2 className="h-4 w-4 text-indigo-600" /> Pass &amp; gate settings
          </span>
          <span className="text-slate-500">
            {event.communication?.passTemplateId ? "Pass template set" : "No pass template yet"} · {event.checkInConfig?.activeGates?.length || 0} gate(s)
          </span>
        </button>

        {open && (
          <div className="grid gap-4 border-t border-slate-100 p-4 text-xs md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block font-semibold uppercase tracking-wider text-slate-700">WhatsApp pass template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={isLoadingTemplates}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              >
                <option value="">— None —</option>
                {usable.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.language}){templateCarriesPass(t) ? "" : " – no QR/pass field"}
                  </option>
                ))}
              </select>
              <p className="text-slate-500">
                Used by &quot;Send&quot; and &quot;Send all passes&quot;. Best: a template approved with an <b>IMAGE header</b> (the QR is sent as the
                image), or one that maps <code>pass_code</code> / <code>pass_url</code>.
              </p>
              {current && !templateCarriesPass(current) && (
                <p className="text-amber-700">This template has no image header or pass field, so guests would not receive their QR.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold uppercase tracking-wider text-slate-700">Entry gates (one per line)</label>
              <textarea
                value={gatesText}
                onChange={(e) => setGatesText(e.target.value)}
                rows={4}
                placeholder={"Main Gate\nVIP Entrance"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
              <p className="text-slate-500">Shown in the gate selector on the Check-in page.</p>
            </div>

            <div className="flex items-center justify-end gap-3 md:col-span-2">
              {message && <span className={message.ok ? "text-emerald-700" : "text-rose-600"}>{message.text}</span>}
              <Button size="sm" onClick={save} isLoading={isUpdating}>
                <Save className="mr-1.5 h-3.5 w-3.5" /> Save settings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

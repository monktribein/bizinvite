"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { TemplateMappingInput, WhatsAppTemplate } from "@/types/campaign";

/** Friendly names for the backend's supported template fields. */
const FIELD_LABELS: Record<string, string> = {
  guest_name: "Guest name",
  event_name: "Event name",
  event_date: "Event date",
  event_time: "Event time",
  venue: "Venue name",
  venue_address: "Venue address",
  venue_city: "Venue city",
  rsvp_deadline: "RSVP deadline",
  dress_code: "Dress code",
  host_names: "Host names",
  companions_allowed: "Companions allowed",
  session_names: "Session names",
  organization_name: "Organization name",
  pass_code: "Pass code",
  pass_url: "Pass link",
};

const QUICK_REPLY_ACTIONS = [
  { value: "ACTION_RSVP_YES", label: "RSVP: Attending" },
  { value: "ACTION_RSVP_NO", label: "RSVP: Declined" },
  { value: "ACTION_RSVP_MAYBE", label: "RSVP: Maybe" },
  { value: "ACTION_OPT_OUT", label: "Opt out of messages" },
];

const selectClass = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900";

function FieldSelect({ value, onChange, fields, label }: { value: string; onChange: (v: string) => void; fields: string[]; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="">Choose a field...</option>
      {fields.map((f) => (
        <option key={f} value={f}>
          {FIELD_LABELS[f] ?? f}
        </option>
      ))}
    </select>
  );
}

/**
 * Binds a Meta template's placeholders to BizInvite fields: body placeholders, a TEXT header
 * placeholder, dynamic URL buttons, quick-reply actions and a default header media link.
 */
export function TemplateMappingModal({
  template,
  fields,
  onClose,
  onSave,
}: {
  template: WhatsAppTemplate;
  fields: string[];
  onClose: () => void;
  onSave: (mapping: TemplateMappingInput) => Promise<unknown>;
}) {
  const isField = (v?: string) => !!v && fields.includes(v);
  const names = template.parameterNames?.length === template.variables.length ? template.parameterNames : template.variables.map((_, i) => String(i + 1));
  const [body, setBody] = useState<string[]>(template.variables.map((v) => (isField(v) ? v : "")));
  const [header, setHeader] = useState(isField(template.headerVariable) ? template.headerVariable! : "");
  const [urlVars, setUrlVars] = useState<string[]>(template.buttons.map((b) => (isField(b.urlVariable) ? b.urlVariable! : "")));
  const [actions, setActions] = useState<string[]>(template.buttons.map((b) => b.payload ?? ""));
  const [mediaUrl, setMediaUrl] = useState(template.headerMediaUrl ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mediaHeader = ["IMAGE", "VIDEO", "DOCUMENT"].includes(template.headerType ?? "");

  const missing =
    body.some((v) => !v) ||
    (!!template.headerParameterName && !header) ||
    template.buttons.some((b, i) => b.type === "URL" && b.dynamicUrl && !urlVars[i]);

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      await onSave({
        variables: body,
        ...(template.headerParameterName ? { headerVariable: header || null } : {}),
        buttonUrlVariables: template.buttons.map((b, i) => (b.type === "URL" && b.dynamicUrl ? urlVars[i] || null : null)),
        buttonPayloads: template.buttons.map((b, i) => (b.type === "QUICK_REPLY" ? actions[i] || null : null)),
        ...(mediaHeader ? { headerMediaUrl: mediaUrl.trim() || null } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError && err.fields ? Object.values(err.fields).flat().join(" ") : err instanceof Error ? err.message : "Could not save the mapping.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Map fields: ${template.name}`} description="Choose which guest or event detail fills each placeholder of this WhatsApp template." maxWidth="2xl">
      <div className="space-y-4 text-xs">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 whitespace-pre-line text-slate-800">
          {template.headerType === "TEXT" && template.headerContent && <p className="font-bold mb-1">{template.headerContent}</p>}
          {template.bodyText}
        </div>

        {body.length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Message body</span>
            {body.map((value, i) => (
              <div key={i} className="grid grid-cols-[6rem_1fr] items-center gap-2">
                <code className="font-mono text-indigo-700">{`{{${names[i]}}}`}</code>
                <FieldSelect label={`Field for {{${names[i]}}}`} value={value} fields={fields} onChange={(v) => setBody((b) => b.map((x, j) => (j === i ? v : x)))} />
              </div>
            ))}
          </div>
        )}

        {template.headerParameterName && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Header</span>
            <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
              <code className="font-mono text-indigo-700">{`{{${template.headerParameterName}}}`}</code>
              <FieldSelect label="Field for the header placeholder" value={header} fields={fields} onChange={setHeader} />
            </div>
          </div>
        )}

        {template.buttons.some((b) => b.type === "QUICK_REPLY" || (b.type === "URL" && b.dynamicUrl)) && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Buttons</span>
            {template.buttons.map((b, i) =>
              b.type === "QUICK_REPLY" ? (
                <div key={i} className="grid grid-cols-[10rem_1fr] items-center gap-2">
                  <span className="font-semibold text-slate-700 truncate">{b.text}</span>
                  <select
                    aria-label={`Action for button ${b.text}`}
                    value={actions[i]}
                    onChange={(e) => setActions((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    className={selectClass}
                  >
                    <option value="">No action</option>
                    {QUICK_REPLY_ACTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : b.type === "URL" && b.dynamicUrl ? (
                <div key={i} className="grid grid-cols-[10rem_1fr] items-center gap-2">
                  <span className="font-semibold text-slate-700 truncate" title={b.url}>
                    {b.text} (link)
                  </span>
                  <FieldSelect label={`Field for the link of ${b.text}`} value={urlVars[i]} fields={fields} onChange={(v) => setUrlVars((u) => u.map((x, j) => (j === i ? v : x)))} />
                </div>
              ) : null
            )}
          </div>
        )}

        {mediaHeader && (
          <div className="space-y-1">
            <label htmlFor="header_media_url" className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Default {template.headerType?.toLowerCase()} link (optional)
            </label>
            <input
              id="header_media_url"
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="https://..."
              className={selectClass}
            />
            <p className="text-slate-500">
              {template.headerType === "DOCUMENT"
                ? "Required: a public https link to the document sent with every message."
                : "Used when a campaign has no attachment. Campaign attachments always take priority."}
            </p>
          </div>
        )}

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} isLoading={saving} disabled={missing}>
            Save Mapping
          </Button>
        </div>
      </div>
    </Modal>
  );
}

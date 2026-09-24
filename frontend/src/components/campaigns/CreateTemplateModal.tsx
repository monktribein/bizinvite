"use client";

import React, { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/client";
import { CreateLocalTemplateInput } from "@/types/campaign";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Placeholder names the backend can fill, e.g. guest_name. */
  variables: string[];
  onCreate: (input: CreateLocalTemplateInput) => Promise<unknown>;
}

const DEFAULT_BODY =
  "Dear {{guest_name}},\n\nYou are warmly invited to {{event_name}} on {{event_date}} at {{venue}}.\n\nKindly confirm your attendance by {{rsvp_deadline}}.";

/** Creates a local test template while WhatsApp is not connected (dry-run mode). */
export function CreateTemplateModal({ isOpen, onClose, variables, onCreate }: CreateTemplateModalProps) {
  const [name, setName] = useState("wedding_invitation");
  const [bodyText, setBodyText] = useState(DEFAULT_BODY);
  const [withRsvpButtons, setWithRsvpButtons] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const usedPlaceholders = [...new Set([...bodyText.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
  const unknownPlaceholders = usedPlaceholders.filter((p) => !variables.includes(p));

  const insertVariable = (variable: string) => {
    const el = bodyRef.current;
    const token = `{{${variable}}}`;
    if (!el) {
      setBodyText((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? bodyText.length;
    const end = el.selectionEnd ?? bodyText.length;
    setBodyText(bodyText.slice(0, start) + token + bodyText.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (unknownPlaceholders.length) {
      setError(`Unknown placeholders: ${unknownPlaceholders.map((p) => `{{${p}}}`).join(", ")}`);
      return;
    }
    setIsSaving(true);
    try {
      await onCreate({
        name,
        bodyText,
        buttons: withRsvpButtons
          ? [
              { type: "QUICK_REPLY", text: "Yes, attending" },
              { type: "QUICK_REPLY", text: "Regretfully no" },
            ]
          : [],
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setError(Object.values(err.fields).flat().join(" ") || err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not create the template.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const previewText = bodyText.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => `[${key.replace(/_/g, " ")}]`);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Test Template"
      description="WhatsApp is not connected yet, so messages are only logged, not sent. Use a test template to try campaigns end to end."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Template Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
          placeholder="wedding_invitation"
        />

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Message Text
          </label>
          <textarea
            ref={bodyRef}
            required
            rows={6}
            maxLength={1024}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
          <p className="text-[11px] text-slate-500 mt-1.5 mb-1">Click to insert guest or event details:</p>
          <div className="flex flex-wrap gap-1.5">
            {variables.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVariable(v)}
                className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100 cursor-pointer"
              >
                {`{{${v}}}`}
              </button>
            ))}
          </div>
          {unknownPlaceholders.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5">
              Unknown placeholders: {unknownPlaceholders.map((p) => `{{${p}}}`).join(", ")}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={withRsvpButtons} onChange={(e) => setWithRsvpButtons(e.target.checked)} />
          Add RSVP reply buttons (&quot;Yes, attending&quot; / &quot;Regretfully no&quot;)
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Preview:</span>
          <div className="rounded-lg bg-white p-3 border border-emerald-200/90 text-xs shadow-2xs">
            <p className="whitespace-pre-line text-slate-800 leading-relaxed">{previewText}</p>
            {withRsvpButtons && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">Yes, attending</span>
                <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">Regretfully no</span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isSaving} disabled={unknownPlaceholders.length > 0}>
            Create Template
          </Button>
        </div>
      </form>
    </Modal>
  );
}

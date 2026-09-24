import { describe, expect, it } from "vitest";
import { setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

describe("templates", () => {
  it("reports the WhatsApp mode so the UI can offer local templates or Meta sync", async () => {
    const t = await setupTenant();
    const res = await t.api.get("/api/v1/templates/variables");
    expect(res.status).toBe(200);
    expect(res.body.data.whatsapp).toEqual({ configured: false, dryRun: true });
    expect(res.body.data.variables).toContain("guest_name");
  });

  it("creates sendable local templates in dry-run mode from named placeholders", async () => {
    const t = await setupTenant();
    const res = await t.api.post("/api/v1/templates", {
      name: "wedding_invite",
      bodyText: "Dear {{guest_name}}, you are invited to {{event_name}} on {{event_date}}.",
      buttons: [
        { type: "QUICK_REPLY", text: "Yes, attending" },
        { type: "QUICK_REPLY", text: "Regretfully no" },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      name: "wedding_invite",
      approvalStatus: "APPROVED",
      source: "local",
      variables: ["guest_name", "event_name", "event_date"],
      buttons: [
        { text: "Yes, attending", payload: "ACTION_RSVP_YES" },
        { text: "Regretfully no", payload: "ACTION_RSVP_NO" },
      ],
    });
    expect((await t.api.get("/api/v1/templates")).body.data).toHaveLength(1);
  });

  it("rejects placeholders that no business field can fill", async () => {
    const t = await setupTenant();
    const named = await t.api.post("/api/v1/templates", { name: "bad_named", bodyText: "Hi {{guest_name}}, table {{table_no}}" });
    expect(named.status).toBe(422);
    expect(named.body.error.message).toContain("{{table_no}}");

    const positional = await t.api.post("/api/v1/templates", { name: "bad_positional", bodyText: "Hi {{1}}" });
    expect(positional.status).toBe(422);
  });
});

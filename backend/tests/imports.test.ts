import { describe, expect, it } from "vitest";
import { Consent, EventGuest, Guest } from "../src/modules/guests/model";
import { Import } from "../src/modules/imports/model";
import { runDueJobs } from "../src/scheduler/job-runner";
import { createEvent, createGuest, jobsOfType, setupTenant, useTestDatabase } from "./helpers";

useTestDatabase();

const CSV = [
  "Full Name,Mobile Number,Category,Companions,Family",
  "Asha Mehta,9820011111,VIP,2,Mehta Family",
  "Bala Iyer,+91 98200 22222,Corporate,0,",
  "Bad Mobile,98200333,General,0,",
  "Asha Duplicate,09820011111,Family,1,",
  "Existing Guest,9820099999,Friend,1,",
  ",9820055555,General,0,",
].join("\n");

async function preview(t: Awaited<ReturnType<typeof setupTenant>>, csv = CSV, fileName = "guests.csv") {
  return t.api.upload("/api/v1/imports/guests/preview").attach("file", Buffer.from(csv), { filename: fileName, contentType: "text/csv" });
}

describe("CSV import", () => {
  it("previews with auto-mapping, validation issues and duplicate detection", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id, { name: "Already Here", mobile: "9820099999" });

    const res = await preview(t);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalRows).toBe(6);
    expect(data.validRows).toBe(4);
    expect(data.errorRows).toBe(2);
    expect(data.columnMappings).toEqual(
      expect.arrayContaining([
        { csvHeader: "Full Name", targetField: "name" },
        { csvHeader: "Mobile Number", targetField: "mobile" },
        { csvHeader: "Companions", targetField: "allowedCompanions" },
      ])
    );
    expect(data.validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 3, field: "mobile", severity: "error" }),
        expect.objectContaining({ rowNumber: 6, field: "name", severity: "error" }),
      ])
    );
    expect(data.duplicates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rowNumber: 4, existingGuestName: "Asha Mehta", action: "skip" }),
        expect.objectContaining({ rowNumber: 5, existingGuestName: "Already Here", action: "skip" }),
      ])
    );
    expect(data.previewRows).toHaveLength(5);
  });

  it("commits: creates new guests, skips or overwrites duplicates, records consent", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    await createGuest(t, event.id, { name: "Already Here", mobile: "9820099999" });
    const { body } = await preview(t);

    const commit = await t.api.post("/api/v1/imports/guests", {
      importId: body.data.importId,
      eventId: event.id,
      columnMappings: body.data.columnMappings,
      duplicateResolutions: { row_4: "skip", row_5: "overwrite" },
    });
    expect(commit.status).toBe(200);
    expect(commit.body.data).toMatchObject({
      status: "completed",
      importedCount: 2,
      createdCount: 2,
      updatedCount: 1,
      duplicateRows: 1,
      invalidRows: 2,
      successfulRows: 3,
    });

    const asha = await Guest.findOne({ organizationId: t.org.id, mobile: "+919820011111" });
    expect(asha!.name).toBe("Asha Mehta"); // row 4 duplicate was skipped
    expect(asha!.consentSource).toBe("csv_import");
    const overwritten = await Guest.findOne({ organizationId: t.org.id, mobile: "+919820099999" });
    expect(overwritten!.name).toBe("Existing Guest");
    expect(await EventGuest.countDocuments({ organizationId: t.org.id, eventId: event.id })).toBe(3);
    expect(await Consent.countDocuments({ organizationId: t.org.id, source: "csv_import" })).toBe(2);

    const status = await t.api.get(`/api/v1/imports/${body.data.importId}`);
    expect(status.body.data.status).toBe("completed");

    // A second commit of the same import is refused.
    const again = await t.api.post("/api/v1/imports/guests", { importId: body.data.importId, eventId: event.id });
    expect(again.status).toBe(409);
  });

  it("runs large imports as a scheduled job instead of blocking the request", async () => {
    const t = await setupTenant();
    const event = await createEvent(t);
    const rows = Array.from({ length: 600 }, (_, i) => `Guest ${i},98${String(10000000 + i).padStart(8, "0")}`);
    const { body } = await preview(t, ["Name,Mobile", ...rows].join("\n"));
    const commit = await t.api.post("/api/v1/imports/guests", { importId: body.data.importId, eventId: event.id });
    expect(commit.status).toBe(202);
    expect(commit.body.data.status).toBe("pending");
    expect(await EventGuest.countDocuments({ organizationId: t.org.id })).toBe(0);
    expect(await jobsOfType("import.commit")).toHaveLength(1);

    await runDueJobs();
    expect((await jobsOfType("import.commit"))[0].status).toBe("completed");
    expect((await Import.findOne({ _id: body.data.importId, organizationId: t.org.id }))!.status).toBe("completed");
    expect(await EventGuest.countDocuments({ organizationId: t.org.id })).toBe(600);
  });

  it("rejects non-CSV uploads and binary content", async () => {
    const t = await setupTenant();
    const exe = await t.api.upload("/api/v1/imports/guests/preview").attach("file", Buffer.from("MZ\0\0binary"), { filename: "guests.exe", contentType: "application/octet-stream" });
    expect(exe.status).toBe(422);
    const binary = await t.api.upload("/api/v1/imports/guests/preview").attach("file", Buffer.from("a,b\n\0\0\0"), { filename: "guests.csv", contentType: "text/csv" });
    expect(binary.status).toBe(400);
    expect(binary.body.error.code).toBe("IMPORT_ERROR");
  });

  it("requires guests:import permission", async () => {
    const t = await setupTenant("COMMUNICATION_MANAGER");
    const res = await preview(t);
    expect(res.status).toBe(403);
  });
});

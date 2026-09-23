import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import {
  InvitationFunnelReport,
  RSVPFunnelReport,
  AttendanceReport,
  ReminderConversionReport,
  DeliveryFailureReport,
  EventSummaryReport,
} from "@/types/report";

export const reportService = {
  async getInvitationFunnel(eventId?: string): Promise<InvitationFunnelReport> {
    if (isMockEnabled()) return mockAdapter.getInvitationFunnelReport(eventId);
    const res = await apiClient.get<InvitationFunnelReport>("/api/v1/reports/invitation-funnel", { eventId });
    return res.data;
  },

  async getRSVPReport(eventId?: string): Promise<RSVPFunnelReport> {
    if (isMockEnabled()) return mockAdapter.getRSVPFunnelReport(eventId);
    const res = await apiClient.get<RSVPFunnelReport>("/api/v1/reports/rsvp", { eventId });
    return res.data;
  },

  async getAttendanceReport(eventId?: string): Promise<AttendanceReport> {
    if (isMockEnabled()) return mockAdapter.getAttendanceReport(eventId);
    const res = await apiClient.get<AttendanceReport>("/api/v1/reports/attendance", { eventId });
    return res.data;
  },

  async getReminderReport(eventId?: string): Promise<ReminderConversionReport> {
    if (isMockEnabled()) return mockAdapter.getReminderConversionReport(eventId);
    const res = await apiClient.get<ReminderConversionReport>("/api/v1/reports/reminders", { eventId });
    return res.data;
  },

  async getDeliveryFailureReport(eventId?: string): Promise<DeliveryFailureReport> {
    if (isMockEnabled()) return mockAdapter.getDeliveryFailureReport(eventId);
    const res = await apiClient.get<DeliveryFailureReport>("/api/v1/reports/failures", { eventId });
    return res.data;
  },

  async getEventSummaryReport(eventId?: string): Promise<EventSummaryReport> {
    if (isMockEnabled()) return mockAdapter.getEventSummaryReport(eventId);
    const res = await apiClient.get<EventSummaryReport>("/api/v1/reports/event-summary", { eventId });
    return res.data;
  },

  async exportReport(type: string, eventId?: string): Promise<void> {
    if (isMockEnabled()) {
      // Generate clean simulated CSV download in browser
      const filename = `bizinvite_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      const csvContent =
        "data:text/csv;charset=utf-8,Category,Metric,Value,Timestamp\n" +
        `Report,${type},Exported Successfully,${new Date().toISOString()}\n` +
        `Event,${eventId || "All Events"},350 Guests,${new Date().toISOString()}\n`;
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    await apiClient.downloadFile(`/api/v1/reports/${type}/export?eventId=${eventId || ""}`, `bizinvite_${type}_report.xlsx`);
  },
};

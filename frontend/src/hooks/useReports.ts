import { useQuery } from "@tanstack/react-query";
import { reportService } from "@/services/report.service";

export function useReports(eventId?: string) {
  const invitationFunnelQuery = useQuery({
    queryKey: ["report_invitation_funnel", eventId],
    queryFn: () => reportService.getInvitationFunnel(eventId),
    enabled: !!eventId,
  });

  const rsvpQuery = useQuery({
    queryKey: ["report_rsvp", eventId],
    queryFn: () => reportService.getRSVPReport(eventId),
    enabled: !!eventId,
  });

  const attendanceQuery = useQuery({
    queryKey: ["report_attendance", eventId],
    queryFn: () => reportService.getAttendanceReport(eventId),
    enabled: !!eventId,
  });

  const reminderQuery = useQuery({
    queryKey: ["report_reminders", eventId],
    queryFn: () => reportService.getReminderReport(eventId),
    enabled: !!eventId,
  });

  const failureQuery = useQuery({
    queryKey: ["report_failures", eventId],
    queryFn: () => reportService.getDeliveryFailureReport(eventId),
    enabled: !!eventId,
  });

  const summaryQuery = useQuery({
    queryKey: ["report_summary", eventId],
    queryFn: () => reportService.getEventSummaryReport(eventId),
    enabled: !!eventId,
  });

  return {
    invitationFunnel: invitationFunnelQuery.data,
    rsvpReport: rsvpQuery.data,
    attendanceReport: attendanceQuery.data,
    reminderReport: reminderQuery.data,
    failureReport: failureQuery.data,
    eventSummary: summaryQuery.data,
    isLoading:
      invitationFunnelQuery.isLoading ||
      rsvpQuery.isLoading ||
      attendanceQuery.isLoading ||
      reminderQuery.isLoading ||
      failureQuery.isLoading ||
      summaryQuery.isLoading,
    exportReport: (type: string) => reportService.exportReport(type, eventId),
  };
}

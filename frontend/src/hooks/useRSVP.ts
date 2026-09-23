import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { rsvpService } from "@/services/rsvp.service";
import { RSVPStatus } from "@/types/guest";
import { RSVPRecord } from "@/types/rsvp";

export function useRSVP(eventId?: string) {
  const queryClient = useQueryClient();

  const rsvpListQuery = useQuery({
    queryKey: ["rsvps", eventId],
    queryFn: () => rsvpService.getRSVPs(eventId),
  });

  const rsvpSummaryQuery = useQuery({
    queryKey: ["rsvp_summary", eventId],
    queryFn: () => rsvpService.getRSVPSummary(eventId),
  });

  const updateRSVPMutation = useMutation({
    mutationFn: ({
      guestId,
      status,
      count,
      requirements,
    }: {
      guestId: string;
      status: RSVPStatus;
      count?: number;
      requirements?: RSVPRecord["requirements"];
    }) => rsvpService.updateRSVP(guestId, status, count, requirements),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvps"] });
      queryClient.invalidateQueries({ queryKey: ["rsvp_summary"] });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
    },
  });

  return {
    rsvps: rsvpListQuery.data || [],
    isLoadingRSVPs: rsvpListQuery.isLoading,
    summary: rsvpSummaryQuery.data,
    isLoadingSummary: rsvpSummaryQuery.isLoading,
    updateRSVP: updateRSVPMutation.mutateAsync,
    isUpdating: updateRSVPMutation.isPending,
  };
}

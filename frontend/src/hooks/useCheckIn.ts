import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { checkInService } from "@/services/checkin.service";

export function useCheckIn(eventId?: string) {
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["checkin_summary", eventId],
    queryFn: () => checkInService.getLiveSummary(eventId),
    enabled: !!eventId,
    refetchInterval: 5000, // Poll summary every 5 seconds for live dashboard counters
  });

  const scanMutation = useMutation({
    mutationFn: ({ qrData, gateId, paxCount }: { qrData: string; gateId: string; paxCount?: number }) =>
      checkInService.scanQRCode(qrData, gateId, paxCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin_summary"] });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  const manualCheckInMutation = useMutation({
    mutationFn: ({ guestId, gateId, paxCount }: { guestId: string; gateId: string; paxCount: number }) =>
      checkInService.manualCheckIn(guestId, gateId, paxCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkin_summary"] });
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  return {
    summary: summaryQuery.data,
    isLoadingSummary: summaryQuery.isLoading,
    scanQR: scanMutation.mutateAsync,
    isScanning: scanMutation.isPending,
    manualCheckIn: manualCheckInMutation.mutateAsync,
    isManualCheckingIn: manualCheckInMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { passService } from "@/services/pass.service";

export function usePasses(eventId?: string) {
  const queryClient = useQueryClient();

  const passesQuery = useQuery({
    queryKey: ["passes", eventId],
    queryFn: () => passService.getPasses(eventId),
  });

  const resendPassMutation = useMutation({
    mutationFn: (passId: string) => passService.resendPass(passId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  const revokePassMutation = useMutation({
    mutationFn: (passId: string) => passService.revokePass(passId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  return {
    passes: passesQuery.data || [],
    isLoading: passesQuery.isLoading,
    resendPass: resendPassMutation.mutateAsync,
    isResending: resendPassMutation.isPending,
    revokePass: revokePassMutation.mutateAsync,
    isRevoking: revokePassMutation.isPending,
  };
}

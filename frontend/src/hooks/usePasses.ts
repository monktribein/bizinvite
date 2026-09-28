import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { passService } from "@/services/pass.service";
import { GeneratePassesInput } from "@/types/pass";

export function usePasses(eventId?: string) {
  const queryClient = useQueryClient();

  const passesQuery = useQuery({
    queryKey: ["passes", eventId],
    queryFn: () => passService.getPasses(eventId),
    enabled: !!eventId,
  });

  const resendPassMutation = useMutation({
    mutationFn: (passId: string) => passService.resendPass(passId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  const generatePassesMutation = useMutation({
    mutationFn: (input: GeneratePassesInput) => passService.generatePasses(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  const sendAllPassesMutation = useMutation({
    mutationFn: (onlyUnsent: boolean) => passService.sendAllPasses(eventId!, onlyUnsent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["passes"] });
    },
  });

  const reissuePassMutation = useMutation({
    mutationFn: (passId: string) => passService.reissuePass(passId),
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
    generatePasses: generatePassesMutation.mutateAsync,
    isGenerating: generatePassesMutation.isPending,
    sendAllPasses: sendAllPassesMutation.mutateAsync,
    isSendingAll: sendAllPassesMutation.isPending,
    reissuePass: reissuePassMutation.mutateAsync,
    isReissuing: reissuePassMutation.isPending,
  };
}

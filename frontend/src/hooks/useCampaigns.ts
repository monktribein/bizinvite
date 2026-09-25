import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignService } from "@/services/campaign.service";
import { CampaignTargetSegment, CreateCampaignInput, CreateLocalTemplateInput, RecipientStatus, TemplateMappingInput } from "@/types/campaign";

/** Most delivered/read receipts arrive within a day of sending. */
const RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function useCampaigns(eventId?: string) {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", eventId],
    queryFn: () => campaignService.getCampaigns(eventId),
    enabled: !!eventId,
    // Sending happens in a background job after the campaign is created, and delivered/read
    // receipts keep arriving by webhook after it completes: keep refreshing while anything is
    // sending, scheduled, or finished recently enough to still be collecting receipts.
    refetchInterval: (query) => {
      const campaigns = query.state.data ?? [];
      if (campaigns.some((c) => c.status === "running")) return 3_000;
      const collectingReceipts = campaigns.some(
        (c) => c.status === "completed" && c.completedAt && Date.now() - new Date(c.completedAt).getTime() < RECEIPT_WINDOW_MS
      );
      if (collectingReceipts) return 15_000;
      if (campaigns.some((c) => c.status === "scheduled")) return 30_000;
      return false;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: () => campaignService.getTemplates(),
  });

  const capabilitiesQuery = useQuery({
    queryKey: ["template_capabilities"],
    queryFn: () => campaignService.getTemplateCapabilities(),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (input: CreateLocalTemplateInput) => campaignService.createLocalTemplate(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
    },
  });

  const syncTemplatesMutation = useMutation({
    mutationFn: () => campaignService.syncTemplates(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      // The connection status counts sendable templates.
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
    },
  });

  const updateTemplateMappingMutation = useMutation({
    mutationFn: ({ id, mapping }: { id: string; mapping: TemplateMappingInput }) => campaignService.updateTemplateMapping(id, mapping),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp_status"] });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: (newCampaign: CreateCampaignInput) => campaignService.createCampaign(newCampaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: (id: string) => campaignService.pauseCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: (id: string) => campaignService.resumeCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const sendCampaignMutation = useMutation({
    mutationFn: (id: string) => campaignService.sendCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });

  const cancelCampaignMutation = useMutation({
    mutationFn: (id: string) => campaignService.cancelCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign_recipients"] });
    },
  });

  return {
    campaigns: campaignsQuery.data || [],
    isLoadingCampaigns: campaignsQuery.isLoading,
    refetchCampaigns: campaignsQuery.refetch,
    templates: templatesQuery.data || [],
    isLoadingTemplates: templatesQuery.isLoading,
    templateCapabilities: capabilitiesQuery.data,
    createTemplate: createTemplateMutation.mutateAsync,
    syncTemplates: syncTemplatesMutation.mutateAsync,
    updateTemplateMapping: updateTemplateMappingMutation.mutateAsync,
    isSyncingTemplates: syncTemplatesMutation.isPending,
    createCampaign: createCampaignMutation.mutateAsync,
    isCreating: createCampaignMutation.isPending,
    pauseCampaign: pauseCampaignMutation.mutateAsync,
    resumeCampaign: resumeCampaignMutation.mutateAsync,
    sendCampaign: sendCampaignMutation.mutateAsync,
    cancelCampaign: cancelCampaignMutation.mutateAsync,
  };
}

/** Per-number delivery status of one campaign; refreshes while messages are still moving. */
export function useCampaignRecipients(campaignId: string | null, status?: RecipientStatus, page = 1, limit = 50) {
  return useQuery({
    queryKey: ["campaign_recipients", campaignId, status, page, limit],
    queryFn: () => campaignService.getCampaignRecipients(campaignId!, { status, page, limit }),
    enabled: !!campaignId,
    refetchInterval: 10_000,
  });
}

/** Live count of who the campaign form's audience reaches. */
export function useAudiencePreview(eventId: string, targetSegment: CampaignTargetSegment, enabled: boolean) {
  return useQuery({
    queryKey: ["audience_preview", eventId, targetSegment],
    queryFn: () => campaignService.previewAudience({ eventId, targetSegment }),
    enabled: enabled && !!eventId,
    staleTime: 5_000,
  });
}

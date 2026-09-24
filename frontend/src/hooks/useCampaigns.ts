import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignService } from "@/services/campaign.service";
import { CreateCampaignInput, CreateLocalTemplateInput } from "@/types/campaign";

export function useCampaigns(eventId?: string) {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", eventId],
    queryFn: () => campaignService.getCampaigns(eventId),
    enabled: !!eventId,
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
    },
  });

  const syncTemplatesMutation = useMutation({
    mutationFn: () => campaignService.syncTemplates(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
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

  return {
    campaigns: campaignsQuery.data || [],
    isLoadingCampaigns: campaignsQuery.isLoading,
    templates: templatesQuery.data || [],
    isLoadingTemplates: templatesQuery.isLoading,
    templateCapabilities: capabilitiesQuery.data,
    createTemplate: createTemplateMutation.mutateAsync,
    syncTemplates: syncTemplatesMutation.mutateAsync,
    isSyncingTemplates: syncTemplatesMutation.isPending,
    createCampaign: createCampaignMutation.mutateAsync,
    isCreating: createCampaignMutation.isPending,
    pauseCampaign: pauseCampaignMutation.mutateAsync,
    resumeCampaign: resumeCampaignMutation.mutateAsync,
  };
}

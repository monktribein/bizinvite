import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { campaignService } from "@/services/campaign.service";
import { Campaign } from "@/types/campaign";

export function useCampaigns(eventId?: string) {
  const queryClient = useQueryClient();

  const campaignsQuery = useQuery({
    queryKey: ["campaigns", eventId],
    queryFn: () => campaignService.getCampaigns(eventId),
  });

  const templatesQuery = useQuery({
    queryKey: ["templates"],
    queryFn: () => campaignService.getTemplates(),
  });

  const createCampaignMutation = useMutation({
    mutationFn: (newCampaign: Partial<Campaign>) => campaignService.createCampaign(newCampaign),
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
    createCampaign: createCampaignMutation.mutateAsync,
    isCreating: createCampaignMutation.isPending,
    pauseCampaign: pauseCampaignMutation.mutateAsync,
    resumeCampaign: resumeCampaignMutation.mutateAsync,
  };
}

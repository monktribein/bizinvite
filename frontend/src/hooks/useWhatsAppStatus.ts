import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/context";
import { organizationService } from "@/services/organization.service";

/** The organization's real WhatsApp connection state (live or dry-run), from the backend. */
export function useWhatsAppStatus(enabled = true) {
  const { organization } = useAuth();
  const orgId = organization?.id;
  return useQuery({
    queryKey: ["whatsapp_status", orgId],
    queryFn: () => organizationService.getWhatsAppStatus(orgId!),
    enabled: enabled && !!orgId,
    staleTime: 60_000,
  });
}

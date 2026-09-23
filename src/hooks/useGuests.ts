import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guestService } from "@/services/guest.service";
import { Guest, ImportCommitRequest } from "@/types/guest";

export function useGuests(
  eventId?: string,
  search?: string,
  filters?: { category?: string; isVip?: boolean; rsvpStatus?: string; checkInStatus?: string }
) {
  const queryClient = useQueryClient();

  const guestsQuery = useQuery({
    queryKey: ["guests", eventId, search, filters],
    queryFn: () => guestService.getGuests(eventId, search, filters),
  });

  const addGuestMutation = useMutation({
    mutationFn: (newGuest: Partial<Guest>) => guestService.addGuest(newGuest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["rsvp_summary"] });
    },
  });

  const updateGuestMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Guest> }) =>
      guestService.updateGuest(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["rsvp_summary"] });
      queryClient.invalidateQueries({ queryKey: ["rsvps"] });
    },
  });

  const commitImportMutation = useMutation({
    mutationFn: (request: ImportCommitRequest) => guestService.commitCsvImport(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guests"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    ...guestsQuery,
    guests: guestsQuery.data || [],
    addGuest: addGuestMutation.mutateAsync,
    isAdding: addGuestMutation.isPending,
    updateGuest: updateGuestMutation.mutateAsync,
    isUpdating: updateGuestMutation.isPending,
    commitImport: commitImportMutation.mutateAsync,
    isImporting: commitImportMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventService } from "@/services/event.service";
import { Event } from "@/types/event";

export function useEvents() {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["events"],
    queryFn: () => eventService.getEvents(),
  });

  const createEventMutation = useMutation({
    mutationFn: (newEvent: Partial<Event>) => eventService.createEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Event> }) =>
      eventService.updateEvent(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  return {
    ...eventsQuery,
    events: eventsQuery.data || [],
    createEvent: createEventMutation.mutateAsync,
    isCreating: createEventMutation.isPending,
    updateEvent: updateEventMutation.mutateAsync,
    isUpdating: updateEventMutation.isPending,
  };
}

export function useEventDetail(eventId: string) {
  return useQuery({
    queryKey: ["events", eventId],
    queryFn: () => eventService.getEventById(eventId),
    enabled: !!eventId,
  });
}

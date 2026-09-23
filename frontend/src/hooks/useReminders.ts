import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reminderService } from "@/services/reminder.service";
import { ReminderRule } from "@/types/reminder";

export function useReminders(eventId?: string) {
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["reminder_rules", eventId],
    queryFn: () => reminderService.getReminderRules(eventId),
  });

  const createRuleMutation = useMutation({
    mutationFn: (rule: Partial<ReminderRule>) => reminderService.createReminderRule(rule),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder_rules"] });
    },
  });

  return {
    rules: rulesQuery.data || [],
    isLoading: rulesQuery.isLoading,
    createRule: createRuleMutation.mutateAsync,
    isCreating: createRuleMutation.isPending,
  };
}

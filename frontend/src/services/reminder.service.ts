import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { ReminderRule } from "@/types/reminder";

export const reminderService = {
  async getReminderRules(eventId?: string): Promise<ReminderRule[]> {
    if (isMockEnabled()) {
      return mockAdapter.getReminderRules(eventId);
    }
    const response = await apiClient.get<ReminderRule[]>("/api/v1/reminder-rules", { eventId });
    return response.data;
  },

  async createReminderRule(rule: Partial<ReminderRule>): Promise<ReminderRule> {
    if (isMockEnabled()) {
      return mockAdapter.createReminderRule(rule);
    }
    const response = await apiClient.post<ReminderRule>("/api/v1/reminder-rules", rule);
    return response.data;
  },
};

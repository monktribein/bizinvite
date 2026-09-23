import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { Event } from "@/types/event";

export const eventService = {
  async getEvents(): Promise<Event[]> {
    if (isMockEnabled()) {
      return mockAdapter.getEvents();
    }
    const response = await apiClient.get<Event[]>("/api/v1/events");
    return response.data;
  },

  async getEventById(id: string): Promise<Event | null> {
    if (isMockEnabled()) {
      return mockAdapter.getEventById(id);
    }
    const response = await apiClient.get<Event>(`/api/v1/events/${id}`);
    return response.data;
  },

  async createEvent(eventData: Partial<Event>): Promise<Event> {
    if (isMockEnabled()) {
      return mockAdapter.createEvent(eventData);
    }
    const response = await apiClient.post<Event>("/api/v1/events", eventData);
    return response.data;
  },

  async updateEvent(id: string, updates: Partial<Event>): Promise<Event> {
    if (isMockEnabled()) {
      return mockAdapter.updateEvent(id, updates);
    }
    const response = await apiClient.patch<Event>(`/api/v1/events/${id}`, updates);
    return response.data;
  },
};

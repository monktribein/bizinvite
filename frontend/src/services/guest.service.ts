import { apiClient } from "@/lib/api/client";
import { mockAdapter } from "@/lib/api/mock-adapter";
import { isMockEnabled } from "./config";
import { Guest, ImportPreviewResult, ImportCommitRequest } from "@/types/guest";

export const guestService = {
  async getGuests(eventId?: string, search?: string, filters?: { category?: string; isVip?: boolean; rsvpStatus?: string; checkInStatus?: string }): Promise<Guest[]> {
    if (isMockEnabled()) {
      return mockAdapter.getGuests(eventId, search, filters);
    }
    const response = await apiClient.get<Guest[]>("/api/v1/guests", {
      eventId,
      search,
      category: filters?.category,
      isVip: filters?.isVip,
      rsvpStatus: filters?.rsvpStatus,
      checkInStatus: filters?.checkInStatus,
    });
    return response.data;
  },

  async addGuest(guestData: Partial<Guest>): Promise<Guest> {
    if (isMockEnabled()) {
      return mockAdapter.addGuest(guestData);
    }
    const response = await apiClient.post<Guest>("/api/v1/guests", guestData);
    return response.data;
  },

  async updateGuest(id: string, updates: Partial<Guest>): Promise<Guest> {
    if (isMockEnabled()) {
      return mockAdapter.updateGuest(id, updates);
    }
    const response = await apiClient.patch<Guest>(`/api/v1/guests/${id}`, updates);
    return response.data;
  },

  // CSV Import Wizard calls
  async previewCsvImport(file: File): Promise<ImportPreviewResult> {
    if (isMockEnabled()) {
      return mockAdapter.previewGuestImport(file.name);
    }
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.upload<ImportPreviewResult>("/api/v1/imports/guests/preview", formData);
    return response.data;
  },

  async commitCsvImport(request: ImportCommitRequest): Promise<{ importedCount: number; updatedCount: number }> {
    if (isMockEnabled()) {
      return mockAdapter.commitGuestImport(request.importId);
    }
    const response = await apiClient.post<{ importedCount: number; updatedCount: number }>("/api/v1/imports/guests", request);
    return response.data;
  },
};

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  meta?: ResponseMeta;
  error?: ApiErrorPayload;
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  requestId?: string;
  timestamp?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

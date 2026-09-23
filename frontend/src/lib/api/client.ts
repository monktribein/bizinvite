import { ApiResponse, ApiErrorPayload } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export class ApiError extends Error {
  public code: string;
  public status: number;
  public fields?: Record<string, string[]>;

  constructor(payload: ApiErrorPayload, status: number) {
    super(payload.message || "An unexpected API error occurred");
    this.name = "ApiError";
    this.code = payload.code || "UNKNOWN_ERROR";
    this.status = status;
    this.fields = payload.fields;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private getAccessToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("bizinvite_access_token");
  }

  private setTokens(accessToken: string, refreshToken?: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem("bizinvite_access_token", accessToken);
    if (refreshToken) {
      localStorage.setItem("bizinvite_refresh_token", refreshToken);
    }
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    const refreshToken = localStorage.getItem("bizinvite_refresh_token");
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        localStorage.removeItem("bizinvite_access_token");
        localStorage.removeItem("bizinvite_refresh_token");
        return null;
      }

      const data = await response.json();
      if (data?.data?.accessToken) {
        this.setTokens(data.data.accessToken, data.data.refreshToken);
        return data.data.accessToken;
      }
    } catch {
      return null;
    }
    return null;
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { params, headers, ...customConfig } = options;

    let url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes("?") ? "&" : "?") + queryString;
      }
    }

    const defaultHeaders: Record<string, string> = {
      Accept: "application/json",
    };

    if (!(customConfig.body instanceof FormData)) {
      defaultHeaders["Content-Type"] = "application/json";
    }

    const token = this.getAccessToken();
    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    let response = await fetch(url, {
      ...customConfig,
      headers: {
        ...defaultHeaders,
        ...headers,
      },
    });

    // Handle 401 token refresh retry
    if (response.status === 401 && token) {
      const newToken = await this.refreshAccessToken();
      if (newToken) {
        defaultHeaders["Authorization"] = `Bearer ${newToken}`;
        response = await fetch(url, {
          ...customConfig,
          headers: {
            ...defaultHeaders,
            ...headers,
          },
        });
      }
    }

    // Handle non-JSON or download responses
    const contentType = response.headers.get("content-type");
    if (contentType && (contentType.includes("application/octet-stream") || contentType.includes("application/vnd.openxmlformats") || contentType.includes("text/csv"))) {
      const blob = await response.blob();
      return {
        success: response.ok,
        data: blob as unknown as T,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch {
      data = {
        success: false,
        error: {
          code: "INVALID_JSON_RESPONSE",
          message: "Server returned non-JSON response",
        },
      };
    }

    if (!response.ok || !data.success) {
      throw new ApiError(
        data.error || { code: "HTTP_ERROR", message: response.statusText },
        response.status
      );
    }

    return data as ApiResponse<T>;
  }

  public get<T>(endpoint: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, { method: "GET", params });
  }

  public post<T>(endpoint: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      params,
    });
  }

  public patch<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  public upload<T>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
    });
  }

  public async downloadFile(endpoint: string, filename: string): Promise<void> {
    const res = await this.request<Blob>(endpoint, { method: "GET" });
    if (res.data instanceof Blob) {
      const url = window.URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

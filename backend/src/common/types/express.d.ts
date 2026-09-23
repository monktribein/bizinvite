import type { Role } from "../constants/roles";

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** The organization the session was issued for (null for a platform admin without membership). */
  organizationId: string | null;
  isPlatformAdmin: boolean;
}

export interface TenantContext {
  organizationId: string;
  /** True when a platform admin is acting inside an organization they are not a member of. */
  crossTenant: boolean;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
      tenant?: TenantContext;
      /** Session family of the access token (used by logout / organization switch). */
      sessionFamily?: string;
      rawBody?: Buffer;
    }
  }
}

export {};

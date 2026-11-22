import { ApiError, apiRequest } from "@/lib/api";
import { MemberSchema, type Member, type RegisterValues } from "@/types/team";

/**
 * Real sign-in against the API: e-mail + password, kept in an HttpOnly
 * session cookie set by the API (the frontend never sees the token).
 *
 *   GET  /api/auth/me        → the signed-in member, 401 when signed out
 *   POST /api/auth/register  { name, email, password } → pending account, signed in
 *   POST /api/auth/login     { email, password }
 *   POST /api/auth/logout
 *   POST /api/auth/password  { currentPassword, newPassword }
 */
export interface AuthService {
  me(): Promise<Member | null>;
  login(email: string, password: string): Promise<Member>;
  register(values: RegisterValues): Promise<Member>;
  logout(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
}

export function createHttpAuthService({
  baseUrl,
  fetchImpl,
}: {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}): AuthService {
  return {
    async me() {
      try {
        return MemberSchema.parse(await apiRequest(baseUrl, "/api/auth/me", { fetchImpl }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    async login(email, password) {
      return MemberSchema.parse(
        await apiRequest(baseUrl, "/api/auth/login", {
          method: "POST",
          body: { email, password },
          fetchImpl,
        }),
      );
    },
    async register(values) {
      return MemberSchema.parse(
        await apiRequest(baseUrl, "/api/auth/register", {
          method: "POST",
          body: values,
          fetchImpl,
        }),
      );
    },
    async logout() {
      await apiRequest(baseUrl, "/api/auth/logout", { method: "POST", fetchImpl });
    },
    async changePassword(currentPassword, newPassword) {
      await apiRequest(baseUrl, "/api/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
        fetchImpl,
      });
    },
  };
}

"use client";

import type { AuthResult, MeResponse, User } from "@cendol/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { api, onUnauthenticated, pendingStore, sessionApi, tokenStore, useHydrated, useStoredToken } from "./api";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  hasToken: boolean;
  twoFactorSetupRequired: boolean;
  /** Takes the API's sign-in answer and moves to the right next step. Returns the page to open. */
  handleAuthResult: (result: AuthResult, login?: string) => string;
  signOut: (options?: { silent?: boolean }) => Promise<void>;
  refresh: () => Promise<unknown>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // storage is only readable in the browser; until then we are "loading", not "signed out"
  const ready = useHydrated();
  const hasToken = Boolean(useStoredToken());

  const me = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => sessionApi.get<MeResponse>("auth/me"),
    enabled: ready && hasToken,
    staleTime: 60_000,
    retry: false,
  });

  const clear = useCallback(() => {
    tokenStore.set(null);
    pendingStore.set(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    onUnauthenticated(() => {
      if (!tokenStore.get()) return;
      clear();
      router.replace(`/login?expired=1&next=${encodeURIComponent(window.location.pathname)}`);
    });
  }, [clear, router]);

  const handleAuthResult = useCallback(
    (result: AuthResult, login?: string) => {
      if (result.status === "authenticated") {
        pendingStore.set(null);
        tokenStore.set(result.token);
        queryClient.setQueryData<MeResponse>(["auth", "me"], {
          user: result.user,
          two_factor_setup_required: result.two_factor_setup_required,
        });
        // the sign-in answer has no permission list; load the full profile
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
        return result.two_factor_setup_required ? "/account/security?setup=1" : "/dashboard";
      }
      pendingStore.set({ status: result.status, token: result.token, destination: "destination" in result ? result.destination : null, login });
      return result.status === "verification_required" ? "/verify" : "/two-factor";
    },
    [queryClient],
  );

  const signOut = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        await api.post("auth/logout").catch(() => undefined);
      }
      clear();
      router.replace("/login");
    },
    [clear, router],
  );

  const value = useMemo<AuthContextValue>(() => {
    const user = me.data?.user ?? null;
    const permissions = user?.permissions ?? [];
    return {
      user,
      isLoading: !ready || (hasToken && me.isPending),
      hasToken,
      twoFactorSetupRequired: me.data?.two_factor_setup_required ?? false,
      handleAuthResult,
      signOut,
      refresh: () => me.refetch(),
      can: (permission: string) => permissions.includes("*") || permissions.includes(permission),
    };
  }, [me, ready, hasToken, handleAuthResult, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

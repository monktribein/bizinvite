"use client";

import React, { Suspense, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/auth/context";

import { ApiError } from "@/lib/api/client";
import { GlobalLoader } from "@/components/ui/Loader";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
                return false;
              }
              return failureCount < 1;
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <GlobalLoader />
      </Suspense>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

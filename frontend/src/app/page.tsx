"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace("/dashboard");
      } else {
        router.replace("/login");
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading BizInvite...</p>
      </div>
    </div>
  );
}

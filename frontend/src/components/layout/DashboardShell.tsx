"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PageLoader } from "@/components/ui/Loader";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // A missing or expired session sends the user back to sign in
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading || !isAuthenticated) {
    return <PageLoader label="Loading BizInvite..." />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      <Sidebar isOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

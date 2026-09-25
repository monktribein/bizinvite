"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { Sparkles, Shield, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Authentication failed. Please check your credentials.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">BizInvite</h1>
          <p className="mt-1 text-xs text-slate-500">
            Event Invitation, RSVP & Reminder Automation Platform
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-base font-semibold text-slate-900">Sign in to Organizer Dashboard</h2>
            <p className="mt-1 text-xs text-slate-500">
              Access your events, WhatsApp campaigns, and live check-in gates.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Work Email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-xs font-medium text-indigo-600 hover:underline">
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
              Sign In to Operations <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>
        </div>

        {/* Security Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <Shield className="h-3.5 w-3.5 text-emerald-600" />
          <span>Tenant Isolated B2B Infrastructure • 256-bit TLS</span>
        </div>
      </div>
    </div>
  );
}

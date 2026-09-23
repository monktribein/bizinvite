"use client";

import React, { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/lib/auth/context";
import { getRoleDisplayName } from "@/lib/auth/permissions";
import { MOCK_USERS, MOCK_AUDIT_LOGS, MOCK_CONSENT_RECORDS } from "@/lib/api/mock-adapter";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/Table";
import { formatDate } from "@/lib/utils/formatters";
import {
  Building2,
  Users,
  MessageSquare,
  FileCheck2,
  History,
  CheckCircle2,
  Plus,
} from "lucide-react";

export default function SettingsPage() {
  const { organization, can } = useAuth();
  const [activeTab, setActiveTab] = useState<"org" | "team" | "whatsapp" | "consent" | "audit">("org");

  return (
    <DashboardShell>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Organization & System Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage tenant profile, team roles, WhatsApp Business credentials status, consent registries, and audit logs.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex overflow-x-auto border-b border-slate-200">
        <button
          onClick={() => setActiveTab("org")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "org"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Building2 className="w-4 h-4" /> Organization Profile
        </button>
        <button
          onClick={() => setActiveTab("team")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "team"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users className="w-4 h-4" /> Team & Roles ({MOCK_USERS.length})
        </button>
        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "whatsapp"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="w-4 h-4" /> WhatsApp Gateway
        </button>
        <button
          onClick={() => setActiveTab("consent")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "consent"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileCheck2 className="w-4 h-4" /> Consent & Opt-Outs
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "audit"
              ? "border-indigo-600 text-indigo-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <History className="w-4 h-4" /> Security Audit Log
        </button>
      </div>

      {/* TAB 1: ORGANIZATION PROFILE */}
      {activeTab === "org" && (
        <Card className="max-w-3xl">
          <CardHeader
            title="Organization Profile"
            subtitle="Details associated with your multi-tenant account"
          />
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Organization Legal / Display Name"
                defaultValue={organization?.name || "Aura Events & Hospitality"}
                readOnly
              />
              <Input
                label="Tenant Slug"
                defaultValue={organization?.slug || "aura-events"}
                readOnly
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Organization ID"
                defaultValue={organization?.id || "org_biz_aura_001"}
                readOnly
                className="font-mono text-slate-500"
              />
              <Input
                label="Subscription Tier"
                defaultValue={(organization?.plan || "enterprise").toUpperCase()}
                readOnly
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-slate-600 text-xs">
              <span className="font-semibold text-slate-800 block mb-1">
                Multi-Tenant Isolation Notice:
              </span>
              All API requests are scoped to your Organization ID. Cross-tenant access is strictly denied by the backend authorization layer.
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: TEAM & ROLES */}
      {activeTab === "team" && (
        <Card>
          <CardHeader
            title="Team Members & Role Access Control"
            subtitle="Granular permissions based on centralized can(user, permission) policy"
            action={
              can("team:manage") && (
                <Button size="sm" className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Invite Staff
                </Button>
              )
            }
          />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Account Status</TableHead>
                  <TableHead>Member Since</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_USERS.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{u.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-slate-700">{u.email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm" className="font-semibold">
                        {getRoleDisplayName(u.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="success" size="sm">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">{formatDate(u.createdAt, false)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: WHATSAPP INTEGRATION STATUS */}
      {activeTab === "whatsapp" && (
        <Card className="max-w-3xl">
          <CardHeader
            title="WhatsApp Business API (WABA) Connection"
            subtitle="Enterprise Cloud API connection health & quality rating"
          />
          <CardContent className="space-y-4 text-xs">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Meta Cloud API Connected</h4>
                  <p className="text-slate-600">
                    Phone Number: <b>+91 98200 12345</b> • Verified Name: <b>Aura Events Concierge</b>
                  </p>
                </div>
              </div>

              <Badge variant="success" size="md">
                QUALITY: GREEN
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">WABA Account ID</span>
                <p className="font-mono font-semibold text-slate-800 text-sm mt-0.5">
                  waba_biz_998127391
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Messaging Tier Limit</span>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">
                  Tier 100K (100,000 unique business-initiated conversations/day)
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 text-slate-500 bg-white">
              <span className="font-semibold text-slate-700 block mb-1">Architecture Boundary:</span>
              WhatsApp permanent access tokens, webhook signing secrets, and Meta certificate keys are securely held and managed solely by the backend server. The frontend dashboard receives only health telemetry and status responses.
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: CONSENT & OPT-OUT RECORDS */}
      {activeTab === "consent" && (
        <Card>
          <CardHeader
            title="Consent & Opt-Out Registry"
            subtitle="Immutable records of WhatsApp opt-in confirmations and opt-out requests"
          />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest Name</TableHead>
                  <TableHead>Mobile Number</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Consent Status</TableHead>
                  <TableHead>Source / Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CONSENT_RECORDS.map((con) => (
                  <TableRow key={con.id}>
                    <TableCell>
                      <span className="font-semibold text-slate-900">{con.guestName}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-slate-700">{con.mobile}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm">
                        WhatsApp
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={con.status === "opted_in" ? "success" : "danger"} size="sm">
                        {con.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-700">{con.source}</span>
                      {con.optOutReason && (
                        <p className="text-[10px] text-rose-600 font-medium">{con.optOutReason}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">{formatDate(con.timestamp)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 5: AUDIT LOG */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader
            title="System Audit Trail"
            subtitle="Chronological log of administrative actions, campaign dispatches, and manual corrections"
          />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operator</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_AUDIT_LOGS.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <span className="font-semibold text-slate-900">{log.userName}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" size="sm">
                        {log.userRole}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-indigo-700 text-xs">
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-slate-600">{log.resourceType}</span>
                    </TableCell>
                    <TableCell>
                      <p className="text-slate-800 max-w-sm truncate">{log.details}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-slate-500">{log.ipAddress || "127.0.0.1"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-slate-500">{formatDate(log.timestamp)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}

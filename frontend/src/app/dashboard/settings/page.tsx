"use client";

import React, { useState, useEffect } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { useAuth } from "@/lib/auth/context";
import { getRoleDisplayName } from "@/lib/auth/permissions";
import { organizationService } from "@/services/organization.service";
import { TeamMember } from "@/types/organization";
import { AuditLog, ConsentRecord } from "@/types/audit";
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
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);

  useEffect(() => {
    if (organization?.id) {
      organizationService.getTeamMembers(organization.id).then(setTeamMembers).catch(() => {});
      organizationService.getAuditLogs(organization.id).then(setAuditLogs).catch(() => {});
      organizationService.getConsentRecords(organization.id).then(setConsentRecords).catch(() => {});
    }
  }, [organization?.id]);

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

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
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
          <Users className="w-4 h-4" /> Team & Roles ({teamMembers.length})
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
                Multi-Tenant Isolation Notice
              </span>
              All events, guest contacts, campaigns, and RSVP analytics belong strictly to your authenticated organization scope.
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
            {teamMembers.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No team members registered yet.
              </div>
            ) : (
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
                  {teamMembers.map((u) => (
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
            )}
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
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">WhatsApp Gateway Connected</span>
                    <Badge variant="success" size="sm">
                      HEALTHY
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5 font-mono">
                    Sender: {organization?.whatsAppStatus.phoneNumber || "+91 98200 12345"}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                  Quality Tier
                </span>
                <span className="font-bold text-slate-900">
                  {organization?.whatsAppStatus.tier || "TIER_100K"} ({organization?.whatsAppStatus.qualityRating || "GREEN"})
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Input
                label="WhatsApp Business Account ID (WABA ID)"
                defaultValue={organization?.whatsAppStatus.wabaId || "waba_biz_998127391"}
                readOnly
                className="font-mono text-slate-600"
              />
              <Input
                label="Verified Display Name"
                defaultValue={organization?.whatsAppStatus.businessDisplayName || "Aura Events Concierge"}
                readOnly
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: CONSENT & OPT-OUTS */}
      {activeTab === "consent" && (
        <Card>
          <CardHeader
            title="Consent & Opt-Out Registry"
            subtitle="DPDP Act / GDPR compliance tracking of invitation opt-ins and opt-outs"
          />
          <CardContent className="p-0">
            {consentRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No consent or opt-out records found.
              </div>
            ) : (
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
                  {consentRecords.map((con) => (
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
            )}
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
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No security audit entries recorded yet.
              </div>
            ) : (
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
                  {auditLogs.map((log) => (
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
            )}
          </CardContent>
        </Card>
      )}
    </DashboardShell>
  );
}

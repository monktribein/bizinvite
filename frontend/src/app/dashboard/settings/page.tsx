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
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { WhatsAppConnectionCard } from "@/components/settings/WhatsAppConnectionCard";
import { Role } from "@/types/auth";
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
  AlertCircle,
  UserPlus,
  Shield,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
} from "lucide-react";

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: "GUEST_MANAGER",
    label: "Guest Manager",
    description: "Manage guest lists, import CSVs, VIP tagging, RSVP management, digital passes, and gate check-in. Restricted from billing and campaign creation.",
  },
  {
    value: "EVENT_ADMINISTRATOR",
    label: "Event Administrator",
    description: "Create/edit events, import guests, dispatch campaigns, and view complete analytics. Restricted from billing and organization deletion.",
  },
  {
    value: "COMMUNICATION_MANAGER",
    label: "Communication Manager",
    description: "Manage WhatsApp campaigns, template broadcasts, and automated reminder schedules.",
  },
  {
    value: "CHECK_IN_EXECUTIVE",
    label: "Check-in Executive",
    description: "Gate-side pass scanning and live check-in access only.",
  },
  {
    value: "READ_ONLY_VIEWER",
    label: "Read-only Viewer",
    description: "View-only access to attendee lists, delivery reports, and event summaries.",
  },
  {
    value: "ORGANIZATION_OWNER",
    label: "Organization Owner (Co-Owner)",
    description: "Full root access to team management, WhatsApp setup, billing, and all events.",
  },
];

export default function SettingsPage() {
  const { organization, can } = useAuth();
  const [activeTab, setActiveTab] = useState<"org" | "team" | "whatsapp" | "consent" | "audit">("org");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);

  // Invite Staff State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<Role>("GUEST_MANAGER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState("");
  const [inviteErrorMsg, setInviteErrorMsg] = useState("");

  // Edit Staff State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("GUEST_MANAGER");
  const [editStatus, setEditStatus] = useState<"active" | "suspended">("active");
  const [editPassword, setEditPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editErrorMsg, setEditErrorMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      organizationService.getTeamMembers(organization.id).then(setTeamMembers).catch(() => {});
      organizationService.getAuditLogs(organization.id).then(setAuditLogs).catch(() => {});
      organizationService.getConsentRecords(organization.id).then(setConsentRecords).catch(() => {});
    }
  }, [organization?.id]);

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) {
      setInviteErrorMsg("Please provide both staff member name and a valid email address.");
      return;
    }
    if (!organization?.id) return;

    setIsSubmitting(true);
    setInviteErrorMsg("");
    try {
      const newMember = await organizationService.inviteTeamMember(organization.id, {
        name: staffName.trim(),
        email: staffEmail.trim().toLowerCase(),
        role: staffRole,
      });

      setTeamMembers((prev) => {
        const filtered = prev.filter((m) => m.email.toLowerCase() !== newMember.email.toLowerCase());
        return [newMember, ...filtered];
      });

      // Refresh audit logs
      organizationService.getAuditLogs(organization.id).then(setAuditLogs).catch(() => {});

      setInviteSuccessMsg(
        `Created ${getRoleDisplayName(staffRole)} account for ${newMember.name} (${newMember.email})! You can now log into this role.`
      );
      setTimeout(() => setInviteSuccessMsg(""), 8000);
      setStaffName("");
      setStaffEmail("");
      setStaffRole("GUEST_MANAGER");
      setIsInviteModalOpen(false);
    } catch (err: unknown) {
      setInviteErrorMsg(err instanceof Error ? err.message : "Failed to invite staff member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (member: TeamMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditStatus(member.status === "suspended" ? "suspended" : "active");
    setEditPassword("");
    setEditErrorMsg("");
    setShowDeleteConfirm(false);
    setIsEditModalOpen(true);
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !organization?.id) return;
    if (!editName.trim()) {
      setEditErrorMsg("Staff member name cannot be blank.");
      return;
    }

    setIsUpdating(true);
    setEditErrorMsg("");
    try {
      const updated = await organizationService.updateTeamMember(organization.id, editingMember.id, {
        name: editName.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword.trim() || undefined,
      });

      setTeamMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );

      // Refresh audit logs
      organizationService.getAuditLogs(organization.id).then(setAuditLogs).catch(() => {});

      setInviteSuccessMsg(
        `Updated ${updated.name} (${updated.email}) - Role: ${getRoleDisplayName(updated.role)}, Status: ${updated.status}${editPassword ? ", Password updated!" : ""}`
      );
      setTimeout(() => setInviteSuccessMsg(""), 8000);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      setEditErrorMsg(err instanceof Error ? err.message : "Failed to update staff member.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!editingMember || !organization?.id) return;
    if (editingMember.email.toLowerCase() === "admin@bizinvite.com" || editingMember.role === "ORGANIZATION_OWNER") {
      setEditErrorMsg("Cannot delete the primary Organization Owner account.");
      return;
    }

    setIsDeleting(true);
    setEditErrorMsg("");
    try {
      await organizationService.deleteTeamMember(organization.id, editingMember.id);
      setTeamMembers((prev) => prev.filter((m) => m.id !== editingMember.id));
      organizationService.getAuditLogs(organization.id).then(setAuditLogs).catch(() => {});

      setInviteSuccessMsg(`Removed ${editingMember.name} (${editingMember.email}) from organization.`);
      setTimeout(() => setInviteSuccessMsg(""), 8000);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      setEditErrorMsg(err instanceof Error ? err.message : "Failed to delete staff member.");
    } finally {
      setIsDeleting(false);
    }
  };

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
        <div className="space-y-4">
          {inviteSuccessMsg && (
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-emerald-800 text-xs shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{inviteSuccessMsg}</span>
              </div>
              <button
                onClick={() => setInviteSuccessMsg("")}
                className="text-emerald-600 hover:text-emerald-900 font-bold ml-4 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <Card>
            <CardHeader
              title="Team Members & Role Access Control"
              subtitle="Granular permissions based on centralized can(user, permission) policy"
              action={
                can("team:manage") && (
                  <Button
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => {
                      setInviteErrorMsg("");
                      setIsInviteModalOpen(true);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" /> Invite Staff
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
                    {can("team:manage") && <TableHead className="text-right">Actions</TableHead>}
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
                        {u.status === "suspended" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            Suspended
                          </span>
                        ) : (
                          <Badge variant="success" size="sm">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-500">{formatDate(u.createdAt, false)}</span>
                      </TableCell>
                      {can("team:manage") && (
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7 px-2.5 gap-1 text-slate-700 hover:text-indigo-600 hover:border-indigo-300"
                            onClick={() => openEditModal(u)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        </div>
      )}

      {/* TAB 3: WHATSAPP INTEGRATION STATUS */}
      {activeTab === "whatsapp" && <WhatsAppConnectionCard />}

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

      {/* Invite Staff Modal */}
      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => {
          if (!isSubmitting) setIsInviteModalOpen(false);
        }}
        title="Invite Staff Member"
        description="Provision a new staff account with granular role permissions under your organization."
      >
        <form onSubmit={handleInviteStaff} className="space-y-4">
          {inviteErrorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{inviteErrorMsg}</span>
            </div>
          )}

          <div>
            <Input
              label="Staff Member Full Name"
              placeholder="e.g. Sunita Rao"
              required
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </div>

          <div>
            <Input
              label="Work Email Address"
              type="email"
              placeholder="e.g. guestmanager@bizinvite.io"
              required
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assigned Operational Role
            </label>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as Role)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Role Permission Scope Callout */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs">
            <div className="flex items-center gap-2 font-semibold text-indigo-950 mb-1">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>{getRoleDisplayName(staffRole)} Scope:</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {ROLE_OPTIONS.find((r) => r.value === staffRole)?.description}
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setIsInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              className="gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              Create Staff Account
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit / Manage Staff Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          if (!isUpdating && !isDeleting) setIsEditModalOpen(false);
        }}
        title={`Manage Staff: ${editingMember?.name || "Staff Member"}`}
        description="Update staff profile, reset credentials, change account status, or remove member."
      >
        <form onSubmit={handleUpdateMember} className="space-y-4">
          {editErrorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Staff Full Name"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Work Email Address"
                value={editingMember?.email || ""}
                readOnly
                className="bg-slate-50 text-slate-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Assigned Role
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Account Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as "active" | "suspended")}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-600 ${
                  editStatus === "suspended"
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-slate-300 bg-white text-emerald-800"
                }`}
              >
                <option value="active">Active (Access Allowed)</option>
                <option value="suspended">Suspended (Access Blocked)</option>
              </select>
            </div>
          </div>

          {/* Role Scope Callout */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-indigo-950 mb-0.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>{getRoleDisplayName(editRole)} Permissions:</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {ROLE_OPTIONS.find((r) => r.value === editRole)?.description}
            </p>
          </div>

          {/* Password Reset Field */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Change or Update Password
              </span>
            </div>
            <input
              type="text"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              placeholder="Enter new password (leave blank to keep current)"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Admin can update or reset this user&apos;s password directly.
            </p>
          </div>

          {/* Danger Zone: Suspend or Remove Staff */}
          {editingMember?.role !== "ORGANIZATION_OWNER" && editingMember?.email?.toLowerCase() !== "admin@bizinvite.com" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3.5">
              {!showDeleteConfirm ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-900 block">
                      Remove Staff Member
                    </span>
                    <p className="text-[11px] text-rose-700">
                      Permanently revoke organization access and delete user record.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs text-rose-600 border-rose-300 hover:bg-rose-100 hover:text-rose-800 gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete User
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-rose-800 font-semibold">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Are you sure you want to delete {editingMember?.name}?</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      isLoading={isDeleting}
                      onClick={handleDeleteMember}
                      className="text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Confirm Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUpdating || isDeleting}
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdating}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}

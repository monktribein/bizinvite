import { CROSS_TENANT } from "../../common/utils/model";
import { Membership, User } from "./model";

export const userRepository = {
  findByEmail(email: string, withSecrets = false) {
    const query = User.findOne({ email: email.toLowerCase().trim() });
    return withSecrets ? query.select("+passwordHash") : query;
  },

  findById(userId: string) {
    return User.findById(userId);
  },

  findByInviteTokenHash(tokenHash: string) {
    return User.findOne({ inviteTokenHash: tokenHash }).select("+inviteTokenHash +inviteExpiresAt");
  },

  findMembership(organizationId: string, userId: string) {
    return Membership.findOne({ organizationId, userId });
  },

  /** All organizations a user belongs to (cross-tenant by nature: it is the user's own list). */
  listMembershipsForUser(userId: string, status?: "active") {
    return Membership.find({ userId, ...(status ? { status } : {}) })
      .setOptions(CROSS_TENANT)
      .sort({ createdAt: 1 });
  },

  listMembershipsForOrganization(organizationId: string) {
    return Membership.find({ organizationId }).sort({ createdAt: 1 });
  },
};

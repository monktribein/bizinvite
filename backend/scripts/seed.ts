/**
 * Bootstraps the first organization and owner, or a platform super admin.
 *
 *   npm run seed -- --org "Aura Events" --email owner@example.com --password 'S3cure-Passw0rd' --name "Owner Name"
 *   npm run seed -- --super-admin --email admin@example.com --password 'S3cure-Passw0rd' --name "Platform Admin"
 *
 * Idempotent: existing users/organizations are reused, never overwritten.
 */
import { connectDatabase, disconnectDatabase } from "../src/config/database";
import { passwordSchema, hashPassword } from "../src/modules/auth/password";
import { ensureSubscription } from "../src/modules/billing/service";
import { Organization } from "../src/modules/organizations/model";
import { Membership, User } from "../src/modules/users/model";
import { slugify } from "../src/common/utils/text";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const superAdmin = process.argv.includes("--super-admin");
  const email = (arg("email") ?? process.env.SEED_EMAIL ?? "").toLowerCase().trim();
  const password = arg("password") ?? process.env.SEED_PASSWORD ?? "";
  const name = arg("name") ?? process.env.SEED_NAME ?? "Administrator";
  const orgName = arg("org") ?? process.env.SEED_ORG_NAME;

  if (!email || !password) throw new Error("--email and --password are required");
  passwordSchema.parse(password);
  if (!superAdmin && !orgName) throw new Error("--org is required (or pass --super-admin)");

  await connectDatabase();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      email,
      name,
      passwordHash: await hashPassword(password),
      status: "active",
      ...(superAdmin ? { platformRole: "PLATFORM_SUPER_ADMIN" } : {}),
    });
    console.log(`Created user ${email}`);
  } else {
    console.log(`User ${email} already exists (unchanged)`);
  }

  if (!superAdmin && orgName) {
    const slug = slugify(orgName);
    let org = await Organization.findOne({ slug });
    if (!org) {
      org = await Organization.create({ name: orgName, slug, plan: "starter" });
      console.log(`Created organization "${orgName}" (${org.id})`);
    }
    await ensureSubscription(org.id);
    const exists = await Membership.findOne({ organizationId: org._id, userId: user._id });
    if (!exists) {
      await Membership.create({ organizationId: org._id, userId: user._id, role: "ORGANIZATION_OWNER", status: "active" });
      console.log(`Added ${email} as ORGANIZATION_OWNER`);
    }
    if (!user.defaultOrganizationId) {
      user.defaultOrganizationId = org._id;
      await user.save();
    }
  }
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});

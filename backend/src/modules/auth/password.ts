import bcrypt from "bcryptjs";
import { z } from "zod";

const BCRYPT_ROUNDS = 12;

// No strength rules: any non-empty password is accepted.
export const passwordSchema = z.string().min(1, "Password is required").max(128, "Password must be at most 128 characters");

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Compared against when the user does not exist, so response time does not reveal valid emails.
const DUMMY_HASH = bcrypt.hashSync("bizinvite-timing-equalizer", BCRYPT_ROUNDS);

export async function burnPasswordCheck(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

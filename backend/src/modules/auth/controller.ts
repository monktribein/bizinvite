import type { Request, Response } from "express";
import { Errors } from "../../common/errors/app-error";
import { sendSuccess } from "../../common/utils/response";
import { userRepository } from "../users/repository";
import * as schema from "./schema";
import * as authService from "./service";

function clientInfo(req: Request): authService.ClientInfo {
  return { ip: req.ip, userAgent: req.header("user-agent"), requestId: req.requestId };
}

export async function login(req: Request, res: Response) {
  const body = schema.loginSchema.parse(req.body);
  const result = await authService.login(body, clientInfo(req));
  sendSuccess(req, res, result, { message: "Logged in successfully" });
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = schema.refreshSchema.parse(req.body);
  const tokens = await authService.refresh(refreshToken, clientInfo(req));
  sendSuccess(req, res, tokens);
}

export async function logout(req: Request, res: Response) {
  const { refreshToken } = schema.logoutSchema.parse(req.body ?? {});
  const auth = req.auth!;
  await authService.logout(req.sessionFamily, refreshToken, {
    userId: auth.userId,
    organizationId: auth.organizationId,
    name: auth.name,
    role: auth.role,
    client: clientInfo(req),
  });
  sendSuccess(req, res, { message: "Logged out successfully" });
}

export async function me(req: Request, res: Response) {
  const user = await userRepository.findById(req.auth!.userId);
  if (!user) throw Errors.unauthorized();
  sendSuccess(req, res, await authService.buildAuthUser(user, req.auth!.organizationId));
}

export async function switchOrganization(req: Request, res: Response) {
  const { organizationId } = schema.switchOrganizationSchema.parse(req.body);
  const result = await authService.switchOrganization(req.auth!.userId, organizationId, req.sessionFamily ?? "", clientInfo(req));
  sendSuccess(req, res, result);
}

export async function acceptInvite(req: Request, res: Response) {
  const { token, password } = schema.acceptInviteSchema.parse(req.body);
  const result = await authService.acceptInvite(token, password, clientInfo(req));
  sendSuccess(req, res, result, { message: "Invitation accepted" });
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = schema.changePasswordSchema.parse(req.body);
  await authService.changePassword(req.auth!.userId, currentPassword, newPassword);
  sendSuccess(req, res, { message: "Password changed. Please sign in again." });
}

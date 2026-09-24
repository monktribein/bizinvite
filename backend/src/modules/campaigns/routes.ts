import { Router } from "express";
import multer from "multer";
import { requirePermission } from "../../middleware/rbac";
import * as controller from "./controller";
import { MAX_MEDIA_UPLOAD_BYTES } from "./media";

// Type and per-type size (image 2 MB, video 10 MB) are checked in media.ts
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES, files: 1, fields: 5 },
});

/** Mounted behind authenticate + resolveTenant. */
export const campaignsRouter = Router();

campaignsRouter.get("/", requirePermission("campaigns:view"), controller.list);
campaignsRouter.post("/", requirePermission("campaigns:create"), controller.create);
campaignsRouter.post("/test", requirePermission("campaigns:send"), controller.testDraft);
campaignsRouter.post("/media", requirePermission("campaigns:create"), mediaUpload.single("file"), controller.uploadMedia);
campaignsRouter.get("/media/:mediaId", requirePermission("campaigns:view"), controller.getMediaFile);
campaignsRouter.get("/:id", requirePermission("campaigns:view"), controller.get);
campaignsRouter.patch("/:id", requirePermission("campaigns:create"), controller.update);
campaignsRouter.get("/:id/recipients", requirePermission("campaigns:view"), controller.recipients);
campaignsRouter.post("/:id/send", requirePermission("campaigns:send"), controller.send);
campaignsRouter.post("/:id/pause", requirePermission("campaigns:send"), controller.pause);
campaignsRouter.post("/:id/resume", requirePermission("campaigns:send"), controller.resume);
campaignsRouter.post("/:id/cancel", requirePermission("campaigns:send"), controller.cancel);
campaignsRouter.post("/:id/test", requirePermission("campaigns:send"), controller.test);

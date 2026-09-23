import { Router } from "express";
import multer from "multer";
import path from "path";
import { Errors } from "../../common/errors/app-error";
import { requirePermission } from "../../middleware/rbac";
import { MAX_IMPORT_FILE_BYTES } from "./csv";
import * as controller from "./controller";

const ALLOWED_MIME = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel", "application/octet-stream"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".csv" || !ALLOWED_MIME.has(file.mimetype)) {
      return cb(Errors.validation("Only .csv files are accepted", { file: ["Only .csv files are accepted"] }));
    }
    cb(null, true);
  },
});

/** Mounted behind authenticate + resolveTenant. */
export const importsRouter = Router();

importsRouter.post("/guests/preview", requirePermission("guests:import"), upload.single("file"), controller.preview);
importsRouter.post("/guests", requirePermission("guests:import"), controller.commit);
importsRouter.get("/:id", requirePermission("guests:import"), controller.get);

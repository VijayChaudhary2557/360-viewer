import multer from "multer";
import { MAX_PANORAMAS } from "./upload.js";

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 50MB per image)"
        : err.code === "LIMIT_FILE_COUNT"
          ? `Too many files (max ${MAX_PANORAMAS} panoramas)`
          : err.message;
    return res.status(400).json({ error: message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || "Upload error" });
  }
}

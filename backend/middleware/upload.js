import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_DIR = path.join(__dirname, "..", "media");

if (!fs.existsSync(MEDIA_DIR)) {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const imageFilter = (_req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype.split("/")[1] ?? "");
  if (ext && mime) cb(null, true);
  else cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
};

export const MAX_PANORAMAS = 100;

export const uploadPanoramas = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: MAX_PANORAMAS },
});

export const mediaUrl = (filename) => `/api/media/${filename}`;

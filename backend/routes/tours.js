import { Router } from "express";
import {
  createTour,
  getTour,
  listTours,
  updateTour,
  uploadPanorama,
} from "../controllers/tourController.js";
import { uploadPanoramas, MAX_PANORAMAS } from "../middleware/upload.js";

const router = Router();

// Single panorama upload (optional utility endpoint)
router.post("/upload", uploadPanoramas.single("panorama"), uploadPanorama);

// Create tour: multipart with title, scenes JSON, and panoramas[] files (ordered)
router.post("/", uploadPanoramas.array("panoramas", MAX_PANORAMAS), createTour);

router.get("/", listTours);
router.get("/:id", getTour);
router.put("/:id", updateTour);

export default router;

import Tour from "../models/Tour.js";
import { mediaUrl } from "../middleware/upload.js";

function parseScenes(raw) {
  if (!raw) return [];
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(data)) throw new Error("scenes must be an array");
  return data;
}

function attachPanoramas(scenes, files) {
  return scenes.map((scene, i) => {
    const file = files[i];
    if (!file) throw new Error(`Missing panorama for scene "${scene.name}"`);
    return {
      ...scene,
      panorama: mediaUrl(file.filename),
    };
  });
}

export async function createTour(req, res) {
  try {
    const title = req.body.title?.trim() || "Untitled Tour";
    const scenes = parseScenes(req.body.scenes);
    const files = req.files ?? [];

    if (scenes.length === 0) {
      return res.status(400).json({ error: "At least one scene is required" });
    }
    if (files.length !== scenes.length) {
      return res.status(400).json({
        error: `Expected ${scenes.length} panorama file(s), received ${files.length}`,
      });
    }

    const tour = await Tour.create({
      title,
      scenes: attachPanoramas(scenes, files),
    });

    res.status(201).json(tour);
  } catch (err) {
    console.error("createTour:", err);
    res.status(400).json({ error: err.message || "Failed to create tour" });
  }
}

export async function listTours(req, res) {
  try {
    const tours = await Tour.find()
      .select("title scenes.sceneId scenes.name createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    res.json(tours);
  } catch (err) {
    res.status(500).json({ error: "Failed to list tours" });
  }
}

export async function getTour(req, res) {
  try {
    const tour = await Tour.findById(req.params.id).lean();
    if (!tour) return res.status(404).json({ error: "Tour not found" });
    res.json(tour);
  } catch (err) {
    res.status(400).json({ error: "Invalid tour id" });
  }
}

export async function updateTour(req, res) {
  try {
    const { title, scenes } = req.body;
    const update = {};
    if (title) update.title = title.trim();
    if (scenes) update.scenes = scenes;

    const tour = await Tour.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!tour) return res.status(404).json({ error: "Tour not found" });
    res.json(tour);
  } catch (err) {
    res.status(400).json({ error: err.message || "Failed to update tour" });
  }
}

export async function uploadPanorama(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    res.status(201).json({
      url: mediaUrl(req.file.filename),
      filename: req.file.filename,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || "Upload failed" });
  }
}

import mongoose from "mongoose";

const hotspotSchema = new mongoose.Schema(
  {
    toRoomId: { type: String, required: true },
    label: { type: String, default: "" },
    lon: { type: Number, default: 0 },
    lat: { type: Number, default: 0 },
  },
  { _id: false },
);

const sceneSchema = new mongoose.Schema(
  {
    sceneId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    floor: { type: Number, default: 1 },
    panorama: { type: String, required: true },
    hotspots: { type: [hotspotSchema], default: [] },
    initialLon: { type: Number, default: 0 },
    initialLat: { type: Number, default: 0 },
    map: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      w: { type: Number, default: 28 },
      h: { type: Number, default: 26 },
    },
  },
  { _id: false },
);

const tourSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    scenes: { type: [sceneSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("Tour", tourSchema);

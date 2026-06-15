import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import Routes from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import dns from "dns";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(cors());

dns.setServers(["1.1.1.1", "8.8.8.8"]);


app.use("/api/media", express.static(path.join(__dirname, "media")));

//! Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Database connection failed:", err));

  
//! Health check
app.get("/api", (req, res) => {
  res.send("Backend is running for 3d virtual tour dashboard");
});

//! API Routes
app.use("/api", Routes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} for 3d virtual tour dashboard`));
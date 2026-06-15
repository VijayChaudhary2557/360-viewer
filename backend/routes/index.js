import { Router } from "express";
import tourRoutes from "./tours.js";

const router = Router();

router.use("/tours", tourRoutes);

export default router;
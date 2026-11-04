import { Router } from "express";
import healthRoutes from "./health.routes";
import sampleRoutes from "./sample.routes";

const router = Router();

// Sub-routes mounted under /api or root of the function router
router.use("/health", healthRoutes);
router.use("/sample", sampleRoutes);

export default router;

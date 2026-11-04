import { Router } from "express";
import { getStatus, createSampleItem } from "../controllers/sample.controller";

const router = Router();

router.get("/status", getStatus);
router.post("/items", createSampleItem);

export default router;

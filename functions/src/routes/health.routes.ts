import { Router } from "express";
import { getHealth } from "../controllers/sample.controller";

const router = Router();

router.get("/", getHealth);

export default router;

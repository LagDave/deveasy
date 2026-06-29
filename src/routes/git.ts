import express from "express";
import { GitController } from "../controllers/git/GitController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

router.get("/history", GitController.history);
router.get("/status", GitController.status);

export default router;

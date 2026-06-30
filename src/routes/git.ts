import express from "express";
import { GitController } from "../controllers/git/GitController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

// Both GETs require a ?projectId= query param identifying the target project.
router.get("/history", GitController.history);
router.get("/status", GitController.status);
router.get("/branches", GitController.branches);
router.post("/checkout", GitController.checkout);
router.post("/stage", GitController.stage);
router.post("/unstage", GitController.unstage);
router.post("/commit", GitController.commit);
router.post("/branch", GitController.branch);
router.post("/push", GitController.push);
router.post("/merge-main", GitController.mergeMain);

export default router;

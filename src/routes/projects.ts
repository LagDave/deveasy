import express from "express";
import { ProjectsController } from "../controllers/projects/ProjectsController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

router.get("/", ProjectsController.list);
router.get("/active", ProjectsController.getActive);
router.post("/active", ProjectsController.setActive);

export default router;

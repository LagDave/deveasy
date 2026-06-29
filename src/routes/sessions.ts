import express from "express";
import { SessionsController } from "../controllers/sessions/SessionsController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

router.post("/", SessionsController.create);
router.get("/", SessionsController.list);
router.get("/:id/messages", SessionsController.listMessages);
router.post("/:id/stop", SessionsController.stop);

export default router;

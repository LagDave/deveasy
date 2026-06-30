import express from "express";
import { TerminalController } from "../controllers/terminal/TerminalController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app. The PTY
 * stream is served separately over the /ws/terminal WebSocket.
 */
const router = express.Router();

router.post("/", TerminalController.create);
router.get("/", TerminalController.list);
router.delete("/:id", TerminalController.remove);

export default router;

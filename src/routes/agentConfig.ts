import express from "express";
import { AgentConfigController } from "../controllers/agent-config/AgentConfigController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

router.get("/", AgentConfigController.list);
router.get("/:type/:name", AgentConfigController.read);
router.put("/:type/:name", AgentConfigController.write);
router.delete("/:type/:name", AgentConfigController.remove);

export default router;

import express from "express";
import { UsageController } from "../controllers/usage/UsageController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware: DevEasy is a single-operator local-first app.
 */
const router = express.Router();

router.get("/limits", UsageController.getLimits);

export default router;

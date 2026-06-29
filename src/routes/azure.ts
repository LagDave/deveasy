import express from "express";
import { AzureController } from "../controllers/azure/AzureController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app.
 * Read + create PR only — no merge/approve/vote/push endpoints (Spec 3 scope).
 */
const router = express.Router();

router.get("/status", AzureController.getStatus);
router.put("/connection", AzureController.connect);
router.get("/pull-requests", AzureController.listPullRequests);
router.get("/pull-requests/:id", AzureController.getPullRequestDetail);
router.post("/pull-requests", AzureController.createPullRequest);

export default router;

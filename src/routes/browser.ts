import express from "express";
import { BrowserController } from "../controllers/browser/BrowserController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app. The live
 * screencast stream is served separately over the /ws/browser WebSocket.
 */
const router = express.Router();

router.post("/:sessionId", BrowserController.open);
router.get("/", BrowserController.list);
router.get("/:sessionId", BrowserController.getInfo);
router.post("/:sessionId/close", BrowserController.close);
router.get("/:sessionId/tabs", BrowserController.listTabs);
router.post("/:sessionId/tabs", BrowserController.newTab);
router.delete("/:sessionId/tabs/:tabId", BrowserController.closeTab);
router.post("/:sessionId/tabs/:tabId/activate", BrowserController.activateTab);

export default router;

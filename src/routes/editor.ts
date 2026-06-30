import express from "express";
import { EditorController } from "../controllers/editor/EditorController";

/**
 * Thin route definitions only — method/path + controller call (Constitution §7.2).
 * No auth middleware in v1: DevEasy is a single-operator local-first app (same as
 * the git and projects routers).
 */
const router = express.Router();

router.get("/tree", EditorController.getTree);
router.get("/file", EditorController.getFile);
router.get("/head", EditorController.getHead);
router.get("/raw", EditorController.getRaw);
router.post("/file", EditorController.saveFile);
router.get("/state", EditorController.getState);
router.put("/state", EditorController.putState);

export default router;

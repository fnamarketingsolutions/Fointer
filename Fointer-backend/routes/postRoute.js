import express from "express";
import {
  listPosts,
  getPost,
  listPublicPosts,
  getPublicPost,
  createPost,
  updatePost,
  deletePost,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  togglePostLike,
  toggleCommentLike,
} from "../controllers/post.controller.js";
import {
  isAuthenticated,
  optionalAuthenticate,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", isAuthenticated, listPosts);
router.post("/", isAuthenticated, createPost);

// Public browse (community-less posts) — before /:id
router.get("/public", optionalAuthenticate, listPublicPosts);
router.get("/public/:id", optionalAuthenticate, getPublicPost);

// Comment mutations must be registered before /:id
router.patch("/comments/:id", isAuthenticated, updateComment);
router.delete("/comments/:id", isAuthenticated, deleteComment);
router.post("/comments/:id/like", isAuthenticated, toggleCommentLike);

router.get("/:id/comments", isAuthenticated, listComments);
router.post("/:id/comments", isAuthenticated, createComment);
router.post("/:id/like", isAuthenticated, togglePostLike);

router.get("/:id", isAuthenticated, getPost);
router.patch("/:id", isAuthenticated, updatePost);
router.delete("/:id", isAuthenticated, deletePost);

export default router;

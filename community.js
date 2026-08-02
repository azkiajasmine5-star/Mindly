"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// 1. Get community posts feed (including replies count)
router.get('/posts', auth_1.authenticateJWT, async (req, res) => {
    try {
        const posts = await db_1.default.communityPost.findMany({
            where: { parentId: null }, // Only top level threads
            include: {
                user: {
                    select: { id: true, name: true, level: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // For each post, fetch replies count manually or calculate
        const postsWithRepliesCount = await Promise.all(posts.map(async (post) => {
            const count = await db_1.default.communityPost.count({
                where: { parentId: post.id }
            });
            return {
                ...post,
                repliesCount: count
            };
        }));
        return res.json(postsWithRepliesCount);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch community feed', details: err.message });
    }
});
// 2. Get post details and all nested thread replies
router.get('/posts/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const post = await db_1.default.communityPost.findUnique({
            where: { id: req.params.id },
            include: {
                user: {
                    select: { id: true, name: true, level: true }
                }
            }
        });
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        const replies = await db_1.default.communityPost.findMany({
            where: { parentId: req.params.id },
            include: {
                user: {
                    select: { id: true, name: true, level: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });
        return res.json({ ...post, replies });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve discussion thread', details: err.message });
    }
});
// 3. Create a community post (or nested thread reply)
router.post('/posts', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { title, content, parentId } = req.body;
        if (!content || (parentId === undefined && !title)) {
            return res.status(400).json({ error: 'Content and title are required for new threads.' });
        }
        const userId = req.user?.id;
        const post = await db_1.default.communityPost.create({
            data: {
                userId,
                title: title || 'Reply',
                content,
                parentId: parentId || null
            },
            include: {
                user: {
                    select: { id: true, name: true }
                }
            }
        });
        // Reward XP +10 for active community participation
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 10;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + 2
                }
            });
        }
        return res.status(201).json(post);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to publish post', details: err.message });
    }
});
// 4. Retrieve shared notes from all peers (Community library)
router.get('/notes', auth_1.authenticateJWT, async (req, res) => {
    try {
        const sharedNotes = await db_1.default.note.findMany({
            where: { isArchived: false },
            include: {
                user: {
                    select: { name: true, level: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(sharedNotes);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve shared notes', details: err.message });
    }
});
exports.default = router;

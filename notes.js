"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const ai_1 = require("../services/ai");
const router = (0, express_1.Router)();
// Create note + trigger AI processing
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { title, rawContent } = req.body;
        if (!title || !rawContent) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        const userId = req.user?.id;
        // Call AI helper
        const aiResult = await ai_1.AIService.processNotes(title, rawContent);
        // Save notes with AI-generated elements in DB
        const note = await db_1.default.note.create({
            data: {
                userId,
                title,
                rawContent,
                summary: aiResult.summary,
                keyPoints: aiResult.keyPoints,
                glossary: aiResult.glossary,
                mindMap: aiResult.mindMap,
                flashcards: aiResult.flashcards
            }
        });
        // Update user stats: award +15 XP for creating smart learning materials
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 15;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + 5 // +5 coins reward
                }
            });
        }
        return res.status(201).json(note);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to process note', details: err.message });
    }
});
// List user notes
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const notes = await db_1.default.note.findMany({
            where: { userId: req.user?.id, isArchived: false },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(notes);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch notes', details: err.message });
    }
});
// Get note detail
router.get('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const note = await db_1.default.note.findFirst({
            where: { id: req.params.id, userId: req.user?.id }
        });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        return res.json(note);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch note detail', details: err.message });
    }
});
// Archive note
router.delete('/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        await db_1.default.note.updateMany({
            where: { id: req.params.id, userId: req.user?.id },
            data: { isArchived: true }
        });
        return res.json({ message: 'Note archived successfully' });
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to delete note', details: err.message });
    }
});
exports.default = router;

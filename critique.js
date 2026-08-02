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
// Submit multimedia layout for AI review
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { mediaType, imageUrl } = req.body;
        if (!mediaType || !imageUrl) {
            return res.status(400).json({ error: 'MediaType and ImageUrl are required' });
        }
        const userId = req.user?.id;
        // Call Vision API critique service
        const report = await ai_1.AIService.critiqueDesign(mediaType, imageUrl);
        // Save critique review inside DB
        const reviewRecord = await db_1.default.mediaCritique.create({
            data: {
                userId,
                mediaType,
                mediaUrl: imageUrl,
                critiqueScore: report.score,
                critiqueText: report.critique,
                suggestions: report.suggestions
            }
        });
        // Reward XP +20 for active review submission
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 20;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + 10 // bonus coins
                }
            });
        }
        return res.status(201).json({
            id: reviewRecord.id,
            score: report.score,
            critique: report.critique,
            suggestions: report.suggestions
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Multimedia evaluation failed', details: err.message });
    }
});
// Get user history of critiques
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const records = await db_1.default.mediaCritique.findMany({
            where: { userId: req.user?.id },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(records);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve critique histories', details: err.message });
    }
});
exports.default = router;

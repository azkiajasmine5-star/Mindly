"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Submit game score and award gamification metrics
router.post('/score', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { gameName, score } = req.body;
        if (!gameName || score === undefined) {
            return res.status(400).json({ error: 'gameName and score are required' });
        }
        const numScore = parseInt(score);
        if (isNaN(numScore) || numScore < 0) {
            return res.status(400).json({ error: 'score must be a non-negative number' });
        }
        // Baseline XP and coin calculations for educational games
        // 10 XP base + 1 XP per point scored (max 50 XP per game)
        // 2 Coins base + 1 Coin per 10 points scored (max 15 coins per game)
        const xpReward = Math.min(50, 10 + Math.floor(numScore / 2));
        const coinsReward = Math.min(15, 2 + Math.floor(numScore / 10));
        // Save Game Score Log
        const gameScoreLog = await db_1.default.gameScore.create({
            data: {
                userId,
                gameName,
                score: numScore,
                xpEarned: xpReward
            }
        });
        // Update user game metrics (XP, Level, Coins)
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        let updatedLevel = 1;
        let updatedXp = 0;
        let updatedCoins = 0;
        if (user) {
            updatedXp = user.xp + xpReward;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            updatedLevel = targetLevel > user.level ? targetLevel : user.level;
            updatedCoins = user.coins + coinsReward;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: updatedLevel,
                    coins: updatedCoins
                }
            });
        }
        return res.status(201).json({
            success: true,
            gameScoreId: gameScoreLog.id,
            score: numScore,
            xpEarned: xpReward,
            coinsEarned: coinsReward,
            user: user ? {
                name: user.name,
                level: updatedLevel,
                xp: updatedXp,
                coins: updatedCoins
            } : null
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Game score recording failed', details: err.message });
    }
});
// Retrieve user's game scores history
router.get('/history', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const scores = await db_1.default.gameScore.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        return res.json(scores);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve game history', details: err.message });
    }
});
exports.default = router;

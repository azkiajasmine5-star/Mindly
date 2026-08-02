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
// Interact with AI Mentor
router.post('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { message, history } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message body cannot be empty' });
        }
        const userId = req.user?.id;
        const dialogueHistory = history || [];
        // Retrieve AI answer
        const responseText = await ai_1.AIService.chatMentor(message, dialogueHistory);
        // Boost learning stats slightly (+2 XP) to reward proactive querying
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 2;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level
                }
            });
        }
        return res.json({ response: responseText });
    }
    catch (err) {
        return res.status(500).json({ error: 'Tutor chat session failed', details: err.message });
    }
});
exports.default = router;

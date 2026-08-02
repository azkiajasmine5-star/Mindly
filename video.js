"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Generate storyboard scene timeline for whiteboard/infographics
router.post('/generate', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { noteId, durationMinutes } = req.body;
        if (!noteId) {
            return res.status(400).json({ error: 'NoteId is required' });
        }
        const note = await db_1.default.note.findUnique({
            where: { id: noteId, userId: req.user?.id }
        });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const duration = parseInt(durationMinutes) || 3;
        // Generate whiteboard storyboard scenes matching note summaries
        const scenes = [
            {
                sceneNumber: 1,
                title: "Introduction to Topic",
                duration: "30s",
                narration: `Hello, today we are learning about "${note.title}". Let's examine the main concept: ${note.summary ? note.summary.substring(0, 120) : 'why visual hierarchy governs multimedia design'}.`,
                animationType: "Whiteboard Drawing",
                visualAsset: "Illustrating a teacher pointing to a blank grid on a screen.",
                subtitles: `Today we dive into: ${note.title}.`
            },
            {
                sceneNumber: 2,
                title: "Deep Dive: Core Principles",
                duration: `${(duration * 60 - 60)}s`,
                narration: "Our study notes highlight critical points. Visual layouts command a structure that maps to human scanning paths. Master fonts and limit pairs to prevent design noise.",
                animationType: "Motion Graphics & Infographics",
                visualAsset: "Displaying contrast ratios sliding from 2:1 up to AA-compliant 4.5:1 with green checkmarks.",
                subtitles: "Limit font families to two and check WCAG contrast rules."
            },
            {
                sceneNumber: 3,
                title: "Conclusion & Recap",
                duration: "30s",
                narration: "To wrap up: keep your spacing wide, structure quad meshes, and test contrast scores. Thanks for watching!",
                animationType: "Outro Card Zoom",
                visualAsset: "Bento grid shrinking into a single glowing study portal logo.",
                subtitles: "Study smarter with StudyWithKia."
            }
        ];
        // Award XP +20 for generating educational videos
        const userId = req.user?.id;
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 20;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + 8
                }
            });
        }
        return res.status(201).json({
            noteId,
            videoTitle: `${note.title} - AI Animated Guide`,
            targetDurationMinutes: duration,
            scenes
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Video generation failed', details: err.message });
    }
});
exports.default = router;

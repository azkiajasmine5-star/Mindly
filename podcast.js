"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// Generate natural script + mock sync subtitles
router.post('/generate', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { noteId, voiceType, style } = req.body;
        if (!noteId) {
            return res.status(400).json({ error: 'NoteId is required' });
        }
        const note = await db_1.default.note.findUnique({
            where: { id: noteId, userId: req.user?.id }
        });
        if (!note) {
            return res.status(404).json({ error: 'Note not found' });
        }
        // Generate podcast script content matching selected style
        let script = '';
        let hostA = voiceType || 'Friendly Mentor (Azkia)';
        let hostB = 'Co-Host (AI)';
        if (style === 'CONVERSATION') {
            script = `[${hostA}]: Welcome back to StudyWithKia Podcasts! Today, we are deep-diving into "${note.title}".
[${hostB}]: Absolutely. It's a fascinating topic. The core of this material covers foundational guidelines that multimedia students must master.
[${hostA}]: Right! For instance, let's look at the summary: ${note.summary || 'understanding key visual structures'}.
[${hostB}]: What stands out is how this impacts real layouts. It provides an immediate outline that minimizes cognitive load.
[${hostA}]: Spot on. Make sure to review the glossary terms, especially when building your interface projects. Thanks for tuning in!`;
        }
        else {
            script = `[${hostA}]: Hello class! Let's do a quick recap on "${note.title}".
According to our study notes, the primary takeaways are clear. The summary states: ${note.summary || 'no summary available'}.
Key concepts include structuring clean quad grids and testing contrast ratios. Remember that WCAG AA compliance requires at least a 4.5:1 ratio.
Ensure you test this layout in your projects before submitting. Keep studying hard, and I will see you in the next lecture!`;
        }
        // Generate simulated subtitles with word timestamps for player sync
        const subtitles = [
            { text: "Welcome back to StudyWithKia Podcasts!", start: 0, end: 3.5 },
            { text: `Today we are deep-diving into our topic: ${note.title}.`, start: 3.8, end: 8.0 },
            { text: "The core of this material covers foundational visual guidelines.", start: 8.5, end: 13.0 },
            { text: `Let's read: ${note.summary ? note.summary.substring(0, 80) : 'studying smart'}...`, start: 13.5, end: 20.0 },
            { text: "Keep studying, and check your WCAG contrast values. See you next time!", start: 20.5, end: 26.0 }
        ];
        // Award XP +15 for generating learning podcasts
        const userId = req.user?.id;
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + 15;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + 5
                }
            });
        }
        return res.status(201).json({
            noteId,
            title: `${note.title} - AI Podcast`,
            script,
            voiceType: hostA,
            style: style || 'TEACHER',
            durationSeconds: 26,
            subtitles,
            audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' // High-quality royalty-free demo audio
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Podcast generation failed', details: err.message });
    }
});
exports.default = router;

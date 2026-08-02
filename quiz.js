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
// Generate quiz
router.post('/generate', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { topic, difficulty, questionCount } = req.body;
        const count = parseInt(questionCount) || 5;
        // Call AI service to generate structured questions
        const questionsData = await ai_1.AIService.generateQuiz(topic || 'General Multimedia', count, difficulty || 'MEDIUM');
        // Create Quiz and Questions in DB
        const quiz = await db_1.default.quiz.create({
            data: {
                title: `AI generated quiz: ${topic || 'General Multimedia'}`,
                difficulty: difficulty || 'MEDIUM',
                questionCount: count,
                questions: {
                    create: questionsData.map((q) => ({
                        type: q.type,
                        content: q.content,
                        options: q.options || {},
                        answer: q.answer,
                        explanation: q.explanation
                    }))
                }
            },
            include: {
                questions: true
            }
        });
        return res.status(201).json(quiz);
    }
    catch (err) {
        return res.status(500).json({ error: 'Quiz generation failed', details: err.message });
    }
});
// Score attempt and award gamification metrics
router.post('/attempt/:id', auth_1.authenticateJWT, async (req, res) => {
    try {
        const quizId = req.params.id;
        const userId = req.user?.id;
        const { answers, duration } = req.body; // answers: Record<questionId, answerValue>
        const quiz = await db_1.default.quiz.findUnique({
            where: { id: quizId },
            include: { questions: true }
        });
        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }
        let correctCount = 0;
        const reviewData = quiz.questions.map((q) => {
            const isCorrect = answers[q.id] === q.answer;
            if (isCorrect)
                correctCount++;
            return {
                questionId: q.id,
                question: q.content,
                submitted: answers[q.id] || '',
                correct: q.answer,
                explanation: q.explanation,
                isCorrect
            };
        });
        const scorePercent = Math.round((correctCount / quiz.questions.length) * 100);
        const xpReward = correctCount * 10 + 20; // 10 XP per correct question + 20 completion XP
        const coinsReward = correctCount * 2;
        // Save attempt log
        const attempt = await db_1.default.quizAttempt.create({
            data: {
                userId,
                quizId,
                score: scorePercent,
                xpEarned: xpReward,
                duration: duration || 60
            }
        });
        // Update user game metrics (XP, Level, Coins)
        const user = await db_1.default.user.findUnique({ where: { id: userId } });
        if (user) {
            const updatedXp = user.xp + xpReward;
            const targetLevel = Math.floor(updatedXp / 100) + 1;
            await db_1.default.user.update({
                where: { id: userId },
                data: {
                    xp: updatedXp,
                    level: targetLevel > user.level ? targetLevel : user.level,
                    coins: user.coins + coinsReward
                }
            });
        }
        return res.json({
            score: scorePercent,
            correctAnswers: correctCount,
            totalQuestions: quiz.questions.length,
            xpEarned: xpReward,
            coinsEarned: coinsReward,
            review: reviewData
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Grading failed', details: err.message });
    }
});
// Fetch Top Users Leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await db_1.default.user.findMany({
            take: 10,
            orderBy: [
                { level: 'desc' },
                { xp: 'desc' }
            ],
            select: {
                id: true,
                name: true,
                xp: true,
                level: true,
                streakDays: true
            }
        });
        return res.json(leaderboard);
    }
    catch (err) {
        return res.status(500).json({ error: 'Leaderboard loading failed', details: err.message });
    }
});
exports.default = router;

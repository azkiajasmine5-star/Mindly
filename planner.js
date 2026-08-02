"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
// 1. Semester Dashboard: Retrieve Courses
router.get('/courses', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const courses = await db_1.default.course.findMany({
            where: { userId },
            orderBy: { semester: 'asc' }
        });
        return res.json(courses);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve courses', details: err.message });
    }
});
// 2. Add course to Semester
router.post('/courses', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { code, name, description, credits, semester } = req.body;
        if (!code || !name) {
            return res.status(400).json({ error: 'Course code and name are required' });
        }
        const course = await db_1.default.course.create({
            data: {
                userId,
                code,
                name,
                description,
                credits: parseInt(credits) || 3,
                semester: parseInt(semester) || 1
            }
        });
        return res.status(201).json(course);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to add course', details: err.message });
    }
});
// 3. Record Grade for Course
router.patch('/courses/:id/grade', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { grade } = req.body;
        const course = await db_1.default.course.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }
        const updated = await db_1.default.course.update({
            where: { id: req.params.id },
            data: { grade }
        });
        return res.json(updated);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to record grade', details: err.message });
    }
});
// 4. Retrieve Study Tasks
router.get('/tasks', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { isCompleted } = req.query;
        const tasks = await db_1.default.studyTask.findMany({
            where: {
                userId,
                isCompleted: isCompleted !== undefined ? isCompleted === 'true' : undefined
            },
            include: {
                course: {
                    select: { code: true, name: true }
                }
            },
            orderBy: { deadline: 'asc' }
        });
        return res.json(tasks);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch tasks', details: err.message });
    }
});
// 5. Add Study Task
router.post('/tasks', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { courseId, title, description, deadline, priority } = req.body;
        if (!title || !deadline) {
            return res.status(400).json({ error: 'Title and deadline date are required' });
        }
        const task = await db_1.default.studyTask.create({
            data: {
                userId,
                courseId: courseId || null,
                title,
                description,
                deadline: new Date(deadline),
                priority: priority || 'MEDIUM'
            }
        });
        return res.status(201).json(task);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to create task', details: err.message });
    }
});
// 6. Complete Study Task & Award gamification XP
router.patch('/tasks/:id/complete', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        const task = await db_1.default.studyTask.findFirst({
            where: { id: req.params.id, userId }
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        const nextCompletedState = !task.isCompleted;
        const updatedTask = await db_1.default.studyTask.update({
            where: { id: req.params.id },
            data: { isCompleted: nextCompletedState }
        });
        // If marked completed, award +5 XP and update coins
        if (nextCompletedState) {
            const user = await db_1.default.user.findUnique({ where: { id: userId } });
            if (user) {
                const nextXp = user.xp + 5;
                const targetLevel = Math.floor(nextXp / 100) + 1;
                await db_1.default.user.update({
                    where: { id: userId },
                    data: {
                        xp: nextXp,
                        level: targetLevel > user.level ? targetLevel : user.level,
                        coins: user.coins + 1
                    }
                });
            }
        }
        return res.json(updatedTask);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to complete task', details: err.message });
    }
});
// 7. AI Study Planner: Create Optimized Study schedule
router.post('/suggest-plan', auth_1.authenticateJWT, async (req, res) => {
    try {
        const userId = req.user?.id;
        // Fetch user tasks and active courses
        const tasks = await db_1.default.studyTask.findMany({
            where: { userId, isCompleted: false },
            include: { course: true }
        });
        const courses = await db_1.default.course.findMany({
            where: { userId }
        });
        // Build context-aware planner outline
        const scheduleItems = tasks.map((task, index) => {
            const hoursToStudy = task.priority === 'HIGH' ? 3 : task.priority === 'MEDIUM' ? 1.5 : 1;
            const timeSlot = index % 2 === 0 ? '14:00 - 15:30' : '19:00 - 20:30';
            return {
                task: task.title,
                course: task.course?.name || 'General study',
                timeSlot,
                durationHours: hoursToStudy,
                priority: task.priority,
                recommendation: task.priority === 'HIGH'
                    ? 'Urgent milestone. Use Pomodoro Deep Focus with Cafe Ambiance audio.'
                    : 'Standard review. Check terminology flashcards in note logs.'
            };
        });
        const plan = {
            timestamp: new Date(),
            totalTasks: tasks.length,
            recommendationSummary: tasks.length > 0
                ? "We have generated an optimized 7-day studying plan based on your active coursework deadlines. High priority milestones are queued first."
                : "You have no outstanding active tasks. We recommend preparing for upcoming semesters by reviewing the multimedia critique guidelines.",
            schedule: scheduleItems
        };
        return res.json(plan);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to generate study plan', details: err.message });
    }
});
exports.default = router;

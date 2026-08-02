"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const db_1 = __importDefault(require("../services/db"));
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'studywithkia-super-secret-key-2026';
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    role: zod_1.z.enum(['USER', 'INSTRUCTOR', 'ADMIN']).optional()
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string()
});
// Register
router.post('/register', async (req, res) => {
    try {
        const parse = registerSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Validation errors', details: parse.error.format() });
        }
        const { name, email, password, role } = parse.data;
        const existing = await db_1.default.user.findUnique({ where: { email } });
        if (existing) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const user = await db_1.default.user.create({
            data: {
                name,
                email,
                passwordHash,
                role: role || 'USER',
                profile: {
                    create: {
                        studyField: 'Multimedia Education'
                    }
                }
            },
            include: {
                profile: true
            }
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    }
    catch (err) {
        return res.status(500).json({ error: 'Registration failed', details: err.message });
    }
});
// Login
router.post('/login', async (req, res) => {
    try {
        const parse = loginSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ error: 'Email and password required' });
        }
        const { email, password } = parse.data;
        const user = await db_1.default.user.findUnique({
            where: { email },
            include: { profile: true }
        });
        if (!user || !(await bcryptjs_1.default.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Refresh last active and potential streak day increments
        const diffTime = Math.abs(new Date().getTime() - user.lastActive.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let newStreak = user.streakDays;
        if (diffDays === 1) {
            newStreak += 1;
        }
        else if (diffDays > 1) {
            newStreak = 1;
        }
        await db_1.default.user.update({
            where: { id: user.id },
            data: { lastActive: new Date(), streakDays: newStreak }
        });
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                xp: user.xp,
                level: user.level,
                coins: user.coins,
                streakDays: newStreak,
                profile: user.profile
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: 'Authentication failed', details: err.message });
    }
});
// Get profile
router.get('/profile', auth_1.authenticateJWT, async (req, res) => {
    try {
        const user = await db_1.default.user.findUnique({
            where: { id: req.user?.id },
            include: { profile: true, portfolio: true }
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user);
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to fetch profile', details: err.message });
    }
});
// Update profile / settings
router.patch('/profile', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { name, avatar, bio, studyField, portfolioWebsite, resumeUrl } = req.body;
        const userId = req.user?.id;
        const updatedUser = await db_1.default.user.update({
            where: { id: userId },
            data: {
                name,
                profile: {
                    update: {
                        avatar,
                        bio,
                        studyField,
                        portfolioWebsite,
                        resumeUrl
                    }
                }
            },
            include: { profile: true }
        });
        return res.json(updatedUser);
    }
    catch (err) {
        return res.status(500).json({ error: 'Profile update failed', details: err.message });
    }
});
exports.default = router;

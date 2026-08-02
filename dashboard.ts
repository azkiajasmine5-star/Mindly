import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// Retrieve combined stats + logs for user homepage dashboard
router.get('/stats', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id!;

    // Fetch user database record
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Counts of note records, quiz logs, critiques
    const notesCount = await prisma.note.count({ where: { userId, isArchived: false } });
    const quizAttemptsCount = await prisma.quizAttempt.count({ where: { userId } });
    const critiquesCount = await prisma.mediaCritique.count({ where: { userId } });
    const tasksRemaining = await prisma.studyTask.count({ where: { userId, isCompleted: false } });

    // Recent items
    const recentNotes = await prisma.note.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      take: 4
    });

    const recentCritiques = await prisma.mediaCritique.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    const upcomingTasks = await prisma.studyTask.findMany({
      where: { userId, isCompleted: false },
      orderBy: { deadline: 'asc' },
      take: 4,
      include: {
        course: {
          select: { code: true }
        }
      }
    });

    // Simulated weekly activity log (XP earned per day of current week)
    const weeklyActivity = [
      { day: 'Mon', xp: 45 },
      { day: 'Tue', xp: 20 },
      { day: 'Wed', xp: 85 },
      { day: 'Thu', xp: 15 },
      { day: 'Fri', xp: 60 },
      { day: 'Sat', xp: 90 },
      { day: 'Sun', xp: 10 }
    ];

    // Earned Badges
    const badges = [];
    if (notesCount >= 1) badges.push({ id: 'badge1', name: 'Note Architect', icon: 'Brain', description: 'Upload and process your first learning note.' });
    if (quizAttemptsCount >= 1) badges.push({ id: 'badge2', name: 'Arena Challenger', icon: 'Trophy', description: 'Attempt a practice quiz in the arena.' });
    if (critiquesCount >= 1) badges.push({ id: 'badge3', name: 'Pixel Critic', icon: 'Palette', description: 'Request design critique diagnostics.' });
    if (user.streakDays >= 3) badges.push({ id: 'badge4', name: 'Unstoppable', icon: 'Flame', description: 'Maintain a 3+ day study streak.' });

    // Fallback if badges are empty to keep user motivated
    if (badges.length === 0) {
      badges.push({ id: 'badge0', name: 'Pioneer', icon: 'Sparkles', description: 'Join StudyWithKia and embark on your learning journey.' });
    }

    const motivations = [
      "Design is not just what it looks like and feels like. Design is how it works. — Steve Jobs",
      "The best way to predict the future is to create it. — Peter Drucker",
      "Simplicity is the ultimate sophistication. — Leonardo da Vinci",
      "Great designs are built on clean grids and high contrast."
    ];
    const dailyMotivation = motivations[Math.floor(Math.random() * motivations.length)];

    return res.json({
      user: {
        name: user.name,
        email: user.email,
        xp: user.xp,
        level: user.level,
        coins: user.coins,
        streakDays: user.streakDays,
        studyField: user.profile?.studyField || 'Multimedia Education'
      },
      counts: {
        notes: notesCount,
        quizzes: quizAttemptsCount,
        critiques: critiquesCount,
        tasks: tasksRemaining
      },
      recentNotes,
      recentCritiques,
      upcomingTasks,
      weeklyActivity,
      badges,
      dailyMotivation
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to aggregate dashboard statistics', details: err.message });
  }
});

// Admin stats overview
router.get('/admin-summary', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if requester is admin
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Permission denied. Admin dashboard access restricted.' });
    }

    const totalUsers = await prisma.user.count();
    const totalNotes = await prisma.note.count();
    const totalQuizzes = await prisma.quiz.count();
    const totalCritiques = await prisma.mediaCritique.count();

    const topUsers = await prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        email: true,
        xp: true,
        level: true,
        role: true
      }
    });

    return res.json({
      summary: {
        users: totalUsers,
        notes: totalNotes,
        quizzes: totalQuizzes,
        critiques: totalCritiques
      },
      topUsers,
      systemStatus: 'ONLINE',
      dbDriver: 'PostgreSQL',
      storageUsedMb: Math.round(totalNotes * 0.05 + totalCritiques * 0.1) // dummy computation
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to gather admin metrics', details: err.message });
  }
});

export default router;

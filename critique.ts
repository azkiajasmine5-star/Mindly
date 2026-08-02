import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';
import { AIService } from '../services/ai';

const router = Router();

// Submit multimedia layout for AI review
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mediaType, imageUrl } = req.body;
    if (!mediaType || !imageUrl) {
      return res.status(400).json({ error: 'MediaType and ImageUrl are required' });
    }

    const userId = req.user?.id!;

    // Call Vision API critique service
    const report = await AIService.critiqueDesign(mediaType, imageUrl);

    // Save critique review inside DB
    const reviewRecord = await prisma.mediaCritique.create({
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const updatedXp = user.xp + 20;
      const targetLevel = Math.floor(updatedXp / 100) + 1;
      await prisma.user.update({
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
  } catch (err: any) {
    return res.status(500).json({ error: 'Multimedia evaluation failed', details: err.message });
  }
});

// Get user history of critiques
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const records = await prisma.mediaCritique.findMany({
      where: { userId: req.user?.id },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(records);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve critique histories', details: err.message });
  }
});

export default router;

import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';
import { AIService } from '../services/ai';

const router = Router();

// Interact with AI Mentor
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message body cannot be empty' });
    }

    const userId = req.user?.id!;
    const dialogueHistory = history || [];

    // Retrieve AI answer
    const responseText = await AIService.chatMentor(message, dialogueHistory);

    // Boost learning stats slightly (+2 XP) to reward proactive querying
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const updatedXp = user.xp + 2;
      const targetLevel = Math.floor(updatedXp / 100) + 1;
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: updatedXp,
          level: targetLevel > user.level ? targetLevel : user.level
        }
      });
    }

    return res.json({ response: responseText });
  } catch (err: any) {
    return res.status(500).json({ error: 'Tutor chat session failed', details: err.message });
  }
});

export default router;

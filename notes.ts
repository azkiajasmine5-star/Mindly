import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';
import { AIService } from '../services/ai';

const router = Router();

// Create note + trigger AI processing
router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, rawContent } = req.body;
    if (!title || !rawContent) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    const userId = req.user?.id!;

    // Call AI helper
    const aiResult = await AIService.processNotes(title, rawContent);

    // Save notes with AI-generated elements in DB
    const note = await prisma.note.create({
      data: {
        userId,
        title,
        rawContent,
        summary: aiResult.summary,
        keyPoints: aiResult.keyPoints,
        glossary: aiResult.glossary,
        mindMap: aiResult.mindMap,
        flashcards: aiResult.flashcards
      }
    });

    // Update user stats: award +15 XP for creating smart learning materials
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const updatedXp = user.xp + 15;
      const targetLevel = Math.floor(updatedXp / 100) + 1;
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: updatedXp,
          level: targetLevel > user.level ? targetLevel : user.level,
          coins: user.coins + 5 // +5 coins reward
        }
      });
    }

    return res.status(201).json(note);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to process note', details: err.message });
  }
});

// List user notes
router.get('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user?.id, isArchived: false },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(notes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch notes', details: err.message });
  }
});

// Get note detail
router.get('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id, userId: req.user?.id }
    });
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.json(note);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch note detail', details: err.message });
  }
});

// Archive note
router.delete('/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.note.updateMany({
      where: { id: req.params.id, userId: req.user?.id },
      data: { isArchived: true }
    });
    return res.json({ message: 'Note archived successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete note', details: err.message });
  }
});

export default router;

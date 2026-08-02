import { Router, Response } from 'express';
import prisma from '../services/db';
import { authenticateJWT, AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

// 1. Get community posts feed (including replies count)
router.get('/posts', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const posts = await prisma.communityPost.findMany({
      where: { parentId: null }, // Only top level threads
      include: {
        user: {
          select: { id: true, name: true, level: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // For each post, fetch replies count manually or calculate
    const postsWithRepliesCount = await Promise.all(
      posts.map(async (post) => {
        const count = await prisma.communityPost.count({
          where: { parentId: post.id }
        });
        return {
          ...post,
          repliesCount: count
        };
      })
    );

    return res.json(postsWithRepliesCount);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch community feed', details: err.message });
  }
});

// 2. Get post details and all nested thread replies
router.get('/posts/:id', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const post = await prisma.communityPost.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, name: true, level: true }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const replies = await prisma.communityPost.findMany({
      where: { parentId: req.params.id },
      include: {
        user: {
          select: { id: true, name: true, level: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return res.json({ ...post, replies });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve discussion thread', details: err.message });
  }
});

// 3. Create a community post (or nested thread reply)
router.post('/posts', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, content, parentId } = req.body;
    if (!content || (parentId === undefined && !title)) {
      return res.status(400).json({ error: 'Content and title are required for new threads.' });
    }

    const userId = req.user?.id!;

    const post = await prisma.communityPost.create({
      data: {
        userId,
        title: title || 'Reply',
        content,
        parentId: parentId || null
      },
      include: {
        user: {
          select: { id: true, name: true }
        }
      }
    });

    // Reward XP +10 for active community participation
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const updatedXp = user.xp + 10;
      const targetLevel = Math.floor(updatedXp / 100) + 1;
      await prisma.user.update({
        where: { id: userId },
        data: {
          xp: updatedXp,
          level: targetLevel > user.level ? targetLevel : user.level,
          coins: user.coins + 2
        }
      });
    }

    return res.status(201).json(post);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to publish post', details: err.message });
  }
});

// 4. Retrieve shared notes from all peers (Community library)
router.get('/notes', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sharedNotes = await prisma.note.findMany({
      where: { isArchived: false },
      include: {
        user: {
          select: { name: true, level: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(sharedNotes);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve shared notes', details: err.message });
  }
});

export default router;

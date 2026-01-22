import express from 'express';
import { resolveScene } from '../services/scene';

const router = express.Router();

/**
 * POST /api/scene/resolve
 * Resolve scene parameter to context
 */
router.post('/resolve', async (req, res) => {
  try {
    const { shortCode } = req.body;

    if (!shortCode) {
      return res.status(400).json({ error: 'shortCode is required' });
    }

    const context = await resolveScene(shortCode);

    if (!context) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    res.json({ data: context });
  } catch (error: any) {
    console.error('Resolve scene error:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve scene' });
  }
});

export default router;

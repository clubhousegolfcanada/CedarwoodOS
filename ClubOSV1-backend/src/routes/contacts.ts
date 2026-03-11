import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/contacts/search
 * Search contacts (HubSpot integration removed)
 */
router.get('/search', authenticate, async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({
        contacts: [],
        message: 'Query must be at least 2 characters'
      });
    }

    logger.info('Contact search requested', {
      query: q,
      userId: req.user?.id,
      userRole: req.user?.role
    });

    // HubSpot integration removed - return empty results
    res.json({
      contacts: [],
      cached: false,
      hubspotConnected: false
    });

  } catch (error: any) {
    logger.error('Contact search error:', error);
    res.status(500).json({
      error: 'Failed to search contacts',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/lookup/:phone
 * Lookup a single contact by phone number (HubSpot integration removed)
 */
router.get('/lookup/:phone', authenticate, async (req: Request, res: Response) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        error: 'Phone number required'
      });
    }

    // HubSpot integration removed
    res.json({
      contact: null,
      found: false
    });

  } catch (error: any) {
    logger.error('Contact lookup error:', error);
    res.status(500).json({
      error: 'Failed to lookup contact',
      message: error.message
    });
  }
});

/**
 * POST /api/contacts/cache/clear
 * Clear cache (HubSpot integration removed)
 */
router.post('/cache/clear', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    res.json({
      success: true,
      message: 'No cache to clear (HubSpot integration removed)'
    });

  } catch (error: any) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * GET /api/contacts/cache/stats
 * Get cache statistics (HubSpot integration removed)
 */
router.get('/cache/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    res.json({
      size: 0,
      hits: 0,
      misses: 0,
      hubspotConnected: false
    });

  } catch (error: any) {
    logger.error('Cache stats error:', error);
    res.status(500).json({
      error: 'Failed to get cache stats',
      message: error.message
    });
  }
});

export default router;

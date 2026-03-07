import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { MODEL_CATALOG } from '../services/llm/gateway';

const router: Router = Router();

router.use(authMiddleware);

/**
 * GET /api/models — Return available models per provider
 */
router.get('/', (_req, res) => {
    res.json({ models: MODEL_CATALOG });
});

export default router;

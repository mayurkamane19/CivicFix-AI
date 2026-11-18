import { Router } from 'express';
import { getRoot } from '../controllers/rootController.js';

const router = Router();

// GET /
router.get('/', getRoot);

export default router;

import express from 'express';
import { processWebhook } from '../controllers/webhook.controller';

const router = express.Router();

router.post('/webhooks/paystack', express.json(), processWebhook);

export default router;

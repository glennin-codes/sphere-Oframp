import express from 'express';
import { createPayment } from '../controllers/payment.controller';

const router = express.Router();

router.post('/payments', createPayment);

export default router;

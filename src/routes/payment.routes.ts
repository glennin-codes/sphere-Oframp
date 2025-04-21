import express from 'express';
import { createPayment, getTransactionStatus } from '../controllers/payment.controller';

const router = express.Router();

router.post('/payments', createPayment);

router.get('/transactions/:reference/status', (req, res, next) => {
  getTransactionStatus(req, res).catch(next);
});

export default router;

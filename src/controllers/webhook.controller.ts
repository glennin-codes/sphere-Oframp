import { Request, Response } from 'express';
import { handlePaystackWebhook } from '../services/webhook.service';

export async function processWebhook(req: Request, res: Response) {
  try {
    console.log("Webhook received");
    console.log(req.body);
    await handlePaystackWebhook(req.body, req.headers['x-paystack-signature'] as string);
    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook processing failed:', error);
    res.status(400).json({ error: error.message });
  }
}

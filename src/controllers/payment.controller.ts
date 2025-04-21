import { Request, Response } from 'express';
import { initiatePayment } from '../services/payment.service';
import { InitiatePaymentParams } from '../types/payment';

export async function createPayment(req: Request, res: Response) {
  try {
    const {
      email,
      amount,
      currency,
      paymentMethod,
      mobileProvider,
      cryptoAsset,
      cryptoWalletAddress
    } = req.body;

    // Build crypto intent if provided
    const cryptoIntent = cryptoAsset && cryptoWalletAddress 
      ? { asset: cryptoAsset, walletAddress: cryptoWalletAddress }
      : undefined;

    const result = await initiatePayment({
      email,
      amount,
      currency,
      paymentMethod,
      mobileProvider,
      cryptoIntent
    });

    res.json({
      success: true,
      data: {
        paymentUrl: result.authorizationUrl,
        reference: result.reference
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

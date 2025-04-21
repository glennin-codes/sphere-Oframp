import { Request, Response } from 'express';
import { initiatePayment } from '../services/payment.service';
import { InitiatePaymentParams } from '../types/payment';
import { PrismaClient } from '@prisma/client';
import Paystack from 'paystack';

const prisma = new PrismaClient();
const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY!);

export async function createPayment(req: Request, res: Response) {
  try {
    const {
      email,
      amount,
      currency,
      paymentMethod,
      mobileProvider,
      cryptoAsset,
      cryptoWalletAddress,
      callbackUrl
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
      cryptoIntent,

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

export async function getTransactionStatus(req: Request, res: Response) {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ success: false, error: 'Transaction reference is required' });
    }

    // 1. Check database first
    let transaction = await prisma.transaction.findUnique({
      where: { paystackRef: reference },
    });

    let finalStatus = transaction?.status;
    let message = `Transaction status from DB: ${finalStatus || 'not found'}`;
    let paystackStatusData: any = null;

    // 2. If pending or not found locally, verify with Paystack
    if (!transaction || transaction.status === 'pending') {
      try {
        const verification = await paystack.transaction.verify(reference);
        paystackStatusData = verification.data; // Store Paystack data
        const paystackStatus = verification.data?.status; // e.g., success, failed, abandoned

        message = `Verified with Paystack. Status: ${paystackStatus}`;

        // 3. Update local DB if status mismatch and Paystack is definitive (success/failed)
        if (transaction && transaction.status === 'pending' && (paystackStatus === 'success' || paystackStatus === 'failed')) {
          transaction = await prisma.transaction.update({
            where: { id: transaction.id },
            data: {
              status: paystackStatus,
              paystackData: verification.data // Update with latest data from Paystack
            },
          });
          finalStatus = transaction.status;
          message += `. Local status updated to ${finalStatus}.`;
        } else if (!transaction && paystackStatus) {
           // Optional: Create transaction if found on Paystack but not locally?
           // Might be complex depending on required data (email, amount etc not available here)
           // For now, just report the status found on Paystack
           finalStatus = paystackStatus;
        } else {
          // If still pending on Paystack or other status, use Paystack status
          finalStatus = paystackStatus;
        }

      } catch (paystackError: any) {
        console.error(`Paystack verification failed for ${reference}:`, paystackError);
        // If transaction exists locally, return its status. Otherwise, report verification error.
        if (!transaction) {
           return res.status(404).json({ success: false, error: 'Transaction not found locally and Paystack verification failed.', details: paystackError.message });
        }
        message += ". Paystack verification failed: " + paystackError.message;
        // Keep the status from DB if verification fails
      }
    }

    if (!finalStatus) {
       return res.status(404).json({ success: false, error: 'Transaction status could not be determined.' });
    }

    res.json({
      success: true,
      status: finalStatus,
      message: message,
      dbData: transaction, // Include DB data (optional)
      paystackVerificationData: paystackStatusData // Include Paystack verification data (optional)
    });

  } catch (error: any) {
    console.error('Error fetching transaction status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}

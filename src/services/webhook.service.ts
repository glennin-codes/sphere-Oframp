import { verify } from 'hcaptcha';
import { PrismaClient } from '@prisma/client';
import { sendCrypto } from './crypto.service';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

export async function handlePaystackWebhook(event: any, signature: string) {
  console.log("Handling Paystack webhook");
  // Verify webhook signature
  const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(JSON.stringify(event))
    .digest('hex');

  if (hash !== signature) {
  
    throw new Error('Invalid webhook signature');
  }

  // Handle charge success
  if (event.event === 'charge.success') {
    console.log("Charge success");
    const transaction = await prisma.transaction.findUnique({
      where: { paystackRef: event.data.reference }
    });

    if (!transaction || transaction.status !== 'pending') {
      return; // Already processed or invalid
    }

    try {
      // Update transaction status
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: 'success',
          paystackData: event.data
        }
      });

      // Process crypto delivery if intent exists
      if (transaction.cryptoIntent) {
        const { asset, walletAddress } = transaction.cryptoIntent as any;
        const txHash = await sendCrypto(
          walletAddress,
          transaction.amount,
          asset
        );
        
        // Update with crypto tx hash
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            paystackData: {
              ...event.data,
              cryptoTransactionHash: txHash
            }
          }
        });
        console.log("Crypto transaction hash updated");
        console.log(txHash);
      

      }
    } catch (error) {
      console.error("Error processing webhook:", error);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'failed' }
      });
      throw error;
    }
  }
}

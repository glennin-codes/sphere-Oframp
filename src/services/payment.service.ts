import Paystack from 'paystack';
import { PrismaClient, Prisma } from '@prisma/client';
import { InitiatePaymentParams, CountryPaymentConfig } from '../types/payment';

const prisma = new PrismaClient();
const paystack = Paystack(process.env.PAYSTACK_SECRET_KEY!);

const COUNTRY_CONFIGS: Record<string, CountryPaymentConfig> = {
  KE: { // Kenya
    currency: 'KES',
    paymentMethods: ['mobile_money', 'card'],
    mobileProviders: ['mpesa', 'airtel'],
    minAmount: 10,
    maxAmount: 150000
  },
  NG: { // Nigeria
    currency: 'NGN',
    paymentMethods: ['card', 'bank_transfer'],
    minAmount: 100,
    maxAmount: 5000000
  },
  GH: { // Ghana
    currency: 'GHS',
    paymentMethods: ['mobile_money', 'card'],
    mobileProviders: ['mtn', 'vodafone', 'airteltigo'],
    minAmount: 1,
    maxAmount: 5000
  }
};

export async function initiatePayment(params: InitiatePaymentParams) {
  // Validate payment method
  const countryCode = getCountryFromCurrency(params.currency);
  const config = COUNTRY_CONFIGS[countryCode];
  console.log(config);
  
  if (!config.paymentMethods.includes(params.paymentMethod)) {
    throw new Error(`Payment method not available for ${params.currency}`);
  }

  // Validate mobile provider if needed
  if (params.paymentMethod === 'mobile_money' && !params.mobileProvider) {
    throw new Error('Mobile provider required for mobile money payments');
  }

  // Initialize Paystack payment
  const payload: any = {
    email: params.email,
    amount: Math.round(params.amount * 100), // Convert to subunits
    currency: params.currency,
    channels: [params.paymentMethod],
    callback_url:  process.env.DEFAULT_CALLBACK_URL,
    metadata: {
      paymentMethod: params.paymentMethod,
      ...(params.paymentMethod === 'mobile_money' && { 
        mobileProvider: params.mobileProvider 
      })
    }
  };

  // Add mobile money details if applicable
  if (params.paymentMethod === 'mobile_money' && params.mobileProvider) {
    payload.mobile_money = {
      provider: params.mobileProvider
    };
  }

  const response = await paystack.transaction.initialize(payload);

  // Save transaction to database
  const transaction = await prisma.transaction.create({
    data: {
      paystackRef: response.data.reference,
      amount: params.amount,
      currency: params.currency,
      userEmail: params.email,
      paymentMethod: params.paymentMethod,
      mobileProvider: params.mobileProvider || null,
      status: 'pending',
      cryptoIntent: params.cryptoIntent ? params.cryptoIntent as unknown as Prisma.InputJsonValue : Prisma.JsonNull,
      paystackData: response.data
    }
  });

  return {
    authorizationUrl: response.data.authorization_url,
    reference: response.data.reference,
    transactionId: transaction.id
  };
}

function getCountryFromCurrency(currency: string): string {
  for (const [code, config] of Object.entries(COUNTRY_CONFIGS)) {
    if (config.currency === currency) return code;
  }
  throw new Error(`Unsupported currency: ${currency}`);
}

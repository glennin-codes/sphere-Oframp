// src/types/payment.d.ts
export interface CryptoIntent {
  asset: string;
  walletAddress: string;
}

export interface InitiatePaymentParams {
  email: string;
  amount: number;
  currency: string;
  paymentMethod: 'card' | 'mobile_money' | 'bank_transfer';
  mobileProvider?: string; // Required if paymentMethod is mobile_money
  cryptoIntent?: CryptoIntent;
}

export interface CountryPaymentConfig {
  currency: string;
  paymentMethods: ('card' | 'mobile_money' | 'bank_transfer')[];
  mobileProviders?: string[];
  minAmount: number;
  maxAmount: number;
}

/**
 * Mock Payment Adapter for development.
 * Simulates Click/Payme integrations without real API keys.
 */

export interface PaymentRequest {
  userId: string;
  amount: number;
  provider: 'click' | 'payme';
}

export interface PaymentResponse {
  success: boolean;
  paymentUrl: string;
  transactionId: string;
}

export class MockPaymentAdapter {
  /**
   * Simulates generating a payment URL. In a real scenario, this would call
   * Click or Payme API to get an invoice/payment link.
   */
  static async createInvoice({ userId, amount, provider }: PaymentRequest): Promise<PaymentResponse> {
    const transactionId = `mock_txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      transactionId,
      // In development, this URL just points to a local page that auto-submits the webhook
      paymentUrl: `/mock-payment-gateway?txn=${transactionId}&amount=${amount}&provider=${provider}&userId=${userId}`
    };
  }

  /**
   * Simulates handling the webhook callback.
   */
  static async processWebhook(transactionId: string, status: 'PAID' | 'FAILED') {
    // In a real app, this would verify signatures, update the Payment record, 
    // and grant Subscription access in the database.
    
    return {
      success: status === 'PAID',
      message: `Transaction ${transactionId} processed as ${status}`
    };
  }
}

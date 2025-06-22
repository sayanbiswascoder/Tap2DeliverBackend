import { StandardCheckoutClient, Env, RefundRequest, RefundResponse } from 'pg-sdk-node';
import { randomUUID } from 'crypto';

async function initiatePhonePeRefund(order: { merchantOrderId: string; total: number }): Promise<(RefundResponse & { merchantRefundId: string }) | null> {
    try {
        const client = StandardCheckoutClient.getInstance(
            process.env.PHONEPE_CLIENT_ID || "",
            process.env.PHONEPE_CLIENT_SECRET || "",
            Number.parseInt(process.env.PHONEPE_CLIENT_VERSION || "1"),
            Env.SANDBOX
        );

        const refundId = randomUUID();
        const originalMerchantOrderId = order.merchantOrderId;
        const amount = order.total;

        const request = RefundRequest.builder()
            .amount(amount)
            .merchantRefundId(refundId)
            .originalMerchantOrderId(originalMerchantOrderId)
            .build();

        const response: RefundResponse = await client.refund(request);
        return { ...response, merchantRefundId: refundId };
    } catch (error) {
        console.error(error);
        return null;
    }
}

export default initiatePhonePeRefund;

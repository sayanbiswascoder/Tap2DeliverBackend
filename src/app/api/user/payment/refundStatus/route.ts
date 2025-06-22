import { NextRequest, NextResponse } from 'next/server';
import { StandardCheckoutClient, Env } from 'pg-sdk-node';
import { db } from '@/app/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { orderId } = await request.json();

        // Fetch the order document from Firestore and get the merchantRefundId (refundId)
        // Assumes you have access to the Firestore db instance via firebaseAdmin
        // If not imported, you may need to import db from your firebaseAdmin utility at the top level
        // Here, we assume db is available as in other routes

        // Dynamically import db from firebaseAdmin (if not already imported at the top)

        if (!orderId) {
            return NextResponse.json(
                { error: 'orderId is required' },
                { status: 400 }
            );
        }

        const orderRef = db.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = orderSnap.data();
        const refundId = orderData?.merchantRefundId;

        if (!refundId) {
            return NextResponse.json(
                { error: 'merchantRefundId not found' },
                { status: 400 }
            );
        }

        const client = StandardCheckoutClient.getInstance(
            process.env.PHONEPE_CLIENT_ID || "",
            process.env.PHONEPE_CLIENT_SECRET || "",
            Number.parseInt(process.env.PHONEPE_CLIENT_VERSION || "1"),
            Env.SANDBOX
        );

        const resp = await client.getRefundStatus(refundId);

        await orderRef.update({
            paymentState: resp.state == "COMPLETED" ? "REFUNDED" : resp.state == "PENDING" ? "REFUND_INITIATED" : "REFUND_FAILED",
            updatedAt: new Date()
        });

        return NextResponse.json({ refundStatus: resp.state, response: resp });
    } catch (error) {
        console.error("Error fetching refund status:", error);
        return NextResponse.json(
            { error: 'Failed to fetch refund status' },
            { status: 500 }
        );
    }
}

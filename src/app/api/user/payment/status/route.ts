import { NextRequest, NextResponse } from 'next/server';
import { StandardCheckoutClient, Env } from 'pg-sdk-node';
import { db } from "@lib/firebaseAdmin";

export async function POST(request: NextRequest) {
    try {
        const { merchantOrderId } = await request.json();
        const client = StandardCheckoutClient.getInstance(
            process.env.PHONEPE_CLIENT_ID || "",
            process.env.PHONEPE_CLIENT_SECRET || "",
            Number.parseInt(process.env.PHONEPE_CLIENT_VERSION || "1"),
            Env.SANDBOX
        );

        const resp = await client.getOrderStatus(merchantOrderId);
        console.log("resp", resp);

        // Update all orders with this merchantOrderId
        const ordersSnapshot = await db.collection('orders')
            .where('merchantOrderId', '==', merchantOrderId)
            .get();

        const updatePromises = ordersSnapshot.docs.map(doc => 
            doc.ref.update({
                state: resp.state,
                updatedAt: new Date()
            })
        );

        await Promise.all(updatePromises);
        
        return NextResponse.json(resp);
    } catch (error) {
        console.error("Error: ", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unknown error occurred' },
            { status: 400 }
        );
    }
}
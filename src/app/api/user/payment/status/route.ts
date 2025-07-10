import { NextRequest, NextResponse } from 'next/server';
import { StandardCheckoutClient, Env } from 'pg-sdk-node';
import admin, { db } from "@lib/firebaseAdmin";
import { messaging } from "firebase-admin"

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

        // Update all orders with this merchantOrderId regardless of the payment status.
        // It's crucial to persist the actual payment state in the database.
        const ordersSnapshot = await db.collection('orders')
            .where('merchantOrderId', '==', merchantOrderId)
            .get();

        const updatePromises = ordersSnapshot.docs.map(doc => 
            doc.ref.update({
                paymentState: resp.state,
                status: resp.state === "COMPLETED" ? 'PLACED' : resp.state === "FAILED" ? "CANCELED" : "PENDING",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
        );

        await Promise.all(updatePromises);

        // Only send notifications and return "SUCCESS" if the payment status is COMPLETED.
        if (resp.state === 'COMPLETED') {
            try {
                // Get unique restaurant IDs from orders
                const restaurantIds = [...new Set(ordersSnapshot.docs.map(doc => doc.data().restaurantId).filter(Boolean))];
                
                // Get FCM tokens for each restaurant
                const fcmTokens: string[] = [];
                for (const restaurantId of restaurantIds) {
                    const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
                    const restaurantData = restaurantDoc.data();
                    if (restaurantData?.fcmToken) {
                        fcmTokens.push(restaurantData.fcmToken);
                    }
                }

                if (fcmTokens.length > 0) {
                    const message: messaging.MulticastMessage = {
                        tokens: fcmTokens,
                        notification: {
                            title: "New Order Received",
                            body: `You have received a new order.`,
                        },
                        "android": {
                            "notification": {
                                "channelId": "order",     // must match your Expo-defined channel
                                "sound": "custom_sound.wav" // the sound file without path
                            }
                        },
                        data: {
                            merchantOrderId,
                            paymentState: resp.state,
                            type: 'NEW_ORDER',
                            timestamp: new Date().toISOString()
                        },
                    };

                    const response = await admin.messaging().sendEachForMulticast(message);
                    if (response.failureCount > 0) {
                        console.error('Failed to send some messages:', response.responses);
                    }
                }

                // Return success status as payment is completed
                return NextResponse.json({ state: "SUCCESS" });
            } catch (error) {
                console.error('Error sending notifications:', error);
                // Even if notification fails, if payment is completed, we still consider the payment successful.
                return NextResponse.json({ state: "SUCCESS" }); 
            }
        } else {
            // If payment is not COMPLETED, return the actual state received from the payment gateway.
            // Do not send notifications or return "SUCCESS".
            return NextResponse.json({ state: resp.state });
        }
        
    } catch (error) {
        console.error("Error: ", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unknown error occurred' },
            { status: 400 }
        );
    }
}
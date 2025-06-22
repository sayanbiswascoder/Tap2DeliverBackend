import { NextRequest, NextResponse } from 'next/server';
import { db } from '@lib/firebaseAdmin';
import admin from '@lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { orderId, riderId } = await request.json();

        if (!orderId || !riderId) {
            return NextResponse.json(
                { 
                    error: 'Order ID and Rider ID are required',
                    state: 'FAILED'
                },
                { status: 400 }
            );
        }

        // Get order reference
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return NextResponse.json(
                { 
                    error: 'Order not found',
                    state: 'FAILED'
                },
                { status: 404 }
            );
        }

        const orderData = orderDoc.data();

        // Verify rider is assigned to this order
        if (orderData?.assignedRiderId !== riderId) {
            return NextResponse.json(
                { 
                    error: 'Rider not assigned to this order',
                    state: 'FAILED'
                },
                { status: 403 }
            );
        }

        // Update order status to PICKED_UP
        await orderRef.update({
            status: 'PICKED',
            pickedUpAt: new Date(),
            updatedAt: new Date()
        });

        // Get user's FCM token
        const userDoc = await db.collection('users').doc(orderData?.userId).get();
        const userData = userDoc.data();

        // Send notification to user if FCM token exists
        if (userData?.fcmToken) {
            const message: admin.messaging.Message = {
                token: userData.fcmToken,
                notification: {
                    title: 'Order Picked Up',
                    body: 'Your order has been picked up and is on its way to you.',
                },
                data: {
                    orderId,
                    status: 'PICKED_UP',
                    type: 'ORDER_STATUS_UPDATE',
                    timestamp: new Date().toISOString()
                },
            };

            try {
                await admin.messaging().send(message);
            } catch (error) {
                console.error('Error sending notification:', error);
            }
        }

        return NextResponse.json({ status: 'SUCCESS' });

    } catch (error) {
        console.error('Error marking order as picked up:', error);
        return NextResponse.json(
            { 
                error: 'Internal server error',
                state: 'FAILED'
            },
            { status: 500 }
        );
    }
}

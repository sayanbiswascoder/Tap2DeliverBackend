import { NextRequest, NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    try {
        const { orderId, restaurantId } = await request.json();

        // Validate request body
        if (!orderId || !restaurantId) {
            return NextResponse.json(
                { error: 'Order ID and Restaurant ID are required' },
                { status: 400 }
            );
        }

        // Get the order document
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = orderDoc.data();

        // Verify the restaurant ID matches
        if (orderData?.restaurantId !== restaurantId) {
            return NextResponse.json(
                { error: 'Unauthorized to accept this order' },
                { status: 403 }
            );
        }

        // Check if order is already accepted
        if (orderData?.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Order is not in pending state' },
                { status: 400 }
            );
        }

        // Update order status
        await orderRef.update({
            status: 'ACCEPTED',
            updatedAt: new Date()
        });

        // Get user's FCM token
        const userDoc = await db.collection('users').doc(orderData.userId).get();
        const userData = userDoc.data();

        // Send notification to user if FCM token exists
        if (userData?.fcmToken) {
            const message: admin.messaging.Message = {
                token: userData.fcmToken,
                notification: {
                    title: 'Order Accepted',
                    body: 'Your order has been accepted by the restaurant.',
                },
                data: {
                    orderId,
                    status: 'ACCEPTED',
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

        return NextResponse.json({ state: 'SUCCESS' });

    } catch (error) {
        console.error('Error accepting order:', error);
        return NextResponse.json(
            { 
                error: 'Internal server error',
                state: 'FAILED'
            },
            { status: 500 }
        );
    }
}

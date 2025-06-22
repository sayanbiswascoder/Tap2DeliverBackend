import { NextRequest, NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';
import initiatePhonePeRefund from '@/app/lib/initiatePhonePeRefund';
import { RefundResponse } from 'pg-sdk-node';

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
                { error: 'Unauthorized to reject this order' },
                { status: 403 }
            );
        }

        // Check if order is already rejected or in a final state
        if (orderData?.status !== 'PLACED') {
            return NextResponse.json(
                { error: 'Order is not in pending state' },
                { status: 400 }
            );
        }

        // If payment mode was ONLINE, initiate PhonePe refund
        let refundResult: (RefundResponse & { merchantRefundId: string }) | null = null;
        if (orderData?.paymentMode === 'ONLINE') {
            try {
                refundResult = await initiatePhonePeRefund(orderData as any);
            } catch (refundError) {
                console.error('Error initiating PhonePe refund:', refundError);
                return NextResponse.json(
                    { error: 'Failed to initiate refund. Please try again later.' },
                    { status: 500 }
                );
            }
        }

        // Update order status and refund info if applicable
        await orderRef.update({
            status: 'CANCELLED',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: new Date(),
            ...(refundResult
                ? {
                    paymentState: refundResult.state === "PENDING" ? 'REFUND_INITIATED' : 'FAILED',
                    refundId: refundResult.refundId,
                    merchantRefundId: refundResult.merchantRefundId
                }
                : {})
        });

        // Get user's FCM token
        const userDoc = await db.collection('users').doc(orderData.userId).get();
        const userData = userDoc.data();

        // Send notification to user if FCM token exists
        if (userData?.fcmToken) {
            const message: admin.messaging.Message = {
                token: userData.fcmToken,
                notification: {
                    title: 'Order Rejected',
                    body: 'Your order has been rejected by the restaurant.',
                },
                data: {
                    orderId,
                    status: 'REJECTED',
                    type: 'ORDER_STATUS_UPDATE',
                    timestamp: new Date().toISOString()
                },
                android: {
                    notification: {
                        channelId: "default",
                        sound: "notification_sound",
                        icon: "notification_icon",
                        priority: "high",
                        color: "#FFB627"
                    }
                }
            };

            try {
                await admin.messaging().send(message);
            } catch (error) {
                console.error('Error sending notification:', error);
            }
        }

        return NextResponse.json({
            state: 'SUCCESS',
            ...(refundResult ? { refund: refundResult } : {})
        });

    } catch (error) {
        console.error('Error rejecting order:', error);
        return NextResponse.json(
            { 
                error: 'Internal server error',
                state: 'FAILED'
            },
            { status: 500 }
        );
    }
}

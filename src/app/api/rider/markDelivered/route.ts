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

        // Update order status to DELIVERED
        await orderRef.update({
            status: 'DELIVERED',
            deliveredAt: new Date(),
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
                    title: 'Order Delivered',
                    body: 'Your order has been delivered successfully!',
                },
                data: {
                    orderId,
                    status: 'DELIVERED',
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

        // Update restaurant's earnings
        const restaurantPaymentRef = db.collection('earnings').doc(orderData?.restaurantId);
        const restaurantPaymentDoc = await restaurantPaymentRef.get();
        const restaurantPaymentData = restaurantPaymentDoc.data();
        
        // Calculate restaurant earnings (total order amount minus delivery fee)
        const restaurantEarnings = orderData?.itemTotal || 0;
        const currentRestaurantEarnings = restaurantPaymentData?.earnings || 0;
        const newRestaurantEarnings = currentRestaurantEarnings + restaurantEarnings;
        
        await restaurantPaymentRef.update({
            earnings: newRestaurantEarnings,
            updatedAt: new Date()
        });

        // Remove order from rider's assigned orders and update earnings
        const riderRef = db.collection('riders').doc(riderId);

        // Update rider's assigned orders and updatedAt
        await riderRef.update({
            assignedOrders: admin.firestore.FieldValue.arrayRemove(orderId),
            updatedAt: new Date()
        });

        // Update rider's payment document with new earnings
        const riderPaymentRef = db.collection('earnings').doc(riderId);
        const riderPaymentDoc = await riderPaymentRef.get();
        const riderPaymentData = riderPaymentDoc.data();
        const currentRiderPaymentEarnings = riderPaymentData?.earnings || 0;
        const deliveryFee = orderData?.delivery;
        const newRiderPaymentEarnings = currentRiderPaymentEarnings + deliveryFee;

        await riderPaymentRef.update({
            earnings: newRiderPaymentEarnings,
            updatedAt: new Date()
        });

        return NextResponse.json({ status: 'SUCCESS' });

    } catch (error) {
        console.error('Error marking order as delivered:', error);
        return NextResponse.json(
            { 
                error: 'Internal server error',
                state: 'FAILED'
            },
            { status: 500 }
        );
    }
}

import { NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const { riderId, orderId } = await request.json();

        // Validate request body
        if (!riderId || !orderId) {
            return NextResponse.json(
                { error: 'Rider ID and Order ID are required' },
                { status: 400 }
            );
        }

        // Get order reference
        const orderRef = db.collection('orders').doc(orderId);
        const orderDoc = await orderRef.get();

        if (!orderDoc.exists) {
            return NextResponse.json(
                { error: 'Order not found' },
                { status: 404 }
            );
        }

        const orderData = orderDoc.data();

        // Check if order is in ACCEPTED state
        if (orderData?.status !== 'ACCEPTED') {
            return NextResponse.json(
                { error: 'Order is not in accepted state' },
                { status: 400 }
            );
        }

        // Check if rider is available
        const riderRef = db.collection('riders').doc(riderId);
        const riderDoc = await riderRef.get();

        if (!riderDoc.exists) {
            return NextResponse.json(
                { error: 'Rider not found' },
                { status: 404 }
            );
        }

        const riderData = riderDoc.data();

        if (!riderData?.isAvailable) {
            return NextResponse.json(
                { error: 'Rider is not available' },
                { status: 400 }
            );
        }

        // Check if order is in rider's available orders
        if (!riderData.availableOrders || !riderData.availableOrders.includes(orderId)) {
            return NextResponse.json(
                { error: 'Order is not available for this rider' },
                { status: 400 }
            );
        }

        // Update order status to ASSIGNED
        await orderRef.update({
            status: 'ASSIGNED',
            assignedRiderId: riderId,
            updatedAt: new Date()
        });

        // Update rider's available orders and set as unavailable
        await riderRef.update({
            availableOrders: admin.firestore.FieldValue.arrayRemove(orderId),
            currentOrderId: admin.firestore.FieldValue.arrayUnion(orderId)
        });

        // Get user's FCM token
        const userDoc = await db.collection('users').doc(orderData.userId).get();
        const userData = userDoc.data();

        // Send notification to user if FCM token exists
        if (userData?.fcmToken) {
            const message: admin.messaging.Message = {
                token: userData.fcmToken,
                notification: {
                    title: 'Rider Assigned',
                    body: 'A rider has been assigned to your order and is on the way.',
                },
                data: {
                    orderId,
                    status: 'ASSIGNED',
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

        // Send notification to restaurant if FCM token exists
        if (orderData.restaurantId) {
            const restaurantDoc = await db.collection('restaurants').doc(orderData.restaurantId).get();
            const restaurantData = restaurantDoc.data();

            if (restaurantData?.fcmToken) {
                const restaurantMessage: admin.messaging.Message = {
                    token: restaurantData.fcmToken,
                    notification: {
                        title: 'Rider Assigned',
                        body: 'A rider has been assigned to pick up the order.',
                    },
                    data: {
                        orderId,
                        status: 'ASSIGNED',
                        type: 'RIDER_ASSIGNED',
                        timestamp: new Date().toISOString()
                    },
                };

                try {
                    await admin.messaging().send(restaurantMessage);
                } catch (error) {
                    console.error('Error sending notification to restaurant:', error);
                }
            }
        }

        // Remove order from other riders' available orders
        const allRidersRef = db.collection('riders');
        const ridersSnapshot = await allRidersRef.get();

        const removeOrderPromises = ridersSnapshot.docs.map(async (doc) => {
            if (doc.id !== riderId) {
                const riderRef = db.collection('riders').doc(doc.id);
                await riderRef.update({
                    availableOrders: admin.firestore.FieldValue.arrayRemove(orderId)
                });
            }
        });

        await Promise.all(removeOrderPromises);

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

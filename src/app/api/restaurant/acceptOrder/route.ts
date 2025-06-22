import { NextRequest, NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';
import { getRiderByPINCode } from '@/app/lib/getRiderByPINCode';

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
        if (orderData?.status !== 'PLACED') {
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

        // Get restaurant and user PIN codes
        const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
        const restaurantData = restaurantDoc.data();
        const userPINCode = userData?.addresses[0]?.pinCode;
        const restaurantPINCode = restaurantData?.address?.pinCode;

        console.log(userPINCode, restaurantPINCode)

        if (userPINCode && restaurantPINCode) {
            // Get available riders for the route
            const availableRiders = await getRiderByPINCode(restaurantPINCode, userPINCode);

            if (availableRiders && availableRiders.length > 0) {
                // Update assigned orders array for all available riders
                const updatePromises = availableRiders.map(async (riderDoc) => {
                    const riderRef = db.collection('riders').doc(riderDoc.id);
                    await riderRef.update({
                        availableOrders: admin.firestore.FieldValue.arrayUnion(orderId)
                    });

                    // Send notification to rider if FCM token exists
                    const riderData = riderDoc.data();
                    if (riderData?.fcmToken) {
                        const riderMessage: admin.messaging.Message = {
                            token: riderData.fcmToken,
                            notification: {
                                title: 'New Order Available',
                                body: 'A new order is available for pickup and delivery.',
                            },
                            data: {
                                orderId,
                                status: 'ACCEPTED',
                                type: 'NEW_ORDER_AVAILABLE',
                                timestamp: new Date().toISOString()
                            },
                        };

                        try {
                            await admin.messaging().send(riderMessage);
                        } catch (error) {
                            console.error('Error sending notification to rider:', error);
                        }
                    }
                });

                await Promise.all(updatePromises);
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

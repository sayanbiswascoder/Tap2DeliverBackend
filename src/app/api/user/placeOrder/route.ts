import getPriceNAvailabilityOfDish from '@/app/lib/getPriceNAvailabilityOfDish';
import { NextResponse } from 'next/server';
import admin, { db } from '@/app/lib/firebaseAdmin';
import { DocumentReference } from 'firebase-admin/firestore';
import type { NextRequest } from 'next/server';

interface OrderItem {
    id: string;
    qty: number;
}

interface OrderItems {
    restaurantId?: string;
    items: OrderItem[];
    delivery: number;
    gst: number;
    total: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orderItems, address } = await request.json() as { userId: string, orderItems: OrderItems[], address: object };
    
    // Validate request body
    if (!userId || !orderItems) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    const orderRefs: DocumentReference[] = [];
    const restaurantIds = new Set<string>();

    // First pass: Validate all items and collect restaurant IDs
    for (const orderItem of orderItems) {
        for (const item of orderItem.items) {
            const dishInfo = await getPriceNAvailabilityOfDish(item.id);
            if (!dishInfo.isAvailable) {
                return NextResponse.json(
                    { 
                        error: "Some dishes are not available", 
                        unavailableItem: item.id 
                    },
                    { status: 400 }
                );
            }
        }
        if (orderItem.restaurantId) {
            restaurantIds.add(orderItem.restaurantId);
        }
        const orderCollection = db.collection("orders");
        const orderRef = orderCollection.doc();
        orderRefs.push(orderRef);
    }

    try {
        // Second pass: Create orders
        for (let orderRefIndex = 0; orderRefIndex < orderItems.length; orderRefIndex++) {
            let itemTotal = 0;
            for (const item of orderItems[orderRefIndex].items) {
                const dishInfo = await getPriceNAvailabilityOfDish(item.id);
                itemTotal += dishInfo.price * item.qty;
            }
            
            const orderData = {
                userId: userId,
                restaurantId: orderItems[orderRefIndex].restaurantId || null,
                items: orderItems[orderRefIndex].items,
                itemTotal,
                status: "PLACED",
                paymentMode: "COD",
                paymentState: "PLACED",
                delivery: orderItems[orderRefIndex].delivery,
                gst: orderItems[orderRefIndex].gst,
                total: orderItems[orderRefIndex].total,
                address,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await orderRefs[orderRefIndex].set(orderData);
        }

        // Send notifications to restaurants
        try {
            const fcmTokens: string[] = [];
            for (const restaurantId of restaurantIds) {
                const restaurantDoc = await db.collection('restaurants').doc(restaurantId).get();
                const restaurantData = restaurantDoc.data();
                if (restaurantData?.fcmToken) {
                    fcmTokens.push(restaurantData.fcmToken);
                }
            }

            if (fcmTokens.length > 0) {
                const message: admin.messaging.MulticastMessage = {
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
                        type: 'NEW_ORDER',
                        timestamp: new Date().toISOString()
                    },
                };

                const response = await admin.messaging().sendEachForMulticast(message);
                if (response.failureCount > 0) {
                    console.error('Failed to send some messages:', response.responses);
                }
            }

            return NextResponse.json({ state: "SUCCESS" });
        } catch (error) {
            console.error('Error sending notifications:', error);
            return NextResponse.json({ state: "SUCCESS" });
        }
    } catch (error) {
        console.error('Error creating orders:', error);
        return NextResponse.json(
            { 
                error: "Failed to create orders", 
                state: "FAILED"
            },
            { status: 500 }
        );
    }
  } catch (error) {
    console.error('Error processing order:', error);
    return NextResponse.json(
        { 
            error: "Internal server error!", 
            state: "FAILED"
        },
        { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { db } from "@lib/firebaseAdmin"
import getAccessToken from '@lib/getAccessToken';
import getPriceNAvailabilityOfDish from '@lib/getPriceNAvailabilityOfDish';
import { DocumentReference } from 'firebase-admin/firestore';

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
        const { userId, orderItems } = await request.json() as { userId: string, orderItems: OrderItems[] };
        let total = 0;
        const access_token = await getAccessToken();
        console.log(access_token)
        const merchantOrderId = randomUUID();
        
        const orderRefs: DocumentReference[] = [];
        for (let i = 0; i < orderItems.length; i++) {
            let price = 0;
            for (const item of orderItems[i].items) {
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
                price += dishInfo.price * item.qty;
            }
            total += price + orderItems[i].delivery + orderItems[i].gst + 10;
            const orderCollection = db.collection("orders");
            const orderRef = orderCollection.doc();
            orderRefs.push(orderRef);
        }
        total = Math.round(total);

        try {
            const ppRes = await axios.post("https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/sdk/order", JSON.stringify({
                'merchantOrderId': merchantOrderId,
                'amount': (total * 100).toString(),
                'paymentFlow': {
                  'type': 'PG_CHECKOUT'
                }
              }), {
                headers:{
                'Content-Type': 'application/json',
                'Authorization': `O-Bearer ${access_token}`
              }});

              console.log(ppRes)

            for (let orderRefIndex = 0; orderRefIndex < orderItems.length; orderRefIndex++) {
                const orderData = {
                    userId: userId,
                    restaurantId: orderItems[orderRefIndex].restaurantId || null,
                    merchantOrderId,
                    items: orderItems[orderRefIndex].items,
                    transactionId: ppRes.data.orderId,
                    state: ppRes.data.state,
                    expireAt: new Date(ppRes.data.expireAt),
                    delivery: orderItems[orderRefIndex].delivery,
                    gst: orderItems[orderRefIndex].gst,
                    total: orderItems[orderRefIndex].total,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await orderRefs[orderRefIndex].set(orderData);
            }
            
            return NextResponse.json({ 
                orderId: ppRes.data.orderId, 
                token: ppRes.data.token, 
                merchantOrderId 
            });
        } catch (axiosError) {
            console.error("PhonePe API Error:", axiosError);
            if (axios.isAxiosError(axiosError)) {
                return NextResponse.json(
                    { 
                        error: "Payment gateway error", 
                        details: axiosError.response?.data || axiosError.message 
                    },
                    { status: axiosError.response?.status || 500 }
                );
            }
            throw axiosError;
        }

    } catch (error: unknown) {
        console.error("Error:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
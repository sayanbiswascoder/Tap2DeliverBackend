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
        const { userId, orderItems, address } = await request.json() as { userId: string, orderItems: OrderItems[], address: object };
        let total = 0;
        const access_token = await getAccessToken();
        const merchantOrderId = randomUUID();
        
        const orderRefs: DocumentReference[] = [];
        for (let i = 0; i < orderItems.length; i++) {
            let itemTotal = 0;
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
                itemTotal += dishInfo.price * item.qty;
            }
            total += itemTotal + orderItems[i].delivery + orderItems[i].gst + 10;
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

            for (let orderRefIndex = 0; orderRefIndex < orderItems.length; orderRefIndex++) {
                let itemTotal = 0;
                for (const item of orderItems[orderRefIndex].items) {
                    const dishInfo = await getPriceNAvailabilityOfDish(item.id);
                    itemTotal += dishInfo.price * item.qty;
                }
                
                const orderData = {
                    userId: userId,
                    restaurantId: orderItems[orderRefIndex].restaurantId || null,
                    merchantOrderId,
                    items: orderItems[orderRefIndex].items,
                    itemTotal,
                    status: "PLACED",
                    transactionId: ppRes.data.orderId,
                    paymentMode: "ONLINE",
                    paymentState: ppRes.data.state,
                    expireAt: new Date(ppRes.data.expireAt),
                    delivery: orderItems[orderRefIndex].delivery,
                    gst: orderItems[orderRefIndex].gst,
                    total: orderItems[orderRefIndex].total,
                    address,
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
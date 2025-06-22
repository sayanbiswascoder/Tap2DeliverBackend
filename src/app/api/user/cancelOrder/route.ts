import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import admin, { db } from '../../../lib/firebaseAdmin';
import initiatePhonePeRefund from '@/app/lib/initiatePhonePeRefund';
import { RefundResponse } from 'pg-sdk-node';

export async function POST(request: NextRequest) {
  try {
    // Get userId from request body
    const body = await request.json();
    const { orderId, userId } = body;

    if (!orderId || !userId) {
      return NextResponse.json({ error: 'orderId and userId is required' }, { status: 400 });
    }

    // Fetch the order
    const orderRef = db.collection('orders').doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderSnap.data();

    // Check if the user is the owner of the order
    if (order?.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow cancel if status is 'pending' or 'accepted'
    if (order?.status !== 'PLACED' && order?.status !== 'ACCEPTED') {
      return NextResponse.json({ error: 'Order cannot be cancelled at this stage' }, { status: 400 });
    }

    // If payment mode was ONLINE, initiate PhonePe refund
    let refundResult: (RefundResponse & { merchantRefundId: string }) | null = null;
    if (order?.paymentMode === 'ONLINE') {
      try {
        refundResult = await initiatePhonePeRefund(order as { merchantOrderId: string, total: number });
      } catch (refundError) {
        console.error('Error initiating PhonePe refund:', refundError);
        return NextResponse.json({ error: 'Failed to initiate refund. Please try again later.' }, { status: 500 });
      }
    }

    console.log(refundResult)

    // Update the order status to 'cancelled'
    await orderRef.update({
      status: 'CANCELLED',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(refundResult ? { paymentState: refundResult.state === "PENDING" ? 'REFUND_INITIATED' : 'FAILED', refundId: refundResult.refundId, merchantRefundId: refundResult.merchantRefundId } : {})
    });

    // If order was in 'accepted' status, notify the restaurant
    if (order?.status === 'ACCEPTED') {
      // Assume restaurant has a notificationToken field
      const restaurantRef = db.collection('restaurants').doc(order.restaurantId);
      const restaurantSnap = await restaurantRef.get();
      if (restaurantSnap.exists) {
        const restaurant = restaurantSnap.data();
        if (restaurant?.fcmToken) {
          const message: admin.messaging.Message = {
            token: restaurant.fcmToken,
            notification: {
              title: 'Order Cancelled',
              body: `Order #${orderId} has been cancelled by the user.`,
            },
            data: {
              type: 'ORDER_CANCELLED',
              orderId: orderId,
              timestamp: new Date().toISOString(),
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
          } catch (err) {
            // Log but don't fail the request
            console.error('Failed to send notification to restaurant:', err);
          }
        }
      }
    }

    return NextResponse.json(
      { 
        message: 'Order cancelled successfully', 
        ...(refundResult ? { refund: refundResult } : {}) 
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

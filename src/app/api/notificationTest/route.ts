import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import admin from '../../lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    console.log("POST")
  try {
    const body = await request.json();
    
    // Validate request body
    if (!body) {
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Process the request
    // const { tokens, title, body, data } = body;
// 
    // if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    //   return NextResponse.json(
    //     { error: 'Valid tokens array is required' },
    //     { status: 400 }
    //   );
    // }
// 
    // if (!title || !body) {
    //   return NextResponse.json(
    //     { error: 'Title and body are required' },
    //     { status: 400 }
    //   );
    // }

    const message: admin.messaging.MulticastMessage = {
      tokens: ["fx1OGEMURASjQTdjfShqIy:APA91bFMtprshCv5A5uX_REhd01C4XmMPrJOvzAV2lLVrQTg9MleonhpWYToRu2009TystyD9LC5hy_DlLs_9px9xQhV9fX85b5XgR__cNjIe143b6aAdX4"],
      notification: {
          title: "New Order Received",
          body: `You have received a new order.`,
      },
      android: {
          notification: {
              channelId: "default",     // must match your Expo-defined channel
              sound: "notification_sound", // the sound file without path
              icon: "notification_icon", // use the app's icon
              priority: "high",
              color: "#FFB627"
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

    return NextResponse.json(
      { message: 'Success', data: body },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import admin from '../../lib/firebaseAdmin';
import { messaging } from 'firebase-admin';

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

    const message: messaging.MulticastMessage = {
      tokens: ["f6hunzPxRC2BOe6Jd1-D4t:APA91bERS35989X6qi6nDvKNzFKRYDS3N_3g7o46inY7ia9VitLly-fPGzkgh6o9j0yQ2nbt1YU8MoyPJv0YNglC_Wi8XnP5nUbb0FSlPon7FiN311nzZ8Q"],
      notification: {
        title: "title",
        body: JSON.stringify({
            message: "Test Message"
        }),
      },
      data: {},
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

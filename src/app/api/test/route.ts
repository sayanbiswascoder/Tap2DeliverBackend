import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import admin from '../../lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const registrationToken = searchParams.get('registrationToken');
  if (!registrationToken) {
    return NextResponse.json({ success: false, error: 'Missing registrationToken in URL params' }, { status: 400 });
  }

  const message: admin.messaging.MulticastMessage = {
    tokens: [registrationToken],
    notification: {
      title: 'Test Notification',
      body: 'This is a test FCM notification from the API route.',
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return NextResponse.json({ success: true, messageId: response });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

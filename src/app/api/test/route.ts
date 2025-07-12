/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import admin from '../../lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  const registrationToken = 'cXJmQZVLQl2XvvGvQvRHRh:APA91bGlFhtFUmlvVhg2sU1DcL5_nGFWH4R3aufha_KCjVBmsQtwcZ79g8DUkCzwS8xlKU7QYMbzuzEfDhd7ZwK_Xjsv5l99ChQfCS2qQvVw61yf-sPYRgo';

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

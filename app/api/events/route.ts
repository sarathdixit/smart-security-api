import { NextResponse } from 'next/server';
import { db, messaging } from '@/lib/firebaseAdmin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.API_SECRET_KEY && authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid or empty JSON payload' }, { status: 400 });
    }

    const { deviceId, event, alarmType, message } = body;
    const eventName = event || alarmType;

    // Validate deviceId and enforce GATE_TOUCH event
    if (!deviceId || eventName !== 'GATE_TOUCH') {
      return NextResponse.json(
        { error: 'Invalid payload: deviceId and event="GATE_TOUCH" are mandatory' },
        { status: 400 }
      );
    }

    const deviceRef = db.collection('devices').doc(deviceId);
    const doc = await deviceRef.get();
    const deviceData = doc.data();

    // System armed status (defaults to true if not explicitly set to false)
    const isArmed = deviceData?.isArmed ?? true;

    const eventMessage =
      message || `Movement detected on ${deviceData?.name || 'Main Gate'}`;

    // 1. Log event to Firestore audit history
    const logRef = await deviceRef.collection('logs').add({
      deviceId,
      alarmType: 'GATE_TOUCH',
      event: 'GATE_TOUCH',
      message: eventMessage,
      timestamp: new Date(),
      isArmedAtTrigger: isArmed,
      acknowledged: false,
      acknowledgedByUid: null,
      acknowledgedByName: null,
      acknowledgedAt: null,
    });

    let notificationSent = false;

    // 2. Trigger alarm & dispatch Full-Screen Emergency FCM Push Notification ONLY IF ARMED
    if (isArmed) {
      // Data-Only FCM Payload (omits notification key to give client 100% control and prevent Android OS duplicate system notifications)
      const androidPayload = {
        priority: 'high' as const,
        ttl: 0,
      };


      const dataPayload = {
        type: 'GATE_TOUCH',
        deviceId: String(deviceId),
        logId: logRef.id,
        title: '🚨 Intrusion / Movement Detected!',
        message: eventMessage,
        fullScreen: 'true',
        timestamp: String(Math.floor(Date.now() / 1000)),
      };

      try {
        await messaging.send({
          topic: `device_${deviceId}`,
          android: androidPayload,
          data: dataPayload,
        });
        notificationSent = true;
      } catch (fcmErr) {
        console.error('FCM Dispatch Error in Events API:', fcmErr);
      }
    } else {
      console.log(`Gate touched on device '${deviceId}', but security system is DISARMED. Alarm & FCM not triggered.`);
    }

    return NextResponse.json({
      success: true,
      logId: logRef.id,
      isArmed,
      notificationSent,
      message: isArmed
        ? 'GATE_TOUCH alarm triggered and FCM broadcast dispatched.'
        : 'System is disarmed. Event logged without triggering alarm.',
    });
  } catch (error: any) {
    console.error('Event API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

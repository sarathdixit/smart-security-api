import { NextResponse } from "next/server";
import { db, messaging } from "@/lib/firebaseAdmin";

// GET /api/alarm/arm - Retrieve current Armed/Disarmed status of security system
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId") || "TEMPLE001";

    const deviceRef = db.collection("devices").doc(deviceId);
    const doc = await deviceRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        {
          success: true,
          deviceId,
          isArmed: true, // Default to Armed if device document is not created yet
        },
        { status: 200 }
      );
    }

    const data = doc.data();
    const isArmed = data?.isArmed ?? true;

    return NextResponse.json(
      {
        success: true,
        deviceId,
        isArmed,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Get Arm Status Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// POST /api/alarm/arm - Toggle or set Armed/Disarmed status of security system and log audit record
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { deviceId = "TEMPLE001", userUid, userName, userEmail } = body;

    const deviceRef = db.collection("devices").doc(deviceId);
    const doc = await deviceRef.get();
    const currentData = doc.data();

    // Determine target armed state: explicit boolean if provided, otherwise toggle current status
    let targetArmedState: boolean;

    if (typeof body.isArmed === "boolean") {
      targetArmedState = body.isArmed;
    } else if (typeof body.armed === "boolean") {
      targetArmedState = body.armed;
    } else {
      const currentArmedState = currentData?.isArmed ?? true;
      targetArmedState = !currentArmedState;
    }

    const now = new Date();
    const userIdentifier = userName || userEmail || "Authorized User";

    // 1. Update device status document in Firestore
    await deviceRef.set(
      {
        isArmed: targetArmedState,
        updatedAt: now,
        updatedByUid: userUid || null,
        updatedByName: userIdentifier,
      },
      { merge: true }
    );

    const alarmType = targetArmedState ? "SYSTEM_ARMED" : "SYSTEM_DISARMED";
    const logMessage = targetArmedState
      ? `Security system armed by ${userIdentifier}`
      : `Security system disarmed by ${userIdentifier}`;

    // 2. Add an audit log entry in devices/{deviceId}/logs so it appears in GET /api/alarm/logs
    const logRef = await deviceRef.collection("logs").add({
      deviceId,
      alarmType,
      event: alarmType,
      message: logMessage,
      timestamp: now,
      isArmedAtTrigger: targetArmedState,
      acknowledged: true,
      acknowledgedByUid: userUid || null,
      acknowledgedByName: userIdentifier,
      acknowledgedAt: now.toISOString(),
    });

    // 3. Dispatch Informational FCM Notification (fullScreen="false")
    const androidPayload = {
      priority: 'high' as const,
      ttl: 0,
    };

    const dataPayload = {
      type: alarmType,
      deviceId: String(deviceId),
      logId: logRef.id,
      title: targetArmedState ? "🟢 Security System Armed" : "🔴 Security System Disarmed",
      message: logMessage,
      fullScreen: "false",
      timestamp: String(Math.floor(now.getTime() / 1000)),
    };

    try {
      await messaging.send({
        topic: "temple_owners",
        android: androidPayload,
        data: dataPayload,
      });
    } catch (fcmErr) {
      console.error("FCM Dispatch Error in Arm Status API:", fcmErr);
    }

    return NextResponse.json(
      {
        success: true,
        message: logMessage,
        deviceId,
        isArmed: targetArmedState,
        logId: logRef.id,
        userUid: userUid || null,
        userName: userIdentifier,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update Arm Status Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}


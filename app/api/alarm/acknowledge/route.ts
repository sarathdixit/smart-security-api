import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "Invalid or empty JSON body." },
        { status: 400 }
      );
    }

    const { deviceId, logId, userUid, userName, userEmail } = body;

    // 1. Validate mandatory fields
    if (!deviceId || !logId) {
      return NextResponse.json(
        { error: "Missing mandatory fields (deviceId or logId)." },
        { status: 400 }
      );
    }

    const logRef = db
      .collection("devices")
      .doc(deviceId)
      .collection("logs")
      .doc(logId);

    // 2. Verify document exists in Firestore
    const docSnap = await logRef.get();
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `logId '${logId}' does not exist in Firestore for deviceId '${deviceId}'.` },
        { status: 404 }
      );
    }

    const acknowledgedByName = userName || userEmail || null;
    const acknowledgedByUid = userUid || null;
    const acknowledgedAt = new Date().toISOString();

    // 3. Mark as acknowledged in Firestore
    await logRef.update({
      acknowledged: true,
      acknowledgedByUid: acknowledgedByUid,
      acknowledgedByName: acknowledgedByName,
      acknowledgedAt: acknowledgedAt,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Alarm acknowledged successfully.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Acknowledge Alarm Error:", error);
    return NextResponse.json(
      { error: error.message || "Firebase or database failure." },
      { status: 500 }
    );
  }
}



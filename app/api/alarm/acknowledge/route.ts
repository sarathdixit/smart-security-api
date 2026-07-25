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

    const acknowledgedByName = userName || userEmail || "Security Admin";
    const acknowledgedByUid = userUid || null;
    const acknowledgedAt = new Date().toISOString();

    // 3. Atomically check and update using a Firestore transaction (First-Wins race condition protection)
    let alreadyAcknowledged = false;
    let winnerName: string | null = null;
    let winnerAt: string | null = null;

    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(logRef);
      if (!doc.exists) {
        throw new Error(`logId '${logId}' does not exist in Firestore for deviceId '${deviceId}'.`);
      }

      const data = doc.data();

      // If ALREADY acknowledged by someone else, DO NOT overwrite!
      if (data?.acknowledged === true) {
        alreadyAcknowledged = true;
        winnerName = data.acknowledgedByName;
        winnerAt = data.acknowledgedAt;
        return;
      }

      // First person to disarm -> Lock in their acknowledgement!
      transaction.update(logRef, {
        acknowledged: true,
        acknowledgedByUid: acknowledgedByUid,
        acknowledgedByName: acknowledgedByName,
        acknowledgedAt: acknowledgedAt,
      });
    });

    if (alreadyAcknowledged) {
      return NextResponse.json(
        {
          success: true,
          alreadyAcknowledged: true,
          message: `Alarm was already acknowledged by ${winnerName || 'another user'}.`,
          acknowledgedByName: winnerName,
          acknowledgedAt: winnerAt,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        alreadyAcknowledged: false,
        message: "Alarm acknowledged successfully.",
        acknowledgedByName: acknowledgedByName,
        acknowledgedAt: acknowledgedAt,
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



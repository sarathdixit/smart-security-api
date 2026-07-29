import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { db } from "@/lib/firebaseAdmin";

/**
 * POST /api/device/share
 * Allows the primary device owner to share access with another user by email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
    }

    const { deviceId, targetEmail, ownerUid } = body;

    if (!deviceId || !targetEmail || !ownerUid) {
      return NextResponse.json(
        { success: false, error: "deviceId, targetEmail, and ownerUid are required" },
        { status: 400 }
      );
    }

    // 1. Verify owner owns the device
    const deviceDoc = await db.collection("devices").doc(deviceId).get();
    if (!deviceDoc.exists) {
      return NextResponse.json({ success: false, error: "Device not found" }, { status: 404 });
    }

    const deviceData = deviceDoc.data();
    if (!deviceData || deviceData.claimedByUid !== ownerUid) {
      return NextResponse.json(
        { success: false, error: "Only the primary owner can share device access" },
        { status: 403 }
      );
    }

    const cleanEmail = targetEmail.toLowerCase().trim();

    // 2. Find target user by email in Firestore
    const userQuery = await db
      .collection("users")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    let targetUid = null;
    if (!userQuery.empty) {
      targetUid = userQuery.docs[0].id;
    }

    // 3. Add to shared users array in device document
    await db.collection("devices").doc(deviceId).update({
      sharedWithEmails: admin.firestore.FieldValue.arrayUnion(cleanEmail),
    });

    if (targetUid) {
      await db
        .collection("users")
        .doc(targetUid)
        .collection("devices")
        .doc(deviceId)
        .set({
          deviceId,
          customName: deviceData.name || "Shared Gate Device",
          role: "MEMBER",
          addedAt: new Date(),
        });
    }

    return NextResponse.json({
      success: true,
      message: `Access shared successfully with ${cleanEmail}`,
    });
  } catch (error: any) {
    console.error("Device Share Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

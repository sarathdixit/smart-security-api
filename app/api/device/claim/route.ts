import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

/**
 * POST /api/device/claim
 * Allows an authenticated user to claim a hardware device using its unique hardware ID
 * (e.g. GATE-A4CF1289B40C) and assign a custom display name (e.g., "Front Temple Gate").
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { success: false, error: "Invalid payload" },
        { status: 400 }
      );
    }

    const { deviceId, customName, userUid, userName, userEmail } = body;

    if (!deviceId || !userUid) {
      return NextResponse.json(
        { success: false, error: "deviceId and userUid are required" },
        { status: 400 }
      );
    }

    const deviceRef = db.collection("devices").doc(deviceId);
    const now = new Date();

    // 1. Ensure device record exists in Firestore
    await deviceRef.set(
      {
        deviceId,
        name: customName || "Security Sensor",
        claimedByUid: userUid,
        claimedByName: userName || "Owner",
        claimedByEmail: userEmail || "",
        claimedAt: now,
        isArmed: true,
      },
      { merge: true }
    );

    // 2. Link device under User's personal collection: users/{userUid}/devices/{deviceId}
    await db
      .collection("users")
      .doc(userUid)
      .collection("devices")
      .doc(deviceId)
      .set({
        deviceId,
        customName: customName || "Security Sensor",
        role: "OWNER",
        addedAt: now,
      });

    return NextResponse.json({
      success: true,
      message: `Device '${customName || deviceId}' claimed successfully.`,
      deviceId,
      customName: customName || "Security Sensor",
    });
  } catch (error: any) {
    console.error("Device Claim API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/device/list?userUid=...
 * Fetches all registered devices associated with the logged-in user.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userUid = searchParams.get("userUid");

    if (!userUid) {
      return NextResponse.json(
        { success: false, error: "userUid parameter is required" },
        { status: 400 }
      );
    }

    const userDevicesSnapshot = await db
      .collection("users")
      .doc(userUid)
      .collection("devices")
      .get();

    const devices = userDevicesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      count: devices.length,
      devices,
    });
  } catch (error: any) {
    console.error("Device List API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

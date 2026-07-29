import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

/**
 * GET /api/device/notification-preference?userUid=...&deviceId=...
 * Fetch user's notification mute setting for a specific device.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userUid = searchParams.get("userUid");
    const deviceId = searchParams.get("deviceId");

    if (!userUid || !deviceId) {
      return NextResponse.json(
        { success: false, error: "userUid and deviceId are required" },
        { status: 400 }
      );
    }

    const deviceDoc = await db
      .collection("users")
      .doc(userUid)
      .collection("devices")
      .doc(deviceId)
      .get();

    const data = deviceDoc.data();

    return NextResponse.json({
      success: true,
      notificationsMuted: Boolean(data?.notificationsMuted),
    });
  } catch (error: any) {
    console.error("Get Device Notification Preference Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/device/notification-preference
 * Mute or Unmute push notifications for a specific user and device.
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

    const { userUid, deviceId, notificationsMuted } = body;

    if (!userUid || !deviceId || typeof notificationsMuted !== "boolean") {
      return NextResponse.json(
        { success: false, error: "userUid, deviceId, and boolean notificationsMuted are required" },
        { status: 400 }
      );
    }

    await db
      .collection("users")
      .doc(userUid)
      .collection("devices")
      .doc(deviceId)
      .set(
        {
          notificationsMuted,
          updatedAt: new Date(),
        },
        { merge: true }
      );

    return NextResponse.json({
      success: true,
      message: notificationsMuted
        ? `Notifications muted for device '${deviceId}'.`
        : `Notifications enabled for device '${deviceId}'.`,
      notificationsMuted,
    });
  } catch (error: any) {
    console.error("Update Device Notification Preference Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

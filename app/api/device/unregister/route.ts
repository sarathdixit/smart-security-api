import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

/**
 * POST /api/device/unregister
 * Unlinks and removes a registered hardware device from a user's account profile.
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

    const { deviceId, userUid } = body;

    if (!deviceId || !userUid) {
      return NextResponse.json(
        { success: false, error: "deviceId and userUid are required" },
        { status: 400 }
      );
    }

    // 1. Delete device link from user's personal collection: users/{userUid}/devices/{deviceId}
    await db
      .collection("users")
      .doc(userUid)
      .collection("devices")
      .doc(deviceId)
      .delete();

    return NextResponse.json({
      success: true,
      message: `Device '${deviceId}' removed from your profile.`,
      deviceId,
    });
  } catch (error: any) {
    console.error("Device Unregister API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

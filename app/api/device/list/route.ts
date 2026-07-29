import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

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

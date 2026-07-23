import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// Force Next.js to evaluate this route dynamically on every request
// export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.API_SECRET_KEY}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { deviceId, wifiSignal, uptime } = body;

    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    await db
      .collection("devices")
      .doc(deviceId)
      .set(
        {
          status: {
            isOnline: true,
            wifiSignal: wifiSignal ?? null,
            uptime: uptime ?? null,
            lastHeartbeat: new Date(),
          },
        },
        { merge: true },
      );

    return NextResponse.json({ success: true, message: "Heartbeat recorded" });
  } catch (error) {
    console.error("Heartbeat Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

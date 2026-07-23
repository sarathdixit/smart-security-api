import { NextResponse } from "next/server";
import { db, messaging } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const OFFLINE_THRESHOLD_MS = 90 * 1000; // 90 Seconds

  try {
    const snapshot = await db.collection("devices").get();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const lastHeartbeat = data.status?.lastHeartbeat?.toDate().getTime() || 0;
      const isCurrentlyOnline = data.status?.isOnline;

      if (isCurrentlyOnline && now - lastHeartbeat > OFFLINE_THRESHOLD_MS) {
        // Mark device status as offline
        await doc.ref.update({
          "status.isOnline": false,
        });

        // Add to audit log
        await doc.ref.collection("logs").add({
          event: "DEVICE_OFFLINE",
          timestamp: new Date(),
        });

        // Send FCM notification
        await messaging.send({
          topic: "temple_owners",
          data: {
            type: "DEVICE_OFFLINE",
            deviceId: doc.id,
            title: "📡 Temple Device Offline",
            message: "No heartbeat received for over 90 seconds.",
            timestamp: String(Math.floor(now / 1000)),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

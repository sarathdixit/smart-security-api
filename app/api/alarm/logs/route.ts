import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const deviceIdParam = searchParams.get("deviceId");
    const limitParam = parseInt(searchParams.get("limit") || "100", 10);
    const limit = isNaN(limitParam) || limitParam <= 0 ? 100 : limitParam;

    let snapshot: FirebaseFirestore.QuerySnapshot;

    if (deviceIdParam) {
      // Filter logs for a specific device
      const devLogsRef = db
        .collection("devices")
        .doc(deviceIdParam)
        .collection("logs");

      try {
        snapshot = await devLogsRef
          .orderBy("timestamp", "desc")
          .limit(limit)
          .get();
      } catch (err: any) {
        console.warn(
          "Device logs query index warning, fetching without orderBy:",
          err.message
        );
        snapshot = await devLogsRef.limit(limit).get();
      }
    } else {
      // Retrieve historical logs across devices using Firestore collectionGroup
      const groupLogsRef = db.collectionGroup("logs");

      try {
        snapshot = await groupLogsRef
          .orderBy("timestamp", "desc")
          .limit(limit)
          .get();
      } catch (err: any) {
        console.warn(
          "CollectionGroup query index warning, fetching without orderBy:",
          err.message
        );
        snapshot = await groupLogsRef.limit(limit).get();
      }
    }

    const getMillis = (ts: any): number => {
      if (!ts) return 0;
      if (typeof ts.toMillis === "function") return ts.toMillis();
      if (typeof ts.toDate === "function") return ts.toDate().getTime();
      if (typeof ts === "string" || typeof ts === "number") return new Date(ts).getTime();
      return 0;
    };

    // Guarantee descending order by timestamp
    const sortedDocs = [...snapshot.docs].sort(
      (a, b) => getMillis(b.data().timestamp) - getMillis(a.data().timestamp)
    );

    const logs = sortedDocs.map((doc) => {
      const data = doc.data();

      // Parent device document ID fallback if data.deviceId is absent
      const deviceId =
        data.deviceId || doc.ref.parent.parent?.id || "unknown";

      const formatIso = (val: any): string | null => {
        if (!val) return null;
        if (typeof val.toDate === "function") return val.toDate().toISOString();
        if (val instanceof Date) return val.toISOString();
        if (typeof val === "string") return val;
        if (typeof val.seconds === "number") {
          return new Date(val.seconds * 1000).toISOString();
        }
        return null;
      };

      return {
        logId: doc.id,
        deviceId: deviceId,
        alarmType: data.alarmType || data.type || data.event || "UNKNOWN_ALARM",
        message: data.message || "",
        acknowledged: Boolean(data.acknowledged),
        acknowledgedByUid: data.acknowledgedByUid ?? null,
        acknowledgedByName: data.acknowledgedByName ?? null,
        acknowledgedByPhoto: data.acknowledgedByPhoto ?? null,
        acknowledgedAt: formatIso(data.acknowledgedAt),
        timestamp: formatIso(data.timestamp),
      };
    });

    return NextResponse.json(
      {
        success: true,
        count: logs.length,
        logs,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Fetch Logs Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}


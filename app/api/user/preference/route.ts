import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";

// GET /api/user/preference?userUid=xxx - Fetch user preferences (language, etc.)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userUid = searchParams.get("userUid");

    if (!userUid) {
      return NextResponse.json({ error: "userUid parameter is required" }, { status: 400 });
    }

    const userDoc = await db.collection("users").doc(userUid).get();
    const data = userDoc.data();

    return NextResponse.json({
      success: true,
      language: data?.language || "ta",
    });
  } catch (error: any) {
    console.error("Get User Preference Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/user/preference - Save user preferences (language, etc.)
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { userUid, language } = body;

    if (!userUid || !language) {
      return NextResponse.json(
        { error: "userUid and language are required" },
        { status: 400 }
      );
    }

    await db.collection("users").doc(userUid).set(
      {
        language,
        updatedAt: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      message: "Language preference saved successfully",
      language,
    });
  } catch (error: any) {
    console.error("Save User Preference Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

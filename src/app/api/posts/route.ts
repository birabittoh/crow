import { NextRequest, NextResponse } from "next/server";
import { createPost } from "@/lib/data-access";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const post = await createPost(body);
    return NextResponse.json(post, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

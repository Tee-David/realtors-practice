import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const secret = process.env.JOTFORM_AGENT_SECRET;
    
    if (!secret) {
      console.error("Missing JOTFORM_AGENT_SECRET");
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const userHash = crypto.createHmac('sha256', secret).update(userId).digest('hex');

    return NextResponse.json({ hash: userHash });
  } catch (error) {
    console.error("Error generating Jotform hash", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

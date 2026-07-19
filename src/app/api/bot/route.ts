import { NextRequest, NextResponse } from "next/server";
import { webhookCallback } from "grammy";
import { createBot } from "@/lib/bot/handlers";

let handler: ((req: NextRequest) => Promise<NextResponse>) | null = null;

function getHandler() {
  if (handler) return handler;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const bot = createBot(token);
  handler = webhookCallback(bot, "std/http") as unknown as (
    req: NextRequest
  ) => Promise<NextResponse>;
  return handler;
}

export async function POST(req: NextRequest) {
  try {
    return await getHandler()(req);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bot error";
    console.error("Bot webhook error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import { inferType, generatePreview } from "@/lib/library";

/**
 * POST /api/library/save
 *
 * Manually save content to the library (e.g., from Chat bookmark).
 * Accepts: { content: string, source_chat_message_id?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let content: string;
  let sourceChatMessageId: string | undefined;
  try {
    const body = await req.json();
    content = body.content;
    sourceChatMessageId = body.source_chat_message_id;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  content = content.trim();

  // Auto-generate title: first sentence or first 60 chars
  const firstSentence = content.match(/^[^.!?\n]+[.!?]?/)?.[0] || "";
  const rawTitle = firstSentence.length > 10 ? firstSentence : content;
  const title =
    rawTitle.length > 60
      ? rawTitle.slice(0, 60).replace(/\s+\S*$/, "") || rawTitle.slice(0, 60)
      : rawTitle;

  const type = inferType(title);
  const preview = generatePreview(content);

  const supabase = getSupabase();

  // Check for duplicate (same source_chat_message_id)
  if (sourceChatMessageId) {
    const { data: existing } = await supabase
      .from("instaclaw_library")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("source_chat_message_id", sourceChatMessageId)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Already saved", itemId: existing[0].id },
        { status: 409 }
      );
    }
  }

  const { data: item, error } = await supabase
    .from("instaclaw_library")
    .insert({
      user_id: session.user.id,
      title,
      type,
      content,
      preview,
      source_chat_message_id: sourceChatMessageId || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ item });
}

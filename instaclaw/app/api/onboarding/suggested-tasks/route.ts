import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase";
import Anthropic from "@anthropic-ai/sdk";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();

  const { data: user } = await supabase
    .from("instaclaw_users")
    .select("gmail_connected, gmail_profile_summary, gmail_insights, name")
    .eq("id", session.user.id)
    .single();

  if (!user?.gmail_connected || !user.gmail_profile_summary) {
    return NextResponse.json({ suggestions: null });
  }

  try {
    const client = new Anthropic();

    const insightsText = user.gmail_insights?.length
      ? user.gmail_insights.join(", ")
      : "";

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Based on this user profile, generate exactly 2 personalized task suggestions that would be immediately useful and interesting to them. These are tasks they can give to their AI agent.

User profile:
${user.gmail_profile_summary}

Quick insights: ${insightsText}

Rules:
- Each suggestion should feel personally relevant, not generic
- Make them specific and actionable (something an AI agent could do right now)
- Keep labels under 50 characters
- Keep descriptions under 40 characters
- One should be a one-off task, the other should be a recurring/scheduled task
- Do NOT use em dashes

Respond in this exact JSON format, nothing else:
[
  {"label": "task instruction here", "description": "short description"},
  {"label": "task instruction here", "description": "short description"}
]`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const suggestions = JSON.parse(text.trim());

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: null });
  }
}

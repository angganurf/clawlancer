import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { getSupabase } from "./supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/signup",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;

      const supabase = getSupabase();

      // Check if the user already exists
      const { data: existing } = await supabase
        .from("instaclaw_users")
        .select("id")
        .eq("google_id", account.providerAccountId)
        .single();

      if (existing) return true;

      // Read the invite code from the cookie set before OAuth redirect
      const cookieStore = await cookies();
      const inviteCode = cookieStore.get("instaclaw_invite_code")?.value;

      // Create the user row
      const { error } = await supabase.from("instaclaw_users").insert({
        email: user.email?.toLowerCase(),
        name: user.name,
        google_id: account.providerAccountId,
        invited_by: inviteCode ? decodeURIComponent(inviteCode) : null,
      });

      if (error) {
        // Unique constraint = user already exists (race condition)
        if (error.code === "23505") return true;
        console.error("Error creating user:", error);
        return false;
      }

      // Consume the invite code: increment times_used, append user to used_by
      if (inviteCode) {
        const normalized = decodeURIComponent(inviteCode)
          .trim()
          .toUpperCase();

        // Get the invite record
        const { data: invite } = await supabase
          .from("instaclaw_invites")
          .select("id, times_used, used_by")
          .eq("code", normalized)
          .single();

        if (invite) {
          // Get the newly created user's ID for used_by
          const { data: newUser } = await supabase
            .from("instaclaw_users")
            .select("id")
            .eq("google_id", account.providerAccountId)
            .single();

          const updatedUsedBy = [
            ...(invite.used_by ?? []),
            ...(newUser ? [newUser.id] : []),
          ];

          await supabase
            .from("instaclaw_invites")
            .update({
              times_used: (invite.times_used ?? 0) + 1,
              used_by: updatedUsedBy,
            })
            .eq("id", invite.id);
        }
      }

      return true;
    },

    async jwt({ token, account }) {
      if (account) {
        token.googleId = account.providerAccountId;
      }
      return token;
    },

    async session({ session, token }) {
      if (token.googleId) {
        const supabase = getSupabase();
        const { data } = await supabase
          .from("instaclaw_users")
          .select("id, onboarding_complete")
          .eq("google_id", token.googleId)
          .single();

        if (data) {
          session.user.id = data.id;
          session.user.onboardingComplete = data.onboarding_complete ?? false;
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});

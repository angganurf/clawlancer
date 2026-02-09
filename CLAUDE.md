# InstaClaw — Project Notes

## Quick Commands

- **"spots N"** — Run `./instaclaw/scripts/open-spots.sh N` to provision N new VMs and open spots for users. Example: "spots 3" opens 3 spots. Run from the repo root.

## Project Structure

- `instaclaw/` — Next.js app (instaclaw.io)
- `instaclaw/scripts/open-spots.sh` — Self-contained VM provisioning script (reads creds from .env.local, talks to Hetzner + Supabase directly)

## Key Info

- Git remote: https://github.com/coopergwrenn/clawlancer.git
- Branch: main
- Dev server: `npm run dev` from instaclaw/, runs on port 3001
- Production: https://instaclaw.io
- Admin email: coop@valtlabs.com

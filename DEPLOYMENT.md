# Deploy (GitHub + Vercel)

This project is a Next.js app (with API routes for username sign-in, leaderboard, and admin panel).

## 1) Push to GitHub

1. Create a new GitHub repo (empty) in your account, e.g. `liquid-glass-casino`.
2. In this project folder:

```bash
git status
git add -A
git commit -m "casino prototype"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2) Deploy on Vercel (recommended)

GitHub Pages can’t run the Next.js API routes (auth/leaderboard/admin), so use Vercel.

1. Go to Vercel → **Add New Project** → import your GitHub repo.
2. Create a hosted Postgres DB (recommended: **Neon**) and copy its connection string.
3. In Vercel Project → **Settings → Environment Variables**, add:

- `DATABASE_URL` = your Neon/Postgres connection string
- `LGC_MASTER_USERNAME` = `master` (or whatever you want)

4. Deploy.

### Master / Admin roles

- The **master username** (default: `master`) is always **role level 3**.
- Master can promote/demote other usernames in `/casino/admin`.
- Admin users (role level 1–3) are **hidden** from the public leaderboard.

## 3) LAN/mobile testing (optional)

Run locally:

```bash
npx next dev -H 0.0.0.0 -p 3001
```

Then open from your phone (same Wi‑Fi):

`http://<your-pc-ip>:3001/casino`


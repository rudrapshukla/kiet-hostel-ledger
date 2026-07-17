# Hostel Ledger — KIET Directory

## Running it locally

You need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd kiet-hostel-ledger
npm install
npm run hash-password
```

The last command asks you to type a passcode, then prints two lines. Create a
file called `.env` (copy `.env.example`) and paste those two lines in, e.g.:

```
JWT_SECRET=a3f9c2...
ADMIN_PASSWORD_HASH=$2a$12$...
PORT=3000
NODE_ENV=development
```

Then start the server:

```bash
npm start
```

Open **http://localhost:3000** — that's the whole site: search, hostel browsing,
contact page, and the Developer tab (unlocks with the passcode you just chose).

## Putting it online (Render, step by step)

Render is the easiest free option for this project: no credit card, it runs a
persistent Node process (not a serverless function), and deploys straight
from GitHub. These steps apply as of mid-2026 — Render's dashboard changes
occasionally, so if a label doesn't match exactly, look for the nearest
equivalent.

### 1. Put the project on GitHub

```bash
cd kiet-hostel-ledger
git init
git add .
git commit -m "Initial commit"
```

Create an empty repository on github.com (no README/license), then:

```bash
git remote add origin https://github.com/<your-username>/kiet-hostel-ledger.git
git branch -M main
git push -u origin main
```

`.env` and `node_modules` are already in `.gitignore`, so your secrets won't
be pushed.

### 2. Generate your real passcode hash locally

```bash
npm install
npm run hash-password
```

Save the two printed lines (`JWT_SECRET` and `ADMIN_PASSWORD_HASH`) somewhere
temporarily — you'll paste them into Render's dashboard in step 4, not into
a file.

### 3. Create the Render web service

1. Go to [render.com](https://render.com) and sign up (no card needed).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account and select the `kiet-hostel-ledger` repo.
4. Fill in:
   - **Name**: anything, e.g. `kiet-hostel-ledger`
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (to start)

### 4. Add environment variables

Still on the same setup screen (or under the service's **Environment** tab
after creation), add:

| Key | Value |
|---|---|
| `JWT_SECRET` | the value you generated in step 2 |
| `ADMIN_PASSWORD_HASH` | the value you generated in step 2 |
| `NODE_ENV` | `production` |

Click **Create Web Service** / **Deploy**. Render builds and starts it, then
gives you a live URL like `https://kiet-hostel-ledger.onrender.com`.

### 5. The one caveat: free-tier storage isn't permanent

This is worth understanding before you rely on it: **Render's free web
services have an ephemeral filesystem.** Anything written to disk — which
includes this app's `data/directory.json`, where every hostel and resident
you add lives — is wiped every time the service redeploys, restarts, or
spins down from inactivity. Free services spin down after just 15 minutes of
no traffic, so in practice this means data added through the developer
console can vanish within the hour.

Two ways to actually fix this, not just work around it:

**Option A — pay for a persistent disk (~$7/month).** Upgrade the service to
Render's Starter plan, then in the service's **Disks** tab, add a disk with:
- Mount path: `/var/data`
- Size: 1 GB is overkill for this app

Then add one more environment variable: `DATA_DIR` = `/var/data`. Redeploy.
The app already reads `DATA_DIR` (see `server.js`), so this is a config
change, not a code change. Data now survives restarts and redeploys
indefinitely.

**Option B — stay fully free, accept the trade-off.** Fine for a quick demo
or portfolio piece where you don't mind re-adding a few hostels after it's
been idle. Not fine for a directory real students are meant to rely on.

If you want a free option that's also durable, that means swapping the JSON
file for an external database with a real free tier (e.g. a free MongoDB
Atlas or Supabase Postgres project) — that's a small code change to
`loadData`/`saveData` in `server.js`, and I'm glad to make it if you'd
rather go that route than pay for the disk.

### 6. Ongoing updates

Every `git push` to `main` triggers an automatic redeploy on Render — no
extra steps needed after the first setup.

## Project layout

```
server.js            Express backend — public API + password/JWT-protected admin routes
scripts/hash-password.js   One-time helper to turn a chosen passcode into a hash
public/               The frontend (plain HTML/CSS/JS, glassmorphism design)
data/directory.json   Where hostel/room data lives (created automatically on first run)
```

## Data storage

Data is kept in `data/directory.json` on the server. It's plenty for a college
directory's scale. If this ever needs to survive redeploys on a host with an
ephemeral filesystem (some free tiers wipe disk on restart), swap that file for
a small database (SQLite or Postgres) — the `loadData`/`saveData` functions in
`server.js` are the only two places that would need to change.

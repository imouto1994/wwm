# PvP Tournament Tracker — Production Deployment Runbook

A step-by-step guide to take `apps/pvp` from this repo to a live production URL, verify it end to end, rehearse, run the event, and wind it down afterwards. For how the app works, see [pvp-app.md](pvp-app.md).

**Time needed:** about 45 minutes, plus an optional 20–30 minute rehearsal (Phase 8, recommended).

**What you end up with:**

| Piece                  | Value                                                                         |
| ---------------------- | ----------------------------------------------------------------------------- |
| Code                   | GitHub `imouto1994/wwm`, branch `main` (local git remote **`fallback`**)      |
| Vercel project         | `gvntrios`, Root Directory `apps/pvp`, Hobby (free) plan                       |
| Viewer page (public)   | `https://gvntrios.vercel.app/` (or whatever domain Vercel gives you)           |
| Host page (PIN)        | `https://gvntrios.vercel.app/host`                                             |
| Storage                | Upstash Redis, free plan, created from the Vercel Marketplace                 |
| Secrets                | `HOST_PIN` (you choose it), Redis URL + token (injected by the integration)   |

> **Git remote warning.** In this clone, `origin` points to `github.com/coinbase/cds`, not to this project. The project's repo is the remote named **`fallback`** (`main` already tracks `fallback/main`). Every push command in this runbook names `fallback` explicitly; don't run a bare `git push origin …`.

---

## Phase 0 — Take the real voter data out of the public repo

The last pushed commit, `41850a2 Initialize PVP app`, includes `example.html`. That's the EasyPoll dashboard sample with real guild members' Discord IDs, usernames and poll answers, and `imouto1994/wwm` is a **public** repo. Fix this before anything else, so the first Vercel deployment doesn't build a commit that contains it.

**Option A — rewrite the last commit (use this if nothing has been pushed since).** Check first:

```bash
cd ~/Documents/wwm
git switch main
git log --oneline -1    # must show: 41850a2 Initialize PVP app
```

Then:

```bash
git rm --cached example.html            # keeps your local copy, stops tracking it
echo 'example.html' >> .gitignore
git add .gitignore
git commit --amend --no-edit
git push --force-with-lease fallback main
```

**Option B — newer commits exist on top.** Remove the file in a new commit:

```bash
git rm --cached example.html
echo 'example.html' >> .gitignore
git add .gitignore
git commit -m "Stop tracking the EasyPoll sample with real voter data"
git push fallback main
```

With option B the file stays in the repo's history. To purge it as well, rewrite history with [git-filter-repo](https://github.com/newren/git-filter-repo) (`brew install git-filter-repo`, then `git filter-repo --invert-paths --path example.html --force` and `git push --force fallback main`). Note that `git filter-repo` deletes the remote named `origin`, which in this clone is the unrelated `coinbase/cds` one.

With either option, GitHub can keep serving the old commit by its hash for a while. If that matters, ask GitHub Support to purge cached views of commit `41850a2`.

- [ ] `git ls-files example.html` prints nothing, and `git status` is clean.

---

## Phase 1 — Local pre-flight (5 min)

```bash
cd ~/Documents/wwm
git switch main && git pull fallback main
git status                      # clean
pnpm install --frozen-lockfile  # same lockfile check Vercel does
pnpm build:pvp                  # typecheck + production build
pnpm lint
```

All three must pass. Optional: `pnpm dev:pvp`, then open http://localhost:2140/host (local PIN `dev`) to see the app before it goes live.

**Generate the `HOST_PIN` now.** The API has **no rate limit on PIN guesses**, so use a long random passphrase, not a 4–6 digit PIN. For example:

```bash
openssl rand -base64 24 | tr -d '/+=' | cut -c1-20
```

Save it in a password manager and send it to the host by DM only. The host types it once per browser tab; the page keeps it for that tab only (`sessionStorage`).

The Vercel project is called **`gvntrios`**, which gives `https://gvntrios.vercel.app`. If that domain is already taken on Vercel, you'll get a suffixed one instead (shown under **Settings → Domains**); use it wherever this runbook says `gvntrios.vercel.app`.

- [ ] Build and lint pass, `HOST_PIN` generated and saved.

---

## Phase 2 — Create the Vercel project (10 min)

1. Go to [vercel.com/new](https://vercel.com/new) (**Add New… → Project**).
2. **Import Git Repository**: pick `imouto1994/wwm`. If it isn't listed, use **Adjust GitHub App Permissions** to grant access.
3. **Configure Project**:

   | Field                        | Value                                                                  |
   | ---------------------------- | ---------------------------------------------------------------------- |
   | Project Name                 | `gvntrios`                                                              |
   | Framework Preset             | **Vite**                                                               |
   | Root Directory               | **Edit → `apps/pvp` → Continue**                                       |
   | Build and Output Settings    | Leave all defaults (no overrides)                                      |
   | Environment Variables        | Add `HOST_PIN` = your passphrase                                       |

   The defaults do the right thing for this monorepo. Vercel installs from the repo root with pnpm 10 (read from the root `package.json` `packageManager` field), runs the app's `build` script (`tsc --noEmit && vite build`), serves `dist/`, and turns `api/tournament.ts` into a Function.

4. Click **Deploy**. The build takes about a minute.

   The site loads after this first deploy, but the API answers **503 "Storage is not configured"** until Phase 4. That's expected.

5. Check these settings on the new project:
   - **Settings → Build and Deployment → Root Directory**: `apps/pvp`, with **"Include files outside the root directory in the Build Step"** enabled. The build needs the root lockfile and workspace config.
   - **Settings → Build and Deployment → Node.js Version**: `24.x`. It comes from `engines.node` in `apps/pvp/package.json`.
   - **Settings → Deployment Protection**: leave the default. Preview deployments need a Vercel login; the production domain is public.
   - *Optional:* under Root Directory, enable **"Skip deployments when there are no changes to the root directory or its dependencies"**, so commits that only touch other apps don't rebuild this one.

- [ ] First production deployment shows **Ready**.

---

## Phase 3 — Put the Function near the guild (2 min, recommended)

By default the Function runs in Washington, D.C. (`iad1`). Each host save and each uncached read goes from the Function to Redis, so keep both close to the players.

1. **Settings → Functions → Function Regions**.
2. **Untick** Washington, D.C. (`iad1`), then **tick** Singapore (`sin1`) (or Hong Kong `hkg1` / Tokyo `hnd1` if the guild is closer to those). **Save.**
3. The Hobby plan allows **one** region. With two ticked, the next deployment fails with an `upgrade_required` error.

The change applies from the next deployment (Phase 6).

- [ ] Exactly one region selected.

---

## Phase 4 — Create and connect Upstash Redis (5 min)

1. In the project: **Storage → Create Database**. Under **Marketplace Database Providers** choose **Upstash → Upstash for Redis → Continue**.
2. **Plan:** Free. **Primary region:** the same area as Phase 3 (AWS `ap-southeast-1`, Singapore). Don't add read regions.
3. **Name:** `gvntrios`. **Create.**
4. **Connect Project:** choose `gvntrios`, environments **Production, Preview and Development**.
   - **Custom Environment Variable Prefix:** leave the default (`KV`), or set exactly `UPSTASH_REDIS_REST`. The app reads `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. **Any other prefix won't be found.**
5. Check **Settings → Environment Variables**. You should see `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the `UPSTASH_REDIS_REST_*` pair) for Production and Preview. The other variables the integration adds (`KV_URL`, `REDIS_URL`, `KV_REST_API_READ_ONLY_TOKEN`) are unused; leave them.

Production and previews share this one database (the free plan allows one). That's safe: the app prefixes every key with the environment (`pvp:production:*`, `pvp:preview:*`), so a rehearsal never touches production data.

- [ ] Redis URL and token variables exist for Production and Preview.

---

## Phase 5 — Check `HOST_PIN` (2 min)

**Settings → Environment Variables → `HOST_PIN`:**

- Environments: **Production** and **Preview**. Development isn't needed; locally the app uses `dev` or `apps/pvp/.env.local`.
- **Edit → mark as Sensitive**, so the value can't be read back from the dashboard.
- Make sure the value has no leading or trailing spaces. The host must type it exactly.

If you skipped it on the import screen, add it now.

- [ ] `HOST_PIN` set for Production and Preview, marked Sensitive.

---

## Phase 6 — Redeploy (2 min)

Environment variables and the region only apply to **new** deployments.

**Deployments → the latest Production deployment → ⋯ → Redeploy → Redeploy.** Wait for **Ready**.

- [ ] New production deployment is Ready.

---

## Phase 7 — Verify production (10 min)

### 7.1 From a terminal

```bash
BASE=https://gvntrios.vercel.app   # your production domain (Settings → Domains)
read -rs PIN; echo                # type HOST_PIN, press Enter; keeps it out of shell history
```

```bash
# 1. Public read. Expect: {"tournament":null}
curl -s "$BASE/api/tournament"; echo

# 2. CDN caching (run it twice). Expect: cache-control: public, max-age=0, must-revalidate
#    and x-vercel-cache: MISS the first time, then HIT or STALE
curl -s -D - -o /dev/null "$BASE/api/tournament" | grep -iE '^(cache-control|x-vercel-cache)'

# 3. Wrong PIN. Expect: 401
curl -s -o /dev/null -w '%{http_code}\n' -H 'x-host-pin: wrong' "$BASE/api/tournament?fresh=1"

# 4. Right PIN. Expect: 200
curl -s -o /dev/null -w '%{http_code}\n' -H "x-host-pin: $PIN" "$BASE/api/tournament?fresh=1"

# 5. Host page routing. Expect: 200 text/html; charset=utf-8
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$BASE/host"

# 6. Unknown API path. Expect: 404
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/nope"
```

If check 1 returns 503, the Redis variables are missing in Production or you didn't redeploy (Phases 4 and 6). If it returns 500, see [Troubleshooting](#appendix-a--troubleshooting). If check 4 returns 401, `HOST_PIN` isn't set for Production, has a typo, or you didn't redeploy.

### 7.2 In the browser

7. Open `$BASE/host` on a laptop. A wrong PIN shows an error; the right PIN opens **Setup**.
8. Set the **event name** and save. This is the first real write to Redis. The header should show **"All changes saved"**.
9. On a phone **on mobile data** (not your Wi-Fi), open `$BASE`. The event name appears within about 10 seconds and the status reads **"Live"**.
10. **Vercel → Logs**, filter by `/api/tournament`: requests are 200s from the region you picked in Phase 3.
11. **Vercel → Storage → gvntrios → Open in Upstash → Data Browser**: keys `pvp:production:state`, `pvp:production:version` and `pvp:production:history` exist.

Production now holds your real event (just its name so far). **Don't test-play on production**; use Phase 8 for that.

- [ ] Checks 1–11 pass.

---

## Phase 8 — Rehearse on a Preview deployment (20–30 min, recommended)

This runs the real Redis save path, conflict handling, the EasyPoll import and real phones against the preview data (`pvp:preview:*`), never production.

### 8.1 Create a preview

```bash
git switch -c pvp-rehearsal
git commit --allow-empty -m "Rehearsal deployment"
git push -u fallback pvp-rehearsal
```

In **Vercel → Deployments**, open the **Preview** for `pvp-rehearsal` and click **Visit**. Previews are behind Vercel login (Deployment Protection), which is fine for you. Other testers need a Vercel login or a share link from the deployment's **Share** menu.

### 8.2 Rehearsal script

1. `/host` → PIN → paste **21 test names**, one per line → **Save** → **Draw groups** → **Start the group stage**.
2. **Group 1:** **Show as live** → copy the poll question and answers → post a real EasyPoll in a test Discord channel → vote from 2–3 accounts.
3. Record 2–3 games (tap winner, tap runner-up, **Save game**), including one **Undo last game**.
4. **Import votes:** EasyPoll dashboard → the poll's votes → open the Chrome console → paste [`scripts/easypoll/easypoll-devtools.js`](../scripts/easypoll/easypoll-devtools.js) → in the host page's poll panel, paste → check the preview → **Save**.
5. **Viewer on a phone:** now playing, vote percentages and recent results update within about 10 seconds.
6. **Conflict:** open `/host` in a second tab. Save a game in tab A, then make any change in tab B. Tab B shows the red banner "Another tab saved a newer version…" and loads tab A's result.
7. **Host tools:** **Download JSON** (the file opens and has your games), **Load saves** → restore an earlier save.
8. **Lock** returns to the PIN gate.
9. Finish with **Host tools → Reset** (type `RESET`).

### 8.3 Clean up

```bash
git switch main
git branch -D pvp-rehearsal
git push fallback --delete pvp-rehearsal
```

Optionally delete the `pvp:preview:*` keys in the Upstash Data Browser and the preview deployment in Vercel.

- [ ] Rehearsal steps pass, branch deleted.

---

## Phase 9 — Before and during the event

**Before (the day before is ideal):**

- [ ] The host opens `$BASE/host` on the scorekeeping device and enters the PIN.
- [ ] Event name and the final participant list (21, 24, 27 or 30 names) are saved. Draw the groups when you're ready to announce them.
- [ ] Share **only the viewer link** (`$BASE`) in Discord, never `/host` together with the PIN.
- [ ] Freeze code: **don't push to `main` on event day**. Every push redeploys production.

**During:**

- Keep **Vercel → Logs** open, filtered to `/api/tournament` and errors.
- After each stage: **Host tools → Download JSON** (your offline backup).
- If the host page shows **"Not saved"**, tap **Retry**. **Don't reload the host tab** until it says saved; unsaved changes only live in that tab.
- One scorekeeping device at a time. To switch, **Lock** the old one and open `/host` on the new one. All results are on the server.
- The run order is in [pvp-app.md §9](pvp-app.md#9-event-day-checklist).

---

## Phase 10 — After the event

1. **Host tools → Download JSON**: the final record.
2. Freeze the results: **Settings → Environment Variables → add `READ_ONLY` = `1`** (Production) → **Redeploy**. Viewers keep seeing the bracket; every write returns 403.
3. **Keep in mind:** Upstash archives a free database after **30 days without traffic** (after warning emails; the data is backed up and can be restored into a new database). Once archived, the viewer page shows "Offline". The downloaded JSON is your permanent record.
4. Optional teardown: delete the database (**Storage → gvntrios → Settings → Delete**) and/or the Vercel project.

**Next event:** remove `READ_ONLY`, redeploy, then **Host tools → Reset**.

---

## Appendix A — Troubleshooting

| Symptom                                                         | Likely cause                                                               | Fix                                                                                                   |
| --------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Build fails with `ERR_PNPM_OUTDATED_LOCKFILE`                   | A dependency changed without committing `pnpm-lock.yaml`                   | `pnpm install` locally, commit the lockfile, push                                                     |
| Build fails on TypeScript errors                                | Code that doesn't typecheck reached `main`                                 | Run `pnpm build:pvp` locally and fix                                                                  |
| Build can't find the lockfile or workspace packages             | "Include files outside the root directory" is off                          | Turn it on (Phase 2, step 5), redeploy                                                                |
| Deployment fails before building, `upgrade_required`            | Two Function regions selected on Hobby                                     | Keep exactly one (Phase 3)                                                                            |
| `/api/tournament` returns 404                                   | Root Directory isn't `apps/pvp`, so `api/` isn't at the project root      | Fix Root Directory, redeploy                                                                          |
| 503 "Storage is not configured"                                 | Redis variables missing for that environment, a custom prefix, or no redeploy | Phase 4 step 5, then redeploy                                                                      |
| 500 "could not reach storage"                                   | Token rotated, database archived or deleted, or an Upstash incident        | Check Logs for "Tournament request failed", check the Upstash console and status page; reconnect, redeploy |
| 401 "Wrong host PIN" with the right PIN                         | `HOST_PIN` not set for that environment, a stray space, or no redeploy     | Fix the variable, redeploy, re-enter the PIN                                                          |
| Host gets sent back to the PIN gate mid-event                   | `HOST_PIN` was changed on the server                                       | Enter the new PIN                                                                                     |
| Red "another tab saved a newer version" banner keeps appearing  | Two devices or tabs are editing                                            | Keep one scorekeeping tab                                                                             |
| Viewer lags more than about 15 seconds                          | The phone tab is in the background (polling pauses) or the CDN served stale | Bring the tab to the front; check `x-vercel-cache` (Phase 7, check 2)                               |
| Preview asks for a Vercel login                                 | Deployment Protection on previews                                          | Expected; log in or use the deployment's Share link                                                   |
| Writes return 403 "read-only"                                   | `READ_ONLY=1` is set                                                       | Remove it, redeploy                                                                                   |

## Appendix B — Restore from a downloaded backup

Use this when the stored tournament is lost or wrong and **Host tools → Restore an earlier save** can't help, for example after moving to a new database. It saves your downloaded JSON as the newest version.

```bash
BASE=https://gvntrios.vercel.app
read -rs PIN; echo
FILE=~/Downloads/pvp-tournament-v42.json   # the file from Host tools → Download JSON

CURRENT=$(curl -s -H "x-host-pin: $PIN" "$BASE/api/tournament?fresh=1" | jq '.tournament.version // 0')
jq -n --slurpfile t "$FILE" --argjson v "$CURRENT" '{expectedVersion: $v, tournament: $t[0]}' \
  | curl -s -X PUT "$BASE/api/tournament" -H "x-host-pin: $PIN" -H 'content-type: application/json' --data-binary @- \
  | jq -c '{version: .tournament.version, stage: .tournament.stage, error}'
```

Expected: a new version number, the stage from your backup, and `"error": null`. Then reload the host page. A `409` means someone saved in between; run it again. `jq` ships with macOS.

## Appendix C — Rolling back

- **Bad code deploy:** **Deployments → the previous good production deployment → ⋯ → Instant Rollback** (or **Promote to Production**). The data isn't affected.
- **Wrong tournament data:** **Host tools → Go back a stage**, or **Restore an earlier save** (the last 50 saves), or [Appendix B](#appendix-b--restore-from-a-downloaded-backup).

## Appendix D — Reference

**Environment variables**

| Variable                                                       | Required | Where                     | Notes                                                       |
| -------------------------------------------------------------- | -------- | ------------------------- | ----------------------------------------------------------- |
| `HOST_PIN`                                                     | Yes      | Production, Preview       | Long passphrase, marked Sensitive. Without it, nobody can write |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) | Yes | Production, Preview, Development | Injected by the Upstash integration                        |
| `READ_ONLY`                                                    | No       | Production                | `1` after the event: results stay visible, writes are refused |
| `VERCEL_ENV`                                                   | Automatic | —                        | Picks the Redis key prefix: `production`, `preview` or `development` |

**Redis keys** (per environment): `pvp:<env>:state` (the tournament JSON), `pvp:<env>:version`, `pvp:<env>:history` (last 50 saves).

**Expected usage** for a 3-hour event: viewer reads are cached by Vercel's CDN for 2 seconds, so Redis sees roughly one read every 2 seconds per CDN region however many people watch. Each host save costs 6 Upstash commands (the compare-and-set script plus its 5 calls). That totals around 10–20 thousand commands, far below the free plan's 500K a month. Check **Vercel → Usage** and the Upstash console after the rehearsal to confirm.

**API details:** [pvp-app.md §7.3](pvp-app.md#73-api).

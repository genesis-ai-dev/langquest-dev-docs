# Runbook: Reconcile config.toml with the remote Supabase projects

**Goal:** Make `supabase/config.toml` a faithful description of the dev and production Supabase projects' actual settings, so config-as-code (`supabase config push`) can be trusted — first manually, later in CI.

**Background:** Supabase has no `config pull` (export dashboard → toml). But `config push` prints a **diff of local vs. remote and asks for confirmation before changing anything**. Answering `n` makes it a read-only drift report. We use that as the reconciliation loop.

**Structure (verified 2026-08-10):** one Supabase project with full Branching enabled. `main` is the default (production) branch; `dev` is a persistent branch mapped to the git `dev` branch; ephemeral preview branches are auto-created per git feature branch.

| Environment | Ref (branch ID, usable as `--project-ref`) |
|---|---|
| dev (persistent branch) | `yjgdgsycxmlvaiuynlbv` |
| production (default branch) | `unsxkmlcyxgtgmtzfonb` |

**Open question (test before trusting):** with Branching enabled, Supabase's runner may *already* be applying `[remotes.*]` config overrides on merges to dev/main. Test: change a harmless `[remotes.dev.auth]` value, merge to dev, check the branch's auth settings in the dashboard a minute later. If it applies, config.toml is already live config — which makes reconciling it accurate even more important, and step 8 (CI push) may be unnecessary.

---

## Safety rules (verified against CLI v2.111.0 source code)

- For each config section (api, db, auth, storage, webhooks) the CLI: fetches remote → diffs → if no difference, writes nothing → if different, prints the diff **then** prompts before writing. The prompt is real, per section.
- **The prompt default is YES** (`[Y/n]`) — pressing Enter pushes. **Explicitly type `n`** for every section until the final deliberate push (step 6).
- **Never run it non-interactively** (script, pipe, CI, agent shell): without a TTY the prompt times out after 100ms and auto-answers YES. Interactive terminal only.
- **Never use `--yes`** during reconciliation — same effect: pushes everything unprompted.
- **Back up first (step 2a)** — there is no undo; the backups are the rollback path.
- Nothing here touches database *data* or storage *files* — `config push` only covers service settings.

---

## 1. Prerequisites (one-time)

1. Supabase CLI authenticated: `npx supabase projects list` should list both projects. If not: `npx supabase login`.
2. dotenvx decryption working: you need the private key(s) in `.env.keys` locally so `npm run sb` can resolve `env()` references (`SEND_EMAIL_HOOK_SECRET`, `AUTH_SITE_URL`, …) in `config.toml`. Test: `npm run decrypt-env -- env | grep SEND_EMAIL` should print a value.
3. Work on a fresh git branch: `git checkout -b config-reconciliation`.

## 2a. Back up current remote settings (rollback insurance)

Create a personal access token at supabase.com/dashboard/account/tokens, then:

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
for ref in yjgdgsycxmlvaiuynlbv unsxkmlcyxgtgmtzfonb; do
  curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$ref/config/auth" > "backup-$ref-auth.json"
  curl -s -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    "https://api.supabase.com/v1/projects/$ref/config/database/postgres" > "backup-$ref-db.json"
done
```

Store the files somewhere safe (not committed — they may contain secrets). If a push ever applies something it shouldn't, these are the values to restore (via dashboard or PATCH to the same endpoints).

## 2. Get the dev project's drift report

```bash
cd ~/dev/langquest
npm run sb -- config push --project-ref yjgdgsycxmlvaiuynlbv
```

- For each section that differs, it prints the diff and then prompts. **Type `n` (not just Enter — Enter means yes) at every prompt.**
- Sections with no drift print "Remote X config is up to date." and are skipped automatically.
- Save the diff output to a scratch file — this is your worklist.

## 3. Classify every line of the diff

For each difference, decide which side is right:

| Case | Action |
|---|---|
| Dashboard value is correct (someone tuned it there) | Edit `config.toml` to match. Environment-specific values go in a `[remotes.dev.<section>]` block; shared values go in the base section. |
| `config.toml` value is correct (dashboard is stale/wrong) | Leave the file as-is; note it — it will be applied when you finally push (step 6). |
| Secret-like value | Use `env(VAR_NAME)` in the file and add the value to the encrypted `supabase/.env*` files (`npm run sb -- … dotenvx encrypt` flow), never plaintext. |
| Setting you don't recognize | Ask the team / git blame the dashboard change in Supabase's audit log (org → Audit) before choosing. |

## 4. Iterate until the dev diff is empty (or intentional)

Repeat steps 2–3 after each round of edits. Done when the diff shows **only** changes you deliberately want to push (ideally: nothing).

## 5. Repeat for production

```bash
npm run sb -- config push --project-ref unsxkmlcyxgtgmtzfonb
```

Same loop. Expect a *different* diff — the two branches drifted independently. Environment-specific corrections go in `[remotes.production.*]` blocks.

Watch for: values identical in both projects belong in base sections; values that differ belong in the two `[remotes.*]` blocks. Don't duplicate base values into remotes blocks unnecessarily.

## 6. (Only if desired) Apply the file to the remotes

If any diffs remain that represent "the file is right, the dashboard is wrong":

1. Get a teammate to review the final diff output.
2. Run the push again and answer `y` — dev first, verify the app/auth still works, then production.

If the diffs came out empty in steps 4–5, skip this — there's nothing to apply.

## 7. Commit the baseline

```bash
git add supabase/config.toml supabase/.env*   # encrypted files only, never .env.keys
git commit -m "chore: reconcile config.toml with remote project settings"
```

PR it through the normal dev → main flow. From this commit onward, treat the dashboard as read-only for anything `config.toml` covers.

## 8. (Later, separate task) Automate in CI

Add a step to the deployment flow: on merge to dev run `config push --project-ref <dev> --yes`, on merge to main the production ref — with `DOTENV_PRIVATE_KEY` provided as a GitHub secret so `env()` resolves. Only do this after the team agrees the dashboard is no longer the source of truth, because CI pushes will silently overwrite dashboard edits.

---

## Reconciliation result (2026-08-10)

- **dev branch: zero drift.** All sections "up to date" — `config.toml` + `[remotes.dev]` faithfully matches the live branch.
- **production: one false diff, no real drift.** The `send_email` hook secret always shows as different because `decrypt-env` loads `SEND_EMAIL_HOOK_SECRET` from `supabase/.env.preview` (there is no `.env.production` in the chain), so pushes targeting production compare against the *preview* secret. **Always answer `n` to the auth prompt when pushing to production** until fixed. Proper fix: encrypted `supabase/.env.production` with the production hook secret + a `decrypt-env:prod` script that loads `.env` + `.env.production` for production-targeted commands. Pushing that false diff would break production password-reset/invitation emails.

## Limitations

- `config push` only manages the domains config-as-code supports (auth, API, db settings, functions, storage, …). Some dashboard settings (e.g. certain org/billing/add-on settings) are outside it and stay dashboard-managed. The diff loop implicitly reveals the boundary: what never shows up in a diff isn't managed.
- Secrets (`supabase secrets`) are separate from config and are not covered by this process.
- The CLI in the repo is v2.76; diff formatting may differ after upgrades, but the confirm-prompt behavior is the contract.

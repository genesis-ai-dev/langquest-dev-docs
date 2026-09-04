# Runbook: Move langquest.org DNS from Vercel to Cloudflare

**Goal:** Make Cloudflare the authoritative DNS provider for `langquest.org` so we can attach `media.langquest.org` to the LangQuest R2 bucket. Website hosting stays on Vercel. Email (Resend + AWS SES) keeps working. Fully reversible.

**Last verified:** 2026-07-28 (record values below were pulled live from DNS and the Vercel dashboard on this date — re-verify if much time has passed).

**Status (2026-07-28):** Phases 1–5 COMPLETE. Zone active on Cloudflare (`kimora`/`nitin.ns.cloudflare.com`), all sites verified, Vercel domains valid, production password-reset email confirmed working. Remaining: Phase 6 (R2 custom domain) and aftercare. Notes: DNSSEC was off at GoDaddy (no DS records — nothing to do); `documenso.langquest.org` correctly points at Railway but the Railway service itself is dead (Railway 404 page) — records can be deleted whenever.

## 1. Two-minute DNS primer

Three separate parties are involved with a domain, and it's easy to conflate them:


| Role                                | Who has it today                    | What it does                                                                                                              |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Registrar**                       | GoDaddy                             | Where the domain is registered. Its job here: stores *which nameservers* answer for `langquest.org`.                      |
| **Authoritative DNS (nameservers)** | Vercel (`ns1`/`ns2.vercel-dns.com`) | Answers every "where is X.langquest.org?" query using a list of *records*. This is what we're moving to Cloudflare.       |
| **Hosting**                         | Vercel                              | Serves the actual websites. Unaffected by this migration — it only needs DNS records that point at it, from any provider. |


A **DNS record** is one line in the phone book: "`www.langquest.org` → go to this Vercel server", "mail for `@langquest.org` → goes to this Amazon server". Common types:

- **A** — name points to an IP address.
- **CNAME** — name is an alias for another name.
- **MX** — where email for the domain gets delivered.
- **TXT** — free-form text; used for email authentication (SPF/DKIM/DMARC) and ownership verification.
- **CAA** — restricts which companies may issue HTTPS certificates for the domain.

The migration is: (1) recreate every record in Cloudflare, (2) tell GoDaddy "Cloudflare's nameservers answer now." During the change-over both providers give identical answers, so there is **no downtime** if step 1 is done correctly.

---



## 2. Prerequisites

- [ ] Access to the org Cloudflare account (the one that will hold the LangQuest R2 buckets)
- [ ] Access to the GoDaddy account that holds the `langquest.org` registration
- [ ] Access to the Vercel team dashboard (to verify domains after the flip)
- [ ] Pick a low-traffic time window. Nothing should break, but don't do this right before a release.

---



## 3. Phase 1 — Add the zone in Cloudflare (no user-visible changes yet)

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) → the org account.
2. **Add a domain** (button on the account home page).
3. Enter `langquest.org`. Choose the **Free** plan. (Free is fully sufficient: DNS hosting, unlimited records, and R2 custom domains are all included. Other zones in the account being on Pro doesn't matter — plans are per-domain.)
4. Cloudflare will scan and auto-import records it can find. **Do not trust the scan to be complete.** Proceed to Phase 2 and reconcile against the full table.
5. Cloudflare will show you two assigned nameservers, e.g. `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. **Write them down** — you'll enter these at GoDaddy in Phase 4. Do NOT change anything at GoDaddy yet.

---



## 4. Phase 2 — Recreate all DNS records in Cloudflare

In Cloudflare: `langquest.org` zone → **DNS** → **Records**. Add/edit until the zone matches this table exactly.

**Critical setting:** every A and CNAME record must be set to **DNS only** (grey cloud icon), NOT "Proxied" (orange cloud). Proxied means Cloudflare sits in front of the traffic, which conflicts with Vercel's own certificate handling. Toggle the cloud icon when creating each record. (MX/TXT records don't have this toggle.)

### 4.1 Websites (Vercel)


| Type  | Name          | Value                                 | Notes                                               |
| ----- | ------------- | ------------------------------------- | --------------------------------------------------- |
| CNAME | `@` (apex)    | `843bfe8b47eb30d6.vercel-dns-016.com` | Apex CNAME via Cloudflare's automatic CNAME flattening. (Migration was initially done with Vercel's three legacy A records — `216.150.1.1`, `76.76.21.21`, `76.76.21.22` — then switched to this CNAME post-flip at Vercel's recommendation, 2026-07-28.) |
| CNAME | `www`         | `843bfe8b47eb30d6.vercel-dns-016.com` | Account-scoped Vercel target                        |
| CNAME | `dev`         | `cname.vercel-dns.com`                |                                                     |
| CNAME | `*` (wildcard) | `cname.vercel-dns-016.com`           | Catch-all: any other subdomain resolves to Vercel   |

The `*` wildcard replicates Vercel's auto-managed wildcard: `app`, `preview.app`, `preview`, `docs`, and any Vercel project domain added in the future all resolve through it with no Cloudflare edit needed. **Do NOT create explicit records for `app`, `preview.app`, `preview`, or `docs`.**

> **How the wildcard works (and its one trap):** a `*` record answers for any subdomain at any depth — but only along paths where no explicit record exists. Explicit records "punch holes" in it: `dev`, `www`, `media` (added later by R2), and the email records all take precedence, which is exactly what we want. The trap: if someone later adds an explicit record for `app`, then `preview.app` is no longer covered by `*` (an explicit node blocks the wildcard for everything beneath it) and would silently break. Rule of thumb: don't add explicit records for names the wildcard already serves.
>
> **Security note:** the wildcard target must be the account-scoped `cname.vercel-dns-016.com`, never the generic `cname.vercel-dns.com` — a generic wildcard target would let anyone claim an unused `*.langquest.org` subdomain on their own Vercel account.



### 4.2 Email — copy exactly; mistakes here silently break invitations/password-reset emails


| Type | Name                | Value                                                                                                                                                                                                                        | Priority |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| MX   | `@` (apex)          | `inbound-smtp.us-east-1.amazonaws.com`                                                                                                                                                                                       | 10       |
| MX   | `send`              | `feedback-smtp.us-east-1.amazonses.com`                                                                                                                                                                                      | 10       |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`                                                                                                                                                                                          |          |
| TXT  | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCfAfy5CrWp13QLFSWM8gju4jkegKQlaOSbFAgtoMLHzTwbDkIU3RuTROf8/jhe++KDNy5pwnnBEy/Z0vAgRSpbNQhXp1LYxF30vqPLtmv/COXqPAhtjxZ5TIdDuYSKKpqLNA+weU5iTd0yluqPYDrc7kW+HN0TssDPu9+w39nTQwIDAQAB` |          |
| TXT  | `_dmarc`            | `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarcreports@langquest.org`                                                                                                                                                     |          |


What these do: apex MX = inbound mail to `@langquest.org` via AWS SES; `send` MX/TXT = Resend's sending subdomain; `resend._domainkey` = DKIM signature key so our emails aren't marked as spam; `_dmarc` = anti-spoofing policy.

### 4.3 Other services


| Type  | Name                        | Value                                                                             | Notes                                                    |
| ----- | --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| CNAME | `documenso`                 | `g6mnecyi.up.railway.app`                                                         | Documenso on Railway                                     |
| TXT   | `_railway-verify.documenso` | `railway-verify=44ac445180b20bf8fdbd8b17b2c376ce639837d6fc3781ad02b4f7999d994b6d` | Railway domain verification                              |
| TXT   | `@` (apex)                  | `_ml8ghewe59n8erd740xpmcg7138nv8a`                                                | Ownership verification for some service; keep            |
| CNAME | `_domainconnect`            | `_domainconnect.gd.domaincontrol.com`                                             | GoDaddy plumbing; harmless to keep                       |
| CNAME | `whm`                       | `langquest.org`                                                                   | Legacy (pre-Vercel leftover); copy as-is, clean up later |
| CNAME | `www.admin`                 | `langquest.org`                                                                   | Legacy; copy as-is, clean up later                       |




### 4.4 CAA records — deliberately SKIPPED

Vercel's zone had auto-managed CAA records (`letsencrypt.org`, `pki.goog`, `sectigo.com`). **Do not recreate them.** No CAA records = any certificate authority may issue (the default for most domains). This guarantees both Vercel's and Cloudflare's certificate renewals keep working. Optionally revisit later to re-add a stricter set.

### 4.5 Delete anything else

If Cloudflare's auto-scan imported records not in the tables above, delete them. The tables are the complete, verified inventory as of 2026-07-28.

---



## 5. Phase 3 — Verify the Cloudflare zone BEFORE flipping

Query Cloudflare's assigned nameservers directly (they answer even before they're live). Replace `xxx.ns.cloudflare.com` with your assigned nameserver from Phase 1:

```bash
NS=xxx.ns.cloudflare.com
dig @$NS +short A langquest.org        # expect: 216.150.1.1, 76.76.21.21, 76.76.21.22
dig @$NS +short CNAME www.langquest.org  # expect: 843bfe8b47eb30d6.vercel-dns-016.com.
dig @$NS +short CNAME dev.langquest.org  # expect: cname.vercel-dns.com.
# The next five all resolve via the * wildcard; each should answer cname.vercel-dns-016.com.
dig @$NS +short CNAME app.langquest.org
dig @$NS +short CNAME preview.langquest.org
dig @$NS +short CNAME preview.app.langquest.org
dig @$NS +short CNAME docs.langquest.org
dig @$NS +short CNAME any-random-name.langquest.org  # wildcard sanity check
dig @$NS +short MX langquest.org       # expect: 10 inbound-smtp.us-east-1.amazonaws.com.
dig @$NS +short MX send.langquest.org
dig @$NS +short TXT send.langquest.org
dig @$NS +short TXT resend._domainkey.langquest.org
dig @$NS +short TXT _dmarc.langquest.org
dig @$NS +short TXT langquest.org
dig @$NS +short CNAME documenso.langquest.org
dig @$NS +short TXT _railway-verify.documenso.langquest.org
```

Every answer must be non-empty and match the tables in Phase 2. **Do not proceed until they all pass.**

---



## 6. Phase 4 — Flip nameservers at GoDaddy

1. Log in to GoDaddy → **My Products** → `langquest.org` → **DNS** / **Manage DNS** → **Nameservers** → **Change Nameservers**.
2. Choose **"I'll use my own nameservers"** (custom).
3. Replace the Vercel nameservers (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`) with the two Cloudflare-assigned nameservers from Phase 1.
4. Save. GoDaddy may ask you to confirm via email.

Nothing breaks at this moment even if propagation is slow: resolvers still holding the old answer ask Vercel (which still has all the records), and resolvers with the new answer ask Cloudflare (which has identical records).

---



## 7. Phase 5 — Post-flip verification

Cloudflare emails you and the zone status changes from "Pending" to **"Active"** — typically within an hour, occasionally up to 24h.

Then check:

1. **DNS answers** (no `@` this time — asks the live chain):
  ```bash
   dig +short NS langquest.org     # expect the two cloudflare nameservers
   dig +short A langquest.org
   dig +short MX langquest.org
  ```
2. **Websites:** load `https://langquest.org`, `https://www.langquest.org`, `https://app.langquest.org`, `https://preview.langquest.org`, `https://docs.langquest.org`, `https://documenso.langquest.org` in a browser.
3. **Vercel:** each project → Settings → Domains → every domain shows **Valid Configuration**. If one complains, add/adjust the exact record Vercel displays (in Cloudflare now, DNS only/grey cloud).
4. **Email (the important one):** trigger a real password-reset email from the production app and confirm it arrives in an inbox (check spam folder — if it lands in spam, the DKIM record in §4.2 is wrong). Send an email TO `team@langquest.org` and confirm it's received.
5. **Resend dashboard:** [resend.com](https://resend.com) → Domains → `langquest.org` should still show verified/green.

---



## 8. Phase 6 — The payoff: attach media.langquest.org to R2

1. Cloudflare dashboard → **R2 Object Storage** → the production bucket (`langquest-attachments-production`).
2. **Settings** → **Custom Domains** → **Connect Domain**.
3. Enter `media.langquest.org` → Continue → Cloudflare shows the CNAME it will add to the zone automatically → **Connect Domain**.
4. Wait for status **Active** (usually minutes; issues a TLS certificate automatically).
5. Test: upload any test object to the bucket, then open `https://media.langquest.org/<object-key>` in a browser.
6. Repeat for the preview bucket if desired, e.g. `media-preview.langquest.org` → `langquest-attachments-preview`.

Record the final public base URLs; the app will consume them via env vars (e.g. `EXPO_PUBLIC_R2_PUBLIC_URL`) in the next migration step.

Optional hardening (later): enable Smart Tiered Cache and a Cache Everything rule for the media hostname to cut R2 reads.

---



## 9. Rollback

At GoDaddy, change the nameservers back to `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. Vercel's zone still holds the original records (don't delete anything in Vercel's DNS dashboard until the Cloudflare setup has been stable for a couple of weeks). Propagation applies again (minutes to hours). Note `media.langquest.org` stops working on rollback — it only exists in the Cloudflare zone.

---



## 10. Aftercare

- Leave the Vercel DNS records untouched for ~2 weeks as a rollback safety net, then optionally tidy.
- New Vercel subdomains (e.g. `staging.langquest.org`) are covered automatically by the `*` wildcard — just add the domain in the Vercel project and check it shows "Valid Configuration". Only add an explicit Cloudflare record if Vercel explicitly asks for a different value, and remember the wildcard trap from §4.1: an explicit record at a name blocks wildcard coverage for everything beneath it (explicit `app` would break `preview.app`).
- DNS record changes are now made in the Cloudflare dashboard (DNS → Records), not Vercel.


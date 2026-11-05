---
publish: true
id: prd.synergy.one-repo.ticket-08
title: Where the App Lives
created: 2026-11-03
kind: plan
type: grilling
blocked_by:
   - one-repo-02-app-under-the-same-domain
status: closed
assignee: claude
updated: 2026-11-05
tags:
   - prd
   - synergy
   - one-repo
   - wayfinder
---

## Question

With the routing options researched, does the App live at `ossidekick.com/app` (the handover) or `app.ossidekick.com`? When does it need a public address at all, given that it has none today? Until this is settled, the header's App link is a config constant.

## Resolution

Grilled with Pratik on 2026-11-05. The App lives at **`app.ossidekick.com`**, gets that address at the cutover, and the public site shows **no App link until Open House**.

### Address

`app.ossidekick.com`, a Vercel custom domain behind a DNS-only CNAME, as the research recommends ([The App Under the Same Domain](one-repo-02-app-under-the-same-domain.md)): no proxy, so Vercel's CDN, client IPs and cache purge keep working, and no `basePath`. The `apps/app` folder is already named for this address. `ossidekick.com/app` stays possible later as a script on the site's Worker ([Pages or Workers for the Site](one-repo-11-pages-or-workers.md)).

### When

The App does have an address today: Vercel's stable production URL, `sidekick-six-bay.vercel.app`. It gains `app.ossidekick.com` at [The Cutover to ossidekick.com](one-repo-10-cutover.md), the day the site moves there:

1. A DNS-only `app` CNAME to Vercel on the ossidekick.com zone, and the domain added to the Vercel project.
2. `NEXT_PUBLIC_APP_URL` set to `https://app.ossidekick.com`.
3. Supabase: the Site URL becomes `https://app.ossidekick.com`, and the Redirect URLs allow list keeps the `vercel.app` URL, localhost and the preview pattern beside it.

### No App link until Open House

The App is single-user until Open House (Phase 11, deferred), but its sign-up is open: `/signup` calls `supabase.auth.signUp`. An "App ↗" link in the public header would invite every visitor to make an account nobody planned for, or, with sign-up closed, lead to a sign-in page they cannot use.

- The header's App link is a config constant that is empty until Open House, and the header renders no link while it is empty. Pratik reaches the App from a bookmark.
- Separately, Pratik turns off "Allow new users to sign up" in Supabase's Auth settings, because the `vercel.app` URL is public whether or not the site links to it. Open House turns it back on along with the link.
- The handover's mobile menu loses its App row for the same reason.

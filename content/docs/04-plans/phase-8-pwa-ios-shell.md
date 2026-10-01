---
publish: true
id: plan.phase-8-pwa-ios-shell
created: 2026-09-19
kind: plan
version: 1.0.0
tags:
   - plan
   - living-plan
   - phase-8
   - taxila
   - alter-ego
   - nextjs
   - vercel
   - pwa
   - mobile
status: planned
depends_on:
   - "[[04-plans/phase-7-war-room-factory-v1]]"
---

> **Milestone:** The app is installable on your iPhone. It works as a PWA in the browser and as a side-loaded Capacitor app.
> **Learning payoff:** Service workers, PWA manifest, Capacitor, mobile UX constraints.

| #    | Task                                                                     | Complexity | Learning |
| ---- | ------------------------------------------------------------------------ | ---------- | -------- |
| 8.1  | Install and configure `Serwist` for service worker support in `apps/web` | 🟡         | 📱       |
| 8.2  | Create `manifest.json` — app name, icons, display mode, theme color      | 🟢         | 📱       |
| 8.3  | Configure offline asset caching strategy in the service worker           | 🟡         | 📱       |
| 8.4  | Test PWA install flow in Chrome DevTools and on iPhone via Safari        | 🟢         | 📱       |
| 8.5  | Audit mobile UI — touch targets, viewport, safe areas, keyboard behavior | 🟡         | 📱 🎨    |
| 8.6  | Initialize Capacitor in `apps/web`                                       | 🟡         | 📱       |
| 8.7  | Configure Capacitor to point at the hosted Vercel Next.js URL            | 🟡         | 📱       |
| 8.8  | Build and side-load the iOS app onto your iPhone using Xcode             | 🟡         | 📱       |
| 8.9  | Test core flows (login, palette, Taxila, Alter Ego chat) on device       | 🟢         |          |
| 8.10 | Handle iOS safe area insets in the layout                                | 🟡         | 📱       |

**Phase 8 Exit Criteria:** App is installable as a PWA from Safari, side-loadable as an iOS app via Capacitor. Core features work on-device.

---

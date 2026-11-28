# Kilo Code prompt: upgrade Fab Hub

## Context
Fab Hub is my vanilla web app: a store of web apps plus a browser-in-a-browser, installable as a PWA. Search finds catalog apps and sites. Any site can be opened in a tab, added to "My Apps", or installed to a phone home screen with its own icon, name and colors through a generated wrapper PWA at `/a/<slug>`.

Stack and rules (do not change these):
- Plain HTML, CSS and JavaScript. No framework and no build step.
- Vercel serverless functions in `/api` (Node 18+, CommonJS). Shared helpers live in `api/_lib.js`.
- Files: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.json`, `catalog.json`, `vercel.json`, `icons/`.
- Keep every existing feature working: search, store grid, tabs, My Apps, press-and-hold reorder, install page, offline shell.
- Escape all user content. Keep the SSRF checks in `safeUrl`. Never store secrets in client code.
- Work in small steps. After each phase, list what changed and give me a manual test checklist. Do not start the next phase until I confirm.

## Phase 0: fix first
1. Search must never leave the screen blank. If `/api/*` fails (for example under Live Server), fall back to filtering `/catalog.json` locally and show a small notice "Running without the API, so web search and site details are unavailable".
2. Show a loading state while searching and a clear empty or error state afterwards. Ignore stale responses.
3. Add a root `npm run dev` script that runs `vercel dev`, and document it in the README.

## Phase 1: core upgrades
1. **Custom icons and names.** In edit mode, tapping a tile opens a sheet to rename the app, paste an icon URL, upload an image (resize to 192px, store as a data URL), pick a brand color, and reset to the detected icon.
2. **Trash.** Removing an app moves it to Trash. Add a Trash view with Restore and Delete forever, and auto-purge after 30 days.
3. **Search My Apps.** Typing also filters My Apps and Recents, shown above the store and web results.
4. **Restore session.** Save open tabs and the active tab to storage and reopen them on launch. Third-party pages cannot report their current URL, so restore each app's start URL only.
5. **Brand status bar.** When a tab is active, set `<meta name="theme-color">` to that app's color. Restore it when the viewer closes.
6. **Offline page.** Add `offline.html`, precached by the service worker. Show it in the viewer when the device is offline or the page fails to load, with Retry and Open in new tab.
7. **Share target.** Add `share_target` to `manifest.json` (GET, params `url` and `text`) so a URL shared from the phone's share sheet opens Fab Hub's add flow for that site.
8. **App shortcuts.** Add manifest `shortcuts` for My Apps and Search.

## Phase 2: viewer features
1. **Fullscreen/kiosk mode.** A button that uses the Fullscreen API and hides the top bar. A small floating handle brings it back.
2. **Force dark mode** per app (toggle). Apply a CSS filter to the iframe (`invert(1) hue-rotate(180deg)`) and keep images and videos natural where possible.
3. **Keep screen awake** toggle using the Screen Wake Lock API, released when the tab closes.
4. **Split view.** Allow 2 panes (side by side on wide screens, stacked on phones) with a draggable divider. Each pane picks an open tab.
5. **Tab suspend.** Tabs inactive for 5 minutes drop their iframe `src` to save memory and reload when selected. Keep a "suspended" dot on the tab.
6. **Pull to refresh** and a pinch-free back/forward where the platform allows. Skip anything the cross-origin sandbox blocks and tell me what was skipped.
7. **Blocked-site handling.** When a site refuses embedding, show why (from the headers) and offer: open in new tab, install as a wrapper PWA, or add anyway.

## Phase 3: organization and safety
1. **Folders and categories** in My Apps: drag one tile onto another to make a folder, with rename. Keep the wobble and reorder.
2. **Export and import** My Apps and settings as JSON.
3. **App lock** (optional per app): require WebAuthn platform authentication (fingerprint, face or device PIN) before opening. If WebAuthn is unavailable, hide the option.
4. **Theme setting:** system, light, dark.
5. **Onboarding:** a 3-step first-run intro that includes the iPhone "Share, then Add to Home Screen" guide.
6. **Accessibility pass:** labels, focus states, keyboard shortcuts (Ctrl+K search, Ctrl+W close tab, Ctrl+Tab next tab).

## Phase 4: accounts and community (ask me before starting)
1. Supabase accounts with cloud sync for My Apps, folders and settings.
2. User-submitted catalog entries with moderation, a report button, and a blocklist of banned domains, all in a Supabase table behind `/api` routes.
3. Shareable app pages at `/a/<slug>` with an install button, QR code and Open Graph tags.
4. Basic analytics: counts of opens and installs per app, with no personal data.

## Done means
- No console errors on a clean load, in Chrome on desktop and Android and in Safari on iPhone.
- Lighthouse PWA checks pass for the shell.
- A short CHANGELOG.md entry for each phase.

# CHANGELOG

## Part A — Global Theme System
- **CSS variables**: All colors defined on `:root` (light) and `:root[data-theme="dark"]` — no hardcoded colors in stylesheet.
- **Three theme modes**: System (default, follows OS), Light, Dark. Persisted in `localStorage` as `fabhub-theme`.
- **No-flash theme**: Inline script in `<head>` applies theme before first paint on every page (landing, app, offline, privacy, terms).
- **Theme toggle**: Sun/moon button in landing header and app header. Cycles System → Dark → Light.
- **`<meta name="theme-color">` sync**: Updates on theme change; keeps per-app brand color when viewer tab is active.
- **200ms transitions** on background/color only. Respects `prefers-reduced-motion`.
- **Input visibility**: Search input and all form fields have explicit `caret-color`, `-webkit-text-fill-color`, placeholder styling for both themes.
- **Landing theme preview**: "Try Light / Dark" button in hero toggles page theme live.

## Fixes — Search & Icons
- **Search input stability**: Search input (`#q`) is created once in HTML and never re-rendered. Debounced at 250ms with request sequence guard to ignore stale responses. Falls back to local `catalog.json` filtering when `/api/search` fails.
- **Keyed tile rendering**: `fill()` now reuses existing tile elements by `data-url` instead of `replaceChildren()` + new elements. Prevents `NS_BINDING_ABORTED` on favicon loads during typing; only updates changed tiles.
- **Icon proxy endpoint**: `/api/icon?domain=` fetches favicons server-side (with SSRF checks via `safeUrl`), tries `<link rel="icon">`, `/favicon.ico`, then Google favicon service. Returns image bytes directly with `Cache-Control: public, max-age=86400` — no redirects, no CORP blocks.
- **Client icon resolution**: `resolveIcon()` prefers custom user icon → cached favicon URL → `/api/icon?domain=` → generated letter tile. `onerror` falls back to letter tile.
- **All API paths relative**: No hardcoded ports; works on any origin.

## Part C — Main App Shell Redesign (iPhone-style Home)
- **Home screen grid**: 4-col on phones, 5-col ≥600px, 6-col ≥900px, 7-col ≥1200px. Rounded-square icons with real favicons, names underneath, wobble animation in edit mode.
- **Pull-down search**: Pull the home grid down to reveal search bar with live results (apps + recents + web). Also accessible via Search dock button and `/` keyboard shortcut.
- **Floating bottom dock**: 5 buttons — Home, Add (+), Current app (shows its favicon), Search, Settings. Center button highlights active app. Respects `safe-area-inset-bottom`.
- **App Library**: Auto-grouped categories (Social, Work, Tools, School, Other) + A-Z list. Searchable. Opens from dock or swipe gesture.
- **Add flow**: Paste URL → auto-fetch favicon, clean name (strips "Home |", " - Official Site", etc.), brand color → preview tile → edit name/icon/color → confirm. Upload custom icon (resized to 192px, stored as data URL).
- **Fullscreen viewer**: Edge-to-edge iframe with floating handle. Tap handle or swipe down to reveal controls (back, reload, tab switcher, close). Shows app title + URL.
- **Tab switcher**: Card grid with live previews, close buttons. Keyboard shortcut `T`.
- **Settings sheet**: Theme (System/Light/Dark), search engine, export/import JSON, clear all data, about/links.
- **Per-app settings**: Open fullscreen by default, force dark mode, keep awake (Wake Lock API), lock (placeholder).
- **Keyboard shortcuts overlay**: Press `?` to see all shortcuts (`/` search, `Esc` close, `N` add, `S` search, `,` settings, `←/→` back/forward, `R` reload, `T` tabs, `W` close tab).
- **Toasts**: Non-blocking notifications for add, remove, restore, import/export, errors.
- **Edit mode**: Press-and-hold any tile → wobble + delete buttons → drag to reorder across pages. Order persists.
- **Page dots**: Indicator when multiple home pages exist.
- **Responsive**: Works at 360px and 1280px in both themes. `prefers-reduced-motion` disables animations.

## Phase 1 — Core Upgrades
- **Custom icons and names**: Edit mode opens a sheet to rename the app, paste an icon URL, upload an image (resized to 192px, stored as data URL), pick a brand color, and reset to the detected icon.
- **Trash**: Removing an app moves it to Trash. Trash view with Restore and Delete forever. Auto-purge after 30 days.
- **Search My Apps**: Typing filters My Apps and Recents, shown above Store and Web results.
- **Restore session**: Open tabs and active tab saved to localStorage and reopened on launch (start URLs only).
- **Brand status bar**: `<meta name="theme-color">` set to active tab's app color; restored on viewer close.
- **Offline page**: `offline.html` precached by service worker. Shown in viewer when offline or page fails to load, with Retry and Open in new tab.
- **Share target**: Added `share_target` to `manifest.json` (GET, params `url` and `text`) so shared URLs open Fab Hub's add flow.
- **App shortcuts**: Added manifest `shortcuts` for My Apps and Search.

## Phase 0 — Fixes
- **API fallback**: Search falls back to filtering `/catalog.json` locally when `/api/*` fails, with notice "Running without the API, so web search and site details are unavailable".
- **Loading state**: Shows "Searching…" while searching; clear empty/error states after.
- **Stale response guard**: Ignores stale search responses via request ID counter.
- **Dev script**: Added `npm run local` script running `vercel dev`; documented in README.
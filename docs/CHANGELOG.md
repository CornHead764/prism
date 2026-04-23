# Changelog

All notable changes to Prism are documented in this file.

## [Unreleased]

## [1.5.2] – 2026-04-22

### Bug Fixes
- **PWA tiles — weather blank**: Weather tile was reading a flat data shape; fixed to use the correct nested `WeatherData.current.temperature/condition/description` structure.
- **PWA tiles — meals wrong**: Meals tile (and rows-mode meals card) matched any meal with today's day name across all historical weeks. Now filters to the current week before looking up today's meal.
- **PWA tiles — bus 404**: Bus tile linked to `/bus` which does not exist. Removed the link; tile now shows status inline with no navigation chevron.

## [1.5.1] – 2026-04-19

### Bug Fixes
- **Shopping — category colors missing**: Grocery categories (produce, bakery, meat, dairy, frozen, pantry) were silently stripped from saved settings, causing list cards to render grey with no color and no Add Item button. Restored full category list in DB and made the hook backfill any missing defaults on load so this can't recur.
- **Shopping — category validation**: API rejected items added to general lists (Target, etc.) with non-grocery categories (clothes, housewares, etc.) because the Zod schema used a closed enum. Changed to `z.string()` to match the open-ended category system.
- **Shopping — duplicate New List button**: Removed the redundant New List button from the list tabs toolbar; the one in the top-right header is sufficient.

## [1.5.0] – 2026-04-19

### Features
- **Weekend Ideas**: New `/weekend` page — a family activity board for local places to visit. Add places to a backlog, mark them visited with a 1–5 star rating, flag favorites, and tag them (outdoor, nature, hike, food, museum, farm, etc.). Visit frequency shown as pip dots grouped in 5s. Filters for status, favorites, tags, and search. Side-panel detail view with edit, mark-visited, and favorite actions. Phase 2 (POI search + map) coming next.
- **Weekend Ideas — group by tag**: Place cards are grouped into tag-category sections (emoji header + count) so you can scan by activity type at a glance. Untagged items fall into an "Other" bucket.
- **Travel Map — GPS photo linking**: Geotagged OneDrive photos are automatically matched to nearby travel pins. The pin detail panel shows a photo strip of matching shots within a configurable radius (default 50 km). Photos can be browsed via a lightbox.
- **Travel Map — re-locate pin**: Pencil icon next to a pin's coordinates opens an inline geocode search — search for a new location and pick a result to update the pin's lat/lng and place name in place (fixes pins dropped in the wrong location).

### Bug Fixes
- **Travel Map — globe longitude drift**: Rotation formula now normalizes center longitude to −180..180 — fixes pins appearing in wrong ocean locations (e.g., Gulf of Mexico instead of Sanibel Island) due to accumulated coordinate drift.
- **Travel Map — far-side pin culling**: Hidden pins now use a CSS class with `!important` flags so MapLibre styles can't override visibility — fixes pins remaining visible behind the Earth.
- **Weekend — side nav missing**: WeekendView was missing its `<PageWrapper>` wrapper, causing the side nav to disappear when navigating to the Weekend page.

### Improved
- **Nav icons**: Chores icon changed to `ListChecks` (multi-check) to better differentiate from Tasks (`CheckSquare`); Weekend icon changed to `Trees`.
- **Travel Map — globe initial zoom**: Default zoom adjusted so the Earth nearly fills the screen on load.

## [1.4.0] – 2026-04-18

### Features
- **Travel Map — Trips**: Multi-stop trip system with three styles — **Route** (A→B→C polyline), **Loop** (closed polyline returning to start), and **Hub** (home base + day-trip spokes). Trips are a first-class object separate from standalone place pins.
- **Travel Map — trip globe rendering**: All trips are always visible on the globe. Inactive trips render as small faded colored dots + thin low-opacity connecting lines. The active (selected) trip shows full numbered markers and a bright dashed line. Clicking any faint dot selects that trip.
- **Travel Map — national parks in trips**: Trips support national park stops alongside regular stops. NP stops display a green tree icon in the stop list instead of a number badge.
- **Travel Map — Place/Trip toggle**: The slide-out panel now shows a segmented Place/Trip toggle when adding something new, so you can switch between adding a standalone place and creating a trip without leaving the panel.
- **OneDrive photo sync — folder picker**: Settings now includes a folder picker so you can select which OneDrive folder to sync photos from, rather than defaulting to the root.
- **Photos — GPS backfill**: New `/api/photos/backfill-gps` endpoint reads GPS EXIF from already-synced photos and writes coordinates back to the database without re-downloading files.

### Bug Fixes
- **OneDrive OAuth callback**: Fixed "fetch failed" error caused by Docker's bridge network not routing IPv6. A `undici` global dispatcher now forces IPv4 for all `fetch()` calls inside the container.

## [1.3.0] – 2026-04-16

### Features
- **Travel Map — Phase 1**: Interactive globe (MapLibre GL + OpenFreeMap tiles, globe projection) for tracking family travel. Pins use a drop-pin SVG marker anchored at the coordinate tip; root locations use colored drop pins (green checkmark = visited, white dot = want-to-go, amber star badge = bucket list, green tree badge = has national parks); child stops use purple circles, national parks use green circles.
- **Travel Map — pin management**: Full inline editing in the detail panel — name, trip label, status toggle (auto-saves), bucket list star (auto-saves), visit dates, description, and tags. No separate edit modal.
- **Travel Map — stops & parks**: Add stops via Nominatim geocode search or add national parks from a curated NPS list; sub-locations displayed as a combined drag-to-reorder list; connecting lines drawn from parent pin to selected children on the globe.
- **Travel Map — Places tab**: Sortable list with stats bar, text search, filter pills (All / Been There / Want to Go / Bucket List / Has NP), and group-by (Year / Country / None) with country flag emoji. Selecting a place switches to the globe and opens its detail panel.
- **Travel Map — dark map mode**: Moon/sun toggle button on the globe applies a CSS filter (`brightness · saturate · contrast · hue-rotate`) only to the map canvas — tiles darken while all markers stay at full brightness, and no tile reload is required.
- **Travel Map — geocoding**: Nominatim proxy at `/api/travel/geocode` with Hawaiian island aliases, special-character normalization, and national park search scoring (boundary/park results ranked above natural features like volcano summits).
- **Tasks**: Person→List and List→Person nested group modes — primary group cards with sub-group sections inside (colored left-border dividers, per-sub-group badge counts). Available in the Group dropdown when task lists exist.
- **Undo Stack**: Global undo across shopping, tasks, wishes, and chores — undo button in the nav bar reverses the most recent mutation.
- **Dashboard Editor**: Transparent background mode — widget cards can render over the grid background image without a double-card effect.
- **Dashboard Editor**: Per-widget text color and opacity controls.
- **Dashboard Editor**: Custom color picker for theme palette swatches.
- **Dashboard Editor**: Grid line opacity and cell background color/opacity controls for calendar and weather widgets.
- **Camera Scanner**: Scan product barcodes with phone/tablet camera on the Shopping page — camera icon in header opens full-screen scanner overlay; automatically looks up product on Open Food Facts and adds it to the active list.
- **Docker**: Multi-arch builds (amd64 + arm64) — Raspberry Pi support via pre-built GHCR image.
- **Health check**: `GET /api/health` now probes PostgreSQL and Redis — returns 503 with `status: "degraded"` if either is down (previously always returned 200).
- **Calendar**: Profile columns now follow family member sort order from Settings; Family calendar group always sorts first before person columns.

### Improved
- **Tasks**: Group control split into a "Group" primary select and a "Then by" secondary select — the nested `Person → List` / `List → Person` arrow-notation options are replaced by two independent dropdowns.
- **Chores**: "Group by Person" toggle replaced with a consistent "Group" dropdown (None / Person) matching Tasks' style.
- **Calendar**: Day view and week view hourly rows now expand to fill available widget/subpage height — `1fr` grid rows scale proportionally instead of using a fixed minimum.
- **Bus Tracker**: Train map switches to 2-row snake layout when 6+ nodes — top row left→right, bottom row right→left, connected by a right-side vertical segment.
- **Bus Tracker**: PM route at-school status now shows "Bus at school — en route" instead of a bogus 0-minute ETA.
- **Bus Tracker**: Route dialog "Scheduled" field renamed to "Home ETA" with helper text clarifying it is the expected arrival time at your stop.
- **Bus Tracker**: Large minute values now display as hours and minutes (e.g., "15h 25m" instead of "925m").
- **README**: Replaced GIF demos with static screenshots for faster loading.

### Bug Fixes
- **Auth cookie secure flag**: Login route now detects HTTPS per-request via `X-Forwarded-Proto` header instead of a global `isSecure` flag derived from `APP_URL` — fixes "Log in to make changes" errors when accessing via `http://localhost:3000` while `APP_URL` pointed at the HTTPS public domain.
- **Travel Map — pin creation validation**: Zod schema now accepts `null` (not just `undefined`) for all optional fields — fixes "Something went wrong" when creating a new place.
- **Hawaii Volcanoes location**: Nominatim search for national parks now prefers boundary/park-type results over natural features — fixes Hawaii Volcanoes appearing at the volcano summit rather than the park centroid.
- **Bucket list unstar persistence**: Star and status toggles now auto-save immediately on click rather than requiring the Save button — fixes unstar/status changes being lost on navigation.
- **Microsoft OAuth callback**: Removed `requireAuth` requirement on the callback route — Microsoft redirects without a Prism session cookie, causing the connection flow to fail silently. Success/error toasts now display in Settings → Connected Accounts.
- **Performance mode**: Removed animation stripping (transitions run on the compositor thread and don't cause CPU overhead); caps transitions at 150ms so the UI remains responsive without looking broken. Fixes washed-out surfaces when backdrop-blur is disabled.
- **Virtual Keyboard**: Tapping a key no longer dismisses the keyboard after one character — `preventDefault` on `pointerDown` keeps focus in the active input field.
- **Virtual Keyboard**: Toggle button now appears correctly on touchscreen laptops where Windows converts touch events to mouse events (uses `navigator.maxTouchPoints` instead of pointer type tracking).
- **Virtual Keyboard**: Reduced height from 38vh to 32vh — less intrusive on 1080p displays.
- **Virtual Keyboard**: Scroll position no longer jumps after voice input adds a new list item — scroll restore is skipped when text was injected while the keyboard was open.
- **Camera Scanner**: Overlay now self-dismisses immediately after a successful scan; haptic feedback on successful scan; iOS AudioContext unlocked synchronously on "Open Camera" tap.
- **UI**: Desktop/laptop font size reduced to 14px base (via `pointer: fine` media query) — previously used the same 16px as touch displays.
- **Calendar**: Day name headers rotate correctly when week starts on Monday.
- **Mobile**: Navigation no longer causes flash/slide animation on page transitions.
- **Docker**: App health check uses node instead of curl; fresh install schema fixed; `VirtualKeyboard` and `CameraScannerOverlay` loaded via `next/dynamic` with `ssr: false`.
- **Database**: Truncate operation now includes all tables (gift_ideas, calendar_notes, wish_items, bus_tracking, audit_logs).
- **CI**: GitHub Actions upgraded from Node.js 20 to 22; layout validation size constraints downgraded to warnings.

### Infrastructure
- **Automatic database migrations**: Schema changes now apply automatically on container startup via `scripts/migrate.js`. Users update by running `./scripts/update.sh` (or `git pull && docker-compose up -d --build`) — no manual database commands required. `drizzle/0000_upgrade.sql` brings any existing installation (regardless of age) to the current schema; future changes go in numbered `drizzle/NNNN_description.sql` files.

### Security
- **CSRF**: Next.js middleware validates `Origin` header on all API mutations — cross-origin requests blocked at the edge (away-mode auto-activation exempt).
- **WiFi config**: Password now stored AES-256-GCM encrypted in the database; decrypted on read with backward-compat for existing plaintext rows.
- **Backups**: `PGPASSWORD` moved from inline shell string to process env — prevents credential leakage in process listings.
- **Babysitter info**: Sensitive section content now requires authentication (`includeSensitive=true` requests gated behind `requireAuth`).
- **Paprika import**: HTML payload capped at 5 MB — prevents memory exhaustion from oversized uploads.
- **Centralized cache invalidation**: New `invalidateEntity(entity)` helper in `src/lib/cache/cacheKeys.ts` replaces 166 ad-hoc `invalidateCache('entity:*')` calls across 65 files; cross-entity dependency graph ensures chore completions also clear points/goals cache.
- **Redis-down 503**: `validateSession` now returns a discriminated union `{ ok, reason }` — Redis unavailability returns 503 ("service unavailable") instead of 401 ("please log in"), preventing confusing auth errors during infra outages.
- **Request ID middleware**: All API responses include `x-request-id` header (24-char hex UUID); propagated into `logError()` for log correlation across distributed traces.
- **`/api/health/deep`** (parent-auth): Deep health check verifying DB, Redis, last backup recency, and OAuth token expiry; triggers optional `ALERT_WEBHOOK_URL` notification on degradation.
- **`apiError()` helper**: Standardized error responses via `src/lib/api/apiResponse.ts` — `{ error: { code, message } }` shape with typed codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`.
- **withAuth migration**: birthdays, calendar-notes routes migrated from raw `requireAuth` boilerplate to `withAuth` wrapper.
- **API token scopes**: `scopes` JSONB column added to `api_tokens` table (default `["*"]` = full access); `withAuth` now enforces scope on API token requests; existing tokens unaffected.
- **Rate limiting**: In-memory fallback limiter — rate limits now enforced even when Redis is unavailable (previously all requests passed through).
- **Backups API**: `POST /api/admin/backups` rate-limited to 5 per hour per user.
- **API**: `GET /api/settings`, `GET /api/settings/wifi`, and `POST /api/shopping/scan` now require display/full auth — previously exposed unauthenticated.

### Performance
- **FamilyProvider**: Equality check on polling results before calling `setMembers` — prevents unnecessary re-renders across all consumers on every 10-minute poll when data is unchanged.
- **CLS fix**: `AppShell` no longer removes `ml-16` from `<main>` when auto-hide fires — SideNav is `position:fixed` so layout should never shift; eliminates CLS spike caused by the 10-second auto-hide timer (CLS 0.337 → 0.07).
- **Caching**: Messages, Tasks, and Photos GET endpoints now cache responses in Redis (60s / 60s / 300s TTLs) — reduces DB load on frequently-polled dashboard data.
- **Visibility polling**: `useCalendarEvents` and `usePhotos` now use `useVisibilityPolling` — polling pauses when the browser tab is hidden.
- **Images**: Replaced raw `<img>` tags with `next/image` (lazy loading, layout stability) in RecipeCard, RecipeDetailModal, and all four nav components.

### Quality
- **BabysitterModeOverlay**: `useBabysitterInfo` and `useWifiConfig` now skip authenticated endpoints when babysitter mode is inactive — eliminates 401 console errors and network failures in Lighthouse best-practices audit (best-practices 96 → 100).

### Tests
- **API error shape** (19 tests): every error code maps to correct HTTP status; `{ error: { code, message } }` shape enforced; `apiSuccess` coverage.
- **Cache cross-dependency** (14 tests): `invalidateEntity('chores')` cascades to points/goals; visited-set prevents double-invalidation; `invalidateEntities` shares visited set across entities.
- **Middleware request ID** (8 tests): `x-request-id` generated and propagated; CSRF blocks mismatched origin; exempt paths pass through; 403 responses still carry the ID.
- **Redis-down degradation** (7 tests): `validateSession` returns `unavailable` vs `invalid`; `requireAuth` returns 503 not 401 on Redis outage; `optionalAuth` degrades to null.
- **PinPad behavioral** (21 tests): member selection, digit entry, backspace, auto-submit, wrong PIN error, keyboard input, cancel, demo mode.
- **Shopping widget behavioral** (10 tests): check/uncheck items, optimistic update, progress bar ratio, list switching, all-checked, empty state.
- **OAuth token expiry** (10 tests): calendar/photo tokens expiring soon → warn; stale/missing backup → warn; Redis/DB down → degraded 503; auth enforcement.
- **Integration tests** (8 tests, `jest.integration.config.js`): events CRUD, chore completion flow with cascade, auth session create/validate/invalidate against real `prism_test` database.
- **Auth enumeration**: Jest tests verify requireAuth routes return 401 and getDisplayAuth routes are correctly guest-accessible (`src/app/api/__tests__/authEnumeration.test.ts`).
- **Widget smoke tests**: 14 render tests for ChoresWidget, TasksWidget, ShoppingWidget covering empty state, data display, and filtering (`src/components/widgets/__tests__/widgetRender.test.tsx`).
- **Jest config**: Added `.test.tsx` to testMatch; ts-jest now overrides `jsx: react-jsx` for component test files.

### Refactored
- **TasksView** (943→235 lines): extracted `TaskRow`, `GroupedTaskGrid`, `NestedGroupedTaskGrid`, `TaskContentArea`, `useTaskGrouping`, `taskGroupTypes` — all files under 250 lines.
- **ChoresView** (632→213 lines): extracted `ChoreGroupCard`, `ChoreGroupGrid`, `ChoreCompletionsList`, `useChoreModals`.
- **LayoutEditor** (901→228 lines): extracted 10 sub-components and hooks — toolbar sections, dashboard manager, measure mode, popover wrapper, shared types.
- **PinPad** (648→164 lines): extracted `usePinPad`, `NumberPad`, `MemberSelection`, `PinDisplay`.
- **Days**: Consolidated 8 inline day-of-week arrays across calendar views, chore modals, WeatherWidget, and the OpenWeather integration into shared `DAYS_SHORT_ARRAY`, `DAYS_LONG_ARRAY`, and `DAYS_SINGLE_ARRAY` constants in `src/lib/constants/days.ts`.
- **CalendarWidget**: Extracted `useCalendarWidgetPrefs` hook (view state, navigation, localStorage persistence) and `CalendarWidgetControls` sub-component — main component reduced from ~357 to ~200 lines.
- **Widgets**: Added `useMemo` for filter/sort chains and `useCallback` for event handlers in ChoresWidget, TasksWidget, ShoppingWidget, and MealsWidget.

### Docs
- **CLAUDE.md**: Added API error standardization, cache invalidation, auth degradation, testing, and request ID guidelines.
- **API auth levels**: Added `docs/api-auth-levels.md` documenting the auth requirement (Public / Display / Auth / Parent) for every API route.

---

## [1.2.0] - 2026-03-29

### Added
- **Google Tasks**: Bidirectional sync with Google Tasks — OAuth flow, list selection, task sync provider
- **Google Tasks**: Google Tasks option in Settings → Task Sync provider picker alongside Microsoft To-Do
- **Google Tasks**: Connected Accounts page dynamically shows "Used for: Calendars, Tasks" when Google Tasks connected
- **Mobile PWA**: Floating action button (FAB) replaces bottom nav bar — Home, Reorder, Settings, Login
- **Mobile PWA**: Dashboard card reorder mode (FAB → Reorder) with drag pills and amber indicator
- **Mobile PWA**: Card visibility settings (FAB → Settings) to show/hide dashboard cards
- **Mobile PWA**: All widget cards available — bus tracker, goals, wishes, photos, clock
- **Mobile PWA**: Screensaver and away mode auto-disabled on PWA (useIsPWA hook)
- **Mobile PWA**: Meals touch-drag between days on mobile
- **Mobile PWA**: Light/dark PWA icon variants, apple-touch-icon support

### Improved
- **Mobile PWA**: All grouped list pages (Tasks, Chores, Shopping, Wishes, Gift Ideas) use single-column on mobile
- **Mobile PWA**: Calendar simplified — short date, Day/Agenda toggle, no filter pills, read-only
- **Mobile PWA**: Messages important/expires badges on own line, edit/delete buttons visible on mobile
- **Mobile PWA**: Shopping extra bottom padding so FAB doesn't overlap last item
- **Mobile PWA**: GripVertical drag icons hidden on mobile across all list pages
- **Mobile PWA**: Card-level drag disabled on mobile to prevent scroll interference
- **Mobile PWA**: Body overflow-hidden changed to md:overflow-hidden for mobile scrolling

## [1.1.0] - 2026-03-16

### Added
- **Gift Ideas**: New "Gift Ideas" tab on the Wishes page — private per-user gift tracking for other family members
- **Gift Ideas**: Per-person columns with quick-add, edit, delete, and purchased toggle
- **Gift Ideas**: Privacy-enforced — only the idea creator can see their ideas; recipients never see them
- **Mobile PWA**: Compact subpage headers on mobile (reduced height, smaller text, hidden icons)
- **Mobile PWA**: Collapsible filter bars on mobile — tap "Filters" to expand/collapse
- **Mobile PWA**: Mobile dashboard — summary card layout with weather, calendar, chores, tasks, shopping, meals, messages, birthdays
- **Settings**: "Week Starts On" toggle (Sunday/Monday) in Settings → Display — controls calendar week boundaries, weekly goal resets, point counters, and meal planning weeks
- **Chores**: Reset Day picker in Add/Edit Chore modals — set which day weekly chores reset (Sun-Sat), day-of-month for monthly, or MM-DD for annual
- **Goals**: Seasonal celebration animations when a goal is fully achieved — week-based holidays: Valentine's, St. Patrick's, Easter, Spring, Memorial Day, July 4th, Halloween, Thanksgiving, Christmas, New Year's (plus default trophy)
- **Messages**: Inline edit support — pencil icon on hover, click to edit in place, Ctrl+Enter to save
- **Calendar Notes**: Day-tied notes panel on calendar widget list and day views — click the sticky note icon to toggle
- **Calendar Notes**: Inline contentEditable editing with auto-save (2s debounce + save on blur)
- **Calendar Notes**: Formatting shortcuts: Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+Shift+S strikethrough, Ctrl+Shift+L bullet list, `- ` auto-converts to list
- **Calendar Notes**: Notes column aligns row-by-row with calendar day grid in list view
- **Calendar Notes**: Read-only when not logged in; shared across all family members
- **Calendar Widget**: Agenda view available on dashboard widget; List (vertical week) view also available on widget
- **Calendar Widget**: Merge/Split toggle for day and list views when multiple calendar groups exist
- **Calendar Widget**: Month view grid toggle (bordered/borderless cells)
- **Calendar**: Agenda view added to calendar subpage
- **Dashboard Editor**: Single-row properties toolbar (widget name + Fill/Outline/Text/Grid + close)
- **Dashboard Editor**: Text size (S/M/L/XL) moved inside the Text color popover alongside swatches

### Changed
- **Auto-Hide UI**: Only wakes on mouse click, keyboard press, or touch — mouse movement/drag no longer triggers reappear

### Improved
- **Away Mode**: Header layout matches babysitter mode — clock top-left, weather top-right in a compact bar
- **Calendar**: Multi-week 3W/4W event text size increased to match month view
- **Calendar**: Today cell border in multi-week view uses standard grid line instead of separate white line
- **Dashboard Editor**: Color popover z-index raised above widgets so dropdowns appear on top
- **Auth**: Settings PIN login now carries over to main app session (eliminates double-login)
- **SideNav**: Logo background made transparent to match nav toolbar color in both themes

### Fixed
- **Calendar**: Events from shared calendars (e.g. Family) no longer duplicate across person columns — matching by groupId instead of color
- **Calendar**: Day widget notes column no longer shows redundant date header when viewing a single day
- **Calendar**: Notes column integrated into DayViewSideBySide with matching header bar and grid line alignment
- **Calendar**: Week view fills available height on calendar subpage
- **Calendar**: Events now span their full duration in week and day views (previously showed as ~30min blocks)
- **Calendar**: Event text top-aligned with start–end time byline below title
- **Calendar**: All-day events fully opaque (no transparency)
- **Calendar**: Event backgrounds fully opaque in week/day views
- **Chores**: Grouped view now shows pending approval state (amber bg, hourglass icon, "Pending" badge)
- **Chores**: Recently completed chores remain visible for 24h after parent auto-approval
- **Chores**: Points input max raised from 100 to 1000
- **Gift Ideas**: Data refreshes immediately on user switch (no stale cache from previous user)
- **Navigation**: Removed border lines from nav, header, and editor toolbars for cleaner appearance
- **Tasks**: Scrolling works correctly on mobile PWA

## [1.0.4] - 2026-03-09

### Added
- **Calendar**: Multi-week view replaces the fixed 2-week view — configurable from 1 to 4 weeks on both the calendar page and dashboard widget
- **Calendar**: Bordered/borderless toggle for multi-week cell outlines; rows auto-size to content
- **Dashboard Editor**: Frosted glass background option with variable blur intensity (Light/Med/Heavy/Max)
- **Dashboard Editor**: Default swatch (reset icon) to return any color target to theme defaults
- **Dashboard Editor**: Harvey ball indicators on Fill/Outline/Text target buttons show color state at a glance
- **Dashboard Editor**: Two-mode touch editing — tap widget to select (move mode), tap again for resize mode, tap again to deselect
- **Auto-Hide UI**: Nav bar and toolbar auto-hide after 10 seconds of inactivity, reappear on mouse/touch (configurable in Settings)
- **Auto-Hide UI**: Staggered animation — header hides first, then nav; nav reappears first, then header
- **Settings**: Location card wired to weather API — supports zip code or city/state, stored in database
- **CONTRIBUTING.md**: Quality standards requiring 95% minimum Lighthouse score across all categories
- **Drag Reorder**: Tasks, chores, goals, and family profile cards can now be reordered by drag-and-drop (touch + mouse supported)
- **Drag Reorder**: Family profile sort order persists to database via `/api/family/reorder`; task/chore group order persists to localStorage
- **Undo**: Tasks, chores, shopping items, and wish claims now show an "Undo" toast button when completed/checked off
- **Wishes**: Self-purchase — cross off items on your own wish list; if someone else already secretly bought it, shows "Someone already got this for you!"
- **Wishes**: Quick-add input moved to top of list (consistent with tasks/chores pattern)
- **Messages**: "Group by Person" toggle groups messages into person-colored cards

### Improved
- **Settings**: Consolidated Screensaver Timeout, Auto-Hide Navigation, and Away Mode Auto-Activation into single "Timers & Auto-Activation" card
- **Calendar**: Multi-week toolbar no longer resizes when switching views — grid icon doubles as border toggle
- **Calendar**: Multi-week today highlight preserved in screensaver mode (data-keep-bg attribute)
- **SideNav**: Tap-to-expand drawer replaces hover-based expansion — works reliably on touch devices, collapses on outside tap or navigation
- **Weather**: Location resolved from DB settings with fallback chain (query param → DB → env var → default)
- **Screensaver**: Fixed `--primary` CSS variable override that turned today highlight bar white
- **Accessibility**: Dashboard editor uses dashed border for move mode, solid for resize — distinguishable without color

### Fixed
- **Navigation**: Fixed nav bar appearing behind page content on iPad — removed wrapper divs that created CSS containing blocks breaking `position: fixed`
- **Navigation**: Fixed auto-hide SSR hydration mismatch — localStorage read deferred to useEffect
- **Navigation**: Auto-hide now limited to dashboard pages only — no more jarring nav animations on subpages
- **Google Calendar**: Fixed events beyond 250-event page being silently dropped — added pagination loop following `nextPageToken`
- **Google Calendar**: Cancelled recurring event instances now filtered out during sync instead of appearing as active events
- **Bus Tracking**: Fixed token mismatch between discover and sync — stale Gmail credentials now deleted on `TokenRevokedError`
- **Layout Editor**: Added `busTracking` to widget validation constraints (fixes "unknown widget ID" error)
- **Layout Editor**: Fixed dashboard save showing "Saved!" but not actually persisting — save button now awaits the API call and shows error on failure
- **Safe Zones**: Shortened default label from "Example safe zone (edit me)" to "1080p" to prevent preview cutoff
- **Calendar**: Multi-day all-day events now span all their days instead of only appearing on the start date (affected all calendar views + widget)

### Improved
- **Performance**: Split RecipesView into RecipeCard, RecipeDetailModal, RecipeFormModal, ImportUrlModal, and ImportPaprikaModal sub-components
- **Performance**: Split ShoppingView into ShoppingCategoryCard and extracted useShoppingCelebration, useShoppingDragReorder, useShoppingInlineInput hooks
- **Performance**: Lazy-load layout editor and dnd-kit (only loaded in edit mode) — LCP improved from 7.2s to 3.9s, TBT from 2.4s to 1.4s
- **Performance**: Bundle analyzer added to build config (`ANALYZE=true npx next build`)
- **Bus Tracking**: Sync lock changed from 60s cooldown to mutex (release on completion) — updates arrive within seconds
- **Bus Tracking**: Response cache reduced to 5s, polling ramps to 5s when ETA ≤ 3 min

### Fixed
- **Recipes**: Fixed crash when opening "Add Recipe" form (missing optional chain on ingredients)
- **Layout Editor (iPad)**: Fix scrolling stopping too early — grid now extends 20+ rows (or half a screen) below the last widget
- **Layout Editor (iPad)**: Fix touch drag not working — tap to select a widget, then drag to move (selected widgets disable browser scroll so dnd-kit receives the gesture)
- **Layout Editor (iPad)**: Enforce minimum 16px cell size so grid remains usable on narrow screens
- **Layout Editor**: Add "Move" grip indicator on selected widgets for touch discoverability
- **Bus Tracking**: Fix arrival event timestamps off by 6 hours in UTC Docker containers — arrival parsers now use the email Date header (timezone-correct) instead of parsing body text times as naive UTC

### Changed
- **Dashboard Grid**: Migrated from 12-column to 48-column grid for finer widget positioning (~20px increments vs ~80px)
  - All existing layouts auto-migrate on load (coordinates scaled 4x)
  - Shared `GRID_COLS` constant as single source of truth
  - Widget constraints, templates, breakpoints, and validation all updated

- **Dashboard Grid**: Replaced react-grid-layout with native CSS Grid + dnd-kit
  - Display mode uses pure CSS Grid (SSR-safe, zero JS layout overhead)
  - Edit mode uses dnd-kit for drag-to-move with grid snapping, pointer events for resize
  - Custom snap modifier adapts to dynamic cell sizes across screen resolutions
  - Touch support via dnd-kit TouchSensor
  - Removes 5 packages from bundle (react-grid-layout and dependencies)
- **Performance**: Lighthouse optimization pass (desktop score: 52 → 96)
  - Lazy-load overlays (Screensaver, AwayMode, BabysitterMode) — broke transitive import chain that pulled entire widget registry into root layout
  - Extract screensaver storage utilities to break circular dependency between Screensaver and useDashboardLayout
  - Lazy-load Add modals (task, message, chore, shopping) — deferred from critical path
  - Add React.memo to eager-loaded widgets (Clock, Weather, Calendar) to prevent unnecessary re-renders
- **Accessibility**: Lighthouse accessibility score 92 → 100
  - Fix WCAG color contrast: rewrite `isLightColor` with proper sRGB linearization and WCAG contrast ratio calculation
  - Fix calendar "Today" badge using white text on yellow seasonal highlight background
  - Add `aria-label` to all sidebar nav links (text hidden when collapsed)
  - Add `aria-label` to logo home link
- **Bus Tracking**: Auto-sync emails on status poll (60s Redis debounce lock)
- **Bus Tracking**: Switch from `is:unread` to label+date Gmail filtering for email sync
  - Supports Gmail filters that skip inbox and route to a label (e.g. "bus")
  - Configurable Gmail label in Settings → Bus Tracking
  - Uses DB dedup (gmailMessageId) instead of marking emails as read
  - Date-windowed search (last 24h) keeps queries efficient

### Added
- **Bus Tracking**: Track school bus arrivals via FirstView email notifications
  - Gmail OAuth integration for polling FirstView geofence notification emails
  - Email parser for 3 notification types: distance-based, arrived-at-stop, arrived-at-school
  - Route discovery: auto-create routes by scanning existing emails in Gmail
  - Bus routes configuration with ordered geofence checkpoints, stop, and school
  - Historical arrival time prediction using rolling median transit times (30-day window)
  - Dashboard widget with progress dots, status colors (gray/amber/green/red), and ETA display
  - Screensaver widget support
  - Settings UI for Gmail connection, route management, checkpoint editing, and auto-discovery
  - Adaptive polling: scales from 60s down to 10s as bus approaches
  - Active days awareness: no false "overdue" status on weekends/non-school days
  - Fuzzy location matching for stop/school name abbreviations
  - API routes for status, sync, routes CRUD, connection management, history, and discovery

## [1.0.3] - 2026-03-01

### Added
- **Wish Lists**: New wish list feature with per-family-member lists, UI page, dashboard widget, and bidirectional sync with Microsoft To-Do
- **Feature Toggles**: Hide/show individual pages from navigation via Settings
- **Message Expiration**: Preset duration options for auto-expiring messages
- **Audit Log**: Activity audit log with settings PIN gate for parent access
- **Connected Accounts**: New settings section showing integration status with disconnect capability
- **Chore Management**: Delete button and enabled toggle added to chore modal and list view

### Changed
- **Calendar Event Layout**: Improved overlap handling and simplified AddEventModal
- **Calendar Deduplication**: Runtime deduplication for cross-calendar and widget events
- **Code Quality**: Deduplicated code, extracted shared utilities, and decomposed large components
- **Shopping Categories**: Moved to Shopping page; renamed Settings sections

### Fixed
- **CI Lint**: Fixed unescaped apostrophe in WishListIntegrationsSection that broke the build-only CI job
- **Calendar Sync**: Fixed settings getting wiped during sync and re-auth; fixed multi-account sync
- **Calendar Toggle Styling**: Fixed toggle styling, screensaver interactivity, and shopping modal issues
- **E2E Test Cleanup**: Added global Playwright teardown to sweep stale test data; fixed per-test cleanup deleting only the first match instead of all duplicates
- **Architecture Review**: Fixed 5 bugs found during architecture review

## [1.0.2] - 2026-02-26

### Added
- **Calendar Merge Toggle**: List view now has a "Merge/Split" button to collapse multi-calendar columns into a single chronological stream
- **Past Time Dimming**: Day view dims past hour cells with grey background and highlights current hour in blue; List view dims past timed events with reduced opacity
- **Per-List Category Visibility**: Each shopping list can now show/hide categories independently via the category manager
- **General List Type**: New "General" shopping list type with preset categories (Clothes, Housewares, Gardening, Electronics, Office, Gifts)
- **General Categories**: Added 6 general-purpose shopping categories alongside grocery categories
- **Shopping Categories Settings**: New Settings section for global category management (add, remove, reorder, reset to defaults)
- **Inline Category Editing in List Modal**: Category chips in the create/edit list dialog are now interactive toggles — select a preset (Grocery, General, All, Custom) then fine-tune by toggling individual categories on/off. Replaces the separate "Categories" button.
- **Tasks Group by List**: Tasks view now supports grouping by Person, List, or None (flat list)
- **Tasks Show/Hide Completed**: Quick eye toggle in the Tasks header to show/hide completed tasks
- **Tasks Click-to-Complete**: All task view modes (flat list, grouped) now support clicking a row to toggle completion (like shopping)
- **Tasks Inline Add with List**: Inline task creation now auto-assigns the active list filter or group list
- **Headless Browser Recipe Import**: Recipes from Cloudflare-protected sites (AllRecipes, Serious Eats) now fetched via Puppeteer headless browser fallback
- **Meal Type Multi-Select Filter**: Meal type filter pills now support multi-select (like calendar profile pills)
- **Recipe Link from Meals**: Meals linked to a Prism recipe show a direct link to open the recipe modal

### Fixed
- **Session Expiry Ghost Avatar**: Users no longer appear logged in after session expiry. Sliding window extends active sessions, 5-minute periodic checks detect stale sessions, and 401 responses immediately clear the avatar
- **Shopping List/Item Creation**: Fixed "Failed to add item" error caused by importing client-only module in server API route
- **Recipe Modal Close Loop**: Fixed recipe modal reopening immediately after closing when navigated via URL param
- **Past Day Dimming**: Increased opacity of past-day dimming across all calendar views for better contrast

## [1.0.1] - 2026-02-25

### Added
- **Shopping Categories**: Custom categories for all list types — add, remove, and reorder via "Manage Categories" modal. Stored in settings with auto-assigned emoji and color. Removed "hardware" list type
- **Gallery Mode**: Full-screen photo slideshow from the Photos page. Respects active filters (orientation, usage, favorites). Tap to exit
- **Inline Task Add**: Quick task creation via inline text input (type + ENTER) in Tasks view. Available in both grouped and flat list modes
- **Babysitter Mode Toggle**: Activate Babysitter Mode directly from the /babysitter page header
- **Vertical Week View**: New "List" calendar view — planner-style vertical layout with days as rows and color-coded events. Profile grouping columns when multiple calendars configured. Today highlighted, past days dimmed
- **Calendar Re-auth Flow**: Detect expired/revoked Google Calendar tokens, show warning in Settings with "Re-authenticate" button that updates existing calendar source tokens

### Fixed
- **Calendar Sync**: Token refresh failures now detect `invalid_grant` errors specifically and mark calendars as needing re-authentication instead of showing generic errors
- **Task Creation**: Fixed "Failed to create task" error when using + button with list filter set to "none"
- **Day View Hidden Hours**: Hour rows now expand to fill available space when hidden hours are enabled, instead of leaving blank space at the bottom

## [1.0.2] - 2026-02-22

### Added
- **Transparent widget background**: New "Transparent" swatch (checkerboard icon) in Fill palette strips the Card background entirely, letting wallpaper show through
- **Widget text color**: New "Text" section in properties bar lets you override text/icon color per widget (Auto mode uses luminance detection or theme default)
- **Calendar transparent mode**: When calendar widget has custom/transparent background, day cell backgrounds are removed so wallpaper shows through the entire widget

### Fixed
- **Text color persistence**: Widget text color now saves to database (was being stripped by API validation)
- **Text color coverage**: Overrides CSS custom properties (`--foreground`, `--card-foreground`, `--muted-foreground`, `--primary`, `--seasonal-accent`) so all text, icons, and accents in the widget pick up the chosen color
- **Day view transparency**: DayViewSideBySide calendar now strips `bg-card/85` in transparent widget mode
- **Calendar dropdown**: Select trigger and filter chips go transparent with the widget
- **iPad properties bar**: Added `onPointerDown` + `touch-manipulation` to all swatch buttons for reliable iPad touch

### Added
- **Custom color picker**: Rainbow swatch in Fill, Outline, and Text sections opens native color picker for full color gamut

### Improved
- **Calendar dark mode**: Replaced hardcoded `bg-gray-200` past-day backgrounds with theme-aware `bg-muted` variants that adapt to light/dark mode
- **Properties bar UX**: Opacity buttons only appear when a color fill is selected (not for None or Transparent); Fill palette uses 9-column grid to accommodate Transparent swatch

## [1.0.1] - 2026-02-22

### Fixed
- **Background opacity**: Widget background opacity no longer makes text/icons transparent — uses rgba background color instead of CSS opacity
- **Color picker touch targets**: Increased button sizes to meet 44px HIG minimum, prevented RGL drag from intercepting touch events on color picker
- **Pencil icon**: Edit icon in dashboard toolbar now opens rename dialog on click
- **Rename dialog**: Replaced browser `window.prompt()` with styled modal dialog (consistent with v1.0 polish)

## [1.0.0] - 2026-02-22

### Changed
- **Toast Notifications**: Replaced all 55 browser `alert()` calls with styled toast notifications (success/warning/destructive variants) using shadcn/Radix toast system
- **Confirm Dialogs**: Replaced all 18 browser `confirm()` calls with styled AlertDialog modals via reusable `useConfirmDialog` hook
- **Optimistic UI**: Task toggle, task delete, shopping item toggle, and shopping item delete now update instantly with automatic rollback on failure

### Added
- **Error Pages**: App-level `error.tsx` and `not-found.tsx` with route-level error boundaries for calendar and settings
- **Accessibility**: Added ~60 `aria-label` attributes to icon-only buttons across all views, widgets, modals, and settings sections
- **Stack trace protection**: Error boundaries gate error details behind `NODE_ENV === 'development'`
- **SSRF Protection**: Recipe URL import validates against private IP ranges, localhost, and internal hostnames
- **Rate Limiting**: Recipe URL import limited to 10 requests per 60 seconds per user
- **Docker Resource Limits**: Container memory and CPU caps (app: 2GB/2CPU, db: 2GB/2CPU, redis: 512MB/1CPU) with Redis LRU eviction policy

### Fixed
- **Console cleanup**: Removed 28 debug `console.log` calls from production code (birthday sync, calendar sync, calendar settings, backup utils)
- **TypeScript**: Replaced `as any` cast in maintenance route with proper type validation
- **Chore authorization**: Added missing `requireRole` check on POST /api/chores
- **Portrait grid overlap**: Bottom widgets no longer render behind the portrait navigation bar on iPads and vertical monitors

## [0.9.5] - 2026-02-21

### Added
- **Comprehensive Test Suite**: 635 unit tests (39 suites) + 76 E2E tests
  - Core utilities: cn, color, crypto, formatters, backup, security headers, recipeParser, paprikaParser, validateFileType, calculateNextDue, pointWaterfall
  - Auth & cache: session management, requireAuth cascade, API tokens, rate limiting, Redis cache layer (all with graceful fallback testing)
  - Hooks (renderHook): useIdleDetection, useAwayModeTimeout, useCalendarFilter, useVisibilityPolling, useHiddenHours, useSwipeNavigation, useScreenSafeZones
  - Integrations: OpenWeather, OneDrive, Google Calendar, MS To-Do (tasks + shopping), calendar sync
  - Services: photo-storage, photo-sync, avatar-storage
  - API routes: chore complete/approve workflow, family member deletion, recipe URL import, withAuth middleware
  - E2E (Playwright): auth flows, dashboard, tasks/chores/shopping/calendar/settings navigation, CRUD mutations for all 5 modules, away/babysitter mode
- **Extracted calculateNextDue**: DRY refactor — shared utility used by both chore complete and approve routes
- **CI Type Check Fix**: All test files pass strict `tsc --noEmit`
- **API Tokens**: Long-lived bearer tokens for machine-to-machine access
  - Generate tokens in Settings → Security → API Tokens
  - Tokens grant parent-level access to all API endpoints
  - SHA-256 hashed storage — raw token shown only once at creation
  - Revoke tokens at any time; `lastUsedAt` tracked per token
  - All existing API routes automatically support `Authorization: Bearer <token>`
- **Iframe Embedding**: Configurable `ALLOWED_FRAME_ANCESTORS` env var for embedding Prism in Home Assistant, Node-RED dashboards, or any iframe consumer
  - Defaults to `SAMEORIGIN` when unset; supports comma-separated origins or `*`
  - Security headers extracted to dedicated module with unit tests
- **Home Assistant Integration Guide** (`docs/home-assistant.md`)
  - Iframe embedding via `ALLOWED_FRAME_ANCESTORS` + `panel_iframe`
  - REST sensor examples for calendar events, chores, shopping, meals
  - Automation examples for TTS announcements and notifications

## [0.9.4] - 2026-02-21

### Added
- **Multi-Dashboard Support**: Multiple named dashboards for different physical screens
  - Each dashboard has its own widget layout, screensaver, and orientation
  - URL routing via `/d/[slug]` (e.g. `/d/kitchen`, `/d/hallway`)
  - `/` continues to show the default dashboard
  - Devices bookmark their dashboard URL for persistent per-screen layouts
- **Dashboard Management** in layout designer toolbar:
  - Dashboard name is now a dropdown listing all dashboards
  - "New Dashboard..." creation dialog with Blank, Default Template, or Copy Current options
  - "Rename Dashboard..." and "Delete Dashboard" in the More menu
  - Switching dashboards navigates to `/d/[slug]`
- **Per-Dashboard Screensaver**: Each dashboard stores its own screensaver layout in the database
  - Screensaver bridge writes active dashboard's screensaver to localStorage on mount
  - Global screensaver component works without changes
- **Per-Dashboard Orientation**: Screen orientation (landscape/portrait) saved per-dashboard in DB instead of localStorage

### Changed
- **Away Mode Icon**: Moon icon replaced with palm tree (`TreePalm`) — more intuitive "vacation/away" meaning, avoids confusion with dark mode
- **Screensaver Icon**: Monitor-with-play icon replaced with lamp/nightlight — better represents ambient display mode

### Improved
- **Auto-Slug Migration**: Existing layouts automatically receive URL slugs on first API fetch
- **Last Dashboard Protection**: API prevents deleting the last remaining dashboard; default reassigned if the current default is deleted

## [0.9.3] - 2026-02-11

### Added
- **Outline Color**: Widget designer now supports border/outline color in addition to background color
  - Same color palette as background picker
  - Persists with layout save (stored in JSONB, no migration needed)

### Improved
- **Widget Designer Touch Support**: All resize handles now meet Apple's 44px minimum touch target
  - Edge handles: 20px → 44px thick; corner handles: 32px → 48px
  - Visual indicators always visible in edit mode (not just on hover)
  - Larger visual dots (18px with white ring) and bars (56×6px)
- **Color Picker Touch Fix**: Picker no longer closes immediately on touch devices
  - Replaced `onMouseLeave` with click-outside-to-dismiss pattern
  - Larger color button (12px → 20px) and swatches (20px → 28px)
  - Wider picker panel (180px → 200px)

## [0.9.2] - 2026-02-10

### Added
- **Away Mode**: Privacy screen that hides sensitive info (calendar, tasks, chores, messages)
  - Shows only clock, weather, and photo slideshow
  - Parent PIN required to exit
  - Toggle via moon icon in dashboard header
  - Auto-activation after extended inactivity (configurable: 4 hours to 1 week)
- **Babysitter Mode**: Full-screen overlay showing babysitter info
  - Displays emergency contacts, house info, children details, house rules
  - Clock and weather in header
  - Blue/purple gradient background
  - Parent PIN required to exit
  - Toggle via baby icon in dashboard header
- **Babysitter Info**: Public info page for caregivers (`/babysitter`)
  - Emergency contacts with call links
  - House information (WiFi, address, etc.)
  - Children details (allergies, bedtimes, medications)
  - House rules with importance levels
  - Sensitive items can be PIN-protected
  - Print-friendly layout
- New nav item: "Babysitter" in sidebar and portrait nav
- New settings section: "Babysitter Info" for managing content
- New settings: "Away Mode Auto-Activation" timeout in Display settings

### Database
- Added `babysitter_info` table with section, sortOrder, content (jsonb), isSensitive fields

### Changed
- Plane celebration animation simplified: 5s duration, slows in middle for text visibility, no loop

### Fixed
- Plane celebration no longer triggers when login is cancelled (only celebrates on successful completion)
- PIN modal z-index issue - now uses React portal to escape stacking contexts created by backdrop-blur
- "Add Childre" typo in babysitter info settings (now correctly shows "Add Child")
- Away Mode and Babysitter Mode now activate immediately (previously required page refresh)
- Babysitter nav item now visible in portrait mode on iPad

## [0.9.1] - 2026-02-09

### Added
- **Calendar hidden hours**: Configure time blocks to hide (e.g., 12am-6am) in Settings → Display
- **Calendar toggle button**: Clock icon in day/week views to show/hide configured time block
- **Grocery category drag-to-reorder**: Drag categories by grip icon to rearrange
- **Non-grocery list layout**: 2-column "List 1"/"List 2" layout matching grocery card style
- **Dashboard swipe prevention**: Prevents scrolling beyond screen bounds while allowing widget internal scroll

### Fixed
- Shopping list type now persists correctly (grocery vs hardware)
- "All Done!" celebration animation properly auto-dismisses
- Two-week vertical view Saturday row no longer cut off
- Non-grocery lists now use consistent card styling

## [0.9.0] - 2026-02-07

### Added
- **Mobile PWA**: Installable app with service worker, manifest, and app icons
- **Bottom navigation**: Mobile and portrait tablet navigation bars
- **Swipe navigation**: Swipe left/right on calendar views to navigate
- **Responsive font sizing**: 16px phones, 18px desktop, 20-24px tablets
- **Shopping celebration**: Animation when all items checked off
- **Shopping mode**: Full-screen mobile shopping experience
- **Calendar auto-scaling**: Views fit available space without scrolling

### Changed
- Removed Chores and Goals from mobile navigation (kiosk-focused)
- Calendar forced to day view on mobile devices
- SideNav hidden on mobile (bottom nav only)

## [0.8.0] - 2026-02-06

### Added
- **Microsoft To-Do integration**: Bidirectional task sync with OAuth
- **Shopping list sync**: MS To-Do integration for shopping items
- **Recipe system**: Full CRUD, URL import, Paprika import
- **Recipe scaling**: Adjust servings with smart fraction handling
- **Add ingredients to shopping list**: From recipe detail modal
- **Meal-recipe linking**: Select recipes when planning meals
- **Background auto-sync**: Tasks sync every 5 minutes on dashboard/screensaver
- **SVG favicon**: New prism icon design
- **Task list management**: Edit names, delete lists, change external connections

### Changed
- Task integration UI redesigned with per-list connect buttons
- Recipe categories/cuisine filter dropdowns
- Ingredient strikethrough toggle in recipe modal

## [0.7.0] - 2026-02-06

### Added
- **Calendar event colors**: Color picker with user profile color default
- **Hide calendars from Add Event**: Configurable per calendar in settings
- **Calendar alias/rename**: Edit display names in settings
- **24-hour week view**: Shows all hours instead of 6am-10pm
- **Overlapping events**: Cycle through horizontal positions
- **Login prompts**: All create actions now require authentication first

### Changed
- Portrait navigation icons increased 1.4x
- Week view shows all-day events in scrollable header
- Removed "+n more" event truncation

## [0.6.0] - 2026-02-06

### Added
- **Wallpaper rotation**: Configurable interval with "never" option
- **Screensaver photo interval**: Configurable in settings
- **Auto-sync re-enabled**: Calendar syncs every 10 minutes
- **Wallpaper fallback**: Uses all photos if none tagged for wallpaper

### Fixed
- Wallpaper only shows on dashboard and screensaver
- Dashboard wallpaper no longer blocked by solid background
- Shopping cache invalidation on item changes
- Tasks cache invalidation on changes
- Points cache invalidation on chore changes

## [0.5.0] - 2026-02-05

### Added
- **Points & Goals system**: Full implementation with waterfall allocation
- **Goal redemption**: Parents can redeem goals for children
- **PointsWidget**: Dashboard widget with per-child progress
- **Goals page**: View, create, edit, delete goals with progress tracking
- **Chore completion history**: View recent completions with approval status
- **Layout import/export**: Share layouts via clipboard JSON

### Changed
- Logo in SideNav: Pixel dissolve design
- Screensaver templates repositioned to hug top borders
- Goals cache invalidation on chore complete/approve

### Fixed
- Chore period boundaries (weekly resets on Sundays)
- Pending chores display in dashboard
- Widget color settings now persist
- Completed goals visibility in light/dark modes

## [0.4.0] - 2026-02-05

### Added
- **Security hardening**: Transactions on concurrent mutations
- **Magic byte validation**: JPEG/PNG/WebP verification on uploads
- **Per-user rate limiting**: Redis-based with graceful fallback

### Fixed
- `requireRole()` authorization gaps in chores/messages/tasks
- Race condition in family member deletion
- Missing author ownership check in messages PATCH

## [0.3.0] - 2026-02-05

### Added
- **Lazy-loaded widgets**: 7 non-default widgets load on demand
- **Conditional modal rendering**: Modals only mount when open

### Changed
- Split 6 oversized components into custom hooks
- All component functions now under 250 lines
- Removed dead `getDemoEvents()` function

## [0.2.0] - 2026-02-05

### Added
- **Database indexes**: 7 new indexes for query performance
- **Consolidated shopping API**: `?includeItems=true` parameter
- **Unique birthday index**: For batch upsert operations

### Fixed
- N+1 query in calendar groups (batch insert)
- N+1 query in birthday sync (batch upsert)
- FK cascade rules on 16 nullable user columns

## [0.1.0] - 2026-02-05

### Added
- **Redis caching**: GET endpoints with mutation invalidation
- **FamilyContext**: Replaces 9 duplicate fetch calls
- **Visibility-based polling**: Pauses when tab hidden

### Fixed
- COUNT query bugs in tasks and messages routes
- Polling intervals reduced (60s→300s/120s)

### Changed
- Brand rename to "Prism"

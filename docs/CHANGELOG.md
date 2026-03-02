# Changelog

All notable changes to Prism are documented in this file.

## [Unreleased]

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

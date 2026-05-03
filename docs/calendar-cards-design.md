# Calendar Cards — Design Reference

Source-of-truth notes for Prism's cards-mode rendering across calendar views. Distilled from a deep recon of FamousWolf/week-planner-card (the visual idiom we're inspired by) + our own theme system. Use this when polishing or re-skinning the card surface.

## Card structure (what fits inside one event card)

Upstream uses up to 4 stacked rows inside the card body:

1. **Time** — `secondary-text-color`. Format: `HH:mm – HH:mm` for timed, literal `Entire day` for all-day.
2. **Title** — primary text color. Inherits theme weight (typically default; appearance of "bold" in screenshots is HA theme).
3. **Description** — only when `showDescription` enabled (we don't currently surface this).
4. **Location** — has an `mdi:map-marker` prefix icon. Only shown when `showLocation && event.location`. **Note: upstream does NOT auto-fall-back to calendar name when location is missing.** That's a Prism-specific improvement we should add — show location if present, else calendar group name.

Stripe: 5px left border in event color, `border-radius: 0 5px 5px 0` (rounded right side only). Compact mode: 2px stripe.

Per-event icon (right side of card body, optional): `mdi` icon at 18px.

Multi-calendar event: extra `additionalColor` divs render parallel stripes per extra calendar, each 5px.

## Day cell header

- Date number: `font-size: 3.5em`, `line-height: 1.2em`. Compact: `1.5em`.
- Weekday/Today text: `font-size: 1.25em` (compact `1em`). Inherits primary-text-color.
- Weather block: `position: absolute; top: 0; right: 0`. Icon `30px` (compact `20px`). High/low temps separated by ` / ` via CSS `content`.
- "Today" cue is **purely textual** — the literal string `"Today"` replaces the weekday name. No ring, no color change in upstream CSS. Any colored ring is theme-applied (e.g. `card_mod`).

## Weather icons

Upstream ships colored raster PNGs (not tinted SVGs). Mapping (HA condition → image):

| Condition(s) | Icon |
|---|---|
| `clear-day`, `sunny` | yellow sun |
| `clear-night` | crescent moon |
| `cloudy`, `overcast` | gray cloud |
| `partly-cloudy-day`, `partlycloudy` | sun + cloud |
| `partly-cloudy-night` | moon + cloud |
| `fog` | fog band |
| `lightning` | bolt |
| `lightning-rainy` | storm with rain |
| `pouring`, `rain`, `rainy` | blue rain |
| `hail`, `sleet`, `snowy-rainy` | mixed precipitation |
| `snow`, `snowy` | snowflake |
| `wind`, `windy`, `windy-variant` | wind lines (only SVG one) |

Night-variant overrides apply for `sunny`, `partlycloudy`, `lightning-rainy`. Color comes from the PNG itself; no per-condition CSS tint.

Prism equivalent: tint Lucide icons with `text-amber-300` (sunny), `text-blue-300` (rain), `text-white/70` (cloudy), etc. Already partially in place in `DayColumn.tsx`.

> **Future-proofing**: Prism's weather source may change based on a community fork (different provider / different condition vocabulary). The card consumes a `WeatherCondition` union typed in `WeatherWidget.tsx`. When the source swaps, update that type's mapping; the icon tinting layer doesn't care about the upstream provider name. Keep the icon-tint switch in `weatherIcon()` keyed off our internal condition enum, not provider strings.

## Spacing (px values)

| Token | Default | Compact |
|---|---|---|
| `--days-spacing` (gap between day cells) | 15 | 5 |
| `--event-spacing` (gap between events) | 5 | 2 |
| `--event-padding` (inside each card) | 10 | `2 5` |
| `--event-border-width` (stripe) | 5 | 2 |
| `--event-border-radius` | 5 | 5 |
| Day header → events margin-top | 10 | 5 |
| Header gap, legend gap | 15 | — |
| Weather icon size | 30 | 20 |

Prism's current values are tighter than upstream — bump cards up to `p-2` or larger, gap-1.5 between cards, 5px stripe (`w-[5px]` or `border-l-[5px]`).

## Typography scale (relative to root)

| Element | Default | Compact |
|---|---|---|
| Day number | `3.5em / 1.2 lh` | `1.5em / 1.5 lh` |
| Weekday/"Today" | `1.25em` | `1em` |
| Event font-size | `1em / 1.2 lh` | `0.9em / 1.1 lh` |
| Weather temp | `1em` | `0.8em` |
| Navigation month label | `2em` | — |

No `font-weight` or `letter-spacing` rules in upstream — all inherits.

For Prism: aim for **day number ≈ text-3xl/text-4xl**, **title text-xs/sm**, **time/subtitle text-[10px]**. Currently we use text-2xl for date — should bump to text-3xl in `md` size.

## Layout (responsive)

CSS container queries (not viewport media queries):

| Container width | Default cols | Compact cols |
|---|---|---|
| ≤ 1920 | 7 | 7 |
| ≤ 1280 | 5 | 7 |
| ≤ 1024 | 3 | 4 |
| ≤ 640 | 1 | 2 |

Prism currently uses Tailwind breakpoints (`grid-cols-1 sm:2 md:3 lg:4 xl:7`). Roughly equivalent; consider container queries when re-doing.

## Color system

Upstream uses **HA theme tokens** with `#ffffff` / `#aaaaaa` fallbacks:
- Card bg: `var(--card-background-color)`
- Title text: `var(--primary-text-color)`
- Time/subtitle: `var(--secondary-text-color, #aaaaaa)`
- Stripe: per-calendar config color (e.g. `#e6c229`, `#1a8fe3`)
- Divider: `var(--divider-color, #ffffff)`

Prism equivalent (already in place):
- Card bg: `bg-card/85`
- Title: `text-foreground`
- Time/subtitle: `text-muted-foreground`
- Stripe: per-event color from `event.color`
- Border: `border-border/40`

## What we currently do vs upstream — gap list

| Aspect | Upstream | Prism today | Gap |
|---|---|---|---|
| 3rd row (location/calendar-fallback) | Has location row only | None | **Add location-or-calendar fallback line** |
| Stripe width | 5px | 3px | Bump to 5px in md+ sizes |
| Internal padding | 10px | py-1 (~4px) | Bump padding |
| Event-to-event gap | 5px | gap-0.5–1.5 | Standardize gap-1 (4px) |
| Day-number size | 3.5em (~56px) | text-2xl (~24px) | Bump to text-3xl/4xl in md |
| Today ring | None (text only) | seasonal-accent ring | Prism is richer; keep |
| Weather icon size | 30px | h-4 (16px) | Bump to h-5/h-6 in larger sizes |
| Description row | Optional | None | Defer; not user-requested |
| Multi-calendar parallel stripes | Yes | No | Defer; Prism doesn't multi-calendar a single event |

## Card capacity per cell — dynamic, not hard-capped

**The hardcoded `MAX_VISIBLE_CARDS` constants in `MonthView.tsx` and `MultiWeekView.tsx` are placeholders, not the design intent.** A 1920×1080 month cell often has room for 6+ cards; capping at 3 wastes vertical space and surfaces "+N more" prematurely. The shipping behavior should be:

- Each cell **measures its own available height** (via `ResizeObserver`) and computes how many cards fit *given the current font scale, theme, and viewport*.
- The card-height constant is itself measured, not guessed — render an off-screen probe card in the same size variant on mount, cache the resulting `getBoundingClientRect().height`, recompute when the font scale changes.
- Show all events that fit; if exactly one would be hidden, prefer to show it (the popover trigger costs more than the card).
- Reserve space for the "+N more" trigger only when overflow is actually present.

Implementation notes are in `~/.claude/projects/c--Projects-prism/memory/week-cards-dynamic-fit.md`.

## Open question — `/week` as a separate route

The standalone `/week` page was the entry point for cards-mode work. Now that Calendar's `week` view supports cards-mode AND can take overlays (planned), the standalone page is mostly redundant. Options:

- **Demote `/week`**: remove the route, point users to "Calendar → Week → cards mode + overlays on."
- **Keep as a deep-link**: `/week` becomes a thin wrapper that loads CalendarView pre-configured with `viewType=week`, `displayMode=cards`, all overlays enabled. Costs ~10 lines, gives a fast bookmark.
- **Keep as today**: standalone page with its own state. Costs duplication.

Decision deferred until the overlay integration ships (then we can compare side-by-side).

## Next steps in priority order

1. **Functional**: integrate meals/chores/tasks overlays into Calendar views (currently only on `/week`). Includes drag-and-drop for chores/tasks/meals. This is the higher-impact pending work.
2. **Visual**: location-or-calendar 3rd line; bump stripe width, padding, and day-number size; refine typography hierarchy. Lower complexity. (Partially landed — see commits.)
3. **Dynamic capacity**: replace hardcoded `MAX_VISIBLE_CARDS` with ResizeObserver measurement (queued: `week-cards-dynamic-fit.md`).
4. **Decide `/week` route fate** once #1 ships.

## Cross-references
- Card primitive: `src/components/calendar/cells/WeekItemCard.tsx`
- Day cell: `src/components/calendar/cells/DayColumn.tsx`
- Overflow popover: `src/components/calendar/cells/DayOverflowPopover.tsx`
- Aggregator: `src/lib/hooks/useWeekViewData.ts`
- Per-view consumers: `src/components/calendar/{Week,WeekVertical,MultiWeek,Month,Agenda,DayViewSideBySide}View.tsx`

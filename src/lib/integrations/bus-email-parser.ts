/**
 * Parses FirstView bus notification emails into structured events.
 * Pure functions, no side effects. Three email types:
 *
 * 1. Distance-Based: "{NAME}'s vehicle entered your {N} ft notification zone
 *    near {address} ({label}, Time Range: {range}, Trip: {id})."
 *
 * 2. Arrived at Stop: "{NAME}'s bus arrived at stop {STOP} at {time} {date} ({trips})."
 *
 * 3. Arrived at School: "{NAME}'s bus arrived at school stop {school} at {time} {date} ({trips})."
 *
 * NOTE: Emails are HTML-only. The body text passed to parseBusEmail should already
 * be HTML-stripped with entities decoded (handled by gmail.ts extractEmailFields).
 * The stripped body has the subject echoed at the start, followed by the actual content.
 */

export type BusEmailType = 'distance_based' | 'arrived_at_stop' | 'arrived_at_school';

export interface ParsedBusEmail {
  type: BusEmailType;
  studentName: string;
  checkpointName: string;
  tripId: string | null;
  eventTime: Date;
  /** Direction hint extracted from trip string or time range */
  directionHint: 'AM' | 'PM' | null;
  rawAddress?: string;
  distanceFt?: number;
  timeRange?: string;
}

export interface BusRoute {
  id: string;
  studentName: string;
  tripId: string;
  direction: 'AM' | 'PM';
  checkpoints: { name: string; sortOrder: number }[];
  stopName: string | null;
  schoolName: string | null;
}

export interface RouteMatch {
  routeId: string;
  checkpointIndex: number;
  checkpointName: string;
  /** True if checkpoint was not found in route config (needs to be auto-added) */
  isNewCheckpoint?: boolean;
}

// Subject patterns
const DISTANCE_BASED_SUBJECT = /First View:\s*Distance-Based Notification/i;
const ARRIVED_AT_STOP_SUBJECT = /First View:\s*Arrived at Stop/i;
const ARRIVED_AT_SCHOOL_SUBJECT = /First View:\s*Arrived at School/i;

// Body patterns — these match ANYWHERE in the body (not just start of line)
// because the stripped HTML body has the subject echoed first.
//
// Actual formats observed:
//   Distance: "EMMA SMITH's vehicle entered your 250 ft notification zone near 742 Elm Street (Turned onto Elm, Time Range: 7:30-8:00 AM, Trip: 15-A)."
//   Stop:     "EMMA's bus arrived at stop ELM ST & OAK AVE at 04:11 PM 2026-02-27 (15-A - PM, 15-A-PM)."
//   School:   "EMMA's bus arrived at school stop Riverside Middle School at 02:55 PM 2026-02-27 (15-A - PM, 15-A-PM)."

// Distance-based: name's vehicle entered your N ft notification zone near address (label, Time Range: range, Trip: id).
const DISTANCE_BASED_BODY = /(.+?)'s vehicle entered your (\d+)\s*ft notification zone near (.+?)\s*\(([^,]+),\s*Time Range:\s*([^,]+),\s*Trip:\s*([^)]+)\)/i;

// Arrived at stop: name's bus arrived at stop STOP at time date (trips).
// Date can be M/D/YYYY or YYYY-MM-DD
const ARRIVED_AT_STOP_BODY = /(.+?)'s bus arrived at stop (.+?) at (\d{1,2}:\d{2}\s*[AP]M)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*\(([^)]+)\)/i;

// Arrived at school: name's bus arrived at school stop SCHOOL at time date (trips).
const ARRIVED_AT_SCHOOL_BODY = /(.+?)'s bus arrived at school stop (.+?) at (\d{1,2}:\d{2}\s*[AP]M)\s+(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\s*\(([^)]+)\)/i;

/**
 * Parse a FirstView email into a structured event.
 * Returns null if the email doesn't match any known pattern.
 *
 */
export function parseBusEmail(
  subject: string,
  body: string,
  emailDate: Date,
): ParsedBusEmail | null {
  // Clean up body text (remove extra whitespace, newlines)
  let cleanBody = body.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim();

  // The stripped HTML body often echoes the subject at the start.
  // Find the actual content by locating the key phrase.
  // e.g. "First View: Arrived at Stop | EMMA EMMA's bus arrived..."
  // We want to start from "EMMA's bus arrived..."
  const contentMarkers = [
    "'s vehicle entered your",
    "'s bus arrived at stop",
    "'s bus arrived at school stop",
  ];

  for (const marker of contentMarkers) {
    const idx = cleanBody.indexOf(marker);
    if (idx > 0) {
      // Walk backwards from the marker to find the start of the name
      // The name is the word(s) immediately before "'s"
      const before = cleanBody.slice(0, idx);
      // Find the last occurrence of two+ uppercase/titlecase words before the marker
      // We look for the name by finding where the content section starts
      // The subject echo ends and the actual content begins with the student name
      // Simple heuristic: find the name by looking for repeated name at the start
      const nameEndIdx = idx;
      // Walk backwards past spaces and the name itself
      let nameStartIdx = nameEndIdx;
      while (nameStartIdx > 0 && before[nameStartIdx - 1] !== ' ') {
        nameStartIdx--;
      }
      // Check if there's a multi-word name (walk back through words)
      let wordCount = 0;
      let tempIdx = nameStartIdx;
      while (tempIdx > 0 && wordCount < 3) {
        tempIdx--;
        while (tempIdx > 0 && before[tempIdx - 1] !== ' ') tempIdx--;
        // Check if this word looks like part of a name (uppercase/title case)
        const word = before.slice(tempIdx, nameStartIdx).trim();
        if (word && /^[A-Z]/.test(word) && !word.includes(':') && !word.includes('|')) {
          nameStartIdx = tempIdx;
          wordCount++;
        } else {
          break;
        }
      }
      cleanBody = cleanBody.slice(nameStartIdx).trim();
      break;
    }
  }

  if (DISTANCE_BASED_SUBJECT.test(subject)) {
    return parseDistanceBased(cleanBody, emailDate);
  }

  if (ARRIVED_AT_STOP_SUBJECT.test(subject)) {
    return parseArrivedAtStop(cleanBody, emailDate);
  }

  if (ARRIVED_AT_SCHOOL_SUBJECT.test(subject)) {
    return parseArrivedAtSchool(cleanBody, emailDate);
  }

  return null;
}

function parseDistanceBased(body: string, emailDate: Date): ParsedBusEmail | null {
  const match = body.match(DISTANCE_BASED_BODY);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5] || !match[6]) return null;

  const timeRange = match[5].trim();
  // Extract direction from time range (e.g. "7:30-8:00 AM" → AM, "3:00-4:00 PM" → PM)
  const directionHint = extractDirectionFromTimeRange(timeRange);

  return {
    type: 'distance_based',
    studentName: normalizeStudentName(match[1].trim()),
    checkpointName: match[4].trim(),
    tripId: match[6].trim(),
    eventTime: emailDate,
    directionHint,
    rawAddress: match[3].trim(),
    distanceFt: parseInt(match[2], 10),
    timeRange,
  };
}

function parseArrivedAtStop(body: string, emailDate: Date): ParsedBusEmail | null {
  const match = body.match(ARRIVED_AT_STOP_BODY);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) return null;

  // Use emailDate (from Date header) as the event time. The email is sent within
  // seconds of the actual event, and emailDate is already timezone-correct (unlike
  // body text times which are in the sender's local timezone — problematic in UTC containers).
  const eventTime = emailDate;
  const tripsStr = match[5].trim();
  const tripId = extractTripId(tripsStr);
  const directionHint = extractDirectionFromTrips(tripsStr);

  return {
    type: 'arrived_at_stop',
    studentName: normalizeStudentName(match[1].trim()),
    checkpointName: match[2].trim(),
    tripId,
    eventTime,
    directionHint,
  };
}

function parseArrivedAtSchool(body: string, emailDate: Date): ParsedBusEmail | null {
  const match = body.match(ARRIVED_AT_SCHOOL_BODY);
  if (!match || !match[1] || !match[2] || !match[3] || !match[4] || !match[5]) return null;

  // Use emailDate as event time (same rationale as parseArrivedAtStop)
  const eventTime = emailDate;
  const tripsStr = match[5].trim();
  const tripId = extractTripId(tripsStr);
  const directionHint = extractDirectionFromTrips(tripsStr);

  return {
    type: 'arrived_at_school',
    studentName: normalizeStudentName(match[1].trim()),
    checkpointName: match[2].trim(),
    tripId,
    eventTime,
    directionHint,
  };
}

/**
 * Normalize student name: FirstView uses full name in some emails (e.g. "EMMA SMITH")
 * and first name only in others (e.g. "EMMA"). We use first name for matching,
 * with title case for display.
 */
function normalizeStudentName(name: string): string {
  // Use first name only for consistency
  const firstName = name.split(/\s+/)[0] || name;
  // Title case
  return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
}

/**
 * Parse a time+date string into a Date object.
 * Time: "7:15 AM" or "04:11 PM"
 * Date: "3/1/2026" (US) or "2026-02-27" (ISO)
 *
 * NOTE: This creates dates in the runtime's timezone. For production use where
 * timezone consistency matters, prefer using emailDate directly (as arrival
 * parsers now do) rather than parsing body text times.
 */
function parseEventTime(timeStr: string, dateStr: string, fallback: Date): Date {
  try {
    let month: number, day: number, year: number;

    if (dateStr.includes('-')) {
      // ISO format: YYYY-MM-DD
      const parts = dateStr.split('-').map(Number);
      year = parts[0]!;
      month = parts[1]!;
      day = parts[2]!;
    } else {
      // US format: M/D/YYYY
      const parts = dateStr.split('/').map(Number);
      month = parts[0]!;
      day = parts[1]!;
      year = parts[2]!;
    }

    if (!month || !day || !year) return fallback;

    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeMatch || !timeMatch[1] || !timeMatch[2] || !timeMatch[3]) return fallback;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const ampm = timeMatch[3].toUpperCase();

    if (ampm === 'PM' && hours !== 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const date = new Date(year, month - 1, day, hours, minutes, 0);
    return isNaN(date.getTime()) ? fallback : date;
  } catch {
    return fallback;
  }
}

/**
 * Extract direction from trip string like "28-C - AM, 28-C-AM" → "AM"
 */
function extractDirectionFromTrips(trips: string): 'AM' | 'PM' | null {
  if (/\bAM\b/i.test(trips)) return 'AM';
  if (/\bPM\b/i.test(trips)) return 'PM';
  return null;
}

/**
 * Extract direction from time range like "7:30-8:00 AM" → "AM"
 */
function extractDirectionFromTimeRange(timeRange: string): 'AM' | 'PM' | null {
  if (/\bAM\b/i.test(timeRange)) return 'AM';
  if (/\bPM\b/i.test(timeRange)) return 'PM';
  return null;
}

/**
 * Extract first trip ID from a trips string.
 * Formats seen: "Trip: 28-C" or "28-C - AM, 28-C-AM" or "28-C - PM, 28-C-PM"
 * We want just the base trip ID (e.g. "28-C").
 */
function extractTripId(trips: string): string | null {
  // Remove "Trip:" prefix if present
  const cleaned = trips.replace(/^Trip:\s*/i, '').trim();
  // Take the first item (comma-separated)
  const first = cleaned.split(',')[0]?.trim();
  if (!first) return null;
  // Remove direction suffix like " - AM" or " - PM"
  return first.replace(/\s*-\s*(AM|PM)$/i, '').trim() || null;
}

/**
 * Fuzzy match location names. Handles common abbreviations and formatting differences.
 * e.g. "ELM RD & OAK AVE" matches "Elm & Oak"
 */
function fuzzyLocationMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/\b(rd|road|ave|avenue|st|street|blvd|boulevard|dr|drive|ln|lane|ct|court)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
  return normalize(a) === normalize(b);
}

/**
 * Match a parsed email to a bus route.
 * For distance-based: match by tripId and studentName (first name, case-insensitive).
 * For arrival emails: match by studentName and try tripId from the trips list.
 */
export function matchEmailToRoute(
  parsed: ParsedBusEmail,
  routes: BusRoute[]
): RouteMatch | null {
  for (const route of routes) {
    // Student name match (case-insensitive, first name only)
    const parsedFirst = parsed.studentName.split(/\s+/)[0]?.toLowerCase() || '';
    const routeFirst = route.studentName.split(/\s+/)[0]?.toLowerCase() || '';
    const nameMatch = parsedFirst === routeFirst;
    if (!nameMatch) continue;

    // Trip ID match (if available)
    if (parsed.tripId && route.tripId !== parsed.tripId) continue;

    // Find checkpoint index
    let checkpointIndex = -1;
    let checkpointName = parsed.checkpointName;

    if (parsed.type === 'distance_based') {
      // Match against ordered checkpoints by name
      const cpIdx = route.checkpoints.findIndex(
        cp => cp.name.toLowerCase() === parsed.checkpointName.toLowerCase()
      );
      if (cpIdx >= 0) {
        checkpointIndex = cpIdx;
        checkpointName = route.checkpoints[cpIdx]!.name;
      } else {
        // Unknown checkpoint for a matching route — flag as new so sync can auto-add it
        checkpointIndex = route.checkpoints.length;
        checkpointName = parsed.checkpointName;
        return { routeId: route.id, checkpointIndex, checkpointName, isNewCheckpoint: true };
      }
    } else if (parsed.type === 'arrived_at_stop') {
      // Stop is after all checkpoints
      checkpointIndex = route.checkpoints.length;
      if (route.stopName && fuzzyLocationMatch(route.stopName, parsed.checkpointName)) {
        checkpointName = route.stopName;
      } else {
        // Auto-match: student+tripId match but stop name differs or is unset
        checkpointName = parsed.checkpointName;
        return { routeId: route.id, checkpointIndex, checkpointName, isNewCheckpoint: true };
      }
    } else if (parsed.type === 'arrived_at_school') {
      // School is the final checkpoint (after stop)
      checkpointIndex = route.checkpoints.length + 1;
      if (route.schoolName && fuzzyLocationMatch(route.schoolName, parsed.checkpointName)) {
        checkpointName = route.schoolName;
      } else {
        // Auto-match: student+tripId match but school name differs or is unset
        checkpointName = parsed.checkpointName;
        return { routeId: route.id, checkpointIndex, checkpointName, isNewCheckpoint: true };
      }
    }

    if (checkpointIndex >= 0) {
      return { routeId: route.id, checkpointIndex, checkpointName };
    }
  }

  return null;
}

import { EPGProgram } from "../types/player";

export type EPGData = Record<string, EPGProgram[]>;

/**
 * Parse XMLTV format EPG data
 * @param xml - XMLTV string
 * @returns EPGData object
 */
export function parseEPG(xml: string): EPGData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");
  const items = doc.querySelectorAll("programme");
  
  const epgData: EPGData = {};
  
  items.forEach(item => {
    const channelId = item.getAttribute("channel") || "";
    const startStr = item.getAttribute("start") || "";
    const stopStr = item.getAttribute("stop") || "";
    
    // Parse start/end time (XMLTV format: YYYYMMDDHHMMSS ±HHMM)
    const parseTime = (timeStr: string) => {
      if (!timeStr) return new Date();
      
      // Remove timezone offset for simplicity
      const cleanStr = timeStr.replace(/\s+[+-]\d{4}$/, "");
      const year = parseInt(cleanStr.substring(0, 4));
      const month = parseInt(cleanStr.substring(4, 6)) - 1;
      const day = parseInt(cleanStr.substring(6, 8));
      const hour = parseInt(cleanStr.substring(8, 10));
      const minute = parseInt(cleanStr.substring(10, 12));
      const second = parseInt(cleanStr.substring(12, 14)) || 0;
      
      return new Date(year, month, day, hour, minute, second);
    };
    
    const start = parseTime(startStr);
    const end = parseTime(stopStr);
    const title = item.querySelector("title")?.textContent || "";
    const id = `${channelId}-${start.getTime()}`;
    
    if (!epgData[channelId]) {
      epgData[channelId] = [];
    }
    
    epgData[channelId].push({
      id,
      title,
      start,
      end
    });
  });
  
  // Sort programs by start time
  Object.keys(epgData).forEach(channelId => {
    epgData[channelId].sort((a, b) => a.start.getTime() - b.start.getTime());
  });
  
  return epgData;
}

/**
 * Generate fallback programs for time gaps
 * Creates 2-hour blocks titled "精彩节目" for periods without real EPG data
 * @param existingPrograms - Existing programs for the channel (must be sorted by start time)
 * @param channelId - Channel ID for generating program IDs
 * @param lookbackHours - How many hours back from now to generate fallback programs (default: 48)
 * @returns Array of fallback programs that don't overlap with existing programs
 */
export function generateFallbackPrograms(
  existingPrograms: EPGProgram[],
  channelId: string,
  lookbackHours: number = 48,
): EPGProgram[] {
  const now = new Date();
  const startTime = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const fallbackPrograms: EPGProgram[] = [];

  // Generate 2-hour blocks for the entire time range
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  let currentStart = new Date(startTime);

  // Round down to nearest 2-hour boundary for cleaner segments
  const hoursSinceEpoch = Math.floor(currentStart.getTime() / (60 * 60 * 1000));
  const roundedHours = Math.floor(hoursSinceEpoch / 2) * 2;
  currentStart = new Date(roundedHours * 60 * 60 * 1000);

  while (currentStart < now) {
    const currentEnd = new Date(currentStart.getTime() + TWO_HOURS_MS);

    // Check if this time slot overlaps with any existing program
    const hasOverlap = existingPrograms.some(
      (p) =>
        (p.start <= currentStart && p.end > currentStart) ||
        (p.start < currentEnd && p.end >= currentEnd) ||
        (p.start >= currentStart && p.end <= currentEnd),
    );

    if (!hasOverlap) {
      fallbackPrograms.push({
        id: `fallback-${channelId}-${currentStart.getTime()}`,
        start: currentStart,
        end: currentEnd,
        title: "精彩节目"
      });
    }

    currentStart = currentEnd;
  }

  return fallbackPrograms;
}

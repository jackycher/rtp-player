import { Channel, M3UMetadata } from "../types/player";

/**
 * Parse M3U playlist string
 * @param m3uContent - M3U content string
 * @returns M3UMetadata object
 */
export function parseM3U(m3uContent: string): M3UMetadata {
  const lines = m3uContent.split(/\r?\n/);
  const channels: Channel[] = [];
  const groups = new Set<string>();
  let currentMeta: Partial<Channel> = {};
  let tvgUrl: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Parse EXTM3U header (may contain TVG URL)
    if (trimmedLine.startsWith("#EXTM3U")) {
      const tvgUrlMatch = trimmedLine.match(/tvg-url="([^"]+)"/);
      if (tvgUrlMatch) {
        tvgUrl = tvgUrlMatch[1];
      }
      continue;
    }
    
    // Parse EXTINF line (channel metadata)
    if (trimmedLine.startsWith("#EXTINF:")) {
      // Reset current meta
      currentMeta = {};
      
      // Extract metadata from EXTINF line
      const infLine = trimmedLine.substring(8); // Remove "#EXTINF:"
      
      // Parse TVG ID
      const tvgIdMatch = infLine.match(/tvg-id="([^"]+)"/);
      if (tvgIdMatch) {
        currentMeta.tvgId = tvgIdMatch[1];
      }
      
      // Parse TVG Name
      const tvgNameMatch = infLine.match(/tvg-name="([^"]+)"/);
      if (tvgNameMatch) {
        currentMeta.tvgName = tvgNameMatch[1];
      }
      
      // Parse TVG Logo
      const tvgLogoMatch = infLine.match(/tvg-logo="([^"]+)"/);
      if (tvgLogoMatch) {
        currentMeta.logo = tvgLogoMatch[1];
      }
      
      // Parse Group
      const groupMatch = infLine.match(/group-title="([^"]+)"/);
      if (groupMatch) {
        currentMeta.group = groupMatch[1];
        groups.add(groupMatch[1]);
      }
      
      // Parse Catchup
      const catchupMatch = infLine.match(/catchup="([^"]+)"/);
      if (catchupMatch) {
        currentMeta.catchup = catchupMatch[1];
      }
      
      // Parse Catchup Source
      const catchupSourceMatch = infLine.match(/catchup-source="([^"]+)"/);
      if (catchupSourceMatch) {
        currentMeta.catchupSource = catchupSourceMatch[1];
      }
      
      // Parse channel name (after last comma)
      const nameMatch = infLine.split(/,\s*/).pop();
      if (nameMatch) {
        currentMeta.name = nameMatch.trim();
      }
      
      continue;
    }
    
    // Skip other comment lines
    if (trimmedLine.startsWith("#")) continue;
    
    // This is the channel URL line
    if (currentMeta.name) {
      const channel: Channel = {
        id: currentMeta.tvgId || currentMeta.name || `channel-${channels.length}`,
        name: currentMeta.name || `Channel ${channels.length + 1}`,
        group: currentMeta.group || "Default",
        url: trimmedLine,
        logo: currentMeta.logo,
        tvgId: currentMeta.tvgId,
        tvgName: currentMeta.tvgName,
        catchup: currentMeta.catchup,
        catchupSource: currentMeta.catchupSource,
      };
      
      channels.push(channel);
      currentMeta = {};
    }
  }
  
  return {
    tvgUrl,
    channels,
    groups: Array.from(groups).sort(),
  };
}

import { useState, useEffect } from 'react';
import { Channel } from '../types/player';
import { parseM3U } from '../lib/m3u-parser';

export function useM3ULoader(url: string) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchM3U = async () => {
      if (!url) {
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const response = await fetch(url, {
          mode: 'cors',
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch M3U: ${response.statusText}`);
        }
        
        const text = await response.text();
        const parsed = parseM3U(text);
        
        setChannels(parsed.channels);
        setGroups(parsed.groups);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error loading M3U:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchM3U();
    
    // 每30分钟刷新一次M3U
    const interval = setInterval(fetchM3U, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [url]);
  
  return { channels, groups, isLoading, error };
}

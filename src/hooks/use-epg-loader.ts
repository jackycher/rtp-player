import { useState, useEffect } from 'react';
import { EPGData, parseEPG } from '../lib/epg-parser';

export function useEPGLoader(url: string) {
  const [epgData, setEpgData] = useState<EPGData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchEPG = async () => {
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
          throw new Error(`Failed to fetch EPG: ${response.statusText}`);
        }
        
        const text = await response.text();
        const parsed = parseEPG(text);
        
        setEpgData(parsed);
        setError(null);
      } catch (err) {
        setError(err as Error);
        console.error('Error loading EPG:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEPG();
    
    // 每6小时刷新一次EPG
    const interval = setInterval(fetchEPG, 6 * 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [url]);
  
  return { epgData, isLoading, error };
}

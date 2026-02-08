import { useState } from 'react';
import { Channel, Locale } from '../../types/player';
import { usePlayerTranslation } from '../../hooks/use-player-translation';
import { cn } from '../../lib/utils';

interface ChannelListProps {
  channels: Channel[];
  groups: string[];
  currentChannel: Channel | null;
  onSelect: (channel: Channel) => void;
  locale: Locale;
}

const ChannelList = ({ channels, groups, currentChannel, onSelect, locale }: ChannelListProps) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const t = usePlayerTranslation(locale);
  
  // 过滤频道
  const filteredChannels = selectedGroup 
    ? channels.filter(c => c.group === selectedGroup)
    : channels;
  
  return (
    <div className="h-full flex flex-col">
      {/* 分组筛选 */}
      <div className="p-2 border-b border-border overflow-x-auto">
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedGroup(null)}
            className={cn(
              "px-2 py-1 text-xs rounded whitespace-nowrap",
              selectedGroup === null 
                ? "bg-primary text-primary-foreground" 
                : "bg-muted hover:bg-muted/80"
            )}
          >
            {t('allChannels')}
          </button>
          
          {groups.map(group => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className={cn(
                "px-2 py-1 text-xs rounded whitespace-nowrap",
                selectedGroup === group 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {group}
            </button>
          ))}
        </div>
      </div>
      
      {/* 频道列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {t('noChannelSelected')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                onClick={() => onSelect(channel)}
                className={cn(
                  "px-3 py-2 hover:bg-muted cursor-pointer transition-colors",
                  currentChannel?.id === channel.id && "bg-primary/10 font-medium"
                )}
              >
                <div className="flex items-center gap-2">
                  {channel.logo && (
                    <img
                      src={channel.logo}
                      alt={channel.name}
                      className="w-6 h-6 rounded object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <span className="truncate">{channel.name}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelList;

import { useState, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import Player from './components/player/Player';
import ChannelList from './components/player/ChannelList';
import EPGView from './components/player/EPGView';
import { Channel, PlayerState, PlayMode, EPGProgram } from './types/player';
import { getLastChannelId, getSidebarVisible, saveSidebarVisible } from './lib/player-storage';
import { useM3ULoader } from './hooks/use-m3u-loader';
import { useEPGLoader } from './hooks/use-epg-loader';
import { generateFallbackPrograms } from './lib/epg-parser';
import { usePlayerTranslation } from './hooks/use-player-translation';

// 默认M3U地址（可替换为自定义地址，Cloudflare部署时支持环境变量）
const DEFAULT_M3U_URL = import.meta.env.VITE_M3U_URL || 'https://example.com/playlist.m3u';
const DEFAULT_EPG_URL = import.meta.env.VITE_EPG_URL || 'https://example.com/epg.xml';

type EPGData = Record<string, EPGProgram[]>;

const App = () => {
  const [sidebarVisible, setSidebarVisible] = useState(getSidebarVisible());
  const [playerState, setPlayerState] = useState<PlayerState>({
    currentChannel: null,
    playMode: 'live',
    currentTime: new Date(),
    isPlaying: true,
    volume: 100,
    isMuted: false,
  });
  const [currentPlayingProgram, setCurrentPlayingProgram] = useState<EPGProgram | null>(null);
  
  // 加载M3U和EPG
  const { channels, groups, isLoading: isM3ULoading } = useM3ULoader(DEFAULT_M3U_URL);
  const { epgData, isLoading: isEPGLoading } = useEPGLoader(DEFAULT_EPG_URL);
  
  const t = usePlayerTranslation('zh-Hans');
  
  // 初始化最后播放的频道
  useEffect(() => {
    if (channels.length > 0) {
      const lastChannelId = getLastChannelId();
      const initialChannel = lastChannelId 
        ? channels.find(c => c.id === lastChannelId) 
        : channels[0];
      
      if (initialChannel) {
        setPlayerState(prev => ({
          ...prev,
          currentChannel: initialChannel,
        }));
      }
    }
  }, [channels]);
  
  // 更新当前播放的节目
  useEffect(() => {
    if (!playerState.currentChannel || !epgData) return;
    
    const channelId = playerState.currentChannel.id;
    const programs = epgData[channelId] || [];
    const now = new Date();
    
    // 生成fallback节目
    const allPrograms = [
      ...programs,
      ...generateFallbackPrograms(programs, channelId, 48)
    ].sort((a, b) => a.start.getTime() - b.start.getTime());
    
    // 更新EPG数据（包含fallback）
    const updatedEpgData: EPGData = {
      ...epgData,
      [channelId]: allPrograms
    };
    
    // 查找当前正在播放的节目
    const currentProgram = allPrograms.find(p => 
      p.start <= now && p.end > now
    ) || null;
    
    setCurrentPlayingProgram(currentProgram);
  }, [playerState.currentChannel, epgData, playerState.currentTime]);
  
  // 切换频道
  const handleChannelSelect = (channel: Channel) => {
    setPlayerState(prev => ({
      ...prev,
      currentChannel: channel,
      playMode: 'live',
      currentTime: new Date(),
    }));
  };
  
  // 选择节目（回看）
  const handleProgramSelect = (start: Date, end: Date) => {
    setPlayerState(prev => ({
      ...prev,
      playMode: 'catchup',
      currentTime: start,
    }));
  };
  
  // 切换侧边栏
  const toggleSidebar = () => {
    setSidebarVisible(prev => {
      saveSidebarVisible(!prev);
      return !prev;
    });
  };
  
  // 更新播放器状态
  const updatePlayerState = (updates: Partial<PlayerState>) => {
    setPlayerState(prev => ({ ...prev, ...updates }));
  };
  
  if (isM3ULoading || isEPGLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}...</p>
        </div>
      </div>
    );
  }
  
  return (
    <MainLayout 
      sidebarVisible={sidebarVisible}
      toggleSidebar={toggleSidebar}
    >
      <div className="flex h-full">
        {/* 频道列表侧边栏 */}
        {sidebarVisible && (
          <div className="w-64 border-r border-border bg-card h-full overflow-y-auto">
            <ChannelList 
              channels={channels}
              groups={groups}
              currentChannel={playerState.currentChannel}
              onSelect={handleChannelSelect}
              locale="zh-Hans"
            />
          </div>
        )}
        
        {/* 主内容区 */}
        <div className="flex-1 flex flex-col h-full">
          {/* 播放器 */}
          <div className="flex-1 relative bg-black">
            {playerState.currentChannel ? (
              <Player 
                channel={playerState.currentChannel}
                state={playerState}
                updateState={updatePlayerState}
                locale="zh-Hans"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white">
                {t('noChannelSelected')}
              </div>
            )}
          </div>
          
          {/* EPG节目单 */}
          <div className="h-80 border-t border-border bg-card">
            <EPGView 
              channelId={playerState.currentChannel?.id || null}
              epgData={epgData || {}}
              onProgramSelect={handleProgramSelect}
              locale="zh-Hans"
              supportsCatchup={true}
              currentPlayingProgram={currentPlayingProgram}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default App;

import { useEffect, useRef, useState, useCallback } from 'react';
import mpegts from '@rtp2httpd/mpegts.js';
import { Channel, PlayerState, Locale, PlayMode } from '../../types/player';
import { usePlayerTranslation } from '../../hooks/use-player-translation';
import { cn, formatDuration } from '../../lib/utils';
import { saveLastChannelId, getForce16x9 } from '../../lib/player-storage';
import PlayerControls from './PlayerControls';

interface PlayerProps {
  channel: Channel;
  state: PlayerState;
  updateState: (updates: Partial<PlayerState>) => void;
  locale: Locale;
}

const Player = ({ channel, state, updateState, locale }: PlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<mpegts.Player | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const t = usePlayerTranslation(locale);
  
  // 保存最后播放的频道
  useEffect(() => {
    saveLastChannelId(channel.id);
  }, [channel.id]);
  
  // 初始化/销毁播放器
  const initPlayer = useCallback(() => {
    if (!videoRef.current) return;
    
    // 销毁现有播放器
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    
    // 构建播放URL（支持回看）
    let playUrl = channel.url;
    if (state.playMode === 'catchup') {
      // 拼接回看时间参数（适配rtp2httpd的catchup格式）
      const catchupTime = Math.floor(state.currentTime.getTime() / 1000);
      playUrl = `${playUrl}?catchup=${catchupTime}`;
    }
    
    // 创建新播放器
    const player = mpegts.createPlayer({
      type: 'm2ts',
      isLive: state.playMode === 'live',
      url: playUrl,
    });
    
    player.attachMediaElement(videoRef.current);
    player.load();
    
    // 播放控制
    if (state.isPlaying) {
      player.play().catch(err => console.error('Play error:', err));
    }
    
    // 事件监听
    player.on('timeupdate', () => {
      if (videoRef.current) {
        setCurrentTime(videoRef.current.currentTime);
        setDuration(videoRef.current.duration || 0);
      }
    });
    
    player.on('waiting', () => setIsBuffering(true));
    player.on('playing', () => setIsBuffering(false));
    player.on('ended', () => {
      updateState({ isPlaying: false });
    });
    
    playerRef.current = player;
    
    // 音量控制
    if (videoRef.current) {
      videoRef.current.volume = state.volume / 100;
      videoRef.current.muted = state.isMuted;
    }
    
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [channel.url, state.playMode, state.currentTime, state.isPlaying, state.volume, state.isMuted, updateState]);
  
  // 频道/播放模式变化时重新初始化播放器
  useEffect(() => {
    const cleanup = initPlayer();
    return cleanup;
  }, [channel.id, state.playMode, initPlayer]);
  
  // 播放/暂停控制
  useEffect(() => {
    if (playerRef.current) {
      if (state.isPlaying) {
        playerRef.current.play().catch(err => console.error('Play error:', err));
      } else {
        playerRef.current.pause();
      }
    }
  }, [state.isPlaying]);
  
  // 音量控制
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = state.volume / 100;
    }
  }, [state.volume]);
  
  // 静音控制
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = state.isMuted;
    }
  }, [state.isMuted]);
  
  // 处理播放控制事件
  const handlePlayPause = () => {
    updateState({ isPlaying: !state.isPlaying });
  };
  
  const handleVolumeChange = (volume: number) => {
    updateState({ 
      volume,
      isMuted: volume === 0 ? true : state.isMuted ? false : state.isMuted
    });
  };
  
  const handleMuteToggle = () => {
    updateState({ isMuted: !state.isMuted });
  };
  
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };
  
  const handleModeToggle = () => {
    updateState({
      playMode: state.playMode === 'live' ? 'catchup' : 'live',
      currentTime: state.playMode === 'live' ? new Date(Date.now() - 3600 * 1000) : new Date()
    });
  };
  
  // 强制16:9比例
  const force16x9 = getForce16x9();
  
  return (
    <div className="relative w-full h-full">
      <div 
        className={cn(
          "w-full h-full flex items-center justify-center",
          force16x9 && "aspect-[16/9]"
        )}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          controls={false}
        />
        
        {/* 缓冲指示器 */}
        {isBuffering && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* 播放器控制栏 */}
        <PlayerControls
          isPlaying={state.isPlaying}
          isMuted={state.isMuted}
          volume={state.volume}
          currentTime={currentTime}
          duration={duration}
          playMode={state.playMode}
          onPlayPause={handlePlayPause}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={handleMuteToggle}
          onSeek={handleSeek}
          onModeToggle={handleModeToggle}
          t={t}
          channelName={channel.name}
        />
      </div>
    </div>
  );
};

export default Player;

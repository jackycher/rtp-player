import { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Clock, Live, SkipBack, Maximize } from 'lucide-react';
import { cn, formatDuration } from '../../lib/utils';
import { PlayMode } from '../../types/player';
import { TranslationKey } from '../../lib/locale';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playMode: PlayMode;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSeek: (time: number) => void;
  onModeToggle: () => void;
  t: (key: TranslationKey) => string;
  channelName: string;
}

const PlayerControls = ({
  isPlaying,
  isMuted,
  volume,
  currentTime,
  duration,
  playMode,
  onPlayPause,
  onVolumeChange,
  onMuteToggle,
  onSeek,
  onModeToggle,
  t,
  channelName
}: PlayerControlsProps) => {
  const [showControls, setShowControls] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // 更新进度条
  useEffect(() => {
    if (duration > 0) {
      setProgress((currentTime / duration) * 100);
    }
  }, [currentTime, duration]);
  
  // 自动隐藏控制栏
  useEffect(() => {
    if (!hovered && isPlaying) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [hovered, isPlaying]);
  
  // 处理进度条点击
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    onSeek(newTime);
  };
  
  // 音量控制
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    onVolumeChange(newVolume);
  };
  
  return (
    <div 
      className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent"
      onMouseEnter={() => {
        setHovered(true);
        setShowControls(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 频道名称 */}
      <div className="px-4 py-2 text-white text-sm font-medium">
        {channelName}
        <span className="ml-2 text-xs opacity-70">
          {playMode === 'live' ? t('live') : `${t('catchup')} (${formatDuration(currentTime)})`}
        </span>
      </div>
      
      {/* 控制栏 */}
      <div 
        className={cn(
          "px-4 pb-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* 进度条 */}
        <div 
          className="w-full h-1 bg-white/20 rounded-full mb-3 cursor-pointer"
          onClick={handleProgressClick}
        >
          <div 
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* 控制按钮 */}
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            {/* 播放/暂停 */}
            <button 
              onClick={onPlayPause}
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              aria-label={isPlaying ? t('pause') : t('play')}
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}
            </button>
            
            {/* 音量控制 */}
            <div className="flex items-center gap-2 w-32">
              <button 
                onClick={onMuteToggle}
                className="p-1 hover:bg-white/20 rounded-full transition-colors"
                aria-label={isMuted ? t('unmute') : t('mute')}
              >
                {isMuted ? (
                  <VolumeX size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer"
                style={{
                  accentColor: '#3b82f6'
                }}
                aria-label={t('volume')}
              />
            </div>
            
            {/* 时间显示 */}
            <div className="text-xs">
              {formatDuration(currentTime)} / {duration > 0 ? formatDuration(duration) : '∞'}
            </div>
            
            {/* 播放模式切换 */}
            <button 
              onClick={onModeToggle}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
            >
              {playMode === 'live' ? (
                <Live size={14} />
              ) : (
                <Clock size={14} />
              )}
              {t(playMode)}
            </button>
            
            {/* 回看偏移 */}
            {playMode === 'catchup' && (
              <button 
                onClick={() => onSeek(Math.max(0, currentTime - 300))}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
              >
                <SkipBack size={14} />
                -5{t('minutes')}
              </button>
            )}
          </div>
          
          <div>
            <button 
              className="p-1 hover:bg-white/20 rounded-full transition-colors"
              onClick={() => {
                const video = document.querySelector('video');
                if (video) {
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  } else {
                    video.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
                  }
                }
              }}
              aria-label="Fullscreen"
            >
              <Maximize size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;

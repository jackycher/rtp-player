import { StrictMode, useEffect, useState, useCallback, useMemo, useRef, Activity } from "react";
import { createRoot } from "react-dom/client";
import mpegts from "@rtp2httpd/mpegts.js";
import { Channel, M3UMetadata, PlayMode } from "../types/player";
import { parseM3U, buildCatchupSegments } from "../lib/m3u-parser";
import { loadEPG, getCurrentProgram, getEPGChannelId, EPGData, fillEPGGaps } from "../lib/epg-parser";
import {
  ChannelList,
  nextScrollBehaviorRef as channelListNextScrollBehaviorRef,
} from "../components/player/channel-list";
import { EPGView, nextScrollBehaviorRef as epgViewNextScrollBehaviorRef } from "../components/player/epg-view";
import { VideoPlayer } from "../components/player/video-player";
import { SettingsDropdown } from "../components/player/settings-dropdown";
import { Card } from "../components/ui/card";
import { usePlayerTranslation } from "../hooks/use-player-translation";
import { useLocale } from "../hooks/use-locale";
import { useTheme } from "../hooks/use-theme";
import {
  saveLastChannelId,
  getLastChannelId,
  saveSidebarVisible,
  getSidebarVisible,
  saveCatchupTailOffset,
  getCatchupTailOffset,
  saveForce16x9,
  getForce16x9,
} from "../lib/player-storage";
import { cn } from "../lib/utils";
import { Edit, ExternalLink, RefreshCw, X } from "lucide-react";

// 新增：自定义M3U URL的本地存储工具函数
const STORAGE_KEY_CUSTOM_M3U_URL = "rtp2httpd-player-custom-m3u-url";

function saveCustomM3uUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_M3U_URL, url);
  } catch (error) {
    console.error("Failed to save custom M3U URL:", error);
  }
}

function getCustomM3uUrl(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_M3U_URL);
  } catch (error) {
    console.error("Failed to get custom M3U URL:", error);
    return null;
  }
}

function clearCustomM3uUrl(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_M3U_URL);
  } catch (error) {
    console.error("Failed to clear custom M3U URL:", error);
  }
}

function PlayerPage() {
  const { locale, setLocale } = useLocale("player-locale");
  const { theme, setTheme } = useTheme("player-theme");
  const t = usePlayerTranslation(locale);

  const [metadata, setMetadata] = useState<M3UMetadata | null>(null);
  const [epgData, setEpgData] = useState<EPGData>({});
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [playMode, setPlayMode] = useState<PlayMode>("live");
  const [playbackSegments, setPlaybackSegments] = useState<mpegts.MediaSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(() => getSidebarVisible());
  const [sidebarView, setSidebarView] = useState<"channels" | "epg">("channels");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [catchupTailOffset, setCatchupTailOffset] = useState(() => getCatchupTailOffset());
  const [force16x9, setForce16x9] = useState(() => getForce16x9());
  // 新增：自定义M3U地址相关状态
  const [customM3uUrl, setCustomM3uUrl] = useState(() => getCustomM3uUrl() || "");
  const [tempM3uUrl, setTempM3uUrl] = useState(customM3uUrl);
  const [showM3uUrlInput, setShowM3uUrlInput] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Track stream start time - the absolute time position when current stream started
  // For live mode: null (no seeking)
  // For catchup mode: the time user seeked to (start of catchup stream)
  const [streamStartTime, setStreamStartTime] = useState<Date>(() => new Date());

  // Track current video playback time in seconds (relative to stream start)
  const [currentVideoTime, setCurrentVideoTime] = useState(0);

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Track mobile/desktop state
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!currentChannel) return;

    const now = new Date();

    if (streamStartTime.getTime() > now.getTime() - 3000) {
      setPlaybackSegments([
        {
          url: currentChannel.url,
          duration: 0,
        },
      ]);
      setPlayMode("live");
      return;
    }

    // Check if channel supports catchup
    if (!currentChannel.catchup || !currentChannel.catchupSource) {
      return;
    }

    setPlaybackSegments(buildCatchupSegments(currentChannel, streamStartTime, catchupTailOffset));
    setPlayMode("catchup");
  }, [currentChannel, streamStartTime, catchupTailOffset]);

  const handleVideoSeek = useCallback(
    (seekTime: Date) => {
      const now = new Date();
      if (seekTime.getTime() > now.getTime() - 30 * 1000) {
        if (streamStartTime < seekTime) {
          setStreamStartTime(now);
        } else {
          setStreamStartTime(new Date(now.getTime() - 30 * 1000));
        }
      } else {
        setStreamStartTime(seekTime);
      }
    },
    [streamStartTime],
  );

  const selectChannel = useCallback((channel: Channel) => {
    setCurrentChannel(channel);
    setStreamStartTime(new Date());
  }, []);

  // Save last played channel when in live mode
  useEffect(() => {
    if (currentChannel && playMode === "live") {
      saveLastChannelId(currentChannel.id);
    }
  }, [currentChannel, playMode]);

  const handleChannelNavigate = useCallback(
    (target: "prev" | "next" | number) => {
      if (!metadata || !metadata.channels.length) return;

      if (target === "prev" || target === "next") {
        if (!currentChannel) return;
        const currentIndex = metadata.channels.findIndex((ch) => ch === currentChannel);
        let nextIndex = 0;

        if (target === "prev") {
          // Wrap around to last channel if at first channel
          nextIndex = currentIndex > 0 ? currentIndex - 1 : metadata.channels.length - 1;
        } else {
          // Wrap around to first channel if at last channel
          nextIndex = currentIndex < metadata.channels.length - 1 ? currentIndex + 1 : 0;
        }
        selectChannel(metadata.channels[nextIndex]);
      } else {
        const channel = metadata.channels[target - 1];
        if (channel) {
          selectChannel(channel);
        }
      }
    },
    [metadata, currentChannel, selectChannel],
  );

  // 改造：支持自定义M3U URL加载
  const loadPlaylist = useCallback(async (customUrl?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // 确定最终使用的M3U地址：优先使用传入的自定义地址 > 保存的自定义地址 > 默认地址
      const m3uUrl = customUrl || (customM3uUrl || "/playlist.m3u");
      
      const response = await fetch(m3uUrl, {
        mode: m3uUrl.startsWith("http") ? "cors" : "same-origin",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      
      if (!response.ok) {
        throw new Error(`${t("failedToLoadPlaylist")} (${response.status} ${response.statusText})`);
      }

      const content = await response.text();
      const parsed = parseM3U(content);
      setMetadata(parsed);

      // Load EPG if available
      if (parsed.tvgUrl) {
        // Build set of valid channel IDs from M3U for filtering
        // Use tvgId, tvgName, and name for EPG matching (with fallback logic)
        const validChannelIds = new Set<string>();
        parsed.channels.forEach((channel) => {
          if (channel.tvgId) validChannelIds.add(channel.tvgId);
          if (channel.tvgName) validChannelIds.add(channel.tvgName);
          validChannelIds.add(channel.name);
        });

        // Build EPG URL with token if available
        const epgUrl = parsed.tvgUrl.replace(".gz", "");

        // Load EPG and filter to only channels in M3U
        loadEPG(epgUrl, validChannelIds)
          .then((epg) => {
            // Fill gaps in EPG data with 2-hour fallback programs for catchup-capable channels
            const filledEpg = fillEPGGaps(epg, parsed.channels);
            setEpgData(filledEpg);
          })
          .catch((err) => {
            console.error("Failed to load EPG:", err);
            // Even if EPG loading fails, generate fallback programs for catchup-capable channels
            const fallbackEpg = fillEPGGaps({}, parsed.channels);
            setEpgData(fallbackEpg);
          });
      } else {
        // No EPG URL provided, generate fallback programs for catchup-capable channels
        const fallbackEpg = fillEPGGaps({}, parsed.channels);
        setEpgData(fallbackEpg);
      }

      // Try to restore last played channel, otherwise select first channel
      if (parsed.channels.length > 0) {
        const lastChannelId = getLastChannelId();
        let channelToSelect = parsed.channels[0];

        if (lastChannelId) {
          const lastChannel = parsed.channels.find((ch) => ch.id === lastChannelId);
          if (lastChannel) {
            channelToSelect = lastChannel;
          }
        }

        selectChannel(channelToSelect);
      }

      // Trigger reveal animation
      setIsRevealing(true);
      window.setTimeout(() => {
        setIsLoading(false);
      }, 500); // Match zoom-fade-out animation duration
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("failedToLoadPlaylist");
      setError(errorMsg);
      setIsLoading(false);
    }
  }, [t, selectChannel, customM3uUrl]);

  // 新增：保存自定义M3U地址并加载
  const handleSaveM3uUrl = useCallback(() => {
    if (!tempM3uUrl.trim()) {
      // 清空自定义地址，使用默认地址
      clearCustomM3uUrl();
      setCustomM3uUrl("");
    } else {
      saveCustomM3uUrl(tempM3uUrl.trim());
      setCustomM3uUrl(tempM3uUrl.trim());
    }
    setShowM3uUrlInput(false);
    // 重新加载播放列表
    loadPlaylist(tempM3uUrl.trim() || undefined);
  }, [tempM3uUrl, loadPlaylist]);

  // 新增：重置为默认M3U地址
  const handleResetM3uUrl = useCallback(() => {
    clearCustomM3uUrl();
    setCustomM3uUrl("");
    setTempM3uUrl("");
    loadPlaylist();
  }, [loadPlaylist]);

  // Load playlist on mount
  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  // Get current program for the video player
  // Use tvgId / tvgName / name with fallback logic for EPG matching
  // Use streamStartTime + currentVideoTime to determine the actual time position
  const currentVideoProgram = useMemo(() => {
    if (!currentChannel) return null;

    // Get EPG channel ID using fallback logic (tvgId -> tvgName -> name)
    const epgChannelId = getEPGChannelId(currentChannel, epgData);
    if (!epgChannelId) return null;

    // Calculate absolute time based on stream start + current video position
    const absoluteTime = new Date(streamStartTime.getTime() + currentVideoTime * 1000);
    return getCurrentProgram(epgChannelId, epgData, absoluteTime);
  }, [currentChannel, epgData, streamStartTime, currentVideoTime]);

  const handleVideoError = useCallback((err: string) => {
    setError(err);
  }, []);

  // Handle fullscreen toggle
  const handleFullscreenToggle = useCallback(() => {
    if (pageContainerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setShowSidebar(true);
      } else {
        pageContainerRef.current.requestFullscreen();
        setShowSidebar(false);
      }
    }
  }, []);

  const handleCatchupTailOffsetChange = useCallback((offset: number) => {
    setCatchupTailOffset(offset);
    saveCatchupTailOffset(offset);
  }, []);

  const handleForce16x9Change = useCallback((enabled: boolean) => {
    setForce16x9(enabled);
    saveForce16x9(enabled);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setShowSidebar((prev) => {
      const newState = !prev;
      saveSidebarVisible(newState);
      return newState;
    });
  }, []);

  // 改造：在设置区域添加M3U地址编辑按钮
  const settingsSlot = useMemo(() => {
    return (
      <div className="flex items-center gap-2">
        {/* 新增：M3U地址编辑按钮 */}
        <button
          onClick={() => {
            setTempM3uUrl(customM3uUrl);
            setShowM3uUrlInput(true);
          }}
          className="flex items-center gap-1 rounded p-1 text-xs hover:bg-muted transition-colors"
          title={t("editM3UUrl") || "Edit M3U URL"}
        >
          <Edit className="h-4 w-4 text-muted-foreground" />
        </button>
        
        <SettingsDropdown
          locale={locale}
          onLocaleChange={setLocale}
          theme={theme}
          onThemeChange={setTheme}
          catchupTailOffset={catchupTailOffset}
          onCatchupTailOffsetChange={handleCatchupTailOffsetChange}
          force16x9={force16x9}
          onForce16x9Change={handleForce16x9Change}
        />
        
        {/* 新增：M3U地址输入弹窗 */}
        {showM3uUrlInput && (
          <div className="absolute right-0 top-full mt-2 w-80 rounded-md border border-border bg-card p-3 shadow-lg z-50">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">{t("editM3UUrl") || "Custom M3U URL"}</h4>
              <button
                onClick={() => setShowM3uUrlInput(false)}
                className="rounded p-0.5 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="url"
                value={tempM3uUrl}
                onChange={(e) => setTempM3uUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u or /playlist.m3u"
                className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleResetM3uUrl}
                  className="flex-1 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/80"
                >
                  {t("resetToDefault") || "Reset to Default"}
                </button>
                <button
                  onClick={handleSaveM3uUrl}
                  className="flex-1 rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
                >
                  {t("save") || "Save & Load"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }, [
    locale,
    theme,
    catchupTailOffset,
    force16x9,
    setLocale,
    setTheme,
    handleCatchupTailOffsetChange,
    handleForce16x9Change,
    customM3uUrl,
    tempM3uUrl,
    showM3uUrlInput,
    handleSaveM3uUrl,
    handleResetM3uUrl,
    t,
  ]);

  // Main UI content
  const mainContent = (
    <div ref={pageContainerRef} className="flex h-dvh flex-col bg-background">
      <title>{t("title")}</title>

      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Video Player - Mobile: fixed aspect ratio at top, Desktop: fills left side */}
        <div className="w-full sticky md:static md:flex-1 shrink-0">
          <VideoPlayer
            channel={currentChannel}
            segments={playbackSegments}
            liveSync={playMode === "live"}
            onError={handleVideoError}
            locale={locale}
            currentProgram={currentVideoProgram}
            onSeek={handleVideoSeek}
            streamStartTime={streamStartTime}
            currentVideoTime={currentVideoTime}
            onCurrentVideoTimeChange={setCurrentVideoTime}
            onChannelNavigate={handleChannelNavigate}
            showSidebar={showSidebar}
            onToggleSidebar={handleToggleSidebar}
            onFullscreenToggle={handleFullscreenToggle}
            force16x9={force16x9}
          />
        </div>

        {/* Sidebar - Mobile: always visible (below video, hidden in fullscreen), Desktop: toggle-able side panel (visible in fullscreen) */}
        <div
          className={cn(
            "flex flex-col w-full md:w-80 md:border-l border-t md:border-t-0 border-border bg-card flex-1 md:flex-initial overflow-hidden",
            (showSidebar || isMobile) && !(isFullscreen && isMobile) ? "" : "hidden",
          )}
        >
          {/* Sidebar Tabs */}
          <div className="flex items-center border-b border-border shrink-0">
            <button
              onClick={() => {
                channelListNextScrollBehaviorRef.current = "instant";
                setSidebarView("channels");
              }}
              className={cn(
                "flex-1 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium",
                sidebarView === "channels"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground cursor-pointer hover:text-foreground",
              )}
            >
              {t("channels")} ({metadata?.channels.length || 0})
              {/* 新增：显示当前使用的M3U地址标识 */}
              {customM3uUrl && (
                <ExternalLink className="inline ml-1 h-3 w-3 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={() => {
                epgViewNextScrollBehaviorRef.current = "instant";
                setSidebarView("epg");
              }}
              className={cn(
                "flex-1 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm font-medium",
                sidebarView === "epg"
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground cursor-pointer hover:text-foreground",
              )}
            >
              {t("programGuide")}
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-hidden">
            <Activity mode={sidebarView === "channels" ? "visible" : "hidden"}>
              <ChannelList
                channels={metadata?.channels}
                groups={metadata?.groups}
                currentChannel={currentChannel}
                onChannelSelect={selectChannel}
                locale={locale}
                settingsSlot={settingsSlot}
              />
            </Activity>
            <Activity mode={sidebarView === "epg" ? "visible" : "hidden"}>
              <EPGView
                channelId={currentChannel ? getEPGChannelId(currentChannel, epgData) : null}
                epgData={epgData}
                onProgramSelect={handleVideoSeek}
                locale={locale}
                supportsCatchup={!!(currentChannel?.catchup && currentChannel?.catchupSource)}
                currentPlayingProgram={currentVideoProgram}
              />
            </Activity>
          </div>
        </div>
      </div>
    </div>
  );

  if (error && !metadata) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-6">
          <div className="mb-4 text-xl font-semibold text-destructive">{t("error")}</div>
          <div className="mb-4 text-sm">{error}</div>
          
          {/* 新增：错误页面添加M3U地址输入 */}
          <div className="mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">{t("customM3UUrl") || "Custom M3U URL"}</h4>
              <button
                onClick={handleResetM3uUrl}
                className="text-xs text-primary hover:underline"
              >
                {t("resetToDefault") || "Reset"}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={tempM3uUrl}
                onChange={(e) => setTempM3uUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSaveM3uUrl}
                className="rounded bg-primary px-3 py-2 text-xs text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <button
            onClick={loadPlaylist}
            className="w-full rounded bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            {t("retry")}
          </button>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Main content rendered below (will be revealed) */}
      {mainContent}
      {/* Loading overlay */}
      {isLoading && (
        <div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-background",
            isRevealing && "animate-[zoom-fade-out_0.5s_ease-out_forwards]",
          )}
        >
          <div className="text-center space-y-4">
            {/* Loading spinner */}
            <div className="h-12 w-12 mx-auto rounded-full border-4 border-muted border-t-primary animate-spin" />
            {/* 新增：显示当前加载的M3U地址 */}
            {customM3uUrl && (
              <p className="text-xs text-muted-foreground">
                {t("loadingFrom") || "Loading from"}: {customM3uUrl}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Mount the app
createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PlayerPage />
  </StrictMode>,
);

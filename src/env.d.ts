/// <reference types="astro/client" />
declare const __BUILD_ID__: string;
declare const __SQL_WASM_HASH__: string;

interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  getPlayerState(): number;
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  destroy(): void;
}

interface Window {
  YT?: {
    Player: new (
      el: HTMLElement,
      opts: {
        videoId: string;
        host?: string;
        playerVars?: Record<string, number | string>;
        events?: Record<string, (e: unknown) => void>;
      }
    ) => YtPlayer;
    PlayerState?: {
      PLAYING: number;
    };
  };
  onYouTubeIframeAPIReady?: () => void;
}

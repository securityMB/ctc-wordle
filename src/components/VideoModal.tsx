import { useEffect, useRef } from 'preact/hooks';
import { isSolved, type Game } from '../lib/wordle.ts';

let ytApiPromise: Promise<void> | null = null;

function loadYtIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!ytApiPromise) {
    ytApiPromise = new Promise<void>((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      document.head.appendChild(script);
    });
  }
  return ytApiPromise;
}

interface VideoModalProps {
  game: Game;
  onClose: () => void;
}

/**
 * Modal dialog embedding a YouTube player for a single Wordle solve with keyboard shortcuts.
 */
export default function VideoModal({ game, onClose }: VideoModalProps) {
  const playerMountRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<{
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    seekTo(seconds: number, allowSeekAhead: boolean): void;
    destroy(): void;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    void loadYtIframeApi().then(() => {
      if (cancelled || !playerMountRef.current || !window.YT?.Player) return;
      playerMountRef.current.textContent = '';
      const target = document.createElement('div');
      playerMountRef.current.appendChild(target);
      ytPlayerRef.current = new window.YT.Player(target, {
        videoId: game.youtubeId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, enablejsapi: 1 },
      });
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const player = ytPlayerRef.current;
      if (!player) return;

      if (e.code === 'Space') {
        e.preventDefault();
        const playingState = window.YT?.PlayerState?.PLAYING ?? 1;
        if (player.getPlayerState() === playingState) {
          player.pauseVideo();
        } else {
          player.playVideo();
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        player.seekTo(Math.max(0, player.getCurrentTime() - 10), true);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        player.seekTo(player.getCurrentTime() + 10, true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelled = true;
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      ytPlayerRef.current?.destroy();
      ytPlayerRef.current = null;
    };
  }, [game, onClose]);

  const solved = isSolved(game);

  return (
    <div
      class="video-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Wordle ${game.date} — ${game.correctWord}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="video-modal">
        <div class="video-modal-header">
          <div class="video-modal-title">
            <span class="video-modal-date">{game.date}</span>
            <span class="video-modal-word">{game.correctWord}</span>
            <span class={`score-badge ${solved ? 'win' : 'fail'}`}>
              {solved ? `${game.guesses.length}/6` : 'X/6'}
            </span>
            {typeof game.solveTimeSeconds === 'number' && (
              <span class="video-modal-time">{game.solveTimeSeconds.toFixed(1)}s</span>
            )}
          </div>
          <div class="video-modal-actions">
            <a
              class="video-modal-ext"
              href={`https://youtu.be/${encodeURIComponent(game.youtubeId)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTube ↗
            </a>
            <button
              type="button"
              class="video-modal-close"
              aria-label="Close video"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <div class="video-modal-player" ref={playerMountRef} />
        <div class="video-modal-footer">
          <span>Space: play/pause · ←/→: ±10s · Esc: close</span>
        </div>
      </div>
    </div>
  );
}

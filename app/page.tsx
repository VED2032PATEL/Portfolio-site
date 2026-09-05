'use client';

import dynamic from 'next/dynamic';
import {
  type AnimationEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { PortfolioContent, CHAPTERS } from '@/components/portfolio-content';
import { Button } from '@/components/ui/button';

const CharacterCanvas = dynamic(() => import('@/components/mascot-scene'), {
  ssr: false,
});

const PROMPT_INTERVAL_MS = 120_000;

type VoiceCue = 'prompt' | 'slider';
type ShutterPhase = 'idle' | 'pull' | 'release';

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [pullSequence, setPullSequence] = useState(0);
  const [shutterPhase, setShutterPhase] = useState<ShutterPhase>('idle');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<VoiceCue[]>([]);
  const soundEnabledRef = useRef(false);
  const transitioningRef = useRef(false);
  const playCueRef = useRef<(cue: VoiceCue) => void>(() => undefined);
  const isTransitioning = shutterPhase !== 'idle';

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = '/audio/spidey-hey.mp3';
    voiceAudio.current = audio;

    const play = (cue: VoiceCue) => {
      if (!soundEnabledRef.current) return;

      if (!audio.paused && !audio.ended) {
        if (!audioQueue.current.includes(cue)) audioQueue.current.push(cue);
        return;
      }

      audio.src =
        cue === 'prompt' ? '/audio/spidey-hey.mp3' : '/audio/spidey-slider.mp3';
      audio.volume = cue === 'prompt' ? 0.75 : 0.87;
      audio.currentTime = 0;
      void audio.play().catch(() => {
        audioQueue.current = [];
        soundEnabledRef.current = false;
        setSoundEnabled(false);
      });
    };

    const handleEnded = () => {
      const nextCue = audioQueue.current.shift();
      if (nextCue) play(nextCue);
    };

    playCueRef.current = play;
    audio.addEventListener('ended', handleEnded);

    return () => {
      soundEnabledRef.current = false;
      audioQueue.current = [];
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audio.removeAttribute('src');
      voiceAudio.current = null;
      playCueRef.current = () => undefined;
    };
  }, []);

  const toggleSound = useCallback(() => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      audioQueue.current = [];
      const audio = voiceAudio.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      return;
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playCueRef.current('prompt');
  }, []);

  const showNextChapter = useCallback(() => {
    if (transitioningRef.current) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setChapter((value) => (value + 1) % CHAPTERS.length);
      playCueRef.current('slider');
      return;
    }

    transitioningRef.current = true;
    setShutterPhase('pull');
    setPullSequence((value) => value + 1);
  }, []);

  const handleShutterAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget) return;

      if (shutterPhase === 'pull') {
        setChapter((value) => (value + 1) % CHAPTERS.length);
        playCueRef.current('slider');
        setShutterPhase('release');
        return;
      }

      if (shutterPhase === 'release') {
        transitioningRef.current = false;
        setShutterPhase('idle');
      }
    },
    [shutterPhase],
  );

  useEffect(() => {
    if (shutterPhase === 'idle') return;
    const failSafe = window.setTimeout(() => {
      transitioningRef.current = false;
      setShutterPhase('idle');
    }, 5000);
    return () => window.clearTimeout(failSafe);
  }, [shutterPhase]);

  useEffect(() => {
    if (!soundEnabled) return;
    const promptTimer = window.setInterval(
      () => playCueRef.current('prompt'),
      PROMPT_INTERVAL_MS,
    );
    return () => window.clearInterval(promptTimer);
  }, [soundEnabled]);

  return (
    <main className="portfolio-shell">
      <header className="site-header">
        <span className="wordmark">
          YOUR NAME<span>®</span>
        </span>
        <div className="header-actions">
          <span className="header-note">Independent by design.</span>
          <Button
            className="sound-control"
            variant="outline"
            size="sm"
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={
              soundEnabled
                ? 'Turn character voice off'
                : 'Turn character voice on'
            }
          >
            {soundEnabled ? (
              <Volume2 aria-hidden="true" />
            ) : (
              <VolumeX aria-hidden="true" />
            )}
            <span>{soundEnabled ? 'Voice on' : 'Voice off'}</span>
          </Button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Chapter {chapter + 1} of {CHAPTERS.length}: {CHAPTERS[chapter]}
      </p>

      <div className="content-layer" key={chapter}>
        <PortfolioContent index={chapter} />
      </div>

      {isTransitioning && (
        <div
          className={`shutter shutter--${shutterPhase}`}
          key={pullSequence}
          aria-hidden="true"
          onAnimationEnd={handleShutterAnimationEnd}
        >
          <div className="shutter-grip" />
          <span className="shutter-index">
            0
            {(shutterPhase === 'pull'
              ? (chapter + 1) % CHAPTERS.length
              : chapter) + 1}
          </span>
        </div>
      )}

      <section className="character-stage" aria-hidden="true">
        <CharacterCanvas pullSequence={pullSequence} />
      </section>

      <div className="character-controls">
        <Button
          className="chest-control"
          variant="ghost"
          type="button"
          aria-disabled={isTransitioning}
          onClick={showNextChapter}
          aria-label={`Pull down the next portfolio chapter: ${CHAPTERS[(chapter + 1) % CHAPTERS.length]}`}
        >
          <span className="chest-control-ring" aria-hidden="true" />
          <span className="chest-control-label">Next chapter</span>
        </Button>
      </div>

      <footer className="site-footer">
        <span>Sample portfolio · your story goes here</span>
        <span>
          0{chapter + 1} / 03 — {CHAPTERS[chapter]}
        </span>
      </footer>
    </main>
  );
}

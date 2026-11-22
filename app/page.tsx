'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { PortfolioContent, CHAPTERS } from '@/components/portfolio-content';
import { Button } from '@/components/ui/button';
import { WEB_PULL, smoothstep } from '@/lib/mascot-motion';

const CharacterCanvas = dynamic(() => import('@/components/mascot-scene'), {
  ssr: false,
});

const PROMPT_INTERVAL_MS = 120_000;

type VoiceCue = 'prompt' | 'slider' | 'reaction';
type ShutterPhase = 'idle' | 'pull';

function PageFooter({ chapter }: { chapter: number }) {
  return (
    <footer className="site-footer">
      <span>Ved Patel · Code, curiosity, and a little character.</span>
      <span>
        0{chapter + 1} / 0{CHAPTERS.length} — {CHAPTERS[chapter]}
      </span>
    </footer>
  );
}

export default function Home() {
  const [chapter, setChapter] = useState(0);
  const [incomingChapter, setIncomingChapter] = useState<number | null>(null);
  const [pullSequence, setPullSequence] = useState(0);
  const [speechSequence, setSpeechSequence] = useState(0);
  const [shutterPhase, setShutterPhase] = useState<ShutterPhase>('idle');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const audioQueue = useRef<VoiceCue[]>([]);
  const soundEnabledRef = useRef(false);
  const transitioningRef = useRef(false);
  const shutterPhaseRef = useRef<ShutterPhase>('idle');
  const shutterRef = useRef<HTMLDivElement | null>(null);
  const playCueRef = useRef<(cue: VoiceCue) => void>(() => undefined);
  const isTransitioning = shutterPhase !== 'idle';

  useEffect(() => {
    if (!isTransitioning) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [isTransitioning]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = '/audio/spidey-hey.mp3';
    voiceAudio.current = audio;

    const play = (cue: VoiceCue) => {
      if (!soundEnabledRef.current) return;

      if (!audio.paused && !audio.ended) {
        if (cue !== 'reaction') {
          if (!audioQueue.current.includes(cue)) audioQueue.current.push(cue);
          return;
        }

        audioQueue.current = [];
        audio.pause();
      }

      const sources: Record<VoiceCue, string> = {
        prompt: '/audio/spidey-hey.mp3',
        slider: '/audio/spidey-slider.mp3',
        reaction: '/audio/spidey-reaction.mp3',
      };
      const volumes: Record<VoiceCue, number> = {
        prompt: 0.75,
        slider: 0.87,
        reaction: 0.85,
      };

      audio.src = sources[cue];
      audio.volume = volumes[cue];
      audio.currentTime = 0;
      setIsSpeaking(true);
      setSpeechSequence((value) => value + 1);
      void audio.play().catch(() => {
        audioQueue.current = [];
        soundEnabledRef.current = false;
        setSoundEnabled(false);
        setIsSpeaking(false);
      });
    };

    const handleEnded = () => {
      const nextCue = audioQueue.current.shift();
      if (nextCue) {
        play(nextCue);
      } else {
        setIsSpeaking(false);
      }
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
      setIsSpeaking(false);
      return;
    }

    soundEnabledRef.current = true;
    setSoundEnabled(true);
    playCueRef.current('prompt');
  }, []);

  const showChapter = useCallback(
    (nextChapter: number) => {
      if (transitioningRef.current) return;
      if (nextChapter === chapter) return;
      window.scrollTo({ top: 0, behavior: 'instant' });

      if (
        !modelReady ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        setChapter(nextChapter);
        playCueRef.current('slider');
        return;
      }

      transitioningRef.current = true;
      shutterPhaseRef.current = 'pull';
      setIncomingChapter(nextChapter);
      setShutterPhase('pull');
      setPullSequence((value) => value + 1);
    },
    [chapter, modelReady],
  );

  const showNextChapter = useCallback(() => {
    if (!modelReady) return;
    showChapter((chapter + 1) % CHAPTERS.length);
  }, [chapter, showChapter, modelReady]);

  const handleCursorOverload = useCallback(() => {
    playCueRef.current('reaction');
  }, []);

  const handleModelReady = useCallback(() => setModelReady(true), []);

  const handlePullFrame = useCallback(
    (elapsedSeconds: number, pullProgress = 0) => {
      const shutter = shutterRef.current;
      if (!shutter) return;

      const shutterViewportY = 0.008 + 0.992 * pullProgress;
      const gripOpacity =
        1 - smoothstep((elapsedSeconds - WEB_PULL.land) / 0.27);

      shutter.style.setProperty(
        '--shutter-translate-y',
        `${(shutterViewportY - 1) * 100}%`,
      );
      shutter.style.setProperty('--shutter-content-opacity', '1');
      shutter.style.setProperty('--shutter-footer-opacity', '1');
      shutter.style.setProperty('--shutter-grip-opacity', String(gripOpacity));
    },
    [],
  );

  const finishPull = useCallback(() => {
    if (shutterPhaseRef.current !== 'pull') return;
    shutterPhaseRef.current = 'idle';
    if (incomingChapter !== null) setChapter(incomingChapter);
    playCueRef.current('slider');
    transitioningRef.current = false;
    setIncomingChapter(null);
    setShutterPhase('idle');
  }, [incomingChapter]);

  useEffect(() => {
    if (!soundEnabled) return;
    const promptTimer = window.setInterval(
      () => playCueRef.current('prompt'),
      PROMPT_INTERVAL_MS,
    );
    return () => window.clearInterval(promptTimer);
  }, [soundEnabled]);

  return (
    <main className="portfolio-shell" data-transitioning={isTransitioning}>
      <header className="site-header">
        <span className="wordmark">
          VED PATEL<span>·</span>
        </span>
        <div className="header-actions">
          <span className="header-note">AI, software & curiosity.</span>
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

      <div
        className="content-layer"
        key={`chapter-${chapter}`}
        inert={isTransitioning}
      >
        <PortfolioContent index={chapter} />
      </div>

      <nav className="chapter-nav" aria-label="Portfolio chapters">
        {CHAPTERS.map((name, index) => (
          <button
            key={name}
            type="button"
            aria-current={chapter === index ? 'page' : undefined}
            disabled={isTransitioning}
            onClick={() => showChapter(index)}
          >
            <span>0{index + 1}</span> {name}
          </button>
        ))}
      </nav>

      {isTransitioning && (
        <div
          ref={shutterRef}
          className={`shutter shutter--${shutterPhase}`}
          key={`pull-${pullSequence}`}
          aria-hidden="true"
          inert
        >
          <div className="shutter-content">
            <PortfolioContent
              index={incomingChapter ?? (chapter + 1) % CHAPTERS.length}
            />
          </div>
          <PageFooter
            chapter={incomingChapter ?? (chapter + 1) % CHAPTERS.length}
          />
          <div className="shutter-grip" />
        </div>
      )}

      <section className="character-stage" aria-hidden="true">
        <CharacterCanvas
          pullSequence={pullSequence}
          speechSequence={speechSequence}
          isSpeaking={isSpeaking}
          onCursorOverload={handleCursorOverload}
          onPullFrame={handlePullFrame}
          onPullComplete={finishPull}
          onReady={handleModelReady}
        />
      </section>

      <div className="character-controls">
        <Button
          className="chest-control"
          variant="ghost"
          type="button"
          aria-disabled={isTransitioning || !modelReady}
          onClick={showNextChapter}
          aria-label={`Pull down the next portfolio chapter: ${CHAPTERS[(chapter + 1) % CHAPTERS.length]}`}
        >
          <span className="chest-control-ring" aria-hidden="true" />
          <span className="chest-control-label">
            {modelReady ? 'Next chapter' : 'Loading character'}
          </span>
        </Button>
      </div>

      <PageFooter chapter={chapter} />
    </main>
  );
}

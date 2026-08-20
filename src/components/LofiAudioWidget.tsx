import React, { useState, useEffect, useRef } from 'react';

export type LofiTheme = 'focus' | 'relax' | 'deep' | 'rain';

interface LofiAudioWidgetProps {
  initialTheme?: LofiTheme;
  isEmbedded?: boolean; // If true, renders as an inline card instead of floating overlay
  className?: string;
}

interface ThemeConfig {
  id: LofiTheme;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  bpm: number;
}

const THEMES: ThemeConfig[] = [
  {
    id: 'focus',
    title: 'Odaklanma',
    subtitle: '70 BPM Warm Lo-Fi Beat & Chords',
    icon: 'headphones',
    color: 'from-indigo-600 to-purple-600',
    bpm: 70,
  },
  {
    id: 'relax',
    title: 'Rahatlama',
    subtitle: '60 BPM Soft Chill Piano & Ocean',
    icon: 'spa',
    color: 'from-amber-500 to-rose-500',
    bpm: 60,
  },
  {
    id: 'deep',
    title: 'Derin Çalışma',
    subtitle: 'Alpha Wave Ambient Pad',
    icon: 'psychology',
    color: 'from-teal-600 to-emerald-600',
    bpm: 50,
  },
  {
    id: 'rain',
    title: 'Yağmur & Doğa',
    subtitle: 'Sakinleştirici Yağmur & Rüzgar',
    icon: 'water_drop',
    color: 'from-blue-600 to-cyan-600',
    bpm: 40,
  },
];

// Frequencies for smooth chill chord progressions (Cmaj7, Am7, Fmaj7, G7)
const CHORDS_MAP: Record<LofiTheme, number[][]> = {
  focus: [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 349.23], // G7
  ],
  relax: [
    [196.00, 246.94, 293.66, 392.00], // G/B
    [164.81, 196.00, 246.94, 293.66], // Em7
    [146.83, 174.61, 220.00, 261.63], // Dm7
    [130.81, 164.81, 196.00, 246.94], // Cmaj7
  ],
  deep: [
    [110.00, 164.81, 220.00, 277.18], // A2 drone + A3
    [116.54, 174.61, 233.08, 293.66], // Bb drone
  ],
  rain: [
    [130.81, 196.00, 261.63], // C3 drone
  ],
};

export const LofiAudioWidget: React.FC<LofiAudioWidgetProps> = ({
  initialTheme = 'focus',
  isEmbedded = false,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<LofiTheme>(initialTheme);
  const [volume, setVolume] = useState<number>(0.4); // 0.0 to 1.0
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  // Draggable Floating Widget State
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; moved: boolean }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    moved: false,
  });
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (!widgetRef.current) return;

    const rect = widgetRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
      moved: false,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !widgetRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }

    if (dragRef.current.moved) {
      const rect = widgetRef.current.getBoundingClientRect();
      const width = rect.width || 130;
      const height = rect.height || 48;
      const maxX = Math.max(10, window.innerWidth - width - 12);
      const maxY = Math.max(10, window.innerHeight - height - 12);

      let newX = dragRef.current.initialX + dx;
      let newY = dragRef.current.initialY + dy;

      newX = Math.max(12, Math.min(maxX, newX));
      newY = Math.max(12, Math.min(maxY, newY));

      setPosition({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleButtonClick = () => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setIsExpanded((prev) => !prev);
  };

  // Web Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const stepRef = useRef<number>(0);

  // Initialize or resume Web Audio Context
  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      masterGainRef.current = masterGain;
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Noise generator for vinyl crackle or rain shower
  const startNoiseGenerator = (ctx: AudioContext, gainNode: GainNode, theme: LofiTheme) => {
    try {
      if (noiseSourceRef.current) {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
        noiseSourceRef.current = null;
      }

      const bufferSize = ctx.sampleRate * 2; // 2 seconds buffer
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Pink noise algorithm
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.05; // Scale down
        b6 = white * 0.115926;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      // Filter settings based on theme
      const filter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();

      if (theme === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, ctx.currentTime);
        noiseGain.gain.setValueAtTime(0.25, ctx.currentTime);
      } else if (theme === 'relax') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, ctx.currentTime);
        filter.Q.setValueAtTime(1.0, ctx.currentTime);
        noiseGain.gain.setValueAtTime(0.12, ctx.currentTime);
      } else {
        // Subtle vinyl crackle filter
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, ctx.currentTime);
        noiseGain.gain.setValueAtTime(0.04, ctx.currentTime);
      }

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(gainNode);

      noise.start();
      noiseSourceRef.current = noise;
    } catch (e) {
      console.warn('Noise synthesis error:', e);
    }
  };

  // Play a soft synth chord note
  const playChordNotes = (ctx: AudioContext, gainNode: GainNode, freqs: number[], duration = 2.0) => {
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      // Soft triangle + sine blend for warm lo-fi keyboard feel
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Add gentle detune / vinyl wobble
      const detuneAmount = (Math.random() - 0.5) * 8;
      osc.detune.setValueAtTime(detuneAmount, ctx.currentTime);

      // Lowpass filter for smooth muffled lo-fi warmth
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 + idx * 50, ctx.currentTime);

      // Envelope
      const now = ctx.currentTime;
      noteGain.gain.setValueAtTime(0.001, now);
      noteGain.gain.linearRampToValueAtTime(0.08 / freqs.length, now + 0.3); // Slow attack
      noteGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);  // Smooth release

      osc.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(gainNode);

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });
  };

  // Soft kick drum for lo-fi beats
  const playKick = (ctx: AudioContext, gainNode: GainNode) => {
    const osc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.15);

    kickGain.gain.setValueAtTime(0.25, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(kickGain);
    kickGain.connect(gainNode);

    osc.start(now);
    osc.stop(now + 0.3);
  };

  // Soft snare/rimshot for lo-fi beats
  const playRimshot = (ctx: AudioContext, gainNode: GainNode) => {
    const osc = ctx.createOscillator();
    const rimGain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);

    rimGain.gain.setValueAtTime(0.08, now);
    rimGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(rimGain);
    rimGain.connect(gainNode);

    osc.start(now);
    osc.stop(now + 0.12);
  };

  // Start continuous music loop
  const startAudioLoop = (theme: LofiTheme) => {
    const ctx = getAudioContext();
    if (!masterGainRef.current) return;

    startNoiseGenerator(ctx, masterGainRef.current, theme);

    const themeConfig = THEMES.find((t) => t.id === theme) || THEMES[0];
    const beatIntervalMs = (60 / themeConfig.bpm) * 1000; // Time per beat in ms
    const chords = CHORDS_MAP[theme];

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
    }

    stepRef.current = 0;

    // Main tick function
    const tick = () => {
      if (!audioCtxRef.current || !masterGainRef.current) return;

      const currentStep = stepRef.current;
      const chordIndex = Math.floor(currentStep / 4) % chords.length;
      const beatInBar = currentStep % 4;

      // Play chord on beat 1 and beat 3
      if (beatInBar === 0 || beatInBar === 2) {
        const chordFreqs = chords[chordIndex];
        playChordNotes(ctx, masterGainRef.current, chordFreqs, (beatIntervalMs * 2.2) / 1000);
      }

      // Play drums for focus & relax themes
      if (theme === 'focus') {
        if (beatInBar === 0) playKick(ctx, masterGainRef.current);
        if (beatInBar === 2) playRimshot(ctx, masterGainRef.current);
      } else if (theme === 'relax') {
        if (beatInBar === 0) playKick(ctx, masterGainRef.current);
      }

      stepRef.current++;
    };

    tick(); // Immediate first tick
    intervalRef.current = window.setInterval(tick, beatIntervalMs);
  };

  // Stop audio loop
  const stopAudioLoop = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (noiseSourceRef.current) {
      try {
        noiseSourceRef.current.stop();
        noiseSourceRef.current.disconnect();
      } catch (e) {
        // Ignore
      }
      noiseSourceRef.current = null;
    }
  };

  // Effect: Handle play/pause state & theme updates
  useEffect(() => {
    if (isPlaying) {
      startAudioLoop(activeTheme);
    } else {
      stopAudioLoop();
    }

    return () => {
      stopAudioLoop();
    };
  }, [isPlaying, activeTheme]);

  // Update volume
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      const targetGain = isMuted ? 0 : volume;
      masterGainRef.current.gain.setValueAtTime(targetGain, audioCtxRef.current.currentTime);
    }
  }, [volume, isMuted]);

  // Toggle play state
  const handleTogglePlay = () => {
    getAudioContext(); // Ensure AudioContext is initialized/resumed on user click
    setIsPlaying((prev) => !prev);
  };

  // Switch Theme
  const handleSelectTheme = (newTheme: LofiTheme) => {
    setActiveTheme(newTheme);
    if (!isPlaying) {
      getAudioContext();
      setIsPlaying(true);
    }
  };

  const currentThemeObj = THEMES.find((t) => t.id === activeTheme) || THEMES[0];

  // Render Inline / Embedded Card View
  if (isEmbedded) {
    return (
      <div className={`bg-card-bg border border-card-border rounded-2xl p-4 shadow-sm space-y-3.5 transition-all ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${currentThemeObj.color} flex items-center justify-center text-white shadow-xs`}>
              <span className="material-symbols-outlined text-xl">{currentThemeObj.icon}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-xs text-text-main">Lo-Fi Müzik & Odaklanma</h4>
                {isPlaying && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Çalıyor</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-text-muted">{currentThemeObj.subtitle}</p>
            </div>
          </div>

          {/* Big Play / Pause Button */}
          <button
            onClick={handleTogglePlay}
            className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                : 'bg-primary hover:bg-primary-hover text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {isPlaying ? 'pause_circle' : 'play_circle'}
            </span>
            <span>{isPlaying ? 'Durdur' : 'Müziği Başlat'}</span>
          </button>
        </div>

        {/* Theme Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {THEMES.map((t) => {
            const isSelected = activeTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleSelectTheme(t.id)}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-primary/10 text-primary border-primary/40 font-black shadow-xs'
                    : 'bg-surface-container-low text-text-muted hover:text-text-main border-card-border/60 hover:border-card-border'
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                <span className="truncate">{t.title}</span>
              </button>
            );
          })}
        </div>

        {/* Controls: Equalizer & Volume */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-card-border/50 text-xs">
          {/* Animated Audio Equalizer Bars */}
          <div className="flex items-center gap-1 min-w-[70px]">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`w-1 bg-primary rounded-full transition-all duration-300 ${
                  isPlaying ? 'animate-bounce' : 'h-1.5 opacity-30'
                }`}
                style={{
                  height: isPlaying ? `${Math.floor(Math.random() * 12 + 6)}px` : '4px',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
            <span className="text-[10px] text-text-muted font-bold ml-1.5">
              {isPlaying ? `${currentThemeObj.bpm} BPM` : 'Sessiz'}
            </span>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="text-text-muted hover:text-text-main transition-colors"
              title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
            >
              <span className="material-symbols-outlined text-lg">
                {isMuted || volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
              </span>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                if (isMuted) setIsMuted(false);
              }}
              className="w-20 accent-primary cursor-pointer h-1.5 rounded-lg bg-surface-container-high"
            />
          </div>
        </div>
      </div>
    );
  }

  // Floating Widget View (Draggable)
  const isNearBottom = position ? position.y > window.innerHeight / 2 : true;
  const isNearRight = position ? position.x > window.innerWidth / 2 : true;

  const containerStyle = position
    ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', right: 'auto' }
    : undefined;

  const containerClass = position
    ? `fixed z-40 touch-none select-none ${className}`
    : `fixed bottom-24 right-4 sm:bottom-28 sm:right-6 z-40 touch-none select-none ${className}`;

  const popoverPosClass = `absolute ${isNearBottom ? 'bottom-full mb-3' : 'top-full mt-3'} ${
    isNearRight ? 'right-0' : 'left-0'
  }`;

  return (
    <div
      ref={widgetRef}
      style={containerStyle}
      className={containerClass}
    >
      {/* Expanded Floating Popover Card */}
      {isExpanded && (
        <div className={`${popoverPosClass} w-80 bg-card-bg/95 backdrop-blur-md border border-card-border rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn`}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-card-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">graphic_eq</span>
              <div>
                <h4 className="font-extrabold text-xs text-text-main">Lo-Fi Çalışma Müzikleri</h4>
                <p className="text-[10px] text-text-muted">Odaklanma & Zihinsel Rahatlama</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 text-text-muted hover:text-text-main rounded-lg hover:bg-surface-container-low cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Themes Grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {THEMES.map((t) => {
              const isSelected = activeTheme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTheme(t.id)}
                  className={`p-2 rounded-xl text-xs font-extrabold text-left flex items-center gap-2 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-primary/10 border-primary/40 text-primary shadow-xs'
                      : 'bg-surface-container-low border-card-border/50 hover:border-card-border text-text-main'
                  }`}
                >
                  <span className="material-symbols-outlined text-base text-primary">{t.icon}</span>
                  <div className="overflow-hidden">
                    <p className="truncate text-[11px]">{t.title}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Controls bar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleTogglePlay}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                isPlaying
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-primary hover:bg-primary-hover text-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {isPlaying ? 'pause_circle' : 'play_circle'}
              </span>
              <span>{isPlaying ? 'Durdur' : 'Müziği Başlat'}</span>
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 bg-surface-container-low px-2 py-1.5 rounded-xl border border-card-border/50">
              <button
                onClick={() => setIsMuted((prev) => !prev)}
                className="text-text-muted hover:text-text-main"
              >
                <span className="material-symbols-outlined text-base">
                  {isMuted || volume === 0 ? 'volume_off' : 'volume_up'}
                </span>
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  if (isMuted) setIsMuted(false);
                }}
                className="w-16 accent-primary cursor-pointer h-1 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating Draggable Pill Button */}
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleButtonClick}
        title="Tıkla: Menüyü Aç / Basılı Tutarak Sürükle & Taşı"
        className={`px-3 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-xl border cursor-grab active:cursor-grabbing touch-none select-none transition-shadow ${
          isPlaying
            ? 'bg-primary text-white border-primary/50 shadow-primary/20'
            : 'bg-card-bg/95 hover:bg-card-bg text-text-main border-card-border'
        } ${isDragging ? 'scale-105 shadow-2xl ring-2 ring-primary/40' : ''}`}
      >
        <span className="material-symbols-outlined text-lg">
          {isPlaying ? 'equalizer' : 'headphones'}
        </span>
        <span className="hidden sm:inline">
          {isPlaying ? `Lo-Fi: ${currentThemeObj.title}` : 'Lo-Fi Müzik'}
        </span>
        {isPlaying && (
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        )}
      </button>
    </div>
  );
};

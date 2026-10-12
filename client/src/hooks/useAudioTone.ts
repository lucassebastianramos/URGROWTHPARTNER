import { useRef, useCallback, useEffect } from 'react';

/**
 * Web Audio API synthesizer for acoustic feedback and iOS Safari autoplay unlocking
 */
export function useAudioTone() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringingIntervalRef = useRef<number | null>(null);
  const isUnlockedRef = useRef<boolean>(false);

  // Initialize or retrieve AudioContext
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioCtxClass();
    }
    return audioCtxRef.current;
  }, []);

  /**
   * CRITICAL: Unlocks AudioContext and Safari autoplay policies.
   * MUST be invoked directly in a user gesture event handler (onClick / onTouchStart).
   */
  const unlockAudio = useCallback(async (audioElementToPrime?: HTMLAudioElement | null) => {
    try {
      const ctx = getAudioContext();

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // Play a short silent buffer to unlock the audio pipeline on iOS Safari
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // Prime an HTMLAudioElement if passed
      if (audioElementToPrime) {
        audioElementToPrime.muted = true;
        await audioElementToPrime.play().catch(() => {});
        audioElementToPrime.muted = false;
        audioElementToPrime.pause();
      }

      isUnlockedRef.current = true;
      console.log('🔊 [AudioContext] Successfully unlocked for mobile audio');
    } catch (err) {
      console.warn('⚠️ [AudioContext] Unlock attempt warning:', err);
    }
  }, [getAudioContext]);

  /**
   * Plays a classic 2-tone doorbell chime ("Ding-Dong")
   */
  const playDoorbellChime = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // Note 1: Ding (880 Hz / A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);

      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2: Dong (659.25 Hz / E5) after 0.4s
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.4);

      gain2.gain.setValueAtTime(0.3, now + 0.4);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.4);
      osc2.stop(now + 1.8);
    } catch (err) {
      console.warn('Could not play chime:', err);
    }
  }, [getAudioContext]);

  /**
   * Starts a realistic phone ringback tone cycle (dual frequency 440Hz + 480Hz)
   */
  const startRingingTone = useCallback(() => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      if (ringingIntervalRef.current) {
        clearInterval(ringingIntervalRef.current);
      }

      const playBurst = () => {
        try {
          const now = ctx.currentTime;

          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, now); // 440 Hz
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, now); // 480 Hz

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
          gain.gain.setValueAtTime(0.12, now + 1.8);
          gain.gain.linearRampToValueAtTime(0, now + 1.9);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.9);
          osc2.stop(now + 1.9);
        } catch (e) {
          console.warn('Ringing burst error:', e);
        }
      };

      // Play first burst immediately
      playBurst();

      // Repeat every 4 seconds (1.9s sound + 2.1s silence)
      ringingIntervalRef.current = window.setInterval(playBurst, 4000);
    } catch (err) {
      console.warn('Could not start ringing tone:', err);
    }
  }, [getAudioContext]);

  /**
   * Stops the ongoing ringing tone
   */
  const stopRingingTone = useCallback(() => {
    if (ringingIntervalRef.current) {
      clearInterval(ringingIntervalRef.current);
      ringingIntervalRef.current = null;
    }
  }, []);

  /**
   * Plays a cheerful 2-beep tone when call connects
   */
  const playConnectedChime = useCallback(() => {
    try {
      stopRingingTone();
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;

      // Beep 1 (523 Hz - C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.linearRampToValueAtTime(0, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);

      // Beep 2 (659 Hz - E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.linearRampToValueAtTime(0, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.32);
    } catch (err) {
      console.warn('Could not play connected chime:', err);
    }
  }, [getAudioContext, stopRingingTone]);

  /**
   * Plays a busy/hangup tone (3 quick pulses)
   */
  const playBusyTone = useCallback(() => {
    try {
      stopRingingTone();
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.3;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.setValueAtTime(480, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      }
    } catch (err) {
      console.warn('Could not play busy tone:', err);
    }
  }, [getAudioContext, stopRingingTone]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (ringingIntervalRef.current) {
        clearInterval(ringingIntervalRef.current);
      }
    };
  }, []);

  return {
    unlockAudio,
    playDoorbellChime,
    startRingingTone,
    stopRingingTone,
    playConnectedChime,
    playBusyTone,
    isUnlockedRef,
  };
}

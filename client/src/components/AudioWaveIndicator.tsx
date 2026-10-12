import React from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface AudioWaveIndicatorProps {
  level: number; // 0 to 100
  isMuted?: boolean;
  label: string;
  isLocal?: boolean;
}

export const AudioWaveIndicator: React.FC<AudioWaveIndicatorProps> = ({
  level,
  isMuted = false,
  label,
  isLocal = false,
}) => {
  const isSpeaking = level > 12 && !isMuted;

  return (
    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-inner">
      <div className="flex items-center gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400'
              : isSpeaking
              ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {isLocal ? (
            isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-300">{label}</p>
          <p className="text-[11px] text-slate-500">
            {isMuted ? 'Micrófono silenciado' : isSpeaking ? 'Transmitiendo audio...' : 'En silencio'}
          </p>
        </div>
      </div>

      {/* Dynamic Visual Equalizer Bars */}
      <div className="flex items-center gap-1.5 h-6 px-2">
        {[0.4, 0.8, 1, 0.7, 0.5].map((multiplier, i) => {
          const barHeight = isMuted
            ? 4
            : Math.max(4, Math.min(24, Math.round((level * multiplier * 0.3) + (isSpeaking ? 6 : 4))));

          return (
            <div
              key={i}
              className={`w-1 rounded-full transition-all duration-75 ${
                isMuted
                  ? 'bg-rose-500/40'
                  : isSpeaking
                  ? 'bg-emerald-400'
                  : 'bg-slate-700'
              }`}
              style={{ height: `${barHeight}px` }}
            />
          );
        })}
      </div>
    </div>
  );
};

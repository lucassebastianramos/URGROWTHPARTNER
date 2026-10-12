import React from 'react';
import { Bell, PhoneCall, PhoneOff, AlertCircle } from 'lucide-react';

interface DoorbellButtonProps {
  status: 'idle' | 'ringing' | 'connected' | 'busy' | 'missed' | 'error';
  onClick: () => void;
  disabled?: boolean;
}

export const DoorbellButton: React.FC<DoorbellButtonProps> = ({
  status,
  onClick,
  disabled = false,
}) => {
  const isRinging = status === 'ringing';
  const isConnected = status === 'connected';

  return (
    <div className="relative flex items-center justify-center my-6">
      {/* Expanding Ripple Rings during RINGING state */}
      {isRinging && (
        <>
          <span className="absolute w-48 h-48 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
          <span className="absolute w-60 h-60 rounded-full bg-emerald-500/10 animate-pulse" />
        </>
      )}

      {/* Rotating glow in connected state */}
      {isConnected && (
        <span className="absolute w-52 h-52 rounded-full bg-emerald-500/15 animate-pulse" />
      )}

      {/* Main Tactile Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label="Tocar Timbre"
        className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-300 transform active:scale-95 select-none shadow-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50 ${
          status === 'idle'
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-emerald-950/80 hover:brightness-110 active:brightness-95 glow-emerald cursor-pointer'
            : isRinging
            ? 'bg-gradient-to-tr from-amber-600 to-emerald-500 text-white shadow-amber-950/80 animate-pulse cursor-pointer'
            : isConnected
            ? 'bg-gradient-to-tr from-emerald-700 to-emerald-500 text-white shadow-emerald-950/80 cursor-default'
            : 'bg-gradient-to-tr from-slate-800 to-slate-700 text-slate-300 shadow-black/80 hover:bg-slate-700 cursor-pointer'
        } ${disabled ? 'opacity-60 cursor-not-allowed active:scale-100' : ''}`}
      >
        {status === 'idle' && (
          <>
            <Bell className="w-16 h-16 mb-2 drop-shadow-md stroke-[2.2]" />
            <span className="text-sm font-bold tracking-wide uppercase">Tocar Timbre</span>
          </>
        )}

        {isRinging && (
          <>
            <PhoneCall className="w-16 h-16 mb-2 animate-bounce drop-shadow-md stroke-[2.2]" />
            <span className="text-xs font-bold tracking-wider uppercase">Llamando...</span>
          </>
        )}

        {isConnected && (
          <>
            <PhoneCall className="w-16 h-16 mb-2 text-white drop-shadow-md stroke-[2.2]" />
            <span className="text-xs font-bold tracking-wider uppercase">Conectado</span>
          </>
        )}

        {(status === 'busy' || status === 'missed' || status === 'error') && (
          <>
            <AlertCircle className="w-16 h-16 mb-2 text-amber-400 drop-shadow-md stroke-[2.2]" />
            <span className="text-xs font-bold tracking-wider uppercase">Reintentar</span>
          </>
        )}
      </button>
    </div>
  );
};

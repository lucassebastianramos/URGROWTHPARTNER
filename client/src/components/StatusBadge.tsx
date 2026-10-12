import React from 'react';

export type StatusType =
  | 'idle'
  | 'ringing'
  | 'connected'
  | 'connecting'
  | 'busy'
  | 'missed'
  | 'ended'
  | 'error';

interface StatusBadgeProps {
  status: StatusType;
  customText?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, customText }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'idle':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          dot: 'bg-emerald-500',
          text: 'Disponible',
        };
      case 'ringing':
        return {
          bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
          dot: 'bg-amber-500 animate-ping',
          text: 'Llamando al residente...',
        };
      case 'connecting':
        return {
          bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
          dot: 'bg-blue-500 animate-pulse',
          text: 'Conectando audio...',
        };
      case 'connected':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
          dot: 'bg-emerald-500 animate-pulse',
          text: 'Llamada en curso',
        };
      case 'busy':
        return {
          bg: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
          dot: 'bg-orange-500',
          text: 'Línea Ocupada',
        };
      case 'missed':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          dot: 'bg-rose-500',
          text: 'Sin Respuesta',
        };
      case 'ended':
        return {
          bg: 'bg-slate-700/30 border-slate-700/50 text-slate-400',
          dot: 'bg-slate-500',
          text: 'Llamada Finalizada',
        };
      case 'error':
        return {
          bg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          dot: 'bg-rose-500',
          text: 'Error de Conexión',
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium tracking-wide transition-all ${config.bg}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dot}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot.split(' ')[0]}`} />
      </span>
      <span>{customText || config.text}</span>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Video,
  VideoOff,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { StatusBadge, StatusType } from '../components/StatusBadge.js';
import { AudioWaveIndicator } from '../components/AudioWaveIndicator.js';
import { useAudioTone } from '../hooks/useAudioTone.js';
import { useWebRTC } from '../hooks/useWebRTC.js';
import { CONFIG } from '../config.js';

interface ResidentPageProps {
  callId: string;
}

interface ValidationData {
  callId: string;
  doorbellName: string;
  doorbellSlug: string;
  unitLabel: string;
  status: string;
  isTerminal: boolean;
}

export const ResidentPage: React.FC<ResidentPageProps> = ({ callId }) => {
  const [token, setToken] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States: 'ringing' | 'connected' | 'ended' | 'missed'
  const [callState, setCallState] = useState<StatusType>('ringing');
  const [callDuration, setCallDuration] = useState<number>(0);

  const durationIntervalRef = useRef<number | null>(null);
  const vibrationIntervalRef = useRef<number | null>(null);

  const {
    unlockAudio,
    startRingingTone,
    stopRingingTone,
    playConnectedChime,
    playBusyTone,
  } = useAudioTone();

  // Callbacks for WebRTC signaling
  const handleCallEnded = useCallback(
    (reason: string, duration?: number) => {
      console.log('🛑 Resident: Call ended', reason);
      stopRingingTone();
      playBusyTone();
      setCallState('ended');
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
      if (duration !== undefined) setCallDuration(duration);
    },
    [stopRingingTone, playBusyTone]
  );

  const handleCallMissed = useCallback(
    (msg: string) => {
      console.log('⏱️ Resident: Call missed', msg);
      stopRingingTone();
      playBusyTone();
      setCallState('missed');
      setErrorMsg(msg || 'Llamada no atendida a tiempo.');
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
    },
    [stopRingingTone, playBusyTone]
  );

  const handleWebRTCError = useCallback((err: string) => {
    setErrorMsg(err);
    stopRingingTone();
  }, [stopRingingTone]);

  // Hook for WebRTC and Socket.io with unidirectional video receiving
  const {
    remoteAudioRef,
    remoteVideoRef,
    hasRemoteVideo,
    isMuted,
    peerMuted,
    localAudioLevel,
    remoteAudioLevel,
    connectSignaling,
    acceptIncomingCall,
    toggleMute,
    hangup,
  } = useWebRTC({
    callId,
    role: 'resident',
    token: token || undefined,
    onCallEnded: handleCallEnded,
    onCallMissed: handleCallMissed,
    onError: handleWebRTCError,
  });

  // Extract token from query params and validate with server
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');

    if (!tokenParam) {
      setErrorMsg('Token de autorización ausente. Por seguridad, este enlace requiere un token firmado.');
      setIsValidating(false);
      return;
    }

    setToken(tokenParam);

    let isMounted = true;
    const validateToken = async () => {
      setIsValidating(true);
      try {
        const res = await fetch(
          `${CONFIG.API_BASE_URL}/calls/${callId}/validate?token=${encodeURIComponent(tokenParam)}`
        );
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.success) {
          setValidationData(data);
          if (data.isTerminal) {
            setCallState('ended');
            setErrorMsg('Esta llamada ya finalizó o ha expirado.');
          } else {
            // Incoming ringing call
            setCallState('ringing');
            startRingingTone();

            // Mobile vibration if available
            if (navigator.vibrate) {
              navigator.vibrate([300, 200, 300]);
              vibrationIntervalRef.current = window.setInterval(() => {
                if (navigator.vibrate) navigator.vibrate([300, 200, 300]);
              }, 3000);
            }
          }
        } else {
          setErrorMsg(data.error || 'Token inválido o expirado.');
        }
      } catch (err) {
        if (isMounted) setErrorMsg('Error al conectar con el servidor.');
      } finally {
        if (isMounted) setIsValidating(false);
      }
    };

    validateToken();
    return () => {
      isMounted = false;
      if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
    };
  }, [callId, startRingingTone]);

  // Connect to Socket.io when token is validated and call is active
  useEffect(() => {
    if (token && validationData && !validationData.isTerminal) {
      connectSignaling();
    }
  }, [token, validationData, connectSignaling]);

  // Answer call handler
  const handleAnswer = async () => {
    if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);

    // CRITICAL: Unlock AudioContext in iOS Safari click gesture
    await unlockAudio(remoteAudioRef.current);

    stopRingingTone();
    playConnectedChime();

    await acceptIncomingCall();
    setCallState('connected');

    setCallDuration(0);
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Reject / Hang up call
  const handleRejectOrHangup = () => {
    stopRingingTone();
    playBusyTone();
    if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    hangup('resident_hangup');
    setCallState('ended');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isValidating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm">Verificando enlace de portero...</p>
      </div>
    );
  }

  if (errorMsg && (callState === 'ended' || !validationData)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Enlace no disponible</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{errorMsg}</p>
        <span className="text-[11px] text-slate-500">
          Por motivos de seguridad y privacidad, los enlaces de atención rápida caducan a los pocos minutos.
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-5 pt-safe pb-safe select-none">
      {/* Audio oculto para recibir la voz del visitante */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Cabecera */}
      <header className="flex flex-col items-center text-center mt-3">
        <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
          <Building2 className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Portero Eléctrico &bull; {validationData?.doorbellName}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
          {validationData?.unitLabel || 'Tu Unidad'}
        </h1>
        <StatusBadge status={callState} />
      </header>

      {/* Área Central del Intercomunicador */}
      <main className="flex flex-col items-center justify-center my-auto py-2 w-full">
        {/* ESTADO: RINGING (Llamada entrante) */}
        {callState === 'ringing' && (
          <div className="flex flex-col items-center text-center w-full">
            <div className="relative my-8">
              <span className="absolute -inset-4 rounded-full bg-emerald-500/20 animate-ping" />
              <span className="absolute -inset-8 rounded-full bg-emerald-500/10 animate-pulse" />
              <div className="relative w-36 h-36 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-2xl shadow-emerald-950/80 glow-emerald">
                <PhoneCall className="w-16 h-16 animate-bounce stroke-[2.2]" />
              </div>
            </div>

            <p className="text-base font-bold text-white mb-1">
              ¡Llaman a {validationData?.unitLabel}!
            </p>
            <p className="text-xs text-slate-400 mb-8 max-w-xs flex items-center justify-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-emerald-400 inline" />
              <span>Un visitante está en la puerta con videovisor en vivo.</span>
            </p>

            {/* Acciones de respuesta */}
            <div className="flex items-center justify-center gap-6 w-full max-w-xs">
              <button
                onClick={handleRejectOrHangup}
                aria-label="Rechazar llamada"
                className="flex-1 py-4 px-6 rounded-2xl bg-slate-900 border border-slate-800 text-rose-400 font-bold text-sm hover:bg-slate-800 active:scale-95 transition flex flex-col items-center gap-1.5 shadow-lg"
              >
                <PhoneOff className="w-6 h-6" />
                <span>Rechazar</span>
              </button>

              <button
                onClick={handleAnswer}
                aria-label="Atender llamada"
                className="flex-1 py-4 px-6 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white font-bold text-sm hover:brightness-110 active:scale-95 transition flex flex-col items-center gap-1.5 shadow-xl shadow-emerald-950/80 glow-emerald"
              >
                <PhoneCall className="w-6 h-6 animate-pulse" />
                <span>Atender</span>
              </button>
            </div>
          </div>
        )}

        {/* ESTADO: CONNECTED (Videovisor en Vivo + Intercomunicador) */}
        {callState === 'connected' && (
          <div className="flex flex-col items-center w-full space-y-3">
            <div className="text-center mb-0.5">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">
                En comunicación con la puerta
              </span>
              <p className="text-2xl font-mono font-bold text-white tracking-wider">
                {formatTimer(callDuration)}
              </p>
            </div>

            {/* VENTANA DE VIDEOVISOR EN VIVO (Muestra la cara de la visita) */}
            <div className="relative w-full aspect-[4/3] max-w-xs rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl flex items-center justify-center">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-slate-400 text-center">
                  <VideoOff className="w-10 h-10 mb-2 opacity-60" />
                  <p className="text-xs font-medium">Conectando videovisor...</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    (El visitante aún no ha activado su cámara o el audio está en curso)
                  </p>
                </div>
              )}

              {/* Badge flotante en el videovisor */}
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-emerald-400 font-semibold border border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Videovisor en vivo</span>
              </div>
            </div>

            {/* Medidores de Audio */}
            <div className="w-full space-y-2 pt-1">
              <AudioWaveIndicator
                level={localAudioLevel}
                isMuted={isMuted}
                label="Tu Micrófono (Residente)"
                isLocal={true}
              />
              <AudioWaveIndicator
                level={remoteAudioLevel}
                isMuted={peerMuted}
                label="Visitante en la Puerta"
                isLocal={false}
              />
            </div>

            {/* Controles de Llamada */}
            <div className="flex items-center justify-center gap-6 pt-2 w-full">
              <button
                onClick={toggleMute}
                aria-label="Silenciar Micrófono"
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center transition-all transform active:scale-90 border ${
                  isMuted
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                    : 'bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                <span className="text-[10px] mt-0.5 font-medium">
                  {isMuted ? 'Mudo' : 'Mutear'}
                </span>
              </button>

              <button
                onClick={handleRejectOrHangup}
                aria-label="Colgar Llamada"
                className="w-16 h-16 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-90 text-white flex flex-col items-center justify-center transition-all shadow-xl shadow-rose-950/60 glow-rose"
              >
                <PhoneOff className="w-7 h-7" />
                <span className="text-[10px] mt-0.5 font-bold uppercase tracking-wider">
                  Colgar
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ESTADO: ENDED */}
        {(callState === 'ended' || callState === 'missed') && (
          <div className="flex flex-col items-center text-center p-6 bg-slate-900/60 border border-slate-800 rounded-3xl max-w-xs">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
              <PhoneOff className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {callState === 'missed' ? 'Llamada no atendida' : 'Llamada finalizada'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {callDuration > 0
                ? `Duración total de conversación: ${formatTimer(callDuration)}`
                : 'La sesión de intercomunicador ha concluido.'}
            </p>
            <span className="text-[11px] text-slate-500">
              Puedes cerrar esta pestaña en tu navegador con total seguridad.
            </span>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Sesión Autenticada y Cifrada &bull; UrGrowUp</span>
      </footer>
    </div>
  );
};

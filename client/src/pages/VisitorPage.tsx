import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Clock,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  ShieldCheck,
  Search,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { DoorbellButton } from '../components/DoorbellButton.js';
import { StatusBadge, StatusType } from '../components/StatusBadge.js';
import { AudioWaveIndicator } from '../components/AudioWaveIndicator.js';
import { useAudioTone } from '../hooks/useAudioTone.js';
import { useWebRTC } from '../hooks/useWebRTC.js';
import { CONFIG } from '../config.js';

interface Unit {
  id: string;
  label: string;
  floor?: string | null;
}

interface PropertyData {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  units: Unit[];
}

interface VisitorPageProps {
  slug: string;
}

export const VisitorPage: React.FC<VisitorPageProps> = ({ slug }) => {
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Call states: 'idle' | 'ringing' | 'connected' | 'missed' | 'busy' | 'ended' | 'error'
  const [callState, setCallState] = useState<StatusType>('idle');
  const [callId, setCallId] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(45);
  const [callDuration, setCallDuration] = useState<number>(0);

  const countdownIntervalRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const {
    unlockAudio,
    playDoorbellChime,
    startRingingTone,
    stopRingingTone,
    playConnectedChime,
    playBusyTone,
  } = useAudioTone();

  // Callbacks for WebRTC signaling
  const handleCallAccepted = useCallback(() => {
    console.log('🎉 Visitor: Resident answered the call!');
    stopRingingTone();
    playConnectedChime();
    setCallState('connected');

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCallDuration(0);
    durationIntervalRef.current = window.setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, [stopRingingTone, playConnectedChime]);

  const handleCallEnded = useCallback(
    (reason: string, duration?: number) => {
      console.log('🛑 Visitor: Call ended', reason);
      stopRingingTone();
      playBusyTone();
      setCallState('ended');
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      if (duration !== undefined) setCallDuration(duration);
    },
    [stopRingingTone, playBusyTone]
  );

  const handleCallMissed = useCallback(
    (msg: string) => {
      console.log('⏱️ Visitor: Call missed', msg);
      stopRingingTone();
      playBusyTone();
      setCallState('missed');
      setErrorMsg(msg || 'No hubo respuesta. El residente no está disponible.');
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    },
    [stopRingingTone, playBusyTone]
  );

  const handleWebRTCError = useCallback(
    (err: string) => {
      setErrorMsg(err);
      setCallState('error');
      stopRingingTone();
    },
    [stopRingingTone]
  );

  // Hook for WebRTC and Socket.io
  const {
    remoteAudioRef,
    localVideoRef,
    hasLocalVideo,
    isMuted,
    peerMuted,
    localAudioLevel,
    remoteAudioLevel,
    connectSignaling,
    toggleMute,
    hangup,
  } = useWebRTC({
    callId: callId || '',
    role: 'visitor',
    onCallAccepted: handleCallAccepted,
    onCallEnded: handleCallEnded,
    onCallMissed: handleCallMissed,
    onError: handleWebRTCError,
  });

  // Fetch Property and Units metadata on mount
  useEffect(() => {
    let isMounted = true;
    const fetchProperty = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/v/${slug}`);
        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.id) {
          setProperty(data);
          // Si es una casa particular con 1 sola unidad, la auto-selecciona inmediatamente
          if (data.units?.length === 1) {
            setSelectedUnit(data.units[0]);
          }
        } else {
          setErrorMsg(data.error || 'Propiedad no encontrada.');
        }
      } catch (err) {
        if (isMounted) setErrorMsg('No se pudo conectar con el servidor.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProperty();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Connect signaling when callId is assigned and state is ringing
  useEffect(() => {
    if (callId && callState === 'ringing') {
      connectSignaling();
    }
  }, [callId, callState, connectSignaling]);

  // Handle Ringing the selected unit
  const handleStartCall = async () => {
    if (!selectedUnit || callState === 'ringing' || callState === 'connected') return;

    setErrorMsg(null);

    // 1. Desbloqueo síncrono del AudioContext para iOS Safari
    await unlockAudio(remoteAudioRef.current);

    // 2. Feedback acústico campanada
    playDoorbellChime();

    try {
      // 3. Disparar llamada al backend para la unidad seleccionada
      const res = await fetch(`${CONFIG.API_BASE_URL}/calls/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: selectedUnit.id }),
      });

      const data = await res.json();

      if (res.status === 429) {
        playBusyTone();
        setCallState('error');
        setErrorMsg(data.error || 'Demasiados intentos. Espera un momento.');
        return;
      }

      if (res.status === 409) {
        playBusyTone();
        setCallState('busy');
        setErrorMsg(data.error || 'La unidad se encuentra ocupada actualmente.');
        return;
      }

      if (!res.ok || !data.success) {
        playBusyTone();
        setCallState('error');
        setErrorMsg(data.error || 'Error al iniciar la llamada.');
        return;
      }

      // Success: Iniciar timbrado
      setCallId(data.callId);
      setCallState('ringing');
      setSecondsRemaining(data.timeoutSeconds || 45);

      // Iniciar repique telefónico
      startRingingTone();

      // Temporizador regresivo de 45 segundos
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = window.setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            stopRingingTone();
            playBusyTone();
            setCallState('missed');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Ring error:', err);
      playBusyTone();
      setCallState('error');
      setErrorMsg('Error de red al intentar llamar.');
    }
  };

  // Hang up / Cancel
  const handleCancelCall = () => {
    stopRingingTone();
    playBusyTone();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    hangup('visitor_cancelled');
    setCallState('idle');
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredUnits = property?.units.filter((u) =>
    u.label.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm">Cargando portero digital...</p>
      </div>
    );
  }

  if (errorMsg && !property) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Timbre no disponible</h2>
        <p className="text-slate-400 text-sm mb-6">{errorMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition"
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-5 pt-safe pb-safe select-none">
      {/* Audio oculto para recepción de sonido del residente */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Cabecera */}
      <header className="flex flex-col items-center text-center mt-3">
        <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
          <Building2 className="w-4 h-4" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Portero Eléctrico QR
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">
          {property?.name}
        </h1>
        {property?.address && (
          <p className="text-xs text-slate-500 mb-2">{property.address}</p>
        )}

        <p className="text-xs text-slate-400 mb-3">
          {selectedUnit
            ? `Llamando a: ${selectedUnit.label}`
            : 'Seleccioná la unidad a la que llamás'}
        </p>

        {selectedUnit && <StatusBadge status={callState} />}
      </header>

      {/* PANTALLA 1: SELECTOR DE UNIDADES (Edificios / Condominios / PHs) */}
      {!selectedUnit && property && property.units.length > 1 && (
        <main className="flex-1 flex flex-col space-y-4 my-4 overflow-hidden">
          {/* Barra de Búsqueda rápida */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Buscar dpto o casa (ej: Frente, 1° A)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition shadow-inner"
            />
          </div>

          {/* Grilla de Unidades */}
          <div className="grid grid-cols-2 gap-3 overflow-y-auto max-h-[55vh] pr-1 py-1">
            {filteredUnits && filteredUnits.length > 0 ? (
              filteredUnits.map((unit) => (
                <button
                  key={unit.id}
                  onClick={() => setSelectedUnit(unit)}
                  className="bg-slate-900/90 hover:bg-slate-800 border border-slate-800 active:border-emerald-500 p-4 rounded-2xl text-center font-bold text-slate-100 transition-all transform active:scale-95 shadow-md flex flex-col items-center justify-center min-h-[76px] group"
                >
                  <span className="text-base group-hover:text-emerald-400 transition">
                    {unit.label}
                  </span>
                  {unit.floor && (
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      Piso {unit.floor}
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="col-span-2 py-8 text-center text-slate-500 text-xs">
                No se encontraron unidades con ese nombre.
              </div>
            )}
          </div>
        </main>
      )}

      {/* PANTALLA 2: BOTÓN DE LLAMADA & VIDEOVISOR (Unidad Seleccionada) */}
      {selectedUnit && (
        <main className="flex-1 flex flex-col items-center justify-center my-auto py-2 w-full">
          {/* Botón para cambiar de unidad si la propiedad tiene más de una */}
          {property && property.units.length > 1 && callState === 'idle' && (
            <button
              onClick={() => setSelectedUnit(null)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-4 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 transition active:scale-95"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Cambiar de unidad</span>
            </button>
          )}

          {/* Estado: IDLE o REINTENTO */}
          {(callState === 'idle' ||
            callState === 'busy' ||
            callState === 'missed' ||
            callState === 'ended' ||
            callState === 'error') && (
            <div className="flex flex-col items-center text-center">
              <DoorbellButton
                status={callState === 'idle' ? 'idle' : callState === 'error' ? 'error' : 'missed'}
                onClick={handleStartCall}
              />

              <p className="text-xs text-slate-400 mt-2 max-w-xs">
                {callState === 'idle'
                  ? 'Se activará el videovisor para que el residente vea quién está en la puerta.'
                  : errorMsg || 'Toca nuevamente para volver a intentar.'}
              </p>

              {errorMsg && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs max-w-xs">
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* Estado: RINGING (45s timeout countdown) */}
          {callState === 'ringing' && (
            <div className="flex flex-col items-center text-center w-full">
              <DoorbellButton status="ringing" onClick={() => {}} disabled />

              <div className="flex items-center gap-2 text-amber-400 font-mono text-sm font-semibold bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20 mb-6">
                <Clock className="w-4 h-4 animate-spin" />
                <span>Esperando respuesta: {secondsRemaining}s</span>
              </div>

              <p className="text-xs text-slate-400 mb-6 max-w-xs">
                El residente de <strong className="text-white">{selectedUnit.label}</strong> ha recibido una alerta con videovisor.
              </p>

              <button
                onClick={handleCancelCall}
                className="px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-800 active:scale-95 transition flex items-center gap-2"
              >
                <PhoneOff className="w-4 h-4 text-rose-400" />
                <span>Cancelar llamada</span>
              </button>
            </div>
          )}

          {/* Estado: CONNECTED (Intercomunicador con videovisor activo) */}
          {callState === 'connected' && (
            <div className="flex flex-col items-center w-full space-y-4">
              <div className="text-center mb-1">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
                  En comunicación con {selectedUnit.label}
                </span>
                <p className="text-3xl font-mono font-bold text-white tracking-wider">
                  {formatTimer(callDuration)}
                </p>
              </div>

              {/* Cámara local del visitante (Videovisor activado) */}
              <div className="relative w-40 h-28 rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
                <div className="absolute bottom-1.5 left-2 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full text-[10px] text-emerald-400">
                  {hasLocalVideo ? (
                    <>
                      <Video className="w-3 h-3" />
                      <span>Cámara en vivo</span>
                    </>
                  ) : (
                    <>
                      <VideoOff className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-400">Solo audio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Medidores de Audio */}
              <div className="w-full space-y-2">
                <AudioWaveIndicator
                  level={localAudioLevel}
                  isMuted={isMuted}
                  label="Tu Micrófono (Visitante)"
                  isLocal={true}
                />
                <AudioWaveIndicator
                  level={remoteAudioLevel}
                  isMuted={peerMuted}
                  label={`Residente (${selectedUnit.label})`}
                  isLocal={false}
                />
              </div>

              {/* Controles de llamada */}
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
                  onClick={handleCancelCall}
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
        </main>
      )}

      {/* Footer */}
      <footer className="mt-4 pt-3 border-t border-slate-900/60 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Videovisor Cifrado P2P &bull; UrGrowUp</span>
      </footer>
    </div>
  );
};

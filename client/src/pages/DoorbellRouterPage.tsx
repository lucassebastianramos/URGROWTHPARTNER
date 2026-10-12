import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, ShieldAlert, KeyRound } from 'lucide-react';
import { VisitorPage } from './VisitorPage.js';
import { ActivatePage } from './ActivatePage.js';
import { CONFIG } from '../config.js';

interface DoorbellRouterPageProps {
  serial: string;
}

export const DoorbellRouterPage: React.FC<DoorbellRouterPageProps> = ({ serial }) => {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cleanSerial = serial.toUpperCase();

  const fetchStatus = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${CONFIG.API_BASE_URL}/d/${cleanSerial}`);
      const resData = await res.json();

      if (!res.ok && res.status !== 403) {
        setErrorMsg(resData.error || 'Chapa no encontrada.');
        return;
      }

      setData(resData);
    } catch (err) {
      setErrorMsg('No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [cleanSerial]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm font-mono">
          Verificando chapa {cleanSerial}...
        </p>
      </div>
    );
  }

  // Chapa no encontrada
  if (errorMsg || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Chapa no registrada</h2>
        <p className="text-slate-400 text-sm mb-6 font-mono">
          {errorMsg || `El identificador ${cleanSerial} no se encuentra en el inventario.`}
        </p>
        <a
          href="/activar"
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700 transition"
        >
          Ir al portal de activación
        </a>
      </div>
    );
  }

  // 1. ESTADO UNCLAIMED: Chapa fabricada en stock pero sin activar
  if (data.status === 'UNCLAIMED') {
    return (
      <ActivatePage
        initialSerial={cleanSerial}
        onActivated={() => {
          fetchStatus();
        }}
      />
    );
  }

  // 2. ESTADO SUSPENDED: Chapa suspendida por falta de pago o daño reportado
  if (data.status === 'SUSPENDED') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto select-none">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Servicio no disponible</h2>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">
          Este timbre inteligente se encuentra temporalmente fuera de servicio.
        </p>
        <span className="text-[11px] text-slate-500 font-mono">
          ID: {cleanSerial} &bull; UrGrowUp Hardware
        </span>
      </div>
    );
  }

  // 3. ESTADO ACTIVE: Chapa vinculada y activa &bull; Renders VisitorPage
  return <VisitorPage slug={cleanSerial} />;
};

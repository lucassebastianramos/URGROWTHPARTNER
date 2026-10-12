import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Building2,
  KeyRound,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  Home,
  QrCode,
} from 'lucide-react';
import { CONFIG } from '../config.js';

interface ActivatePageProps {
  initialSerial?: string;
  onActivated?: (serial: string) => void;
}

export const ActivatePage: React.FC<ActivatePageProps> = ({ initialSerial, onActivated }) => {
  const [serial, setSerial] = useState<string>(initialSerial || '');
  const [claimCode, setClaimCode] = useState<string>('');
  const [propertyName, setPropertyName] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [residentName, setResidentName] = useState<string>('');
  const [telegramChatId, setTelegramChatId] = useState<string>('');

  const [propertyType, setPropertyType] = useState<'single' | 'multi'>('single');
  const [units, setUnits] = useState<string[]>(['Casa Frente', 'Casa Fondo']);
  const [newUnitLabel, setNewUnitLabel] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const handleAddUnit = () => {
    if (newUnitLabel.trim() && !units.includes(newUnitLabel.trim())) {
      setUnits([...units, newUnitLabel.trim()]);
      setNewUnitLabel('');
    }
  };

  const handleRemoveUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanSerial = serial.trim().toUpperCase();
    if (!cleanSerial) {
      setErrorMsg('Debes ingresar el número de serie de la chapa (ej: UG-1003).');
      return;
    }

    if (!claimCode.trim() || claimCode.trim().length !== 4) {
      setErrorMsg('El PIN de activación debe ser un código de 4 dígitos provisto en tu tarjeta.');
      return;
    }

    if (!propertyName.trim()) {
      setErrorMsg('Indica el nombre con el que se identificará tu propiedad o timbre.');
      return;
    }

    setIsLoading(true);

    try {
      const payloadUnits = propertyType === 'single' ? ['Recepción'] : units;

      const res = await fetch(`${CONFIG.API_BASE_URL}/d/${cleanSerial}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimCode: claimCode.trim(),
          name: propertyName.trim(),
          address: address.trim() || undefined,
          residentName: residentName.trim() || undefined,
          telegramChatId: telegramChatId.trim() || undefined,
          units: payloadUnits,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Error al activar el timbre.');
        return;
      }

      setSuccess(true);
      if (onActivated) {
        setTimeout(() => onActivated(cleanSerial), 2000);
      }
    } catch (err) {
      setErrorMsg('Error de conexión al intentar activar la chapa.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 animate-bounce">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">
          ¡Chapa Activada con Éxito!
        </span>
        <h2 className="text-2xl font-extrabold text-white mb-2">
          {propertyName}
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          La chapa metálica <span className="font-mono text-emerald-400 font-bold">{serial.toUpperCase()}</span> ya está vinculada y lista para recibir llamadas con videovisor.
        </p>

        <a
          href={`/d/${serial.toUpperCase()}`}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold text-sm hover:brightness-110 active:scale-95 transition shadow-xl shadow-emerald-950/80"
        >
          Probar Timbre Ahora
        </a>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-5 pt-safe pb-safe select-none">
      <header className="flex flex-col items-center text-center mt-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-950/60 mb-2 glow-emerald">
          <KeyRound className="w-6 h-6 stroke-[2.5]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">
          Activación de Hardware Físico
        </span>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Vincular Chapa UrGrowUp
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Ingresá el PIN secreto que vino en el sobre para activar tu placa de metal en la nube.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 my-auto">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Hardware Identifiers */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Serial de Chapa
            </label>
            <input
              type="text"
              required
              placeholder="Ej: UG-1003"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-emerald-400 uppercase placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition shadow-inner font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              PIN de Activación
            </label>
            <input
              type="text"
              maxLength={4}
              required
              placeholder="PIN de 4 dígitos"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition shadow-inner text-center font-bold tracking-widest"
            />
          </div>
        </div>

        {/* 2. Property Configuration */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Nombre de la Propiedad o Timbre
          </label>
          <input
            type="text"
            required
            placeholder="Ej: Complejo Brown 1200 o Casa Familia"
            value={propertyName}
            onChange={(e) => setPropertyName(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Dirección Física (Opcional)
          </label>
          <input
            type="text"
            placeholder="Ej: Almirante Brown 1200, Ramos Mejía"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
          />
        </div>

        {/* 3. Selector de Tipo de Propiedad */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Tipo de Inmueble
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPropertyType('single')}
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                propertyType === 'single'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Casa Única</span>
            </button>

            <button
              type="button"
              onClick={() => setPropertyType('multi')}
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                propertyType === 'multi'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>PH / Edificio</span>
            </button>
          </div>
        </div>

        {/* Si es Multi-Unidad: Lista interactiva de Unidades */}
        {propertyType === 'multi' && (
          <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Departamentos o Casas Internas
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ej: 1° A o Casa Frente"
                value={newUnitLabel}
                onChange={(e) => setNewUnitLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUnit();
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddUnit}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
              {units.map((unit, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200"
                >
                  <span>{unit}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveUnit(index)}
                    className="text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 4. Contacto de Telegram para Alertas */}
        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <Send className="w-3.5 h-3.5 text-sky-400" />
            <span>Notificaciones a Telegram</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Tu Nombre (ej: Ariel)"
              value={residentName}
              onChange={(e) => setResidentName(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <input
              type="text"
              placeholder="Telegram Chat ID"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-slate-950 font-bold text-sm hover:brightness-110 active:scale-95 transition shadow-xl shadow-emerald-950/80 flex items-center justify-center gap-2 glow-emerald"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isLoading ? 'Activando...' : 'Activar Timbre en la Nube'}</span>
        </button>
      </form>

      <footer className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-center gap-2 text-[11px] text-slate-500">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>Activación Segura por PIN &bull; UrGrowUp</span>
      </footer>
    </div>
  );
};

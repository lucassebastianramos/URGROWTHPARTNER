import React from 'react';
import {
  Bell,
  QrCode,
  Shield,
  ArrowRight,
  Smartphone,
  Sparkles,
  Building2,
  Home,
  KeyRound,
  Package,
  Layers,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col justify-between max-w-md w-full mx-auto px-5 pt-safe pb-safe">
      <header className="flex flex-col items-center text-center mt-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-xl shadow-emerald-950/60 mb-3 glow-emerald">
          <Bell className="w-8 h-8 stroke-[2.5]" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
          Hardware Serializado &bull; QR Dinámico
        </span>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          UrGrowUp Doorbell
        </h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
          Chapas de aluminio grabadas en láser con serial inmutable y asignación dinámica en la nube.
        </p>
      </header>

      <main className="my-auto py-3 space-y-3.5">
        {/* Chapas grabadas en láser de prueba */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <QrCode className="w-4 h-4 text-emerald-400" />
            Chapas Serializadas del Lote Láser
          </h2>

          <div className="space-y-2">
            {/* Chapa 1: Activa Casa */}
            <a
              href="/d/UG-1001"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition group active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
                  01
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition">
                    UG-1001 &bull; Oficina Central
                  </p>
                  <p className="text-[11px] text-slate-400">Activa (1 unidad) &bull; /d/UG-1001</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
            </a>

            {/* Chapa 2: Activa PH Multi-Unidad */}
            <a
              href="/d/UG-1002"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 transition group active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-mono font-bold text-xs">
                  02
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-emerald-400 transition">
                    UG-1002 &bull; Complejo Brown 1200
                  </p>
                  <p className="text-[11px] text-slate-400">Activa (4 unidades) &bull; /d/UG-1002</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition" />
            </a>

            {/* Chapa 3: Sin Activar (Stock en caja) */}
            <a
              href="/d/UG-1003"
              className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 transition group active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-bold text-xs">
                  03
                </div>
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-amber-400 transition flex items-center gap-1.5">
                    <span>UG-1003 &bull; Sin Activar (En Caja)</span>
                  </p>
                  <p className="text-[11px] text-amber-400/80">PIN: 8492 &bull; Probar Activación</p>
                </div>
              </div>
              <KeyRound className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition" />
            </a>

            {/* Chapa 4: Suspendida */}
            <a
              href="/d/UG-1005"
              className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800 transition group active:scale-98"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center font-mono font-bold text-xs">
                  05
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">
                    UG-1005 &bull; Chapa Suspendida
                  </p>
                  <p className="text-[11px] text-slate-500">Prueba de estado SUSPENDED</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-600 transition" />
            </a>
          </div>
        </div>

        {/* Acceso directo a activación por PIN */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-teal-950/40 border border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-bold text-white">¿Tenés una chapa nueva?</p>
              <p className="text-[11px] text-slate-400">Activala con el PIN de tu tarjeta</p>
            </div>
          </div>
          <a
            href="/activar"
            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold hover:bg-emerald-400 transition active:scale-95 shadow-md"
          >
            Activar
          </a>
        </div>
      </main>

      <footer className="mt-2 pt-3 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-500" />
          <span>urgrowup.com/d/</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Indirección QR Serializada</span>
        </div>
      </footer>
    </div>
  );
};

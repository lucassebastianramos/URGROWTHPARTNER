# 🔔 UrGrowUp - Smart Doorbell SaaS ("Timbre Inteligente QR")

MVP de alta disponibilidad para sistema de portero eléctrico inteligente por código QR con arquitectura **Hardware Serializado con QR Dinámico**, **Multi-Unidad (Edificios, PHs y Casas)**, **Videovisor WebRTC unidireccional**, señalización WebRTC P2P de audio bidireccional, notificaciones instantáneas a Telegram y despliegue en Docker con Cloudflare Tunnel bajo el dominio de producción **`https://urgrowup.com`**.

---

## 🏷️ Indirección por Hardware Serializado y QR Dinámico

El principio fundamental del sistema es desacoplar el hardware físico del inquilino o vivienda:
1. **Chapa Metálica Grabada en Láser:**
   - No lleva nombres, números ni datos mutables.
   - Solo lleva la marca *UrGrowUp*, la leyenda *"Escaneá para tocar timbre"* y el QR apuntando a la URL corta inmutable: `https://urgrowup.com/d/<SERIAL>` (ej: `https://urgrowup.com/d/UG-1001`) con el texto `ID: UG-1001`.
2. **Ciclo de Fabricación en Lote (Láser):**
   - Se mandan a grabar lotes de 50 o 100 chapas idénticas en stock con el script `npm run qr:batch`.
   - Genera archivos vectoriales **SVG** con nivel de corrección de error **H (30% redundancia)** listos para el software de corte láser, junto con `inventario_inicial.json`.
3. **Tarjeta con PIN de Activación:**
   - La chapa se entrega con una tarjeta o sobre sellado con un PIN de seguridad (ej: `PIN: 8492`), impidiendo que un tercero active una chapa recién instalada.
4. **Ciclo de Vida en Base de Datos:**
   - `UNCLAIMED`: Fabricada en caja. Al escanearla, solicita el PIN para configurarla por primera vez.
   - `ACTIVE`: Vinculada a una casa, PH o edificio con sus respectivas unidades y contactos.
   - `SUSPENDED`: Reportada dañada o con servicio pausado.

```
                                  [ Visitante ]
                          https://urgrowup.com/d/:serial
                                       │
                      (HTTPS / WSS vía Cloudflare Tunnel)
                                       ▼
                     ┌───────────────────────────────────┐
                     │   cloudflared (Cloudflare Tunnel) │
                     └─────────────────┬─────────────────┘
                                       │ (Reverse Proxy Local)
                                       ▼
                     ┌───────────────────────────────────┐
                     │   UrGrowUp App Container (Node 20)│
                     │  - Resolución de Hardware (/d/:id)│
                     │  - Activación por PIN (/activar)  │
                     │  - Selector de Unidades Multi-PH  │
                     │  - Socket.io Señalización WebRTC  │
                     │  - Servidor de SPA React (Vite)   │
                     └──────┬──────────────────────┬─────┘
                            │                      │
                  (Prisma)  │                      │ (Telegram Bot API)
                            ▼                      ▼
                   ┌─────────────────┐    ┌─────────────────┐
                   │  PostgreSQL 16  │    │  Residente App  │
                   │  (Docker Vol)   │    │ (Telegram Alert)│
                   └─────────────────┘    └────────┬────────┘
                                                   │
                                      [ Residente Abre Enlace ]
                           https://urgrowup.com/call/:callId?token=...
                                                   │
                                                   ▼
                ◄══════ Audio Bidireccional P2P (WebRTC) ══════►
                ══════► Video del Visitante (Videovisor) ══════►
                      (Google STUN: stun.l.google.com:19302)
```

---

## 🚀 Características y Requisitos Técnicos Cumplidos

1. **Desacoplamiento Propiedad / Unidad:**
   - Un único QR físico permite que el visitante seleccione la unidad de destino en condominios, o llame directamente en propiedades de una sola unidad.
2. **Videovisor Unidireccional en Vivo:**
   - Cámara frontal del visitante transmitida al residente en WebRTC P2P con fallback suave a solo audio si el dispositivo carece de cámara o deniega el permiso.
3. **Privacidad y Seguridad Estricta:**
   - El visitante **nunca** tiene acceso al número de teléfono, correo o ID de Telegram del residente.
   - Las URLs de atención rápida `/call/:callId?token=...` validan un **token efímero JWT firmado** con fecha de expiración estricta (10 minutos por defecto).
4. **Audio & Autoplay en iOS Safari / Android Chrome:**
   - La API de Web Audio (`AudioContext`) y los elementos `<audio>` son desbloqueados dentro del gesto táctil de usuario (`onClick` de "Tocar Timbre" y "Atender").
   - Sintetizador acústico procedural integrado con Web Audio API (genera repiques de timbre, tonos telefónicos cadenciados y beeps de conexión sin depender de archivos de audio externos).
5. **Manejo de Estados y Timeouts (45s):**
   - Si no hay respuesta tras 45 segundos, el servidor emite `call_missed`, marca la sesión en base de datos como `MISSED` y notifica al visitante.
   - Si cualquiera de las dos partes cierra la pestaña o pierde conexión, los streams y conexiones RTCPeerConnection se destruyen inmediatamente en ambos extremos.
6. **Anti-Spam (Rate Limiting):**
   - Limitador de ventana deslizante por IP y por unidad (máximo 2 intentos por minuto).
   - Bloqueo de llamadas concurrentes si la unidad específica ya se encuentra sonando o en comunicación (`409 Conflict`).
7. **Notificaciones Instantáneas:**
   - Despacho automático de alerta al Telegram del residente indicando el nombre de la propiedad y la **Unidad / Depto**, con botón en línea (*Inline Keyboard Button*) directo hacia la sala de video-atención.

---

## 📁 Estructura del Monorepo

```
URGROWTHPARTNER/
├── client/                     # Frontend React 18 + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/         # DoorbellButton, AudioWaveIndicator, StatusBadge
│   │   ├── hooks/              # useWebRTC.ts, useAudioTone.ts
│   │   ├── pages/              # VisitorPage.tsx, ResidentPage.tsx, HomePage.tsx
│   │   ├── config.ts           # Configuración de URLs y servidores STUN
│   │   ├── App.tsx             # Enrutador cliente (/v/:slug, /call/:callId)
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── server/                     # Backend Express + Socket.io + Prisma ORM
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos: User, Doorbell, CallSession
│   │   └── seed.ts             # Poblado inicial (timbres 'oficina' y 'casa-1')
│   ├── src/
│   │   ├── config/env.ts       # Variables de entorno y orígenes CORS
│   │   ├── db/prisma.ts        # Cliente Prisma singleton
│   │   ├── routes/             # Endpoints REST (/api/doorbells, /api/calls)
│   │   ├── services/           # telegram.service, token.service, rateLimiter, callManager
│   │   ├── socket/             # Señalización WebRTC tipada en Socket.io
│   │   ├── app.ts              # Servidor Express y middleware
│   │   └── index.ts            # Punto de entrada HTTP y WebSockets
│   ├── docker-entrypoint.sh    # Script de arranque en Docker (migraciones y seed)
│   └── package.json
├── Dockerfile                  # Build multietapa (Frontend + Backend + Alpine Runner)
├── docker-compose.yml          # Postgres 16 + App + Cloudflare Tunnel
├── .env.example                # Plantilla de variables de entorno
└── package.json                # Scripts raíz del monorepo
```

---

## ⚙️ Configuración de Variables de Entorno (`.env`)

Copia la plantilla `.env.example` a `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Configura las siguientes variables:

```ini
APP_URL=https://urgrowup.com
PORT=3000
NODE_ENV=production

# Base de Datos PostgreSQL
POSTGRES_USER=doorbell_user
POSTGRES_PASSWORD=tu_contraseña_segura_aqui
POSTGRES_DB=doorbell_db
DATABASE_URL="postgresql://doorbell_user:tu_contraseña_segura_aqui@postgres:5432/doorbell_db?schema=public"

# Seguridad y Token Efímero
JWT_SECRET=tu_secreto_aleatorio_muy_largo_y_seguro_2026
TOKEN_EXPIRES_IN_SECONDS=600

# Integración Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_DEFAULT_CHAT_ID=12345678

# Cloudflare Tunnel
TUNNEL_TOKEN=eyJhIjoiZXhhbXBsZS10b2tlbi1yZXBsYWNlLXdpdGgteW91ci1vd24tdG9rZW4ifQ==
```

> **Nota sobre Telegram:** Si dejas `TELEGRAM_BOT_TOKEN` vacío durante desarrollo local, el sistema registrará en los logs de consola la URL directa generada para el residente para que puedas probarla sin configurar un bot.

---

## 🐳 Despliegue en Producción con Docker y Cloudflare Tunnel

El stack está optimizado para un servidor Linux local con **8 GB de RAM**, utilizando un túnel seguro de Cloudflare sin necesidad de abrir puertos en tu router o firewall.

### 1. Obtener el `TUNNEL_TOKEN` de Cloudflare
1. Accede a tu panel de **Cloudflare Zero Trust** -> **Networks** -> **Tunnels**.
2. Crea un nuevo túnel llamado `urgrowup-doorbell`.
3. Copia el **Token del túnel** provisto y colócalo en tu archivo `.env` en `TUNNEL_TOKEN`.
4. En la pestaña **Public Hostname** del túnel en Cloudflare, configura la siguiente regla:
   - **Subdomain / Domain:** `urgrowup.com`
   - **Type:** `HTTP`
   - **URL:** `app:3000` (el nombre del servicio interno de Docker)
   - En **Additional application settings** -> **HTTP Configurations**, activa **WebSockets**.

### 2. Levantar el stack completo
En la raíz del proyecto, ejecuta:

```bash
docker compose up -d --build
```

El proceso automatizado:
1. Compilará el frontend estático con Vite.
2. Compilará el backend con TypeScript en modo estricto.
3. Levantará PostgreSQL 16 Alpine con límite de memoria optimizado.
4. Esperará la salud de la base de datos y ejecutará automáticamente `npx prisma db push` y el script de seed con los timbres demo.
5. Iniciará `cloudflared` conectando el tráfico de `https://urgrowup.com` al puerto 3000 interno.

### 3. Verificar estado de los contenedores
```bash
docker compose ps
docker compose logs -f app
```

---

## 💻 Desarrollo Local (Sin Docker)

Si deseas trabajar en desarrollo local con recarga en caliente:

### 1. Instalar dependencias
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 2. Base de datos local
Asegúrate de tener PostgreSQL ejecutándose y tu `.env` apuntando a `localhost:5432`.
Ejecuta la sincronización de esquema y seed:
```bash
npm run db:migrate
npm run db:seed
```

### 3. Iniciar servidores
En dos terminales separadas (o usando los scripts npm):

- **Backend (Puerto 3000):**
  ```bash
  npm run dev:server
  ```
- **Frontend Vite (Puerto 5173 con proxy a 3000):**
  ```bash
  npm run dev:client
  ```

### 4. Generación de Lotes Láser (Vectorial SVG)
Para generar un nuevo lote de 50 chapas listas para enviar al taller de corte láser:
```bash
npm run qr:batch
```
Esto genera en el directorio `qrs_para_laser/`:
- 50 archivos vectoriales `UG-1001.svg` a `UG-1050.svg` con nivel de corrección H (30%).
- `inventario_inicial.json` con los números de serie, PINs secretos de activación y URLs cortas.

---

## 🧪 Pruebas del Flujo Completo (Paso a Paso)

### Caso 1: Chapa en Stock sin Activar (`UG-1003`)
1. Abre `https://urgrowup.com/d/UG-1003` (o `http://localhost:5173/d/UG-1003`).
2. El sistema detecta el estado `UNCLAIMED` y abre el portal de activación.
3. Ingresa el PIN provisto en la tarjeta: **`8492`**.
4. Completa el nombre de la propiedad (ej: *"PH Las Heras 300"*), define si es casa única o agrega unidades (*"Frente"* / *"Fondo"*), y guarda.
5. Inmediatamente la chapa pasa a estado `ACTIVE` en la base de datos sin cambiar el metal.

### Caso 2: Chapa Activa Casa Única (`UG-1001`)
1. Abre `https://urgrowup.com/d/UG-1001` (o `http://localhost:5173/d/UG-1001`).
2. Como tiene una sola unidad ("Recepción"), la selecciona automáticamente y muestra el botón táctil de llamada.
3. Al tocar el timbre, activa el videovisor (cámara frontal del visitante), dispara el mensaje a Telegram y comienza el timbrado de 45s.

### Caso 3: Chapa Activa PH Multi-Unidad (`UG-1002`)
1. Abre `https://urgrowup.com/d/UG-1002`.
2. Verás el título **"Complejo Brown 1200"** y la grilla táctil con buscador rápido:
   - `Casa Frente`
   - `Casa Fondo`
   - `1° Piso Depto A`
   - `1° Piso Depto B`
3. Al tocar **"Casa Frente"**, se selecciona la unidad y aparece la pantalla de llamada.
4. Al presionar **"Tocar Timbre"**, activa la cámara del visitante y notifica a Telegram con el botón `[ 📹 ATENDER VIDEO-LLAMADA ]`.

### Caso 4: Chapa Suspendida (`UG-1005`)
1. Abre `https://urgrowup.com/d/UG-1005`.
2. El sistema muestra la pantalla institucional de suspensión: *"Servicio temporalmente no disponible"*.

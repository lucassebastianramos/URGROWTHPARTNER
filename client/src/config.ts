// Client application configuration
export const CONFIG = {
  // Base origin for API and WebSockets
  BASE_URL: typeof window !== 'undefined' ? window.location.origin : 'https://urgrowup.com',
  API_BASE_URL: '/api',
  SOCKET_URL: typeof window !== 'undefined' ? window.location.origin : 'https://urgrowup.com',

  // STUN Servers configuration for WebRTC NAT traversal
  RTC_CONFIG: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  } satisfies RTCConfiguration,

  // Audio constraints optimized for mobile speech
  AUDIO_CONSTRAINTS: {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  } satisfies MediaStreamConstraints,
};

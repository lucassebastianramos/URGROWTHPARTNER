import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { CONFIG } from '../config.js';

export interface UseWebRTCOptions {
  callId: string;
  role: 'visitor' | 'resident';
  token?: string;
  onCallAccepted?: () => void;
  onCallEnded?: (reason: string, durationSeconds?: number) => void;
  onCallMissed?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useWebRTC(options: UseWebRTCOptions) {
  const { callId, role, token, onCallAccepted, onCallEnded, onCallMissed, onError } = options;

  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [peerMuted, setPeerMuted] = useState<boolean>(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);
  const [hasLocalVideo, setHasLocalVideo] = useState<boolean>(false);
  const [localAudioLevel, setLocalAudioLevel] = useState<number>(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const iceCandidatesQueueRef = useRef<RTCIceCandidateInit[]>([]);

  // Web Audio analysers for real-time speech meter
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  /**
   * Initializes local media stream.
   * - Visitor: requests mic + front camera for Videovisor.
   * - Resident: requests mic only.
   */
  const getLocalMediaStream = useCallback(async (): Promise<MediaStream> => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    try {
      let stream: MediaStream;

      if (role === 'visitor') {
        // Attempt to get audio + front-facing video (Videovisor)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: CONFIG.AUDIO_CONSTRAINTS.audio,
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
          setHasLocalVideo(true);
          console.log('📹 [WebRTC] Visitor camera and audio acquired successfully.');
        } catch (videoErr) {
          console.warn('⚠️ [WebRTC] Camera access failed or denied, falling back to audio only:', videoErr);
          stream = await navigator.mediaDevices.getUserMedia(CONFIG.AUDIO_CONSTRAINTS);
          setHasLocalVideo(false);
        }
      } else {
        // Resident only sends audio (resident remains private)
        stream = await navigator.mediaDevices.getUserMedia(CONFIG.AUDIO_CONSTRAINTS);
        setHasLocalVideo(false);
      }

      localStreamRef.current = stream;

      // Bind local video preview if visitor
      if (localVideoRef.current && role === 'visitor') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(console.warn);
      }

      setupAudioMeters(stream, 'local');
      return stream;
    } catch (err: any) {
      console.error('❌ [WebRTC] Media permission denied:', err);
      const msg = err.name === 'NotAllowedError'
        ? 'Permiso de micrófono o cámara denegado. Habilita los permisos en tu navegador.'
        : 'No se pudo acceder a los dispositivos de audio o video.';
      if (onError) onError(msg);
      throw new Error(msg);
    }
  }, [role, onError]);

  /**
   * Sets up Web Audio AnalyserNode to calculate speech volume levels (0-100)
   */
  const setupAudioMeters = useCallback((stream: MediaStream, type: 'local' | 'remote') => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) return;

      if (!audioContextRef.current) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtxClass();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));

        if (type === 'local') {
          setLocalAudioLevel(normalized);
        } else {
          setRemoteAudioLevel(normalized);
        }

        animFrameRef.current = requestAnimationFrame(checkLevel);
      };

      animFrameRef.current = requestAnimationFrame(checkLevel);
    } catch (e) {
      console.warn('Audio metering unavailable:', e);
    }
  }, []);

  /**
   * Creates RTCPeerConnection and binds media & ICE listeners
   */
  const createPeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;

    console.log('🔧 [WebRTC] Creating RTCPeerConnection...');
    const pc = new RTCPeerConnection(CONFIG.RTC_CONFIG);
    pcRef.current = pc;

    // Monitor connection status
    pc.onconnectionstatechange = () => {
      console.log(`📡 [WebRTC] Connection state changed: ${pc.connectionState}`);
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.warn('⚠️ [WebRTC] Connection failed, attempting ICE restart...');
        pc.restartIce();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 [WebRTC] ICE state: ${pc.iceConnectionState}`);
    };

    // Forward local ICE candidate to peer via signaling
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice_candidate', {
          callId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Receive remote media track (audio and/or video)
    pc.ontrack = (event) => {
      console.log('🎵 [WebRTC] Remote track received:', event.track.kind);
      const stream = event.streams[0] || new MediaStream([event.track]);
      remoteStreamRef.current = stream;

      if (event.track.kind === 'video') {
        setHasRemoteVideo(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch((err) => {
            console.warn('⚠️ [WebRTC] Remote video play error:', err);
          });
        }
      }

      if (event.track.kind === 'audio') {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch((err) => {
            console.warn('⚠️ [WebRTC] Remote audio autoplay error:', err);
          });
        }
        setupAudioMeters(stream, 'remote');
      }
    };

    // Attach local media tracks (Audio and Video if visitor)
    const localStream = await getLocalMediaStream();
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    return pc;
  }, [callId, getLocalMediaStream, setupAudioMeters]);

  /**
   * Sends WebRTC Offer (Initiated by Visitor when Call is accepted)
   */
  const sendOffer = useCallback(async () => {
    try {
      console.log('📤 [WebRTC] Creating and sending SDP Offer...');
      const pc = await createPeerConnection();
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await pc.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('webrtc_offer', {
          callId,
          sdp: offer,
        });
      }
    } catch (err: any) {
      console.error('❌ [WebRTC] Error sending offer:', err);
      if (onError) onError('Error al generar la señal de comunicación.');
    }
  }, [callId, createPeerConnection, onError]);

  /**
   * Connects to Socket.io and establishes signaling room
   */
  const connectSignaling = useCallback(() => {
    if (socketRef.current) return;

    console.log(`🔌 [Socket.io] Connecting to ${CONFIG.SOCKET_URL}...`);
    const socket = io(CONFIG.SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log(`✅ [Socket.io] Connected with socket ID: ${socket.id}`);
      socket.emit('join_room', {
        callId,
        role,
        token,
      });
    });

    socket.on('joined_room', (data) => {
      console.log(`🚪 [Socket.io] Successfully joined room call:${callId}`, data);
    });

    socket.on('call_accepted', () => {
      console.log('🎉 [Socket.io] Resident accepted the call!');
      if (onCallAccepted) onCallAccepted();

      // Visitor generates offer upon acceptance
      if (role === 'visitor') {
        sendOffer();
      }
    });

    socket.on('webrtc_offer', async ({ sdp }) => {
      console.log('📥 [WebRTC] Received SDP Offer from peer.');
      try {
        const pc = await createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush queued ICE candidates
        while (iceCandidatesQueueRef.current.length > 0) {
          const candidate = iceCandidatesQueueRef.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        // Generate and send Answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc_answer', {
          callId,
          sdp: answer,
        });
        console.log('📤 [WebRTC] Answer generated and sent.');
      } catch (err) {
        console.error('❌ [WebRTC] Error handling offer:', err);
      }
    });

    socket.on('webrtc_answer', async ({ sdp }) => {
      console.log('📥 [WebRTC] Received SDP Answer from peer.');
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));

          // Flush queued ICE candidates
          while (iceCandidatesQueueRef.current.length > 0) {
            const candidate = iceCandidatesQueueRef.current.shift();
            if (candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (err) {
        console.error('❌ [WebRTC] Error handling answer:', err);
      }
    });

    socket.on('ice_candidate', async ({ candidate }) => {
      try {
        if (pcRef.current && pcRef.current.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          iceCandidatesQueueRef.current.push(candidate);
        }
      } catch (err) {
        console.warn('⚠️ [WebRTC] Error adding ICE candidate:', err);
      }
    });

    socket.on('peer_mute_toggle', ({ isMuted: peerMuteState }) => {
      setPeerMuted(peerMuteState);
    });

    socket.on('call_missed', ({ message }) => {
      console.log('⏱️ [WebRTC] Call missed:', message);
      if (onCallMissed) onCallMissed(message);
      hangup('missed');
    });

    socket.on('call_ended', ({ reason, durationSeconds }) => {
      console.log(`🛑 [WebRTC] Call ended by peer: reason=${reason}`);
      if (onCallEnded) onCallEnded(reason, durationSeconds);
      hangup(reason);
    });

    socket.on('error_message', ({ message }) => {
      console.error('❌ [Socket.io] Error:', message);
      if (onError) onError(message);
    });
  }, [callId, role, token, onCallAccepted, onCallEnded, onCallMissed, onError, sendOffer, createPeerConnection]);

  /**
   * Accepts call (Invoked by resident clicking "Atender")
   */
  const acceptIncomingCall = useCallback(async () => {
    if (socketRef.current) {
      console.log('📞 [WebRTC] Emitting call_accept...');
      socketRef.current.emit('call_accept', { callId });
      await getLocalMediaStream();
    }
  }, [callId, getLocalMediaStream]);

  /**
   * Toggles microphone mute state
   */
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const newMuteState = !audioTrack.enabled;
      setIsMuted(newMuteState);

      if (socketRef.current) {
        socketRef.current.emit('mute_toggle', {
          callId,
          isMuted: newMuteState,
        });
      }
    }
  }, [callId]);

  /**
   * Hang up and clean up all media tracks & sockets
   */
  const hangup = useCallback((reason: string = 'hangup') => {
    console.log(`🛑 [WebRTC] Cleaning up call resources (${reason})...`);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('end_call', { callId, reason });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Stop all local tracks (both microphone and camera)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    setConnectionState('closed');
    setHasRemoteVideo(false);
    setHasLocalVideo(false);
    setLocalAudioLevel(0);
    setRemoteAudioLevel(0);
  }, [callId]);

  useEffect(() => {
    return () => {
      hangup('unmount');
    };
  }, [hangup]);

  return {
    remoteAudioRef,
    remoteVideoRef,
    localVideoRef,
    hasRemoteVideo,
    hasLocalVideo,
    connectionState,
    isMuted,
    peerMuted,
    localAudioLevel,
    remoteAudioLevel,
    connectSignaling,
    acceptIncomingCall,
    toggleMute,
    hangup,
  };
}

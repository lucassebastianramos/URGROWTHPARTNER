export interface ClientToServerEvents {
  join_room: (data: {
    callId: string;
    role: 'visitor' | 'resident';
    token?: string;
  }) => void;

  call_accept: (data: {
    callId: string;
  }) => void;

  webrtc_offer: (data: {
    callId: string;
    sdp: any;
  }) => void;

  webrtc_answer: (data: {
    callId: string;
    sdp: any;
  }) => void;

  ice_candidate: (data: {
    callId: string;
    candidate: any;
  }) => void;

  mute_toggle: (data: {
    callId: string;
    isMuted: boolean;
  }) => void;

  end_call: (data: {
    callId: string;
    reason?: string;
  }) => void;
}

export interface ServerToClientEvents {
  joined_room: (data: {
    role: 'visitor' | 'resident';
    callId: string;
    peerPresent: boolean;
    status: string;
  }) => void;

  peer_joined: (data: {
    role: 'visitor' | 'resident';
  }) => void;

  call_accepted: (data: {
    callId: string;
  }) => void;

  webrtc_offer: (data: {
    sdp: any;
  }) => void;

  webrtc_answer: (data: {
    sdp: any;
  }) => void;

  ice_candidate: (data: {
    candidate: any;
  }) => void;

  peer_mute_toggle: (data: {
    isMuted: boolean;
  }) => void;

  call_missed: (data: {
    callId: string;
    reason: string;
    message: string;
  }) => void;

  call_ended: (data: {
    callId: string;
    reason: string;
    durationSeconds?: number;
  }) => void;

  error_message: (data: {
    code: string;
    message: string;
  }) => void;
}

export interface InterServerEvents {}

export interface SocketData {
  callId?: string;
  role?: 'visitor' | 'resident';
}

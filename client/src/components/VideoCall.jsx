import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Crown,
  Heart,
  Sparkles,
  Wifi,
  Copy,
  Check,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import BirthdayHatOverlay from './BirthdayHatOverlay';

// High-availability default STUN + multi-transport TURN servers (fallback)
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // OpenRelay Metered TURN Relays (UDP, TCP, and TLS)
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp'
    ],
    username: 'openrelay',
    credential: 'openrelay'
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelay',
    credential: 'openrelay'
  },
  {
    urls: [
      'turn:turn.matrix.org:3478?transport=udp',
      'turn:turn.matrix.org:3478?transport=tcp'
    ]
  }
];

const DEFAULT_RTC_CONFIG = {
  iceServers: DEFAULT_ICE_SERVERS,
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle'
};

function VideoCallComponent({
  socket,
  roomId,
  currentUser,
  participants = [],
  hatStyle = 'royal-gold',
  onBlowMicStream = null
}) {
  const localVideoRef = useRef(null);
  const localBlurVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteBlurVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const iceCandidatesQueueRef = useRef([]);
  const pendingOfferRef = useRef(null);
  const makingOfferRef = useRef(false);
  const targetPeerIdRef = useRef(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [connectionStatus, setConnectionStatus] = useState('waiting'); // 'waiting' | 'connecting' | 'connected' | 'disconnected'
  const [iceStatusText, setIceStatusText] = useState('Connecting to partner...');
  const [rtcConfig, setRtcConfig] = useState(DEFAULT_RTC_CONFIG);
  const [isRemoteLive, setIsRemoteLive] = useState(false);
  const [hasRemoteUser, setHasRemoteUser] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('Partner');
  const [remoteUserRole, setRemoteUserRole] = useState('partner');
  const [mediaError, setMediaError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [localIsPortrait, setLocalIsPortrait] = useState(false);
  const [remoteIsPortrait, setRemoteIsPortrait] = useState(false);

  // Hat customization
  const [hatYOffset, setHatYOffset] = useState(0.36);
  const [hatSizeScale, setHatSizeScale] = useState(0.88);
  const [showHatSettings, setShowHatSettings] = useState(false);

  const isLocalStar = currentUser?.role === 'star';

  // Helper: Play video with browser autoplay policy fallback
  const playVideoSafely = useCallback((videoEl) => {
    if (!videoEl) return;
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('[VideoCall] Autoplay with audio was restricted by browser. Muting temporarily so video visuals render immediately:', err.name);
        videoEl.muted = true;
        videoEl.play().catch(e => console.error('[VideoCall] Even muted play failed:', e));
      });
    }
  }, []);

  // Callback ref for remote video: guarantees stream is bound whenever element mounts or updates
  const setRemoteVideo = useCallback((node) => {
    remoteVideoRef.current = node;
    if (node) {
      if (remoteStreamRef.current && remoteStreamRef.current.getTracks().length > 0) {
        node.srcObject = remoteStreamRef.current;
        playVideoSafely(node);
      }
    }
  }, [playVideoSafely]);

  // Callback ref for remote blurred background video
  const setRemoteBlurVideo = useCallback((node) => {
    remoteBlurVideoRef.current = node;
    if (node && remoteStreamRef.current && remoteStreamRef.current.getTracks().length > 0) {
      node.srcObject = remoteStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Callback ref for local video
  const setLocalVideo = useCallback((node) => {
    localVideoRef.current = node;
    if (node && localStreamRef.current) {
      node.srcObject = localStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Callback ref for local blurred background video
  const setLocalBlurVideo = useCallback((node) => {
    localBlurVideoRef.current = node;
    if (node && localStreamRef.current) {
      node.srcObject = localStreamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Global user interaction listener to unmute remote video once user touches or clicks anywhere
  useEffect(() => {
    const handleUserInteraction = () => {
      if (remoteVideoRef.current && remoteVideoRef.current.muted) {
        remoteVideoRef.current.muted = false;
        remoteVideoRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('click', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // Identify remote participant from room participants list
  useEffect(() => {
    const remote = participants.find(p => p.id !== socket?.id);
    if (remote) {
      setHasRemoteUser(true);
      setRemoteUserName(remote.name || (remote.role === 'star' ? 'Birthday Star' : 'Partner'));
      setRemoteUserRole(remote.role || 'partner');
      targetPeerIdRef.current = remote.id;
    } else {
      setHasRemoteUser(false);
      setIsRemoteLive(false);
      targetPeerIdRef.current = null;
    }
  }, [participants, socket?.id]);

  // Dynamic ICE server retrieval (STUN + TURN credentials)
  useEffect(() => {
    let isCancelled = false;

    async function fetchIceConfig() {
      try {
        if (socket) {
          socket.emit('get-ice-servers', ({ iceServers }) => {
            if (!isCancelled && iceServers && Array.isArray(iceServers) && iceServers.length > 0) {
              console.log('[WebRTC ICE] Configured with', iceServers.length, 'servers via Socket.IO');
              setRtcConfig(prev => ({ ...prev, iceServers }));
            }
          });
        }

        const res = await fetch('/api/ice-servers');
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            console.log('[WebRTC ICE] Configured with', data.iceServers.length, 'servers via REST API');
            setRtcConfig(prev => ({ ...prev, iceServers: data.iceServers }));
          }
        }
      } catch (err) {
        console.log('[WebRTC ICE] Using fallback high-availability STUN + TURN servers');
      }
    }

    fetchIceConfig();
    return () => { isCancelled = true; };
  }, [socket]);

  // Flush queued ICE candidates helper
  const flushQueuedIceCandidates = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
    const queue = [...iceCandidatesQueueRef.current];
    iceCandidatesQueueRef.current = [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
        console.log('[WebRTC ICE] Successfully applied queued candidate');
      } catch (err) {
        console.warn('[WebRTC ICE] Add queued ICE error:', err.message);
      }
    }
  }, []);

  // Create & Send Offer helper
  const createAndSendOffer = useCallback(async (targetId) => {
    const pc = peerConnectionRef.current;
    if (!pc || makingOfferRef.current) return;
    try {
      makingOfferRef.current = true;
      console.log('[WebRTC] Creating Offer for target:', targetId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('signal-offer', {
          to: targetId,
          offer
        });
        console.log('[WebRTC] Offer sent to target:', targetId);
      }
    } catch (err) {
      console.error('[WebRTC] createAndSendOffer error:', err);
    } finally {
      makingOfferRef.current = false;
    }
  }, [socket]);

  // Handle incoming Offer helper
  const handleIncomingOffer = useCallback(async (from, offer) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] Storing pending offer because peer connection is still initializing');
      pendingOfferRef.current = { from, offer };
      return;
    }

    try {
      console.log('[WebRTC] Processing incoming Offer from:', from);
      targetPeerIdRef.current = from;

      if (pc.signalingState !== 'stable') {
        console.log('[WebRTC] Rolling back local description due to incoming offer');
        await pc.setLocalDescription({ type: 'rollback' });
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      await flushQueuedIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.emit('signal-answer', {
          to: from,
          answer
        });
        console.log('[WebRTC] Answer sent back to:', from);
      }
    } catch (err) {
      console.error('[WebRTC] handleIncomingOffer error:', err);
    }
  }, [socket, flushQueuedIceCandidates]);

  // Setup Peer Connection with local tracks and event handlers
  const setupPeerConnection = useCallback((stream) => {
    if (peerConnectionRef.current) {
      try { peerConnectionRef.current.close(); } catch (e) {}
    }

    console.log('[WebRTC] Initializing RTCPeerConnection with servers:', rtcConfig.iceServers?.length || 0);
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    if (stream) {
      stream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, stream);
        } catch (e) {
          console.warn('[WebRTC] addTrack error:', e);
        }
      });
    }

    // Diagnostic inspector for selected ICE candidate pair
    const checkSelectedCandidatePair = async () => {
      try {
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && (report.selected || report.state === 'succeeded')) {
            const local = stats.get(report.localCandidateId);
            const remote = stats.get(report.remoteCandidateId);
            const isRelay = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
            console.log(`[ICE Diagnostic] Selected Pair: Local [${local?.candidateType}] (${local?.protocol}) <--> Remote [${remote?.candidateType}] (${remote?.protocol})`);
            console.log(`[ICE Diagnostic] Traversal Path: ${isRelay ? 'TURN RELAY (Symmetric NAT bypassed)' : 'DIRECT P2P'}`);
          }
        });
      } catch (e) {}
    };

    // Remote Track Handler
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind, event.streams);
      let incomingStream = null;
      if (event.streams && event.streams[0]) {
        incomingStream = event.streams[0];
      } else {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        incomingStream = remoteStreamRef.current;
      }
      remoteStreamRef.current = incomingStream;

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = incomingStream;
        playVideoSafely(remoteVideoRef.current);
      }
      if (remoteBlurVideoRef.current) {
        remoteBlurVideoRef.current.srcObject = incomingStream;
        remoteBlurVideoRef.current.play().catch(() => {});
      }

      setIsRemoteLive(true);
      setHasRemoteUser(true);
      setConnectionStatus('connected');
      setIceStatusText('Video connected ❤️');
      checkSelectedCandidatePair();
    };

    // ICE Candidate Generation with diagnostic inspection
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const type = event.candidate.type;
        const protocol = event.candidate.protocol;
        const host = `${event.candidate.address || event.candidate.ip || 'unknown'}:${event.candidate.port}`;
        console.log(`[ICE Candidate Generated] Type: [${type}], Protocol: ${protocol}, Target: ${host}`);

        if (socket) {
          socket.emit('signal-ice', {
            to: targetPeerIdRef.current,
            candidate: event.candidate
          });
        }
      } else {
        console.log('[ICE Gathering] Local ICE candidate gathering completed.');
      }
    };

    // ICE Gathering State change
    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC Diagnostic] iceGatheringState:', pc.iceGatheringState);
    };

    // ICE Connection State change
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC Diagnostic] iceConnectionState:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'checking') {
        setConnectionStatus('connecting');
        setIceStatusText('Establishing secure video connection...');
      } else if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setConnectionStatus('connected');
        setIceStatusText('Video connected ❤️');
        setIsRemoteLive(true);
        checkSelectedCandidatePair();
      } else if (pc.iceConnectionState === 'disconnected') {
        setConnectionStatus('connecting');
        setIceStatusText('Connection interrupted. Reconnecting...');
      } else if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC Diagnostic] ICE connection failed across networks. Triggering ICE restart with TURN relay...');
        setConnectionStatus('connecting');
        setIceStatusText('Connection interrupted. Reconnecting...');
        try {
          if (pc.restartIce && targetPeerIdRef.current) {
            pc.restartIce();
            createAndSendOffer(targetPeerIdRef.current);
          }
        } catch (e) {
          console.error('[WebRTC ICE Restart Error]:', e);
        }
      }
    };

    // Peer Connection State change
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC Diagnostic] connectionState:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setIceStatusText('Video connected ❤️');
        setIsRemoteLive(true);
        checkSelectedCandidatePair();
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
        setIceStatusText('Establishing secure video connection...');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected');
        setIceStatusText('Connection interrupted. Reconnecting...');
      }
    };

    // Signaling State change
    pc.onsignalingstatechange = () => {
      console.log('[WebRTC Diagnostic] signalingState:', pc.signalingState);
    };

    // If an offer arrived while media was initializing, process it now!
    if (pendingOfferRef.current) {
      const { from, offer } = pendingOfferRef.current;
      pendingOfferRef.current = null;
      handleIncomingOffer(from, offer);
    }

    return pc;
  }, [socket, playVideoSafely, handleIncomingOffer, rtcConfig, createAndSendOffer]);

  // Initialize Media Stream & WebRTC
  useEffect(() => {
    let isCancelled = false;

    async function initMedia() {
      try {
        setMediaError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: true
        });

        if (isCancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        if (localBlurVideoRef.current) {
          localBlurVideoRef.current.srcObject = stream;
          localBlurVideoRef.current.play().catch(() => {});
        }

        if (onBlowMicStream) {
          onBlowMicStream(stream);
        }

        setupPeerConnection(stream);

        // Notify room that our media & WebRTC connection are ready
        if (socket) {
          socket.emit('webrtc-ready');
        }
      } catch (err) {
        console.warn('[VideoCall] Camera getUserMedia error:', err);
        setMediaError(
          err.name === 'NotAllowedError'
            ? 'Camera / microphone access denied. Please click the camera icon in your browser URL bar to allow.'
            : 'Camera could not be accessed. If another tab is using the camera, you can still participate!'
        );

        // Audio fallback if video fails
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!isCancelled) {
            localStreamRef.current = audioOnly;
            setIsVideoDisabled(true);
            setupPeerConnection(audioOnly);
            if (socket) socket.emit('webrtc-ready');
          }
        } catch (e) {
          setupPeerConnection(null);
          if (socket) socket.emit('webrtc-ready');
        }
      }
    }

    initMedia();

    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [facingMode, setupPeerConnection, socket, onBlowMicStream]);

  // Socket Signaling Listeners
  useEffect(() => {
    if (!socket) return;

    // Server-coordinated handshake: Designated as Caller
    const handleStartWebRtcCall = ({ to }) => {
      console.log('[Socket] start-webrtc-call received, targeting:', to);
      targetPeerIdRef.current = to;
      setHasRemoteUser(true);
      setConnectionStatus('connecting');
      createAndSendOffer(to);
    };

    // Server-coordinated handshake: Designated as Callee
    const handleExpectWebRtcCall = ({ from }) => {
      console.log('[Socket] expect-webrtc-call received from:', from);
      targetPeerIdRef.current = from;
      setHasRemoteUser(true);
      setConnectionStatus('connecting');
    };

    // Remote peer joined room
    const handlePeerJoined = ({ peer }) => {
      console.log('[Socket] Peer joined:', peer.id);
      targetPeerIdRef.current = peer.id;
      setHasRemoteUser(true);
      setRemoteUserName(peer.name);
      setRemoteUserRole(peer.role);
      setConnectionStatus('connecting');
      if (socket) socket.emit('webrtc-ready');
    };

    // Remote peer signaled webrtc-ready
    const handleWebRtcReady = ({ from }) => {
      console.log('[Socket] Peer webrtc-ready received from:', from);
      targetPeerIdRef.current = from;
      setHasRemoteUser(true);
    };

    // Received WebRTC Offer
    const handleSignalOffer = ({ from, offer }) => {
      console.log('[Socket] signal-offer received from:', from);
      handleIncomingOffer(from, offer);
    };

    // Received WebRTC Answer
    const handleSignalAnswer = async ({ from, answer }) => {
      console.log('[Socket] signal-answer received from:', from);
      const pc = peerConnectionRef.current;
      if (!pc || pc.signalingState === 'stable') return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushQueuedIceCandidates(pc);
        console.log('[WebRTC] Answer set successfully. Connection establishing!');
      } catch (err) {
        console.error('[WebRTC] setRemoteDescription Answer error:', err);
      }
    };

    // Received ICE Candidate
    const handleSignalIce = async ({ from, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!candidate) return;

      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('[WebRTC] addIceCandidate error:', err);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    };

    // Remote peer disconnected
    const handlePeerLeft = ({ peerName }) => {
      console.log('[Socket] Peer left:', peerName);
      setHasRemoteUser(false);
      setIsRemoteLive(false);
      setConnectionStatus('waiting');
      remoteStreamRef.current = new MediaStream();
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      if (remoteBlurVideoRef.current) {
        remoteBlurVideoRef.current.srcObject = null;
      }
    };

    socket.on('start-webrtc-call', handleStartWebRtcCall);
    socket.on('expect-webrtc-call', handleExpectWebRtcCall);
    socket.on('peer-joined', handlePeerJoined);
    socket.on('webrtc-ready', handleWebRtcReady);
    socket.on('signal-offer', handleSignalOffer);
    socket.on('signal-answer', handleSignalAnswer);
    socket.on('signal-ice', handleSignalIce);
    socket.on('peer-left', handlePeerLeft);

    return () => {
      socket.off('start-webrtc-call', handleStartWebRtcCall);
      socket.off('expect-webrtc-call', handleExpectWebRtcCall);
      socket.off('peer-joined', handlePeerJoined);
      socket.off('webrtc-ready', handleWebRtcReady);
      socket.off('signal-offer', handleSignalOffer);
      socket.off('signal-answer', handleSignalAnswer);
      socket.off('signal-ice', handleSignalIce);
      socket.off('peer-left', handlePeerLeft);
    };
  }, [socket, createAndSendOffer, handleIncomingOffer, flushQueuedIceCandidates]);

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
        if (socket) {
          socket.emit('update-user-media', { isMuted: !audioTrack.enabled });
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoDisabled(!videoTrack.enabled);
        if (socket) {
          socket.emit('update-user-media', { isVideoOff: !videoTrack.enabled });
        }
      }
    }
  };

  const switchFacingMode = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const isBothConnected = participants.length >= 2 || connectionStatus === 'connected';

  return (
    <div className="relative w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden select-none">
      {/* Permission Warning Banner if any */}
      {mediaError && (
        <div className="mb-2 z-40 bg-rose-950/90 border border-rose-500/50 rounded-xl p-2.5 text-xs text-rose-200 flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{mediaError}</span>
          </div>
          <button
            onClick={() => setFacingMode(prev => (prev === 'user' ? 'user' : 'user'))}
            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* GOOGLE MEET-STYLE LANDSCAPE VIDEO GRID (16:9 PROPORTIONS, EQUAL SIZES, SIDE BY SIDE) */}
      <div className="relative w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 select-none">
        
        {/* PANEL 1: BIRTHDAY STAR 👑 */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-[#0d0316] shadow-xl flex items-center justify-center">
          {isLocalStar ? (
            // LOCAL USER IS THE BIRTHDAY STAR
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Ambient Blurred Video Background for portrait or letterboxed feeds */}
              {localStreamRef.current && !isVideoDisabled && (
                <video
                  ref={setLocalBlurVideo}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none ${
                    facingMode === 'user' ? '-scale-x-110' : ''
                  }`}
                />
              )}

              {/* Main Video Feed (object-cover for landscape, object-contain for portrait) */}
              <video
                ref={setLocalVideo}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setLocalIsPortrait(v.videoHeight > v.videoWidth);
                  }
                }}
                className={`relative z-10 w-full h-full ${
                  localIsPortrait ? 'object-contain' : 'object-cover'
                } transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Head-Tracked Birthday Hat Overlay */}
              {!isVideoDisabled && (
                <BirthdayHatOverlay
                  videoRef={localVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={facingMode === 'user'}
                  objectFit={localIsPortrait ? 'contain' : 'cover'}
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />
              )}

              {/* Video Off State */}
              {isVideoDisabled && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#1f062b] to-[#0c0212]">
                  <div className="w-14 h-14 rounded-full bg-amber-400/20 border-2 border-amber-400/50 flex items-center justify-center text-2xl shadow-lg">
                    👑
                  </div>
                  <p className="mt-2 text-amber-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-amber-300/60">Camera Off</p>
                </div>
              )}

              {/* Top-Right Star Badge */}
              <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-amber-400/40 text-amber-300 text-[10px] font-semibold backdrop-blur-md">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>Birthday Star</span>
              </div>

              {/* Bottom-Left Participant Info Card (Google Meet Style) */}
              <div className="absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-semibold text-amber-100">{currentUser?.name || 'You'}</span>
                <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                  {isAudioMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-rose-400" title="Microphone Muted" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" title="Microphone Active" />
                  )}
                  {isVideoDisabled ? (
                    <VideoOff className="w-3.5 h-3.5 text-rose-400" title="Camera Off" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-emerald-400" title="Camera Active" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            // REMOTE USER IS THE BIRTHDAY STAR
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Ambient Blurred Video Background for Remote Star */}
              {isRemoteLive && (
                <video
                  ref={setRemoteBlurVideo}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none"
                />
              )}

              {/* Main Crisp Remote Video */}
              <video
                ref={setRemoteVideo}
                autoPlay
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setRemoteIsPortrait(v.videoHeight > v.videoWidth);
                  }
                }}
                className={`relative z-10 w-full h-full ${
                  remoteIsPortrait ? 'object-contain' : 'object-cover'
                } transition-opacity duration-300 ${
                  isRemoteLive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Birthday Hat Overlay on Remote Star */}
              {isRemoteLive && (
                <BirthdayHatOverlay
                  videoRef={remoteVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={false}
                  objectFit={remoteIsPortrait ? 'contain' : 'cover'}
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />
              )}

              {/* Top-Right Star Badge */}
              <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-amber-400/40 text-amber-300 text-[10px] font-semibold backdrop-blur-md">
                <Crown className="w-3 h-3 text-amber-400" />
                <span>Birthday Star</span>
              </div>

              {/* Bottom-Left Remote Participant Label */}
              {hasRemoteUser && (
                <div className="absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md shadow-md">
                  <span className={`w-2 h-2 rounded-full ${isRemoteLive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-ping'}`} />
                  <span className="font-semibold text-amber-100">{remoteUserName}</span>
                  <span className="text-[10px] text-amber-300/80 border-l border-white/20 pl-2">
                    {isRemoteLive ? 'Video connected ❤️' : (iceStatusText || 'Connecting to partner...')}
                  </span>
                  <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                    {isRemoteLive ? (
                      <Video className="w-3.5 h-3.5 text-emerald-400" title="Live Video" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" title="Connecting" />
                    )}
                  </div>
                </div>
              )}

              {/* Waiting / Connecting Placeholder */}
              {!isRemoteLive && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#1b0526] to-[#0c0212]">
                  {hasRemoteUser ? (
                    <>
                      <RefreshCw className="w-7 h-7 text-amber-400 animate-spin mb-2" />
                      <h4 className="text-amber-200 font-semibold text-xs sm:text-sm">
                        {iceStatusText || 'Connecting to partner...'}
                      </h4>
                      <p className="text-[10px] text-pink-300/70 mt-0.5">
                        {connectionStatus === 'connected' ? 'Video connected ❤️' : (iceStatusText || 'Establishing secure video connection...')}
                      </p>
                    </>
                  ) : (
                    <>
                      <Crown className="w-8 h-8 text-amber-400/80 animate-pulse mb-2" />
                      <h4 className="text-amber-200 font-semibold text-xs sm:text-sm">Waiting for Birthday Star 👑</h4>
                      <p className="text-[10px] text-pink-300/70 mt-0.5 max-w-[220px]">
                        Share invitation link with the birthday star!
                      </p>
                      <button
                        onClick={handleCopyLink}
                        className="mt-2.5 px-3 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium border border-amber-400/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {linkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-300" />}
                        <span>{linkCopied ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL 2: CELEBRATING PARTNER 💖 */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border-2 border-pink-500/30 bg-[#0d0316] shadow-xl flex items-center justify-center">
          {!isLocalStar ? (
            // LOCAL USER IS THE PARTNER
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Ambient Blurred Video Background */}
              {localStreamRef.current && !isVideoDisabled && (
                <video
                  ref={setLocalBlurVideo}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none ${
                    facingMode === 'user' ? '-scale-x-110' : ''
                  }`}
                />
              )}

              {/* Main Local Partner Video */}
              <video
                ref={setLocalVideo}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setLocalIsPortrait(v.videoHeight > v.videoWidth);
                  }
                }}
                className={`relative z-10 w-full h-full ${
                  localIsPortrait ? 'object-contain' : 'object-cover'
                } transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Video Off State */}
              {isVideoDisabled && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-[#250831] to-[#0c0212]">
                  <div className="w-14 h-14 rounded-full bg-pink-500/20 border-2 border-pink-400/50 flex items-center justify-center text-2xl shadow-lg">
                    💖
                  </div>
                  <p className="mt-2 text-pink-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-pink-400/60">Camera Off</p>
                </div>
              )}

              {/* Top-Right Partner Badge */}
              <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-pink-400/40 text-pink-200 text-[10px] font-semibold backdrop-blur-md">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                <span>Celebrating</span>
              </div>

              {/* Bottom-Left Local Label */}
              <div className="absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="font-semibold text-pink-100">{currentUser?.name || 'You'}</span>
                <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                  {isAudioMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-rose-400" title="Microphone Muted" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" title="Microphone Active" />
                  )}
                  {isVideoDisabled ? (
                    <VideoOff className="w-3.5 h-3.5 text-rose-400" title="Camera Off" />
                  ) : (
                    <Video className="w-3.5 h-3.5 text-emerald-400" title="Camera Active" />
                  )}
                </div>
              </div>
            </div>
          ) : (
            // REMOTE USER IS THE PARTNER
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Ambient Blurred Video Background for Remote Partner */}
              {isRemoteLive && (
                <video
                  ref={setRemoteBlurVideo}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none"
                />
              )}

              {/* Main Crisp Remote Partner Video */}
              <video
                ref={setRemoteVideo}
                autoPlay
                playsInline
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (v.videoWidth && v.videoHeight) {
                    setRemoteIsPortrait(v.videoHeight > v.videoWidth);
                  }
                }}
                className={`relative z-10 w-full h-full ${
                  remoteIsPortrait ? 'object-contain' : 'object-cover'
                } transition-opacity duration-300 ${
                  isRemoteLive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Top-Right Partner Badge */}
              <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/60 border border-pink-400/40 text-pink-200 text-[10px] font-semibold backdrop-blur-md">
                <Heart className="w-3 h-3 text-rose-400 fill-rose-400" />
                <span>Celebrating</span>
              </div>

              {/* Bottom-Left Remote Label */}
              {hasRemoteUser && (
                <div className="absolute bottom-2.5 left-2.5 z-30 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md shadow-md">
                  <span className={`w-2 h-2 rounded-full ${isRemoteLive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-pink-400 animate-ping'}`} />
                  <span className="font-semibold text-pink-100">{remoteUserName}</span>
                  <span className="text-[10px] text-pink-300/80 border-l border-white/20 pl-2">
                    {isRemoteLive ? 'Video connected ❤️' : (iceStatusText || 'Connecting to partner...')}
                  </span>
                  <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                    {isRemoteLive ? (
                      <Video className="w-3.5 h-3.5 text-emerald-400" title="Live Video" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-pink-400 animate-spin" title="Connecting" />
                    )}
                  </div>
                </div>
              )}

              {/* Waiting / Connecting State for Remote Partner */}
              {!isRemoteLive && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#21062c] to-[#0c0212]">
                  {hasRemoteUser ? (
                    <>
                      <RefreshCw className="w-7 h-7 text-pink-400 animate-spin mb-2" />
                      <h4 className="text-pink-200 font-semibold text-xs sm:text-sm">
                        {iceStatusText || 'Connecting to partner...'}
                      </h4>
                      <p className="text-[10px] text-pink-300/70 mt-0.5">
                        {connectionStatus === 'connected' ? 'Video connected ❤️' : (iceStatusText || 'Establishing secure video connection...')}
                      </p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-8 h-8 text-pink-400 animate-pulse mb-2" />
                      <h4 className="text-pink-200 font-semibold text-xs sm:text-sm">Waiting for Partner ❤️</h4>
                      <p className="text-[10px] text-pink-300/70 mt-0.5 max-w-[220px]">
                        Share invitation link with your partner!
                      </p>
                      <button
                        onClick={handleCopyLink}
                        className="mt-2.5 px-3 py-1 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-medium border border-pink-400/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {linkCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-300" />}
                        <span>{linkCopied ? 'Link Copied!' : 'Copy Link'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* GOOGLE MEET-STYLE BOTTOM CONTROLS DOCK */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Connection Status Pill */}
        <div className="flex items-center gap-2 text-xs">
          {isBothConnected && isRemoteLive ? (
            <div className="flex items-center gap-1.5 text-emerald-300 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span>Both Connected Live (P2P) ❤️</span>
            </div>
          ) : hasRemoteUser ? (
            <div className="flex items-center gap-1.5 text-amber-300 font-medium bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              <span>Connecting Video Call...</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-pink-300/70 bg-pink-500/10 px-3 py-1 rounded-full border border-pink-500/20">
              <Wifi className="w-3 h-3 text-pink-400" />
              <span>Waiting for Partner</span>
            </div>
          )}
        </div>

        {/* Circular Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 cursor-pointer shadow-lg ${
              isAudioMuted
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideo}
            title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 cursor-pointer shadow-lg ${
              isVideoDisabled
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/50'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            }`}
          >
            {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Flip Camera (Front / Back) */}
          <button
            onClick={switchFacingMode}
            title="Switch Camera (Front/Back)"
            className="p-2.5 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all duration-200 cursor-pointer shadow-lg"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Hat Position Fine-tuning for Birthday Star */}
          {isLocalStar && (
            <button
              onClick={() => setShowHatSettings(!showHatSettings)}
              title="Adjust Party Hat"
              className={`p-2.5 sm:p-3 rounded-full transition-all duration-200 cursor-pointer shadow-lg ${
                showHatSettings
                  ? 'bg-amber-400 text-black font-bold shadow-amber-900/50'
                  : 'bg-white/10 hover:bg-white/20 text-amber-300 border border-white/15'
              }`}
            >
              <Crown className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hat Fine-Tuning Drawer */}
      {showHatSettings && isLocalStar && (
        <div className="mt-3 p-3.5 rounded-2xl bg-black/90 border border-amber-400/40 shadow-2xl backdrop-blur-xl text-xs space-y-2 animate-fadeIn max-w-md mx-auto w-full">
          <div className="flex items-center justify-between text-amber-300 font-semibold border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>Party Hat Placement</span>
            </span>
            <button
              onClick={() => {
                setHatYOffset(0.22);
                setHatSizeScale(0.88);
              }}
              className="text-[10px] text-pink-300/70 hover:text-white cursor-pointer"
            >
              Reset
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="flex justify-between text-[10px] text-pink-200 mb-0.5">
                <span>Height Offset:</span>
                <span className="font-mono text-amber-300">{Math.round(hatYOffset * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.45"
                step="0.02"
                value={hatYOffset}
                onChange={e => setHatYOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-pink-200 mb-0.5">
                <span>Hat Size:</span>
                <span className="font-mono text-amber-300">{Math.round(hatSizeScale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.2"
                step="0.04"
                value={hatSizeScale}
                onChange={e => setHatSizeScale(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const VideoCall = React.memo(VideoCallComponent);
export default VideoCall;

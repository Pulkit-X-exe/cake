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

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export default function VideoCall({
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
  const [isRemoteLive, setIsRemoteLive] = useState(false);
  const [hasRemoteUser, setHasRemoteUser] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('Partner');
  const [remoteUserRole, setRemoteUserRole] = useState('partner');
  const [mediaError, setMediaError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Hat customization
  const [hatYOffset, setHatYOffset] = useState(0.22);
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

  // Flush queued ICE candidates helper
  const flushQueuedIceCandidates = useCallback(async (pc) => {
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const cand = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[WebRTC] Add queued ICE error:', err);
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

    const pc = new RTCPeerConnection(RTC_CONFIG);
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
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('signal-ice', {
          to: targetPeerIdRef.current,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed to:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
        setIsRemoteLive(true);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      }
    };

    // If an offer arrived while media was initializing, process it now!
    if (pendingOfferRef.current) {
      const { from, offer } = pendingOfferRef.current;
      pendingOfferRef.current = null;
      handleIncomingOffer(from, offer);
    }

    return pc;
  }, [socket, playVideoSafely, handleIncomingOffer]);

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

      {/* DUAL SIMULTANEOUS VIDEO GRID: EQUAL IMPORTANCE, COMPLETE CAMERA FRAMES (object-contain) WITH AMBIENT BLURRED BACKDROP */}
      <div className="relative flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-3 overflow-hidden rounded-2xl min-h-[360px] md:min-h-0">
        
        {/* PANEL 1: BIRTHDAY STAR 👑 (Local if currentUser is Star, Remote if currentUser is Partner) */}
        <div className="relative w-full h-full min-h-[175px] md:min-h-0 rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-[#12031c] shadow-xl flex items-center justify-center">
          {isLocalStar ? (
            // LOCAL USER IS THE BIRTHDAY STAR
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              {/* Ambient Blurred Video Background */}
              {localStreamRef.current && !isVideoDisabled && (
                <video
                  ref={setLocalBlurVideo}
                  autoPlay
                  playsInline
                  muted
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none ${
                    facingMode === 'user' ? '-scale-x-125' : ''
                  }`}
                />
              )}

              {/* Main Crisp Contained Video: Entire camera frame is visible without cropping */}
              <video
                ref={setLocalVideo}
                autoPlay
                playsInline
                muted
                className={`relative z-10 w-full h-full object-contain transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Birthday Hat Overlay on Local Birthday Star */}
              {!isVideoDisabled && (
                <BirthdayHatOverlay
                  videoRef={localVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={facingMode === 'user'}
                  objectFit="contain"
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />
              )}

              {/* Video Off Placeholder */}
              {isVideoDisabled && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-purple-950/90 to-amber-950/90">
                  <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-3xl shadow-glow">
                    👑
                  </div>
                  <p className="mt-2 text-amber-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-amber-300/60">Camera Off</p>
                </div>
              )}

              {/* Badge */}
              <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-amber-400/60 text-amber-300 text-[11px] font-semibold backdrop-blur-md shadow-md">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentUser?.name || 'You'} (Birthday Star 👑)</span>
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
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                />
              )}

              {/* Main Crisp Contained Video for Remote Star */}
              <video
                ref={setRemoteVideo}
                autoPlay
                playsInline
                className={`relative z-10 w-full h-full object-contain transition-opacity duration-300 ${
                  isRemoteLive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Birthday Hat Overlay on Remote Birthday Star */}
              {isRemoteLive && (
                <BirthdayHatOverlay
                  videoRef={remoteVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={false}
                  objectFit="contain"
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />
              )}

              {/* Remote Star Badge */}
              {hasRemoteUser && (
                <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-amber-400/60 text-amber-300 text-[11px] font-semibold backdrop-blur-md shadow-md">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{remoteUserName} (Birthday Star 👑)</span>
                </div>
              )}

              {/* Loading / Waiting States for Remote Star */}
              {!isRemoteLive && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#250938] to-[#12031c]">
                  {hasRemoteUser ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-2" />
                      <h4 className="text-amber-200 font-semibold text-xs sm:text-sm">Connecting Live Video...</h4>
                      <p className="text-[11px] text-pink-300/70 mt-1">Establishing peer-to-peer camera feed with {remoteUserName}...</p>
                    </>
                  ) : (
                    <>
                      <Crown className="w-10 h-10 text-amber-400/80 animate-bounce mb-2" />
                      <h4 className="text-amber-200 font-semibold text-xs sm:text-sm">Waiting for Birthday Star 👑</h4>
                      <p className="text-[11px] text-pink-300/70 mt-1 max-w-[200px]">
                        Share the celebration link with the birthday star!
                      </p>
                      <button
                        onClick={handleCopyLink}
                        className="mt-3 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium border border-amber-400/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                        <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PANEL 2: CELEBRATING PARTNER 💖 (Local if currentUser is Partner, Remote if currentUser is Star) */}
        <div className="relative w-full h-full min-h-[175px] md:min-h-0 rounded-2xl overflow-hidden border-2 border-pink-500/40 bg-[#12031c] shadow-xl flex items-center justify-center">
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
                  className={`absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none ${
                    facingMode === 'user' ? '-scale-x-125' : ''
                  }`}
                />
              )}

              {/* Main Crisp Contained Video: Entire camera frame is visible without cropping */}
              <video
                ref={setLocalVideo}
                autoPlay
                playsInline
                muted
                className={`relative z-10 w-full h-full object-contain transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {isVideoDisabled && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-b from-pink-950/90 to-purple-950/90">
                  <div className="w-16 h-16 rounded-full bg-pink-500/20 border-2 border-pink-400/60 flex items-center justify-center text-3xl shadow-glow">
                    💖
                  </div>
                  <p className="mt-2 text-pink-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-pink-400/60">Camera Off</p>
                </div>
              )}

              {/* Badge */}
              <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-pink-400/60 text-pink-200 text-[11px] font-semibold backdrop-blur-md shadow-md">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>{currentUser?.name || 'You'} (Celebrating 💖)</span>
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
                  className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-125 pointer-events-none"
                />
              )}

              {/* Main Crisp Contained Video for Remote Partner */}
              <video
                ref={setRemoteVideo}
                autoPlay
                playsInline
                className={`relative z-10 w-full h-full object-contain transition-opacity duration-300 ${
                  isRemoteLive ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Remote Partner Badge */}
              {hasRemoteUser && (
                <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-pink-400/60 text-pink-200 text-[11px] font-semibold backdrop-blur-md shadow-md">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>{remoteUserName} (Celebrating 💖)</span>
                </div>
              )}

              {/* Loading / Waiting States for Remote Partner */}
              {!isRemoteLive && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#250938] to-[#12031c]">
                  {hasRemoteUser ? (
                    <>
                      <RefreshCw className="w-8 h-8 text-pink-400 animate-spin mb-2" />
                      <h4 className="text-pink-200 font-semibold text-xs sm:text-sm">Connecting Live Video...</h4>
                      <p className="text-[11px] text-pink-300/70 mt-1">Establishing peer-to-peer camera feed with {remoteUserName}...</p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-10 h-10 text-pink-400 animate-pulse mb-2" />
                      <h4 className="text-pink-200 font-semibold text-xs sm:text-sm">Waiting for Partner ❤️</h4>
                      <p className="text-[11px] text-pink-300/70 mt-1 max-w-[200px]">
                        Share this invitation link so your partner can sit with you!
                      </p>
                      <button
                        onClick={handleCopyLink}
                        className="mt-3 px-3 py-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-medium border border-pink-400/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                        <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Connection Quality Pill */}
      <div className="mt-2 flex items-center justify-between text-[11px] px-1 text-pink-300/70">
        <div className="flex items-center gap-1.5">
          {isBothConnected && isRemoteLive ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium">Both Participants Live (P2P Video Active) ❤️</span>
            </>
          ) : hasRemoteUser ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-300">Connecting live video feeds...</span>
            </>
          ) : (
            <>
              <Wifi className="w-3 h-3 text-pink-400" />
              <span>Waiting for partner to join</span>
            </>
          )}
        </div>

        {/* Video Call Controls Dock */}
        <div className="flex items-center gap-2">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isAudioMuted ? 'bg-rose-600 text-white shadow-glow-rose' : 'bg-white/10 hover:bg-white/20 text-pink-100'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideo}
            title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isVideoDisabled ? 'bg-rose-600 text-white shadow-glow-rose' : 'bg-white/10 hover:bg-white/20 text-pink-100'
            }`}
          >
            {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Flip Camera */}
          <button
            onClick={switchFacingMode}
            title="Flip Camera"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-100 transition-colors cursor-pointer"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Hat Position Fine-tuning for Birthday Star */}
          {isLocalStar && (
            <button
              onClick={() => setShowHatSettings(!showHatSettings)}
              title="Adjust Hat Placement"
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                showHatSettings
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400 shadow-glow'
                  : 'bg-white/10 hover:bg-white/20 text-pink-100'
              }`}
            >
              <Crown className="w-4 h-4 text-amber-300" />
            </button>
          )}
        </div>
      </div>

      {/* Hat Fine-Tuning Drawer */}
      {showHatSettings && isLocalStar && (
        <div className="mt-2 p-3 rounded-2xl bg-black/95 border border-amber-400/50 shadow-2xl backdrop-blur-xl text-xs space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between text-amber-300 font-semibold border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>Birthday Hat Placement</span>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-[10px] text-pink-200 mb-0.5">
                <span>Height:</span>
                <span className="font-mono text-amber-300">{Math.round(hatYOffset * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.50"
                step="0.02"
                value={hatYOffset}
                onChange={e => setHatYOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-pink-200 mb-0.5">
                <span>Size:</span>
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

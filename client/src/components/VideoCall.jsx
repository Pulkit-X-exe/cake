import React, { useEffect, useRef, useState } from 'react';
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
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
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
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const makingOfferRef = useRef(false);
  const targetPeerIdRef = useRef(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [facingMode, setFacingMode] = useState('user');
  const [connectionStatus, setConnectionStatus] = useState('waiting'); // 'waiting' | 'connecting' | 'connected' | 'disconnected'
  const [hasRemoteUser, setHasRemoteUser] = useState(false);
  const [remoteUserName, setRemoteUserName] = useState('Partner');
  const [remoteUserRole, setRemoteUserRole] = useState('partner');
  const [mediaError, setMediaError] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Hat customization
  const [hatYOffset, setHatYOffset] = useState(0.38);
  const [hatSizeScale, setHatSizeScale] = useState(0.82);
  const [showHatSettings, setShowHatSettings] = useState(false);

  const isLocalStar = currentUser?.role === 'star';
  const isPolite = !isLocalStar; // Star is impolite caller, partner is polite

  // Identify remote participant
  useEffect(() => {
    const remote = participants.find(p => p.id !== socket?.id);
    if (remote) {
      setHasRemoteUser(true);
      setRemoteUserName(remote.name || (remote.role === 'star' ? 'Birthday Star' : 'Partner'));
      setRemoteUserRole(remote.role || 'partner');
      targetPeerIdRef.current = remote.id;
    } else {
      setHasRemoteUser(false);
      targetPeerIdRef.current = null;
    }
  }, [participants, socket?.id]);

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
        }

        if (onBlowMicStream) {
          onBlowMicStream(stream);
        }

        setupPeerConnection(stream);
      } catch (err) {
        console.warn('[VideoCall] Media error:', err);
        setMediaError(
          err.name === 'NotAllowedError'
            ? 'Camera / microphone access denied. Please click the camera icon in your browser URL bar to allow.'
            : 'Camera could not be accessed. If another tab is using the camera, you can still participate!'
        );

        // Fallback: try audio only or continue
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true });
          if (!isCancelled) {
            localStreamRef.current = audioOnly;
            setIsVideoDisabled(true);
            setupPeerConnection(audioOnly);
          }
        } catch (e) {
          setupPeerConnection(null);
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
  }, [facingMode]);

  function setupPeerConnection(stream) {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionRef.current = pc;

    if (stream) {
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
    }

    // Remote Track received
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      if (remoteVideoRef.current) {
        if (event.streams && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        } else {
          let curStream = remoteVideoRef.current.srcObject;
          if (!curStream) {
            curStream = new MediaStream();
            remoteVideoRef.current.srcObject = curStream;
          }
          curStream.addTrack(event.track);
        }
        remoteVideoRef.current.play().catch(() => {});
        setHasRemoteUser(true);
        setConnectionStatus('connected');
      }
    };

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && targetPeerIdRef.current) {
        socket.emit('signal-ice', {
          to: targetPeerIdRef.current,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('disconnected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatus('connecting');
      }
    };

    // Existing peer starts the call
    if (targetPeerIdRef.current && isLocalStar) {
      sendOffer(pc, targetPeerIdRef.current);
    }
  }

  async function sendOffer(pc, targetId) {
    if (!pc || makingOfferRef.current) return;
    try {
      makingOfferRef.current = true;
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);

      if (socket) {
        socket.emit('signal-offer', {
          to: targetId,
          offer
        });
        console.log('[WebRTC] Sent Offer to', targetId);
      }
    } catch (e) {
      console.error('[WebRTC] Create offer error:', e);
    } finally {
      makingOfferRef.current = false;
    }
  }

  // Socket Signaling Listeners
  useEffect(() => {
    if (!socket) return;

    // Remote peer joined -> Host / Star sends offer
    const handlePeerJoined = ({ peer }) => {
      console.log('[Socket] Peer joined:', peer.id);
      targetPeerIdRef.current = peer.id;
      setHasRemoteUser(true);
      setRemoteUserName(peer.name);
      setRemoteUserRole(peer.role);
      setConnectionStatus('connecting');

      const pc = peerConnectionRef.current;
      if (pc) {
        sendOffer(pc, peer.id);
      }
    };

    // Received Offer
    const handleSignalOffer = async ({ from, offer }) => {
      console.log('[Socket] Received Offer from:', from);
      targetPeerIdRef.current = from;
      const pc = peerConnectionRef.current;
      if (!pc) return;

      const offerCollision = makingOfferRef.current || pc.signalingState !== 'stable';
      if (offerCollision && !isPolite) {
        console.log('[WebRTC] Impolite peer ignoring offer collision');
        return;
      }

      try {
        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Process queued ICE candidates
        while (iceCandidatesQueueRef.current.length > 0) {
          const cand = iceCandidatesQueueRef.current.shift();
          try {
            await pc.addIceCandidate(cand);
          } catch (e) {}
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('signal-answer', {
          to: from,
          answer
        });
        console.log('[WebRTC] Sent Answer to:', from);
      } catch (err) {
        console.error('[WebRTC] Handle offer error:', err);
      }
    };

    // Received Answer
    const handleSignalAnswer = async ({ from, answer }) => {
      console.log('[Socket] Received Answer from:', from);
      const pc = peerConnectionRef.current;
      if (!pc || pc.signalingState === 'stable') return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        while (iceCandidatesQueueRef.current.length > 0) {
          const cand = iceCandidatesQueueRef.current.shift();
          try {
            await pc.addIceCandidate(cand);
          } catch (e) {}
        }
      } catch (err) {
        console.error('[WebRTC] Handle answer error:', err);
      }
    };

    // Received ICE candidate
    const handleSignalIce = async ({ from, candidate }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !candidate) return;

      try {
        const iceCand = new RTCIceCandidate(candidate);
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(iceCand);
        } else {
          iceCandidatesQueueRef.current.push(iceCand);
        }
      } catch (err) {
        console.error('[WebRTC] Add ICE candidate error:', err);
      }
    };

    const handlePeerLeft = ({ peerName }) => {
      console.log('[Socket] Peer left:', peerName);
      setHasRemoteUser(false);
      setConnectionStatus('waiting');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
    };

    socket.on('peer-joined', handlePeerJoined);
    socket.on('signal-offer', handleSignalOffer);
    socket.on('signal-answer', handleSignalAnswer);
    socket.on('signal-ice', handleSignalIce);
    socket.on('peer-left', handlePeerLeft);

    return () => {
      socket.off('peer-joined', handlePeerJoined);
      socket.off('signal-offer', handleSignalOffer);
      socket.off('signal-answer', handleSignalAnswer);
      socket.off('signal-ice', handleSignalIce);
      socket.off('peer-left', handlePeerLeft);
    };
  }, [socket, isPolite]);

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

  return (
    <div className="relative w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden">
      {/* Permission Warning Banner if any */}
      {mediaError && (
        <div className="mb-2 z-40 bg-rose-950/90 border border-rose-500/50 rounded-xl p-2.5 text-xs text-rose-200 flex items-center justify-between shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{mediaError}</span>
          </div>
          <button
            onClick={() => setFacingMode(prev => (prev === 'user' ? 'user' : 'user'))}
            className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* DUAL SIMULTANEOUS CAMERA STAGE: BOTH PARTICIPANTS CLEARLY VISIBLE AT THE SAME TIME! */}
      <div className="relative flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 overflow-hidden rounded-2xl">
        
        {/* PANEL 1: BIRTHDAY STAR (👑 Crowned with the Birthday Hat) */}
        <div className="relative w-full h-full min-h-[160px] md:min-h-0 rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-[#160524] shadow-xl flex items-center justify-center">
          {isLocalStar ? (
            // LOCAL USER IS THE BIRTHDAY STAR
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {/* Birthday Hat Overlay on Birthday Star */}
              {!isVideoDisabled && (
                <BirthdayHatOverlay
                  videoRef={localVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={facingMode === 'user'}
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />
              )}

              {/* Video Off Placeholder */}
              {isVideoDisabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-purple-950/80 to-amber-950/80">
                  <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400/60 flex items-center justify-center text-3xl shadow-glow">
                    👑
                  </div>
                  <p className="mt-2 text-amber-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-amber-300/60">Camera Off</p>
                </div>
              )}

              {/* Badge */}
              <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-amber-400/60 text-amber-300 text-[11px] font-semibold backdrop-blur-md shadow-md">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{currentUser?.name || 'You'} (Birthday Star 👑)</span>
              </div>
            </div>
          ) : (
            // REMOTE USER IS THE BIRTHDAY STAR
            hasRemoteUser ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Birthday Hat Overlay on Remote Star */}
                <BirthdayHatOverlay
                  videoRef={remoteVideoRef}
                  isBirthdayPerson={true}
                  hatStyle={hatStyle}
                  isMirrored={false}
                  yOffsetRatio={hatYOffset}
                  sizeScale={hatSizeScale}
                />

                {/* Badge */}
                <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-amber-400/60 text-amber-300 text-[11px] font-semibold backdrop-blur-md shadow-md">
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span>{remoteUserName} (Birthday Star 👑)</span>
                </div>
              </div>
            ) : (
              // Remote Star Not Joined Yet
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#250938] to-[#12031c]">
                <Crown className="w-10 h-10 text-amber-400/80 animate-bounce mb-2" />
                <h4 className="text-amber-200 font-semibold text-xs sm:text-sm">Waiting for Birthday Star 👑</h4>
                <p className="text-[11px] text-pink-300/70 mt-1 max-w-[200px]">
                  Share the celebration link with the birthday star!
                </p>
                <button
                  onClick={handleCopyLink}
                  className="mt-3 px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium border border-amber-400/40 transition-colors flex items-center gap-1.5"
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>
            )
          )}
        </div>

        {/* PANEL 2: CELEBRATING PARTNER (💖 Cheering and Sharing the Moment) */}
        <div className="relative w-full h-full min-h-[160px] md:min-h-0 rounded-2xl overflow-hidden border-2 border-pink-500/40 bg-[#160524] shadow-xl flex items-center justify-center">
          {!isLocalStar ? (
            // LOCAL USER IS THE PARTNER
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isVideoDisabled ? 'opacity-0' : 'opacity-100'
                } ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />

              {isVideoDisabled && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-pink-950/80 to-purple-950/80">
                  <div className="w-16 h-16 rounded-full bg-pink-500/20 border-2 border-pink-400/60 flex items-center justify-center text-3xl shadow-glow">
                    💖
                  </div>
                  <p className="mt-2 text-pink-200 text-xs font-semibold">{currentUser?.name || 'You'}</p>
                  <p className="text-[10px] text-pink-400/60">Camera Off</p>
                </div>
              )}

              {/* Badge */}
              <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-pink-400/60 text-pink-200 text-[11px] font-semibold backdrop-blur-md shadow-md">
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>{currentUser?.name || 'You'} (Celebrating 💖)</span>
              </div>
            </div>
          ) : (
            // REMOTE USER IS THE PARTNER
            hasRemoteUser ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Badge */}
                <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 border border-pink-400/60 text-pink-200 text-[11px] font-semibold backdrop-blur-md shadow-md">
                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                  <span>{remoteUserName} (Celebrating 💖)</span>
                </div>
              </div>
            ) : (
              // Partner has not joined yet
              <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-[#250938] to-[#12031c]">
                <Sparkles className="w-10 h-10 text-pink-400 animate-pulse mb-2" />
                <h4 className="text-pink-200 font-semibold text-xs sm:text-sm">Waiting for Partner ❤️</h4>
                <p className="text-[11px] text-pink-300/70 mt-1 max-w-[200px]">
                  Share this invitation link so your partner can sit with you!
                </p>
                <button
                  onClick={handleCopyLink}
                  className="mt-3 px-3 py-1.5 rounded-full bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 text-xs font-medium border border-pink-400/40 transition-colors flex items-center gap-1.5"
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-300" />}
                  <span>{linkCopied ? 'Link Copied!' : 'Copy Invite Link'}</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Connection Quality Pill */}
      <div className="mt-2 flex items-center justify-between text-[11px] px-1 text-pink-300/70">
        <div className="flex items-center gap-1.5">
          {connectionStatus === 'connected' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-medium">Both Connected Live (P2P)</span>
            </>
          ) : hasRemoteUser ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-amber-300">Connecting video feeds...</span>
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
            className={`p-2 rounded-full transition-colors ${
              isAudioMuted ? 'bg-rose-600 text-white shadow-glow-rose' : 'bg-white/10 hover:bg-white/20 text-pink-100'
            }`}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleVideo}
            title={isVideoDisabled ? 'Turn Camera On' : 'Turn Camera Off'}
            className={`p-2 rounded-full transition-colors ${
              isVideoDisabled ? 'bg-rose-600 text-white shadow-glow-rose' : 'bg-white/10 hover:bg-white/20 text-pink-100'
            }`}
          >
            {isVideoDisabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Flip Camera */}
          <button
            onClick={switchFacingMode}
            title="Flip Camera"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-pink-100 transition-colors"
          >
            <SwitchCamera className="w-4 h-4" />
          </button>

          {/* Hat Position Fine-tuning for Birthday Star */}
          {isLocalStar && (
            <button
              onClick={() => setShowHatSettings(!showHatSettings)}
              title="Adjust Hat Placement"
              className={`p-2 rounded-full transition-colors ${
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
                setHatYOffset(0.38);
                setHatSizeScale(0.82);
              }}
              className="text-[10px] text-pink-300/70 hover:text-white"
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
                min="0.15"
                max="0.65"
                step="0.02"
                value={hatYOffset}
                onChange={e => setHatYOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-400"
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
                className="w-full accent-amber-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

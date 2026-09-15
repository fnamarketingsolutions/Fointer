import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  LuLoaderCircle as Loader2,
  LuMic as Mic,
  LuMicOff as MicOff,
  LuPhone as Phone,
  LuPhoneOff as PhoneOff,
  LuVideo as Video,
  LuVideoOff as VideoOff,
} from "react-icons/lu";
import { getLiveSocket } from "../../../shared/services/liveSocket";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import {
  closeCallPushNotification,
  createCallRingtone,
} from "../utils/callRing";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function CallTile({ peer, isLocal }) {
  const videoRef = useRef(null);
  const showVideo =
    peer.mode === "video" &&
    peer.camera !== false &&
    peer.stream &&
    peer.stream.getVideoTracks().some((track) => track.readyState === "live");

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;
    el.srcObject = peer.stream || null;
    return () => {
      if (el.srcObject) el.srcObject = null;
    };
  }, [peer.stream]);

  const label = isLocal ? "You" : peer.name || peer.username || "Caller";

  return (
    <div className="relative aspect-video min-h-[160px] rounded-xl overflow-hidden bg-[#0D0A08] border border-fo-border">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`absolute inset-0 w-full h-full object-cover ${
          showVideo ? "opacity-100" : "opacity-0"
        }`}
      />
      {!showVideo ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-14 h-14 rounded-full bg-fo-accent/15 border border-fo-accent/40 text-fo-accent flex items-center justify-center text-base font-bold">
            {(label[0] || "?").toUpperCase()}
          </div>
          <span className="text-[11px] text-fo-muted">
            {peer.mode === "audio" ? "Audio" : "Camera off"}
          </span>
        </div>
      ) : null}
      <div className="absolute left-2 bottom-2 right-2 flex items-center gap-1.5">
        <span className="truncate text-[11px] font-medium text-white bg-black/55 px-2 py-0.5 rounded-md">
          {label}
        </span>
        {peer.mic === false ? (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-black/55 text-red-300">
            <MicOff size={11} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

const DirectCall = forwardRef(function DirectCall(
  { conversationId, otherUser, disabled = false },
  ref
) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState("idle"); // idle | ringing_out | ringing_in | connecting | active
  const [mode, setMode] = useState("audio");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");
  const [tiles, setTiles] = useState([]);
  const [incomingFrom, setIncomingFrom] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const phaseRef = useRef(phase);
  const modeRef = useRef(mode);
  const conversationIdRef = useRef(conversationId);
  const makingOfferRef = useRef(new Set());
  const handlersRef = useRef({});
  const stopRingRef = useRef(null);
  const callActionHandledRef = useRef("");

  phaseRef.current = phase;
  modeRef.current = mode;
  conversationIdRef.current = conversationId;

  const stopRingtone = useCallback(() => {
    if (stopRingRef.current) {
      stopRingRef.current();
      stopRingRef.current = null;
    }
  }, []);

  const startRingtone = useCallback(() => {
    stopRingtone();
    stopRingRef.current = createCallRingtone();
  }, [stopRingtone]);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const closePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    try {
      peer.pc.close();
    } catch {
      /* ignore */
    }
    peersRef.current.delete(socketId);
  }, []);

  const closeAllPeers = useCallback(() => {
    for (const socketId of [...peersRef.current.keys()]) {
      closePeer(socketId);
    }
  }, [closePeer]);

  const syncTiles = useCallback(() => {
    const local = localStreamRef.current;
    const localSocketId = getLiveSocket().id;
    const next = [];
    if (local && (phaseRef.current === "active" || phaseRef.current === "connecting" || phaseRef.current === "ringing_out")) {
      next.push({
        socketId: localSocketId || "local",
        name: "You",
        mode: modeRef.current,
        mic: !local.getAudioTracks().some((track) => !track.enabled),
        camera: local.getVideoTracks().some((track) => track.enabled),
        stream: local,
        isLocal: true,
      });
    }
    for (const peer of peersRef.current.values()) {
      next.push({
        socketId: peer.socketId,
        name: peer.name,
        username: peer.username,
        mode: peer.mode,
        mic: peer.mic,
        camera: peer.camera,
        stream: peer.stream,
        isLocal: false,
      });
    }
    setTiles(next);
  }, []);

  const resetCallUi = useCallback(
    (message = "") => {
      stopRingtone();
      closeCallPushNotification(conversationIdRef.current);
      closeAllPeers();
      stopLocal();
      setPhase("idle");
      setIncomingFrom(null);
      setError(message);
      setMuted(false);
      setCameraOff(false);
      setTiles([]);
      makingOfferRef.current.clear();
    },
    [closeAllPeers, stopLocal, stopRingtone]
  );

  const sendSignal = useCallback((to, payload) => {
    getLiveSocket().emit("dm_call_signal", {
      conversationId: conversationIdRef.current,
      to,
      ...payload,
    });
  }, []);

  const ensurePeer = useCallback(
    (remote) => {
      if (!remote?.socketId) return null;
      if (peersRef.current.has(remote.socketId)) {
        const existing = peersRef.current.get(remote.socketId);
        if (remote.name) existing.name = remote.name;
        if (remote.username) existing.username = remote.username;
        if (remote.mode) existing.mode = remote.mode;
        if (typeof remote.mic === "boolean") existing.mic = remote.mic;
        if (typeof remote.camera === "boolean") existing.camera = remote.camera;
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const stream = new MediaStream();
      const myId = String(getLiveSocket().id || "");
      const polite = myId < String(remote.socketId);

      const peer = {
        socketId: remote.socketId,
        name: remote.name || otherUser?.name || otherUser?.username || "Caller",
        username: remote.username || otherUser?.username || "",
        mode: remote.mode || modeRef.current,
        mic: remote.mic !== false,
        camera: remote.camera !== false,
        pc,
        stream,
        polite,
        ignoreOffer: false,
      };

      const local = localStreamRef.current;
      if (local) {
        local.getTracks().forEach((track) => {
          pc.addTrack(track, local);
        });
      }

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal(remote.socketId, {
          type: "ice",
          candidate: event.candidate,
        });
      };

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          if (!peer.stream.getTracks().some((item) => item.id === track.id)) {
            peer.stream.addTrack(track);
          }
        });
        syncTiles();
      };

      peersRef.current.set(remote.socketId, peer);
      return peer;
    },
    [otherUser, sendSignal, syncTiles]
  );

  const createOffer = useCallback(
    async (remote) => {
      const peer = ensurePeer(remote);
      if (!peer) return;
      try {
        makingOfferRef.current.add(remote.socketId);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        sendSignal(remote.socketId, {
          type: "offer",
          sdp: peer.pc.localDescription,
        });
      } catch {
        setError("Could not connect the call.");
      } finally {
        makingOfferRef.current.delete(remote.socketId);
      }
    },
    [ensurePeer, sendSignal]
  );

  const handleSignal = useCallback(
    async ({ from, type, sdp, candidate }) => {
      if (
        phaseRef.current !== "active" &&
        phaseRef.current !== "connecting" &&
        phaseRef.current !== "ringing_out"
      ) {
        return;
      }
      if (!from) return;
      const peer = ensurePeer({ socketId: from });
      if (!peer) return;

      try {
        if (type === "offer" && sdp) {
          const makingOffer = makingOfferRef.current.has(from);
          const collision =
            makingOffer || peer.pc.signalingState !== "stable";
          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;

          if (collision) {
            await Promise.all([
              peer.pc.setLocalDescription({ type: "rollback" }),
              peer.pc.setRemoteDescription(sdp),
            ]);
          } else {
            await peer.pc.setRemoteDescription(sdp);
          }
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal(from, { type: "answer", sdp: peer.pc.localDescription });
          return;
        }

        if (type === "answer" && sdp) {
          if (peer.pc.signalingState === "have-local-offer") {
            await peer.pc.setRemoteDescription(sdp);
          }
          return;
        }

        if (type === "ice" && candidate && !peer.ignoreOffer) {
          try {
            await peer.pc.addIceCandidate(candidate);
          } catch {
            /* ignore stale ICE */
          }
        }
      } catch {
        /* ignore stale signaling */
      }
    },
    [ensurePeer, sendSignal]
  );

  const acquireMedia = useCallback(async (nextMode) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video:
        nextMode === "video"
          ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
          : false,
    });
    localStreamRef.current = stream;
    modeRef.current = nextMode;
    setMode(nextMode);
    setCameraOff(nextMode !== "video");
    setMuted(false);
    return stream;
  }, []);

  const connectToPeers = useCallback(
    async (peers = []) => {
      stopRingtone();
      closeCallPushNotification(conversationIdRef.current);
      setPhase("active");
      syncTiles();
      const myId = String(getLiveSocket().id || "");
      for (const peer of peers) {
        if (myId > String(peer.socketId)) {
          await createOffer(peer);
        } else {
          ensurePeer(peer);
        }
      }
      syncTiles();
    },
    [createOffer, ensurePeer, stopRingtone, syncTiles]
  );

  const endCall = useCallback(
    (emitLeave = true, reasonMessage = "") => {
      if (emitLeave && conversationIdRef.current) {
        const socket = getLiveSocket();
        if (phaseRef.current === "ringing_out") {
          socket.emit("dm_call_cancel", {
            conversationId: conversationIdRef.current,
          });
        } else if (
          phaseRef.current === "active" ||
          phaseRef.current === "connecting"
        ) {
          socket.emit("dm_call_leave", {
            conversationId: conversationIdRef.current,
          });
        } else if (phaseRef.current === "ringing_in") {
          socket.emit("dm_call_reject", {
            conversationId: conversationIdRef.current,
          });
        }
      }
      resetCallUi(reasonMessage);
    },
    [resetCallUi]
  );

  const start = useCallback(
    async (nextMode = "audio") => {
      if (disabled || phaseRef.current !== "idle" || !conversationId) return;
      setError("");
      setPhase("connecting");
      try {
        await acquireMedia(nextMode);
        const socket = getLiveSocket();
        socket.emit(
          "dm_call_invite",
          { conversationId, mode: nextMode },
          (ack) => {
            if (!ack?.success) {
              resetCallUi(ack?.message || "Could not start the call.");
              return;
            }
            setPhase("ringing_out");
            syncTiles();
          }
        );
      } catch (err) {
        const denied = err?.name === "NotAllowedError";
        resetCallUi(
          denied
            ? "Allow microphone and camera access to place a call."
            : "Could not start your microphone or camera."
        );
      }
    },
    [acquireMedia, conversationId, disabled, resetCallUi, syncTiles]
  );

  const acceptIncoming = useCallback(async () => {
    if (phaseRef.current !== "ringing_in" || !conversationId) return;
    setError("");
    setPhase("connecting");
    try {
      await acquireMedia(modeRef.current);
      const socket = getLiveSocket();
      socket.emit("dm_call_accept", { conversationId }, async (ack) => {
        if (!ack?.success) {
          resetCallUi(ack?.message || "Could not join the call.");
          return;
        }
        await connectToPeers(ack.peers || []);
      });
    } catch (err) {
      const denied = err?.name === "NotAllowedError";
      endCall(true);
      setError(
        denied
          ? "Allow microphone and camera access to answer the call."
          : "Could not start your microphone or camera."
      );
    }
  }, [acquireMedia, connectToPeers, conversationId, endCall, resetCallUi]);

  useImperativeHandle(
    ref,
    () => ({
      start,
      end: () => endCall(true),
      isBusy: () => phaseRef.current !== "idle",
    }),
    [endCall, start]
  );

  handlersRef.current = {
    closePeer,
    createOffer,
    ensurePeer,
    handleSignal,
    connectToPeers,
    endCall,
    resetCallUi,
    syncTiles,
    acceptIncoming,
  };

  useEffect(() => {
    if (!conversationId) return undefined;
    const socket = getLiveSocket();
    const matches = (payload) =>
      String(payload?.conversationId || "") === String(conversationId);

    const onIncoming = (payload) => {
      if (!matches(payload)) return;
      if (phaseRef.current !== "idle") return;
      modeRef.current = payload.mode === "video" ? "video" : "audio";
      setMode(modeRef.current);
      setIncomingFrom(payload.from || null);
      setPhase("ringing_in");
      setError("");
      startRingtone();
    };

    const onAccepted = async (payload) => {
      if (!matches(payload)) return;
      if (phaseRef.current !== "ringing_out") return;
      const peer = payload.peer;
      setPhase("connecting");
      await handlersRef.current.connectToPeers(peer ? [peer] : []);
    };

    const onEnded = (payload) => {
      if (!matches(payload)) return;
      const reason = payload?.reason;
      const message =
        reason === "rejected"
          ? "Call declined."
          : reason === "cancelled"
            ? "Call cancelled."
            : "Call ended.";
      handlersRef.current.resetCallUi(
        phaseRef.current === "idle" ? "" : message
      );
    };

    const onPeerLeft = (payload) => {
      if (!matches(payload)) return;
      handlersRef.current.closePeer(payload.socketId);
      handlersRef.current.resetCallUi("Call ended.");
    };

    const onPresence = (payload) => {
      if (!matches(payload)) return;
      const peer = peersRef.current.get(payload.socketId);
      if (!peer) return;
      if (typeof payload.mic === "boolean") peer.mic = payload.mic;
      if (typeof payload.camera === "boolean") peer.camera = payload.camera;
      if (payload.mode) peer.mode = payload.mode;
      handlersRef.current.syncTiles();
    };

    const onSignal = (payload) => {
      if (!matches(payload)) return;
      handlersRef.current.handleSignal(payload);
    };

    socket.emit("join_conversation", { conversationId }, () => {
      socket.emit("dm_call_sync", { conversationId }, (ack) => {
        if (!ack?.success || !ack.call) return;
        if (phaseRef.current !== "idle") return;
        const call = ack.call;
        if (call.status === "ringing" && !call.selfInCall) {
          modeRef.current = call.mode === "video" ? "video" : "audio";
          setMode(modeRef.current);
          setIncomingFrom(call.from || null);
          setPhase("ringing_in");
          startRingtone();
        }
      });
    });

    socket.on("dm_call_incoming", onIncoming);
    socket.on("dm_call_accepted", onAccepted);
    socket.on("dm_call_ended", onEnded);
    socket.on("dm_call_peer_left", onPeerLeft);
    socket.on("dm_call_presence", onPresence);
    socket.on("dm_call_signal", onSignal);

    return () => {
      socket.off("dm_call_incoming", onIncoming);
      socket.off("dm_call_accepted", onAccepted);
      socket.off("dm_call_ended", onEnded);
      socket.off("dm_call_peer_left", onPeerLeft);
      socket.off("dm_call_presence", onPresence);
      socket.off("dm_call_signal", onSignal);
      if (phaseRef.current !== "idle") {
        handlersRef.current.endCall(true);
      }
    };
  }, [conversationId, startRingtone]);

  // Handle Accept / Decline from the phone-style push notification.
  useEffect(() => {
    const action = searchParams.get("callAction");
    if (!action || !conversationId) return;
    const key = `${conversationId}:${action}`;
    if (callActionHandledRef.current === key) return;
    callActionHandledRef.current = key;

    const clearQuery = () => {
      const next = new URLSearchParams(searchParams);
      next.delete("callAction");
      navigate(
        { pathname: `/messages/${conversationId}`, search: next.toString() },
        { replace: true }
      );
    };

    if (action === "decline") {
      clearQuery();
      if (phaseRef.current === "ringing_in" || phaseRef.current === "idle") {
        getLiveSocket().emit("dm_call_reject", { conversationId });
        resetCallUi("Call declined.");
      }
      return;
    }

    if (action === "accept") {
      clearQuery();
      const tryAccept = () => {
        if (phaseRef.current === "ringing_in") {
          handlersRef.current.acceptIncoming?.();
          return;
        }
        // Wait briefly for sync/incoming to land after opening from push.
        window.setTimeout(() => {
          if (phaseRef.current === "ringing_in") {
            handlersRef.current.acceptIncoming?.();
          }
        }, 800);
      };
      tryAccept();
    }
  }, [conversationId, navigate, resetCallUi, searchParams]);

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
    getLiveSocket().emit("dm_call_presence", {
      conversationId,
      mic: !next,
    });
    syncTiles();
  };

  const toggleCamera = () => {
    if (modeRef.current !== "video") return;
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
    setCameraOff(nextOff);
    getLiveSocket().emit("dm_call_presence", {
      conversationId,
      camera: !nextOff,
    });
    syncTiles();
  };

  if (phase === "idle" && !error) return null;

  const otherLabel =
    incomingFrom?.name ||
    incomingFrom?.username ||
    otherUser?.name ||
    otherUser?.username ||
    "User";

  if (phase === "ringing_in") {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#0B0907]/95 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(232,168,56,0.18),_transparent_55%)] pointer-events-none" />
        <ProfileAvatar
          src={incomingFrom?.avatar || otherUser?.avatar}
          name={otherLabel}
          className="relative w-28 h-28 rounded-full object-cover border-2 border-fo-accent/50 shadow-[0_0_0_12px_rgba(232,168,56,0.12)]"
        />
        <p className="relative mt-6 text-2xl font-semibold text-white tracking-tight">
          {otherLabel}
        </p>
        <p className="relative mt-2 text-sm text-white/70">
          Incoming {mode === "video" ? "video" : "audio"} call…
        </p>
        <div className="relative mt-10 flex items-center gap-8">
          <button
            type="button"
            onClick={() => endCall(true)}
            className="flex flex-col items-center gap-2"
          >
            <span className="w-16 h-16 rounded-full bg-red-500 text-white inline-flex items-center justify-center shadow-lg">
              <PhoneOff size={26} />
            </span>
            <span className="text-xs text-white/80">Decline</span>
          </button>
          <button
            type="button"
            onClick={acceptIncoming}
            className="flex flex-col items-center gap-2"
          >
            <span className="w-16 h-16 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center shadow-lg animate-pulse">
              <Phone size={26} />
            </span>
            <span className="text-xs text-white/80">Accept</span>
          </button>
        </div>
      </div>
    );
  }

  return (
      <div className="mt-3 shrink-0 rounded-2xl border border-fo-border bg-fo-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-fo-border flex items-center gap-2 text-xs text-fo-muted">
        {mode === "audio" ? (
          <Phone size={14} className="text-fo-accent" />
        ) : (
          <Video size={14} className="text-fo-accent" />
        )}
        {mode === "audio" ? "Audio call" : "Video call"}
        <span className="ml-auto text-fo-subtle capitalize">
          {phase === "ringing_out"
            ? "Calling…"
            : phase === "connecting"
              ? "Connecting…"
              : phase === "active"
                ? "Connected"
                : ""}
        </span>
      </div>

      <div className="p-3 space-y-3">
        {phase === "ringing_out" ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <ProfileAvatar
              src={otherUser?.avatar}
              name={otherLabel}
              className="w-16 h-16 rounded-full object-cover border border-fo-border"
            />
            <div className="text-center">
              <p className="text-sm font-semibold text-fo-text">{otherLabel}</p>
              <p className="text-xs text-fo-subtle mt-1">
                Calling for {mode}…
              </p>
            </div>
          </div>
        ) : null}

        {(phase === "active" || phase === "connecting") && tiles.length ? (
          <div
            className={`grid gap-2 ${
              tiles.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {tiles.map((peer) => (
              <CallTile
                key={peer.socketId}
                peer={peer}
                isLocal={peer.isLocal}
              />
            ))}
          </div>
        ) : null}

        {error ? <p className="text-xs text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {phase === "ringing_out" || phase === "connecting" ? (
            <button
              type="button"
              onClick={() => endCall(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              {phase === "connecting" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <PhoneOff size={14} />
              )}
              Cancel
            </button>
          ) : null}

          {phase === "active" ? (
            <>
              <button
                type="button"
                onClick={toggleMic}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-fo-border text-fo-text hover:border-fo-accent/40"
              >
                {muted ? <MicOff size={14} /> : <Mic size={14} />}
                {muted ? "Unmute" : "Mute"}
              </button>
              {mode === "video" ? (
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-fo-border text-fo-text hover:border-fo-accent/40"
                >
                  {cameraOff ? <VideoOff size={14} /> : <Video size={14} />}
                  {cameraOff ? "Camera on" : "Camera off"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => endCall(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
              >
                <PhoneOff size={14} /> End call
              </button>
            </>
          ) : null}

          {phase === "idle" && error ? (
            <button
              type="button"
              onClick={() => setError("")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-fo-border text-fo-muted"
            >
              Dismiss
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default DirectCall;

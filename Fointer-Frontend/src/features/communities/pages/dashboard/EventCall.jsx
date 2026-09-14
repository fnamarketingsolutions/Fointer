import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  LuLoaderCircle as Loader2,
  LuMic as Mic,
  LuMicOff as MicOff,
  LuPhone as Phone,
  LuPhoneOff as PhoneOff,
  LuVideo as Video,
  LuVideoOff as VideoOff,
} from "react-icons/lu";
import { getLiveSocket } from "../../../../shared/services/liveSocket";

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

  const label = isLocal ? "You" : peer.name || peer.username || "Member";

  return (
    <div className="relative aspect-video min-h-[140px] rounded-xl overflow-hidden bg-[#0D0A08] border border-fo-border">
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
          <div className="w-12 h-12 rounded-full bg-fo-accent/15 border border-fo-accent/40 text-fo-accent flex items-center justify-center text-sm font-bold">
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

export default function EventCall({ eventId, isLive, callMode = "chat" }) {
  const [joining, setJoining] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [mode, setMode] = useState(callMode === "audio" ? "audio" : "video");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState([]);
  const [tiles, setTiles] = useState([]);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const inCallRef = useRef(false);
  const modeRef = useRef(mode);
  const makingOfferRef = useRef(new Set());
  const handlersRef = useRef({});

  const syncTiles = useCallback(() => {
    const local = localStreamRef.current;
    const localSocketId = getLiveSocket().id;
    const next = [];
    if (local && inCallRef.current) {
      next.push({
        socketId: localSocketId || "local",
        name: "You",
        mode: modeRef.current,
        mic: !local.getAudioTracks().some((track) => !track.enabled),
        camera:
          modeRef.current === "video" &&
          local.getVideoTracks().some((track) => track.enabled),
        stream: local,
        isLocal: true,
      });
    }
    peersRef.current.forEach((peer, socketId) => {
      next.push({
        socketId,
        name: peer.name,
        username: peer.username,
        mode: peer.mode,
        mic: peer.mic,
        camera: peer.camera,
        stream: peer.stream,
        isLocal: false,
      });
    });
    setTiles(next);
  }, []);

  const closePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.close();
    peersRef.current.delete(socketId);
    makingOfferRef.current.delete(socketId);
  }, []);

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const leaveCall = useCallback(
    (notify = true) => {
      if (notify && eventId) {
        getLiveSocket().emit("call_leave", { eventId });
      }
      peersRef.current.forEach((_, socketId) => closePeer(socketId));
      peersRef.current.clear();
      stopLocal();
      inCallRef.current = false;
      setInCall(false);
      setMuted(false);
      setCameraOff(false);
      setTiles([]);
    },
    [closePeer, eventId, stopLocal]
  );

  const sendSignal = useCallback(
    (to, payload) => {
      getLiveSocket().emit("call_signal", { eventId, to, ...payload });
    },
    [eventId]
  );

  const ensurePeer = useCallback(
    (remote) => {
      const socketId = remote.socketId;
      if (!socketId || socketId === getLiveSocket().id) return null;
      const existing = peersRef.current.get(socketId);
      if (existing) {
        existing.name = remote.name || existing.name;
        existing.username = remote.username || existing.username;
        existing.mode = remote.mode || existing.mode;
        if (typeof remote.mic === "boolean") existing.mic = remote.mic;
        if (typeof remote.camera === "boolean") existing.camera = remote.camera;
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      const peer = {
        pc,
        name: remote.name || remote.username || "Member",
        username: remote.username || "",
        mode: remote.mode || "audio",
        mic: remote.mic !== false,
        camera: remote.camera !== false && remote.mode === "video",
        stream: new MediaStream(),
        polite: String(getLiveSocket().id || "") < String(socketId),
        ignoreOffer: false,
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal(socketId, { type: "ice", candidate: event.candidate });
      };

      pc.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => {
          if (!peer.stream.getTracks().some((item) => item.id === track.id)) {
            peer.stream.addTrack(track);
          }
        });
        syncTiles();
      };

      peersRef.current.set(socketId, peer);
      return peer;
    },
    [sendSignal, syncTiles]
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
        setError("Could not connect to a caller.");
      } finally {
        makingOfferRef.current.delete(remote.socketId);
      }
    },
    [ensurePeer, sendSignal]
  );

  const handleSignal = useCallback(
    async ({ from, type, sdp, candidate }) => {
      if (!inCallRef.current || !from) return;
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
            if (!peer.ignoreOffer) throw new Error("ICE failed");
          }
        }
      } catch {
        /* ignore stale signaling during leave/renegotiate */
      }
    },
    [ensurePeer, sendSignal]
  );

  const joinCall = async (nextMode) => {
    if (!isLive || joining || inCall) return;
    setError("");
    setJoining(true);
    try {
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

      const socket = getLiveSocket();
      socket.emit("call_join", { eventId, mode: nextMode }, async (ack) => {
        if (!ack?.success) {
          stopLocal();
          setError(ack?.message || "Could not join the call.");
          setJoining(false);
          return;
        }
        inCallRef.current = true;
        setInCall(true);
        setJoining(false);
        syncTiles();
        const myId = String(socket.id || "");
        for (const peer of ack.peers || []) {
          if (myId > String(peer.socketId)) {
            await createOffer(peer);
          }
        }
        syncTiles();
      });
    } catch (err) {
      stopLocal();
      const denied = err?.name === "NotAllowedError";
      setError(
        denied
          ? "Allow microphone and camera access to join the call."
          : "Could not start your microphone or camera."
      );
      setJoining(false);
    }
  };

  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
    getLiveSocket().emit("call_presence", { eventId, mic: !next });
    syncTiles();
  };

  const toggleCamera = async () => {
    if (modeRef.current !== "video") return;
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !cameraOff;
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !nextOff;
    });
    setCameraOff(nextOff);
    getLiveSocket().emit("call_presence", { eventId, camera: !nextOff });
    syncTiles();
  };

  handlersRef.current = {
    closePeer,
    createOffer,
    handleSignal,
    leaveCall,
    syncTiles,
  };

  useEffect(() => {
    const socket = getLiveSocket();

    const onRoster = ({ peers }) => {
      setRoster(Array.isArray(peers) ? peers : []);
    };

    const onPeerJoined = ({ peer }) => {
      if (!peer?.socketId) return;
      setRoster((prev) => {
        if (prev.some((item) => item.socketId === peer.socketId)) return prev;
        return [...prev, peer];
      });
      if (!inCallRef.current) return;
      if (peersRef.current.has(peer.socketId)) return;
      const myId = String(socket.id || "");
      if (myId > String(peer.socketId)) {
        handlersRef.current.createOffer(peer);
      }
    };

    const onPeerLeft = ({ socketId }) => {
      handlersRef.current.closePeer(socketId);
      setRoster((prev) => prev.filter((item) => item.socketId !== socketId));
      handlersRef.current.syncTiles();
    };

    const onPresence = ({ socketId, mic, camera, mode: nextMode }) => {
      const peer = peersRef.current.get(socketId);
      if (peer) {
        if (typeof mic === "boolean") peer.mic = mic;
        if (typeof camera === "boolean") peer.camera = camera;
        if (nextMode) peer.mode = nextMode;
        handlersRef.current.syncTiles();
      }
      setRoster((prev) =>
        prev.map((item) =>
          item.socketId === socketId
            ? {
                ...item,
                mic: typeof mic === "boolean" ? mic : item.mic,
                camera: typeof camera === "boolean" ? camera : item.camera,
                mode: nextMode || item.mode,
              }
            : item
        )
      );
    };

    const onSignal = (payload) => {
      handlersRef.current.handleSignal(payload);
    };

    const onCallEnded = () => {
      handlersRef.current.leaveCall(false);
      setRoster([]);
      setError("The call ended.");
    };

    socket.emit("call_sync", { eventId }, (ack) => {
      if (ack?.peers) setRoster(ack.peers);
    });

    socket.on("call_roster", onRoster);
    socket.on("call_peer_joined", onPeerJoined);
    socket.on("call_peer_left", onPeerLeft);
    socket.on("call_presence", onPresence);
    socket.on("call_signal", onSignal);
    socket.on("call_ended", onCallEnded);

    return () => {
      socket.off("call_roster", onRoster);
      socket.off("call_peer_joined", onPeerJoined);
      socket.off("call_peer_left", onPeerLeft);
      socket.off("call_presence", onPresence);
      socket.off("call_signal", onSignal);
      socket.off("call_ended", onCallEnded);
      handlersRef.current.leaveCall(true);
    };
  }, [eventId]);

  useEffect(() => {
    if (!isLive && inCallRef.current) leaveCall(true);
  }, [isLive, leaveCall]);

  const othersInCall = roster.filter(
    (peer) => peer.socketId !== getLiveSocket().id
  ).length;
  const suggested = callMode === "audio" ? "audio" : "video";

  return (
    <div className="border border-fo-border rounded-2xl bg-fo-surface overflow-hidden">
      <div className="px-4 py-2.5 border-b border-fo-border flex items-center gap-2 text-xs text-fo-muted">
        {callMode === "audio" ? (
          <Phone size={14} className="text-fo-accent" />
        ) : (
          <Video size={14} className="text-fo-accent" />
        )}
        {callMode === "audio" ? "Audio call" : "Video & audio call"}
        <span className="ml-auto text-fo-subtle">
          {inCall ? tiles.length : roster.length} in call
        </span>
      </div>

      <div className="p-3 space-y-3">
        {inCall ? (
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
        ) : (
          <div className="rounded-xl border border-dashed border-fo-border px-4 py-6 text-center space-y-2">
            <p className="text-sm text-fo-text">
              {isLive
                ? othersInCall
                  ? `${othersInCall} ${othersInCall === 1 ? "person is" : "people are"} already in the call.`
                  : "Start or join the call from this event."
                : "This event has ended."}
            </p>
            <p className="text-[11px] text-fo-subtle">
              Up to 6 people can talk at once. Commentary chat stays open below.
            </p>
          </div>
        )}

        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : null}

        {isLive ? (
          <div className="flex flex-wrap items-center gap-2">
            {inCall ? (
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
                  onClick={() => leaveCall(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
                >
                  <PhoneOff size={14} /> Leave call
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={joining}
                  onClick={() => joinCall("audio")}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${
                    suggested === "audio"
                      ? "bg-fo-accent text-black border-fo-accent"
                      : "border-fo-border text-fo-text hover:border-fo-accent/40"
                  } disabled:opacity-50`}
                >
                  {joining && mode === "audio" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Phone size={14} />
                  )}
                  Join audio
                </button>
                <button
                  type="button"
                  disabled={joining}
                  onClick={() => joinCall("video")}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border ${
                    suggested === "video"
                      ? "bg-fo-accent text-black border-fo-accent"
                      : "border-fo-border text-fo-text hover:border-fo-accent/40"
                  } disabled:opacity-50`}
                >
                  {joining && mode === "video" ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Video size={14} />
                  )}
                  Join video
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

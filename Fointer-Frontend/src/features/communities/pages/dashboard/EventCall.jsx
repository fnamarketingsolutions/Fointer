import { useCallback, useEffect, useRef, useState } from "react";
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
import CallTile from "../../../../shared/components/CallTile";
import { useAuth } from "../../../../context/AuthContext";
import { getIceConfig } from "../../../../shared/webrtc/iceServers";
import { watchPeerConnection } from "../../../../shared/webrtc/iceRestart";
import { applyPeerSignal } from "../../../../shared/webrtc/applyPeerSignal";
import { createIceQueue, enqueueSerial } from "../../../../shared/webrtc/iceQueue";
import { addRemoteTracks } from "../../../../shared/webrtc/remoteTracks";
import { mergeCallTiles } from "../../../../shared/webrtc/mediaTile";
import { planMeshOffers, shouldOfferToPeer } from "../../../../shared/webrtc/meshPlan";
import { showVideoJoinControl } from "../../../../shared/webrtc/callSession";
import {
  applyRemoteCameraState,
  attachVideoTrack,
  cameraControlLabel,
  cameraPresencePayload,
  disableLocalCamera,
  enableLocalCamera,
  queuePeerRenegotiation,
  watchRemoteTrack,
} from "../../../../shared/webrtc/mediaSwitch";

export default function EventCall({ eventId, isLive, callMode = "chat", authorized = true }) {
  const { user } = useAuth();
  const [joining, setJoining] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [mode, setMode] = useState(callMode === "audio" ? "audio" : "video");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [error, setError] = useState("");
  const [roster, setRoster] = useState([]);
  const [tiles, setTiles] = useState([]);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const rosterRef = useRef([]);
  const inCallRef = useRef(false);
  const acceptSignalsRef = useRef(false);
  const cameraBusyRef = useRef(false);
  const modeRef = useRef(mode);
  const iceConfigRef = useRef(null);
  const makingOfferRef = useRef(new Set());
  const handlersRef = useRef({});
  const earlySignalsRef = useRef([]);
  const signalChainRef = useRef({ chain: Promise.resolve() });

  const syncTiles = useCallback(() => {
    const local = localStreamRef.current;
    const localSocketId = String(getLiveSocket().id || "");
    const localTile =
      local && inCallRef.current
        ? {
            socketId: localSocketId || "local",
            name: "You",
            avatar: user?.avatar || "",
            mode: modeRef.current,
            mic: !local.getAudioTracks().some((track) => !track.enabled),
            camera:
              modeRef.current === "video" &&
              local.getVideoTracks().some((track) => track.enabled),
            stream: local,
            isLocal: true,
          }
        : null;
    const peers = [...peersRef.current.entries()].map(([socketId, peer]) => ({
      socketId,
      name: peer.name,
      username: peer.username,
      avatar: peer.avatar || "",
      mode: peer.mode,
      mic: peer.mic,
      camera: peer.camera,
      stream: peer.stream,
      streamVersion: peer.streamVersion || 0,
      connectionState: peer.connectionState || "",
    }));
    setTiles(mergeCallTiles({ local: localTile, roster: rosterRef.current, peers }));
  }, [user?.avatar]);

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
      acceptSignalsRef.current = false;
      earlySignalsRef.current = [];
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

  const attachLocalTracks = (pc) => {
    const stream = localStreamRef.current;
    if (!stream || !pc?.getSenders) return false;
    let added = false;
    const senders = pc.getSenders();
    for (const track of stream.getTracks()) {
      if (!track || track.readyState === "ended") continue;
      if (track.kind === "video") {
        const plan = attachVideoTrack(pc, track, stream);
        if (plan.action === "add" || plan.action === "replace") added = true;
        continue;
      }
      const exists = senders.some(
        (sender) =>
          sender.track &&
          (sender.track.id === track.id || sender.track.kind === track.kind)
      );
      if (!exists) {
        pc.addTrack(track, stream);
        added = true;
      }
    }
    return added;
  };

  const ensurePeer = useCallback(
    (remote) => {
      const socketId = remote.socketId;
      if (!socketId || socketId === getLiveSocket().id) return null;
      const known =
        rosterRef.current.find((item) => item.socketId === socketId) || {};
      const info = {
        name: remote.name || known.name,
        username: remote.username || known.username,
        avatar: remote.avatar || known.avatar,
        mode: remote.mode || known.mode || "video",
        mic: typeof remote.mic === "boolean" ? remote.mic : known.mic,
        camera: typeof remote.camera === "boolean" ? remote.camera : known.camera,
      };
      const existing = peersRef.current.get(socketId);
      if (existing) {
        existing.name = info.name || existing.name;
        existing.username = info.username || existing.username;
        existing.avatar = info.avatar || existing.avatar;
        existing.mode = info.mode || existing.mode;
        if (typeof info.mic === "boolean") existing.mic = info.mic;
        if (typeof info.camera === "boolean") existing.camera = info.camera;
        if (attachLocalTracks(existing.pc)) existing.needsRenegotiate = true;
        return existing;
      }

      const pc = new RTCPeerConnection(iceConfigRef.current || undefined);
      const peer = {
        pc,
        name: info.name || info.username || "Member",
        username: info.username || "",
        avatar: info.avatar || "",
        mode: info.mode || "video",
        mic: info.mic !== false,
        camera: info.camera !== false,
        stream: new MediaStream(),
        streamVersion: 0,
        connectionState: "new",
        polite: String(getLiveSocket().id || "") < String(socketId),
        ignoreOffer: false,
        iceQueue: createIceQueue(),
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal(socketId, {
          type: "ice",
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      };

      pc.onconnectionstatechange = () => {
        peer.connectionState = pc.connectionState;
        syncTiles();
      };
      watchPeerConnection(pc, {
        polite: peer.polite,
        isActive: () => inCallRef.current,
        sendOffer: (description) => {
          sendSignal(socketId, { type: "offer", sdp: description });
        },
      });

      pc.ontrack = (event) => {
        addRemoteTracks(peer.stream, event);
        if (event.track) {
          watchRemoteTrack(event.track, peer, syncTiles);
          if (
            event.track.kind === "video" &&
            event.track.muted !== true &&
            event.track.readyState === "live"
          ) {
            peer.mode = "video";
            peer.camera = true;
          }
        }
        peer.streamVersion += 1;
        syncTiles();
      };

      peer.stream.onremovetrack = () => {
        peer.streamVersion += 1;
        syncTiles();
      };

      peersRef.current.set(socketId, peer);
      return peer;
    },
    [sendSignal, syncTiles]
  );

  const createOffer = useCallback(
    async (remote, { force = false } = {}) => {
      const peer = ensurePeer(remote);
      if (!peer) return;
      const described = peer.pc.localDescription || peer.pc.remoteDescription;
      if (!force && (peer.offered || described)) return;
      if (force && peer.pc.signalingState && peer.pc.signalingState !== "stable") return;
      peer.offered = true;
      try {
        makingOfferRef.current.add(remote.socketId);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        sendSignal(remote.socketId, {
          type: "offer",
          sdp: peer.pc.localDescription,
        });
      } catch {
        peer.offered = false;
        setError("Could not connect to a caller.");
      } finally {
        makingOfferRef.current.delete(remote.socketId);
      }
    },
    [ensurePeer, sendSignal]
  );

  const reconcileRoster = useCallback(
    (rosterPeers = []) => {
      if (!inCallRef.current) return;
      const myId = String(getLiveSocket().id || "");
      const present = new Set();
      for (const remote of rosterPeers) {
        if (!remote?.socketId || String(remote.socketId) === myId) continue;
        present.add(remote.socketId);
        ensurePeer(remote);
      }
      for (const socketId of [...peersRef.current.keys()]) {
        if (!present.has(socketId)) closePeer(socketId);
      }
      const already = new Set();
      for (const [socketId, peer] of peersRef.current) {
        if (peer.offered || peer.pc.localDescription || peer.pc.remoteDescription) {
          already.add(socketId);
        }
      }
      for (const remote of planMeshOffers(myId, rosterPeers, already)) {
        enqueueSerial(signalChainRef.current, () => createOffer(remote));
      }
      for (const remote of rosterPeers) {
        const peer = peersRef.current.get(remote.socketId);
        if (!peer?.needsRenegotiate) continue;
        peer.needsRenegotiate = false;
        peer.offered = false;
        enqueueSerial(signalChainRef.current, () => createOffer(remote, { force: true }));
      }
      syncTiles();
    },
    [closePeer, createOffer, ensurePeer, syncTiles]
  );

  const applySignal = useCallback(
    async ({ from, type, sdp, candidate }) => {
      if (!inCallRef.current || !from || !localStreamRef.current) return;
      const known = rosterRef.current.find((item) => item.socketId === from) || {};
      const peer = ensurePeer({
        socketId: from,
        name: known.name,
        username: known.username,
        avatar: known.avatar,
        mode: known.mode,
        mic: known.mic,
        camera: known.camera,
      });
      if (!peer) return;
      try {
        await applyPeerSignal(
          peer,
          { type, sdp, candidate },
          {
            makingOffer: makingOfferRef.current.has(from),
            onAnswer: (description) => {
              sendSignal(from, { type: "answer", sdp: description });
            },
            beforeAnswer: async () => {
              const stream = localStreamRef.current;
              const track = stream
                ?.getVideoTracks?.()
                .find((item) => item.readyState === "live" && item.enabled !== false);
              if (!track) return;
              const plan = attachVideoTrack(peer.pc, track, stream);
              if (plan.pending) await plan.pending;
            },
          }
        );
        syncTiles();
      } catch {
        /* ignore stale signaling during leave/renegotiate */
      }
    },
    [ensurePeer, sendSignal, syncTiles]
  );

  const flushEarlySignals = useCallback(() => {
    if (!inCallRef.current || !localStreamRef.current) return;
    const queued = earlySignalsRef.current.splice(0);
    for (const item of queued) {
      enqueueSerial(signalChainRef.current, () => applySignal(item));
    }
  }, [applySignal]);

  const handleSignal = useCallback(
    (payload) => {
      if (!payload?.from) return;
      if (!inCallRef.current && !acceptSignalsRef.current) return;
      if (!inCallRef.current || !localStreamRef.current) {
        earlySignalsRef.current.push(payload);
        return;
      }
      enqueueSerial(signalChainRef.current, () => applySignal(payload));
    },
    [applySignal]
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
      iceConfigRef.current = await getIceConfig();
      localStreamRef.current = stream;
      modeRef.current = nextMode;
      setMode(nextMode);
      setCameraOff(nextMode !== "video");
      setMuted(false);

      const socket = getLiveSocket();
      acceptSignalsRef.current = true;
      socket.emit("call_join", { eventId, mode: nextMode }, async (ack) => {
        if (!ack?.success) {
          acceptSignalsRef.current = false;
          earlySignalsRef.current = [];
          stopLocal();
          setError(ack?.message || "Could not join the call.");
          setJoining(false);
          return;
        }
        inCallRef.current = true;
        setInCall(true);
        setJoining(false);
        syncTiles();
        flushEarlySignals();
        await signalChainRef.current.chain;
        const peers = ack.peers || [];
        const full = ack.self ? [...peers, ack.self] : peers;
        rosterRef.current = full;
        setRoster(full);
        reconcileRoster(peers);
        syncTiles();
      });
    } catch (err) {
      acceptSignalsRef.current = false;
      earlySignalsRef.current = [];
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

  const publishLiveCamera = (cameraOn) => {
    const payload = cameraPresencePayload(cameraOn);
    modeRef.current = payload.mode;
    setMode(payload.mode);
    setCameraOff(!cameraOn);
    getLiveSocket().emit("call_presence", { eventId, ...payload });
    syncTiles();
  };

  const renegotiateLivePeers = () =>
    queuePeerRenegotiation({
      peers: peersRef.current,
      chain: signalChainRef.current,
      makingOffer: makingOfferRef.current,
      isActive: () => inCallRef.current,
      sendOffer: (socketId, description) => {
        sendSignal(socketId, { type: "offer", sdp: description });
      },
      onError: () => setError("Video update failed. Audio is still connected."),
    });

  const turnCameraOff = async () => {
    if (cameraBusyRef.current || !inCallRef.current || !localStreamRef.current) return;
    const hasLiveVideo = localStreamRef.current
      .getVideoTracks()
      .some((track) => track.readyState === "live");
    if (!hasLiveVideo && modeRef.current !== "video") return;
    cameraBusyRef.current = true;
    setCameraBusy(true);
    setError("");
    try {
      await disableLocalCamera({
        localStream: localStreamRef.current,
        peerConnections: [...peersRef.current.values()].map((peer) => peer.pc),
      });
      if (!inCallRef.current) return;
      publishLiveCamera(false);
      await renegotiateLivePeers();
    } catch {
      setError("Video update failed. Audio is still connected.");
    } finally {
      cameraBusyRef.current = false;
      setCameraBusy(false);
      syncTiles();
    }
  };

  const turnCameraOn = async () => {
    if (cameraBusyRef.current || !inCallRef.current) return;
    const liveVideo = localStreamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === "live" && track.enabled !== false);
    if (liveVideo) return;
    cameraBusyRef.current = true;
    setCameraBusy(true);
    setError("");
    try {
      const result = await enableLocalCamera({
        localStream: localStreamRef.current,
        peerConnections: [...peersRef.current.values()].map((peer) => peer.pc),
        getUserMedia: (constraints) => {
          if (!navigator.mediaDevices?.getUserMedia) {
            const error = new Error("Camera unavailable");
            error.name = "NotFoundError";
            return Promise.reject(error);
          }
          return navigator.mediaDevices.getUserMedia(constraints);
        },
      });
      if (!inCallRef.current) {
        result.track?.stop?.();
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      result.track.onended = () => {
        if (cameraBusyRef.current) return;
        const stillLive = localStreamRef.current
          ?.getVideoTracks()
          .some((track) => track.id === result.track.id && track.readyState === "live");
        if (!stillLive && inCallRef.current) void turnCameraOff();
      };
      publishLiveCamera(true);
      await renegotiateLivePeers();
    } catch {
      setError("Video update failed. Audio is still connected.");
    } finally {
      cameraBusyRef.current = false;
      setCameraBusy(false);
      syncTiles();
    }
  };

  const toggleCamera = () => {
    if (cameraBusy) return;
    const cameraOn = localStreamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === "live" && track.enabled !== false);
    if (cameraOn) void turnCameraOff();
    else void turnCameraOn();
  };

  handlersRef.current = {
    closePeer,
    createOffer,
    handleSignal,
    leaveCall,
    reconcileRoster,
    syncTiles,
  };

  useEffect(() => {
    const socket = getLiveSocket();

    const onRoster = ({ peers }) => {
      const next = Array.isArray(peers) ? peers : [];
      rosterRef.current = next;
      setRoster(next);
      if (inCallRef.current) handlersRef.current.reconcileRoster(next);
      else handlersRef.current.syncTiles();
    };

    const onPeerJoined = ({ peer }) => {
      if (!peer?.socketId) return;
      const next = rosterRef.current.filter((item) => item.socketId !== peer.socketId);
      next.push(peer);
      rosterRef.current = next;
      setRoster(next);
      if (!inCallRef.current) return;
      ensurePeer(peer);
      const existing = peersRef.current.get(peer.socketId);
      const described = existing?.pc?.localDescription || existing?.pc?.remoteDescription;
      if (shouldOfferToPeer(socket.id, peer.socketId) && !existing?.offered && !described) {
        enqueueSerial(signalChainRef.current, () => handlersRef.current.createOffer(peer));
      }
      handlersRef.current.syncTiles();
    };

    const onPeerLeft = ({ socketId }) => {
      handlersRef.current.closePeer(socketId);
      rosterRef.current = rosterRef.current.filter((item) => item.socketId !== socketId);
      setRoster(rosterRef.current);
      handlersRef.current.syncTiles();
    };

    const onPresence = ({ socketId, mic, camera, mode: nextMode }) => {
      const peer = peersRef.current.get(socketId);
      if (peer) applyRemoteCameraState(peer, { mic, camera, mode: nextMode });
      rosterRef.current = rosterRef.current.map((item) =>
        item.socketId === socketId
          ? {
              ...item,
              mic: typeof mic === "boolean" ? mic : item.mic,
              camera: typeof camera === "boolean" ? camera : item.camera,
              mode: nextMode || item.mode,
            }
          : item
      );
      setRoster(rosterRef.current);
      handlersRef.current.syncTiles();
    };

    const onSignal = (payload) => {
      handlersRef.current.handleSignal(payload);
    };

    const onCallEnded = () => {
      handlersRef.current.leaveCall(false);
      rosterRef.current = [];
      setRoster([]);
      setError("The call ended.");
    };

    socket.emit("call_sync", { eventId }, (ack) => {
      if (!ack?.peers) return;
      rosterRef.current = ack.peers;
      setRoster(ack.peers);
      if (inCallRef.current) handlersRef.current.reconcileRoster(ack.peers);
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
        {(inCall ? mode : callMode) === "audio" ? (
          <Phone size={14} className="text-fo-accent" />
        ) : (
          <Video size={14} className="text-fo-accent" />
        )}
        {inCall
          ? mode === "audio"
            ? "Audio call"
            : "Video call"
          : callMode === "audio"
            ? "Audio call"
            : "Video & audio call"}
        <span className="ml-auto text-fo-subtle">
          {cameraBusy ? "Updating camera… · " : ""}
          {inCall
            ? Math.max(
                tiles.length,
                roster.filter((peer) => peer.socketId !== getLiveSocket().id).length + 1
              )
            : roster.length}{" "}
          in call
        </span>
      </div>

      <div className="p-3 space-y-3">
        {inCall ? (
          <div
            className={`grid gap-2 ${
              tiles.length > 2 ? "grid-cols-2" : tiles.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {tiles.map((peer) => (
              <CallTile
                key={peer.socketId}
                peer={peer}
                isLocal={peer.isLocal}
                fallbackLabel="Member"
                size="sm"
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

        {isLive && inCall ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleMic}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg text-xs border border-fo-border text-fo-text hover:border-fo-accent/40"
            >
              {muted ? <MicOff size={14} /> : <Mic size={14} />}
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              disabled={cameraBusy}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg text-xs border border-fo-border text-fo-text hover:border-fo-accent/40 disabled:opacity-60"
            >
              {cameraBusy ? (
                <Loader2 size={14} className="animate-spin" />
              ) : cameraOff || mode === "audio" ? (
                <VideoOff size={14} />
              ) : (
                <Video size={14} />
              )}
              {cameraControlLabel({
                cameraOn: mode === "video" && !cameraOff,
                busy: cameraBusy,
              })}
            </button>
            <button
              type="button"
              onClick={() => leaveCall(true)}
              className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
            >
              <PhoneOff size={14} /> Leave call
            </button>
          </div>
        ) : null}
        {isLive && !inCall ? (
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch gap-2">
            {showVideoJoinControl({ isLive, inCall, authorized }) ? (
              <button
                type="button"
                disabled={joining}
                onClick={() => joinCall("video")}
                className={`inline-flex items-center justify-center gap-1.5 min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-semibold border ${
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
            ) : null}
            <button
              type="button"
              disabled={joining}
              onClick={() => joinCall("audio")}
              className={`inline-flex items-center justify-center gap-1.5 min-h-11 w-full sm:w-auto px-3 py-2 rounded-lg text-xs font-semibold border ${
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

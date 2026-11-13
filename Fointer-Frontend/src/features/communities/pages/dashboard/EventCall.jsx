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
import { claimIceCall, getIceConfig, getIceRequestId, getIceSession, iceRefreshDue, maybeRotateIce, releaseIceCall } from "../../../../shared/webrtc/iceServers";
import { flushCallDiagnostics, noteIceConfigurationApplied, reportIceCandidateError } from "../../../../shared/webrtc/callDiagnostics";
import { watchPeerConnection } from "../../../../shared/webrtc/iceRestart";
import { applyPeerSignal, applyQueuedAnswer, plainSessionDescription } from "../../../../shared/webrtc/applyPeerSignal";
import {
  attachLocalMedia,
  bindTracksToOffer,
  canCreateOffer,
  claimOfferLock,
  missingLocalKinds,
  releaseOfferLock,
} from "../../../../shared/webrtc/sdpNegotiation";
import { assessMediaHealth, readSafeCallStats, toPublicMediaLog } from "../../../../shared/webrtc/callStats";
import { createSignalCourier } from "../../../../shared/webrtc/signalDelivery";
import { recoveryNeededAfterNetworkChange, watchNetworkChanges } from "../../../../shared/webrtc/networkRecovery";
import { createIceQueue, enqueueSerial, pushLocalCandidate, replayLocalCandidates } from "../../../../shared/webrtc/iceQueue";
import { addRemoteTracks } from "../../../../shared/webrtc/remoteTracks";
import { mergeCallTiles } from "../../../../shared/webrtc/mediaTile";
import { planMeshOffers, shouldOfferToPeer } from "../../../../shared/webrtc/meshPlan";
import { liveCallJoinMode, showAudioJoinControl, showVideoJoinControl } from "../../../../shared/webrtc/callSession";
import {
  applyRemoteCameraState,
  cameraControlLabel,
  cameraPresencePayload,
  capturePeerTransport,
  disableLocalCamera,
  enableLocalCamera,
  logCameraToggle,
  queuePeerRenegotiation,
  renegotiatePeer,
  watchRemoteTrack,
} from "../../../../shared/webrtc/mediaSwitch";

export default function EventCall({
  eventId,
  eventTitle,
  isLive,
  callMode = "chat",
  authorized = true,
  isRouteActive,
  onCallStateChange,
}) {
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
  const eventIdRef = useRef(eventId);
  const signalCourierRef = useRef(null);
  const acceptSignalsRef = useRef(false);
  const cameraBusyRef = useRef(false);
  const modeRef = useRef(mode);
  const iceConfigRef = useRef(null);
  const iceCallKeyRef = useRef("");
  const iceTokenRef = useRef(0);
  const makingOfferRef = useRef(new Set());
  const handlersRef = useRef({});
  const earlySignalsRef = useRef([]);
  const signalChainRef = useRef({ chain: Promise.resolve() });
  const callWindowRef = useRef(null);
  const windowDragRef = useRef(null);
  const [windowPosition, setWindowPosition] = useState(null);

  const startWindowDrag = (event) => {
    if (event.target.closest("button")) return;
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const rect = callWindowRef.current?.getBoundingClientRect();
    if (!rect) return;
    windowDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    setWindowPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const moveWindow = (event) => {
    const drag = windowDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const width = callWindowRef.current?.offsetWidth || 320;
    const height = callWindowRef.current?.offsetHeight || 280;
    setWindowPosition({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, drag.left + event.clientX - drag.startX)),
      top: Math.max(8, Math.min(window.innerHeight - height - 8, drag.top + event.clientY - drag.startY)),
    });
  };

  const stopWindowDrag = (event) => {
    const drag = windowDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    windowDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

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
      iceConnectionState: peer.iceConnectionState || "",
      networkStatus: peer.networkStatus || "",
      mediaStats: peer.mediaStats || null,
    }));
    setTiles(mergeCallTiles({ local: localTile, roster: rosterRef.current, peers }));
  }, [user?.avatar]);

  useEffect(() => {
    if (!inCall) return undefined;
    let stopped = false;
    let lastLoggedAt = 0;
    const sample = async () => {
      let changed = false;
      for (const peer of peersRef.current.values()) {
        const summary = await readSafeCallStats(peer.pc);
        if (stopped || !summary) continue;
        const previous = peer.mediaStats;
        peer.mediaStats = summary;
        const health = assessMediaHealth(previous, summary);
        if (health.restart) peer.stopIceRecovery?.request?.();
        if (health.status === "one-way" || health.status === "poor-video") {
          if (peer.networkStatus !== health.status) changed = true;
          peer.networkStatus = health.status;
        }
        if (Date.now() - lastLoggedAt >= 15_000) {
          lastLoggedAt = Date.now();
          console.info("[event-call] media", toPublicMediaLog(summary));
        }
      }
      if (changed && !stopped) syncTiles();
    };
    const timer = setInterval(() => {
      void sample();
    }, 5000);
    void sample();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [inCall, syncTiles]);

  const closePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    peer.stopIceRecovery?.();
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
      signalCourierRef.current?.cancelPending();
      peersRef.current.forEach((_, socketId) => closePeer(socketId));
      peersRef.current.clear();
      stopLocal();
      inCallRef.current = false;
      acceptSignalsRef.current = false;
      earlySignalsRef.current = [];
      setInCall(false);
      onCallStateChange?.(false);
      setMuted(false);
      setCameraOff(false);
      setTiles([]);
      releaseIceCall(iceTokenRef.current, iceCallKeyRef.current);
      iceTokenRef.current = 0;
      iceCallKeyRef.current = "";
      iceConfigRef.current = null;
      void flushCallDiagnostics();
    },
    [closePeer, eventId, onCallStateChange, stopLocal]
  );

  useEffect(() => {
    eventIdRef.current = eventId;
  }, [eventId]);

  useEffect(() => {
    const courier = createSignalCourier({
      isActive: () => inCallRef.current,
      onFailure: ({ type, reason }) => {
        console.info("[event-call] signal", { type, reason });
      },
      emit: (message, ack) => {
        getLiveSocket().timeout(1500).emit(
          "call_signal",
          { eventId: eventIdRef.current, ...message },
          (err, body) => ack(err ? { success: false, message: "timeout" } : body)
        );
      },
    });
    signalCourierRef.current = courier;
    return () => {
      courier.cancelPending();
      signalCourierRef.current = null;
    };
  }, []);

  const sendSignal = useCallback((to, payload) => {
    signalCourierRef.current?.send({ to, ...payload });
  }, []);

  const attachLocalTracks = (pc) => attachLocalMedia(pc, localStreamRef.current).added.length > 0;

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

      const iceConfig = iceConfigRef.current;
      if (!iceConfig?.iceServers?.length) return null;
      const pc = new RTCPeerConnection(iceConfig);
      noteIceConfigurationApplied({
        callId: eventIdRef.current || iceCallKeyRef.current,
        requestId: getIceRequestId(iceCallKeyRef.current),
        callType: "event",
        direction: "join",
      });
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
        iceGeneration: 0,
      };

      attachLocalMedia(pc, localStreamRef.current);
      pc.onnegotiationneeded = () => {
        peer.negotiationNeeded = true;
        if (peer.polite || peer.offerLock || !canCreateOffer(pc)) return;
        enqueueSerial(signalChainRef.current, () => handlersRef.current.createOffer?.(remote));
      };

      pc.onicecandidateerror = (event) => {
        reportIceCandidateError(event, { callId: eventIdRef.current });
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
        pushLocalCandidate(peer, candidate);
        sendSignal(socketId, {
          type: "ice",
          generation: peer.iceGeneration || 0,
          candidate,
        });
      };

      pc.onconnectionstatechange = () => {
        peer.connectionState = pc.connectionState;
        syncTiles();
      };
      peer.stopIceRecovery = watchPeerConnection(pc, {
        polite: peer.polite,
        getCredentialSession: () => getIceSession(iceCallKeyRef.current),
        beforeRestart: async (connection) => {
          const result = await maybeRotateIce(connection, getIceSession(iceCallKeyRef.current), async (options) => {
            const next = await getIceConfig({
              ...options,
              callKey: iceCallKeyRef.current,
              token: iceTokenRef.current,
              callType: "event",
              direction: "join",
            });
            if (iceTokenRef.current) iceConfigRef.current = next;
            return next;
          });
          return result;
        },
        isActive: () => inCallRef.current,
        claimOffer: () => claimOfferLock(peer, pc),
        releaseOffer: () => releaseOfferLock(peer),
        sendOffer: (description, meta) => {
          if (!meta?.resend) {
            peer.iceGeneration = (peer.iceGeneration || 0) + 1;
            peer.localIceReplayed = false;
            peer.localCandidates = [];
            signalCourierRef.current?.dropOlder(peer.iceGeneration);
          }
          sendSignal(socketId, {
            type: "offer",
            sdp: plainSessionDescription(description),
            generation: peer.iceGeneration || 0,
          });
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

  const loadIceForCall = useCallback(async ({ fresh = false } = {}) => {
    if (fresh) {
      const previousToken = iceTokenRef.current;
      const previousKey = iceCallKeyRef.current;
      const token = claimIceCall();
      releaseIceCall(previousToken, previousKey);
      iceTokenRef.current = token;
      iceConfigRef.current = null;
      iceCallKeyRef.current = `event:${eventIdRef.current || "live"}:${token}`;
    } else if (iceConfigRef.current && !iceRefreshDue(getIceSession(iceCallKeyRef.current))) {
      return iceConfigRef.current;
    }
    const token = iceTokenRef.current;
    const rtc = await getIceConfig({
      force: !fresh && iceRefreshDue(getIceSession(iceCallKeyRef.current)),
      callKey: iceCallKeyRef.current,
      token,
      callType: "event",
      direction: "join",
    });
    if (iceTokenRef.current !== token) return iceConfigRef.current;
    iceConfigRef.current = rtc;
    return rtc;
  }, []);

  const createOffer = useCallback(
    async (remote, { force = false } = {}) => {
      await loadIceForCall();
      const peer = ensurePeer(remote);
      if (!peer) return;
      const described = peer.pc.localDescription || peer.pc.remoteDescription;
      if (!force && (peer.offered || described)) return;
      if (peer.pc.signalingState && peer.pc.signalingState !== "stable") return;
      if (!claimOfferLock(peer, peer.pc)) return;
      peer.offered = true;
      try {
        makingOfferRef.current.add(remote.socketId);
        attachLocalMedia(peer.pc, localStreamRef.current);
        const offer = await peer.pc.createOffer();
        if (!canCreateOffer(peer.pc)) return;
        await peer.pc.setLocalDescription(offer);
        const description = plainSessionDescription(peer.pc.localDescription);
        sendSignal(remote.socketId, {
          type: "offer",
          sdp: description,
          generation: peer.iceGeneration || 0,
        });
        try {
          if (await applyQueuedAnswer(peer, {
            onAnswer: (answer) => {
              sendSignal(remote.socketId, { type: "answer", sdp: plainSessionDescription(answer) });
            },
          })) {
            for (const candidate of replayLocalCandidates(peer)) {
              sendSignal(remote.socketId, {
                type: "ice",
                generation: peer.iceGeneration || 0,
                candidate,
              });
            }
          }
        } catch {
          /* a stale early answer must not block the offer */
        }
      } catch (error) {
        peer.offered = peer.pc?.signalingState === "have-local-offer";
        if (peer.pc?.connectionState !== "connected" && !/m-line/i.test(error?.message || "")) {
          setError("Could not connect to a caller.");
        }
      } finally {
        releaseOfferLock(peer);
        makingOfferRef.current.delete(remote.socketId);
      }
    },
    [ensurePeer, loadIceForCall, sendSignal]
  );

  const reconcileRoster = useCallback(
    async (rosterPeers = []) => {
      if (!inCallRef.current) return;
      if (iceRefreshDue(getIceSession(iceCallKeyRef.current))) {
        iceConfigRef.current = await getIceConfig({
          force: true,
          callKey: iceCallKeyRef.current,
          token: iceTokenRef.current,
          callType: "event",
          direction: "join",
        });
      }
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
      async ({ from, type, sdp, candidate, messageId, generation }) => {
      if (!inCallRef.current || !from || !localStreamRef.current) return;
      const existing = peersRef.current.get(from);
      if (existing?.pc) {
        await maybeRotateIce(existing.pc, getIceSession(iceCallKeyRef.current), async (options) => {
          const next = await getIceConfig({
            ...options,
            callKey: iceCallKeyRef.current,
            token: iceTokenRef.current,
            callType: "event",
            direction: "join",
          });
          if (iceTokenRef.current) iceConfigRef.current = next;
          return next;
        });
      } else {
        await loadIceForCall();
      }
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
        const applied = await applyPeerSignal(
          peer,
          { type, sdp, candidate, messageId, generation },
          {
            makingOffer: makingOfferRef.current.has(from),
            onAnswer: (description) => {
              sendSignal(from, { type: "answer", sdp: plainSessionDescription(description) });
            },
            beforeAnswer: async () => {
              const bound = bindTracksToOffer(peer.pc, localStreamRef.current);
              if (bound.pending) await bound.pending;
            },
          }
        );
        if (applied && (type === "offer" || type === "answer")) {
          for (const item of replayLocalCandidates(peer)) {
            sendSignal(from, {
              type: "ice",
              generation: peer.iceGeneration || 0,
              candidate: item,
            });
          }
        }
        if (applied && type === "offer" && missingLocalKinds(peer.pc, localStreamRef.current).length) {
          enqueueSerial(signalChainRef.current, async () => {
            const { added } = attachLocalMedia(peer.pc, localStreamRef.current);
            if (!added.length || peer.offerLock || !canCreateOffer(peer.pc)) return;
            makingOfferRef.current.add(from);
            try {
              await renegotiatePeer(peer, {
                makingOffer: false,
                sendOffer: (description) => {
                  sendSignal(from, { type: "offer", sdp: plainSessionDescription(description) });
                },
              });
            } finally {
              makingOfferRef.current.delete(from);
            }
          });
        }
        syncTiles();
      } catch {
        /* ignore stale signaling during leave/renegotiate */
      }
    },
    [ensurePeer, loadIceForCall, sendSignal, syncTiles]
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
    const resolvedMode = liveCallJoinMode(callMode, nextMode);
    if (!isLive || joining || inCall || !resolvedMode) return;
    setError("");
    setJoining(true);
    try {
      iceConfigRef.current = await loadIceForCall({ fresh: true });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video:
          resolvedMode === "video"
            ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
            : false,
      });
      localStreamRef.current = stream;
      modeRef.current = resolvedMode;
      setMode(resolvedMode);
      setCameraOff(resolvedMode !== "video");
      setMuted(false);

      const socket = getLiveSocket();
      acceptSignalsRef.current = true;
      socket.emit("call_join", { eventId, mode: resolvedMode }, async (ack) => {
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
        onCallStateChange?.(true);
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
      const relayUnavailable = err?.name === "TurnUnavailableError";
      setError(
        denied
          ? resolvedMode === "video"
            ? "Allow microphone and camera access to join the call."
            : "Allow microphone access to join the call."
          : relayUnavailable
            ? err.message
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
        sendSignal(socketId, { type: "offer", sdp: plainSessionDescription(description) });
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
    const peerConnections = [...peersRef.current.values()].map((peer) => peer.pc);
    const before = capturePeerTransport(peerConnections);
    try {
      const result = await disableLocalCamera({
        localStream: localStreamRef.current,
        peerConnections,
      });
      if (!inCallRef.current) return;
      publishLiveCamera(false);
      if (result.renegotiate) await renegotiateLivePeers();
      logCameraToggle({
        callId: eventIdRef.current,
        action: "disabled",
        localStream: localStreamRef.current,
        peerConnections,
        before,
        renegotiation: Boolean(result.renegotiate),
        iceRestart: Boolean(result.iceRestart),
      });
    } catch {
      setError("Video update failed. Audio is still connected.");
    } finally {
      cameraBusyRef.current = false;
      setCameraBusy(false);
      syncTiles();
    }
  };

  const turnCameraOn = async () => {
    if (callMode === "audio" || cameraBusyRef.current || !inCallRef.current) return;
    const liveVideo = localStreamRef.current
      ?.getVideoTracks()
      .some((track) => track.readyState === "live" && track.enabled !== false);
    if (liveVideo) return;
    cameraBusyRef.current = true;
    setCameraBusy(true);
    setError("");
    const peerConnections = [...peersRef.current.values()].map((peer) => peer.pc);
    const before = capturePeerTransport(peerConnections);
    try {
      const result = await enableLocalCamera({
        localStream: localStreamRef.current,
        peerConnections,
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
        if (result.action !== "enabled") result.track?.stop?.();
        return;
      }
      if (!result.ok) {
        logCameraToggle({
          callId: eventIdRef.current,
          action: "failed",
          localStream: localStreamRef.current,
          peerConnections,
          before,
          renegotiation: false,
          iceRestart: false,
        });
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
      if (result.renegotiate) await renegotiateLivePeers();
      logCameraToggle({
        callId: eventIdRef.current,
        action: result.action || "enabled",
        localStream: localStreamRef.current,
        peerConnections,
        before,
        renegotiation: Boolean(result.renegotiate),
        iceRestart: Boolean(result.iceRestart),
      });
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

  useEffect(() => {
    handlersRef.current = {
      closePeer,
      createOffer,
      handleSignal,
      leaveCall,
      reconcileRoster,
      syncTiles,
    };
  });

  useEffect(() => {
    const socket = getLiveSocket();

    const onRoster = ({ peers }) => {
      const next = Array.isArray(peers) ? peers : [];
      rosterRef.current = next;
      setRoster(next);
      if (inCallRef.current) handlersRef.current.reconcileRoster(next);
      else handlersRef.current.syncTiles();
    };

    const onPeerJoined = async ({ peer }) => {
      if (!peer?.socketId) return;
      if (iceRefreshDue(getIceSession(iceCallKeyRef.current))) {
        iceConfigRef.current = await getIceConfig({
          force: true,
          callKey: iceCallKeyRef.current,
          token: iceTokenRef.current,
          callType: "event",
          direction: "join",
        });
      }
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

    const rejoinEvent = () => {
      if (!inCallRef.current) return;
      socket.emit(
        "call_join",
        { eventId, mode: modeRef.current === "audio" ? "audio" : "video" },
        (ack) => {
          if (!ack?.success) {
            if (/ended|access|not found/i.test(ack?.message || "")) {
              handlersRef.current.leaveCall(false);
              setError(ack?.message || "The call ended.");
            }
            return;
          }
          const peers = ack.peers || [];
          rosterRef.current = ack.self ? [...peers, ack.self] : peers;
          setRoster(rosterRef.current);
          handlersRef.current.reconcileRoster(peers);
        }
      );
    };
    const stopNetworkWatch = watchNetworkChanges(() => {
      for (const peer of peersRef.current.values()) {
        if (recoveryNeededAfterNetworkChange(peer.pc)) peer.stopIceRecovery?.request?.();
      }
    });

    socket.emit("call_sync", { eventId }, (ack) => {
      if (!ack?.peers) return;
      rosterRef.current = ack.peers;
      setRoster(ack.peers);
      if (inCallRef.current) handlersRef.current.reconcileRoster(ack.peers);
    });
    socket.on("connect", rejoinEvent);

    socket.on("call_roster", onRoster);
    socket.on("call_peer_joined", onPeerJoined);
    socket.on("call_peer_left", onPeerLeft);
    socket.on("call_presence", onPresence);
    socket.on("call_signal", onSignal);
    socket.on("call_ended", onCallEnded);

    return () => {
      stopNetworkWatch();
      socket.off("connect", rejoinEvent);
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
  const suggested = callMode === "audio" ? "audio" : callMode === "video" ? "video" : "";
  const roomHint =
    callMode === "audio"
      ? "Voice only. The camera stays off."
      : callMode === "video"
        ? "Camera and microphone are part of this room."
        : "Commentary chat stays open. Joining a call is optional.";

  if (!isRouteActive && !inCall && !joining) return null;

  return (
    <div
      ref={callWindowRef}
      style={windowPosition || undefined}
      className={`fixed z-[70] w-[min(24rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-fo-border bg-fo-surface text-fo-text shadow-2xl ${
        windowPosition ? "left-0 top-0" : "bottom-20 right-3 sm:bottom-4 sm:right-4"
      }`}
    >
      <div
        onPointerDown={startWindowDrag}
        onPointerMove={moveWindow}
        onPointerUp={stopWindowDrag}
        onPointerCancel={stopWindowDrag}
        className="flex items-center gap-2 border-b border-fo-border bg-fo-surface px-4 py-3 text-xs text-fo-muted touch-none cursor-grab active:cursor-grabbing"
      >
        {(inCall ? mode : callMode) === "audio" ? (
          <Phone size={14} className="text-fo-accent" />
        ) : (
          <Video size={14} className="text-fo-accent" />
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">
          {eventTitle || "Live event call"}
        </span>
        <span className="shrink-0 text-fo-subtle">
          {inCall
            ? mode === "audio"
              ? "Audio"
              : "Video"
            : callMode === "audio"
              ? "Audio"
              : callMode === "video"
                ? "Video"
                : "Call"}
        </span>
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
              {roomHint} Up to 6 people can talk at once.
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
            {callMode === "audio" ? null : (
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
            )}
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
            {showVideoJoinControl({ isLive, inCall, authorized, callMode }) ? (
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
            {showAudioJoinControl({ isLive, inCall, authorized, callMode }) ? (
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
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

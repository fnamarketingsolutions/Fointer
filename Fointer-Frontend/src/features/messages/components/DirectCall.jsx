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
  LuMaximize2 as Maximize,
  LuMic as Mic,
  LuMicOff as MicOff,
  LuMinimize2 as Minimize,
  LuPhone as Phone,
  LuPhoneOff as PhoneOff,
  LuVideo as Video,
  LuVideoOff as VideoOff,
} from "react-icons/lu";
import { getLiveSocket } from "../../../shared/services/liveSocket";
import ProfileAvatar from "../../../shared/components/ProfileAvatar";
import CallTile from "../../../shared/components/CallTile";
import { useAuth } from "../../../context/AuthContext";
import { getIceConfig, validateIceConfig } from "../../../shared/webrtc/iceServers";
import { watchPeerConnection } from "../../../shared/webrtc/iceRestart";
import {
  callLinkFailureMessage,
  callLinkLabel,
  deriveCallLink,
  MEDIA_CONNECT_FAILURE,
} from "../../../shared/webrtc/callLink";
import { assessMediaHealth, emptyMediaStats, readSafeCallStats, toPublicMediaLog } from "../../../shared/webrtc/callStats";
import { logCallDiagnostic } from "../../../shared/webrtc/callDiagnostics";
import { createSignalCourier } from "../../../shared/webrtc/signalDelivery";
import { recoveryNeededAfterNetworkChange, watchNetworkChanges } from "../../../shared/webrtc/networkRecovery";
import { applyPeerSignal } from "../../../shared/webrtc/applyPeerSignal";
import {
  callPhaseCanSignal,
  createIceQueue,
  enqueueSerial,
} from "../../../shared/webrtc/iceQueue";
import { addRemoteTracks } from "../../../shared/webrtc/remoteTracks";
import {
  closeCallPushNotification,
  createCallRingtone,
} from "../utils/callRing";
import { setDmCallBusy, isRetiredDmCall, retireDmCall } from "../utils/dmCallActivity";
import { shouldApplyEnd, shouldIgnoreSignal, shouldStartRing } from "../../../shared/webrtc/callSession";
import {
  applyRemoteCameraState,
  attachVideoTrack,
  cameraControlLabel,
  cameraPresencePayload,
  disableLocalCamera,
  enableLocalCamera,
  queuePeerRenegotiation,
  watchRemoteTrack,
} from "../../../shared/webrtc/mediaSwitch";
import {
  DELETED_USER_LABEL,
  personDisplayName,
} from "../../../shared/utils/personDisplay";

const DirectCall = forwardRef(function DirectCall(
  { conversationId, otherUser, disabled = false },
  ref
) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | ringing_out | ringing_in | connecting | active
  const [mode, setMode] = useState("audio");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [error, setError] = useState("");
  const [tiles, setTiles] = useState([]);
  const [incomingFrom, setIncomingFrom] = useState(null);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [previewPosition, setPreviewPosition] = useState(null);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [windowPosition, setWindowPosition] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const phaseRef = useRef(phase);
  const modeRef = useRef(mode);
  const conversationIdRef = useRef(conversationId);
  const makingOfferRef = useRef(new Set());
  const handlersRef = useRef({});
  const stopRingRef = useRef(null);
  const callActionHandledRef = useRef("");
  const earlySignalsRef = useRef([]);
  const signalChainRef = useRef({ chain: Promise.resolve() });
  const startRingtoneRef = useRef(null);
  const callIdRef = useRef("");
  const syncGenRef = useRef(0);
  const cameraBusyRef = useRef(false);
  const iceConfigRef = useRef(null);
  const previewRef = useRef(null);
  const previewStageRef = useRef(null);
  const previewDragRef = useRef(null);
  const suppressPreviewClickRef = useRef(false);
  const callWindowRef = useRef(null);
  const windowDragRef = useRef(null);
  const sampleStatsRef = useRef(async () => {});
  const [signalCourier] = useState(() => createSignalCourier({
    isActive: () => phaseRef.current !== "idle",
    onFailure: ({ type, reason }) => {
      logCallDiagnostic({
        callId: callIdRef.current,
        phase: phaseRef.current,
        signalType: type,
        delivery: reason === "timeout" ? "server_timeout" : "server_rejected",
      });
    },
    emit: (message, ack) => {
      const signalType = message?.type || "";
      getLiveSocket().timeout(1500).emit(
        "dm_call_signal",
        {
          conversationId: conversationIdRef.current,
          callId: callIdRef.current,
          ...message,
        },
        (err, body) => {
          if (!err && body?.success && signalType !== "ice") {
            logCallDiagnostic({
              callId: callIdRef.current,
              phase: phaseRef.current,
              signalType,
              delivery: body.queued ? "server_queued" : "server_ack",
            });
          }
          ack(err ? { success: false, message: "timeout" } : body);
        }
      );
    },
  }));

  modeRef.current = mode;
  conversationIdRef.current = conversationId;

  useEffect(() => {
    const status = deriveCallLink({
      phase,
      peers: tiles.filter((tile) => !tile.isLocal),
    });
    setError((current) => {
      if (status === "failed") return callLinkFailureMessage(status) || MEDIA_CONNECT_FAILURE;
      if (current === MEDIA_CONNECT_FAILURE) return "";
      return current;
    });
  }, [phase, tiles]);

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
  startRingtoneRef.current = startRingtone;

  const stopLocal = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }, []);

  const closePeer = useCallback((socketId) => {
    const peer = peersRef.current.get(socketId);
    if (!peer) return;
    peer.stopIceRecovery?.();
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
        avatar: user?.avatar || "",
        mode: modeRef.current,
        mic: !local.getAudioTracks().some((track) => !track.enabled),
        camera: local.getVideoTracks().some(
          (track) => track.readyState === "live" && track.enabled !== false
        ),
        stream: local,
        isLocal: true,
      });
    }
    for (const peer of peersRef.current.values()) {
      next.push({
        socketId: peer.socketId,
        name: peer.name,
        username: peer.username,
        avatar: peer.avatar || otherUser?.avatar || "",
        mode: peer.mode,
        mic: peer.mic,
        camera: peer.camera,
        stream: peer.stream,
        streamVersion: peer.streamVersion || 0,
        connectionState: peer.connectionState || "",
        iceConnectionState: peer.iceConnectionState || "",
        networkStatus: peer.networkStatus || "",
        everConnected: peer.everConnected === true,
        mediaStats: peer.mediaStats || null,
        isLocal: false,
      });
    }
    setTiles(next);
  }, [otherUser?.avatar, user?.avatar]);

  const resetCallUi = useCallback(
    (message = "") => {
      stopRingtone();
      closeCallPushNotification(conversationIdRef.current);
      closeAllPeers();
      stopLocal();
      earlySignalsRef.current = [];
      phaseRef.current = "idle";
      signalCourier.cancelPending();
      if (callIdRef.current) retireDmCall(callIdRef.current);
      callIdRef.current = "";
      setDmCallBusy(false);
      setPhase("idle");
      setIncomingFrom(null);
      setError(message);
      setMuted(false);
      setCameraOff(false);
      setTiles([]);
      setLocalExpanded(false);
      setPreviewPosition(null);
      setVideoExpanded(false);
      setWindowPosition(null);
      makingOfferRef.current.clear();
    },
    [closeAllPeers, signalCourier, stopLocal, stopRingtone]
  );

  const sendSignal = useCallback((to, payload) => {
    signalCourier.send({ to, ...payload });
  }, [signalCourier]);

  const ensurePeer = useCallback(
    (remote) => {
      if (!remote?.socketId) return null;
      if (peersRef.current.has(remote.socketId)) {
        const existing = peersRef.current.get(remote.socketId);
        if (remote.name) existing.name = remote.name;
        if (remote.username) existing.username = remote.username;
        if (remote.avatar) existing.avatar = remote.avatar;
        if (remote.mode) existing.mode = remote.mode;
        if (typeof remote.mic === "boolean") existing.mic = remote.mic;
        if (typeof remote.camera === "boolean") existing.camera = remote.camera;
        return existing;
      }

      const iceConfig = iceConfigRef.current;
      if (!validateIceConfig(iceConfig, { production: Boolean(import.meta.env?.PROD) }).ok) {
        return null;
      }
      const pc = new RTCPeerConnection(iceConfig || undefined);
      const stream = new MediaStream();
      const myId = String(getLiveSocket().id || "");
      const polite = myId < String(remote.socketId);

      const peer = {
        socketId: remote.socketId,
        name: personDisplayName(remote, "") ||
          personDisplayName(otherUser, "Caller"),
        username: remote.username || otherUser?.username || "",
        avatar: remote.avatar || otherUser?.avatar || "",
        mode: remote.mode || modeRef.current,
        mic: remote.mic !== false,
        camera: remote.camera !== false,
        pc,
        stream,
        streamVersion: 0,
        connectionState: "new",
        iceConnectionState: "new",
        networkStatus: "connecting",
        mediaStats: emptyMediaStats(),
        polite,
        ignoreOffer: false,
        iceQueue: createIceQueue(),
        iceGeneration: 0,
      };

      const local = localStreamRef.current;
      if (local) {
        local.getTracks().forEach((track) => {
          pc.addTrack(track, local);
        });
      }

      let lastStateLog = "";
      const logTransport = () => {
        const signature = [
          phaseRef.current,
          pc.signalingState,
          pc.connectionState,
          pc.iceConnectionState,
          peer.mediaStats?.candidate?.localType || "",
          peer.mediaStats?.candidate?.relayProtocol || "",
        ].join("|");
        if (signature === lastStateLog) return;
        lastStateLog = signature;
        logCallDiagnostic({
          callId: callIdRef.current,
          phase: phaseRef.current,
          signalingState: pc.signalingState,
          connectionState: pc.connectionState,
          iceConnectionState: pc.iceConnectionState,
          localCandidateType: peer.mediaStats?.candidate?.localType || "",
          remoteCandidateType: peer.mediaStats?.candidate?.remoteType || "",
          relayProtocol: peer.mediaStats?.candidate?.relayProtocol || "",
        });
      };
      const noteTransport = (state) => {
        if (state === "connected" || state === "completed") {
          peer.everConnected = true;
          peer.networkStatus = "connected";
          return;
        }
        if (state === "failed" || (state === "disconnected" && peer.everConnected)) {
          peer.networkStatus = "reconnecting";
        }
      };

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal(remote.socketId, {
          type: "ice",
          generation: peer.iceGeneration || 0,
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
        });
      };

      pc.onconnectionstatechange = () => {
        peer.connectionState = pc.connectionState;
        noteTransport(pc.connectionState);
        logTransport();
        if (pc.connectionState === "connected" || pc.connectionState === "failed") {
          void sampleStatsRef.current();
        }
        syncTiles();
      };
      peer.stopIceRecovery = watchPeerConnection(pc, {
        polite,
        retryInitialOffer: true,
        isActive: () => phaseRef.current !== "idle",
        onStatus: (status) => {
          peer.networkStatus = status;
          logTransport();
          syncTiles();
        },
        sendOffer: (description, meta) => {
          if (meta?.resend) {
            if (!peer.localOfferMessageId) {
              peer.localOfferMessageId = `offer_${callIdRef.current || "call"}_${remote.socketId}`;
            }
            sendSignal(remote.socketId, {
              type: "offer",
              sdp: description,
              generation: peer.iceGeneration || 0,
              messageId: peer.localOfferMessageId,
            });
            return;
          }
          peer.iceGeneration = (peer.iceGeneration || 0) + 1;
          peer.localOfferMessageId = "";
          signalCourier.dropOlder(peer.iceGeneration);
          sendSignal(remote.socketId, {
            type: "offer",
            sdp: description,
            generation: peer.iceGeneration,
          });
        },
      });

      pc.oniceconnectionstatechange = () => {
        peer.iceConnectionState = pc.iceConnectionState;
        noteTransport(pc.iceConnectionState);
        if (["connected", "completed"].includes(pc.iceConnectionState)) {
          void sampleStatsRef.current();
        }
        logTransport();
        syncTiles();
      };

      pc.onicecandidateerror = (event) => {
        console.info("[dm-call] media", {
          event: "ice_candidate_error",
          code: event.errorCode || null,
        });
      };

      pc.ontrack = (event) => {
        addRemoteTracks(peer.stream, event);
        const tracks = event.track ? [event.track] : [];
        for (const track of tracks) watchRemoteTrack(track, peer, syncTiles);
        peer.streamVersion += 1;
        if (
          event.track?.kind === "video" &&
          event.track.muted !== true &&
          event.track.readyState === "live"
        ) {
          peer.camera = true;
          peer.mode = "video";
        }
        syncTiles();
      };

      peer.stream.onremovetrack = () => {
        peer.streamVersion += 1;
        syncTiles();
      };

      peersRef.current.set(remote.socketId, peer);
      return peer;
    },
    [otherUser, sendSignal, signalCourier, syncTiles]
  );

  const createOffer = useCallback(
    async (remote) => {
      const peer = ensurePeer(remote);
      if (!peer) return;
      try {
        makingOfferRef.current.add(remote.socketId);
        const offer = await peer.pc.createOffer();
        await peer.pc.setLocalDescription(offer);
        if (!peer.localOfferMessageId) {
          peer.localOfferMessageId = `offer_${callIdRef.current || "call"}_${remote.socketId}`;
        }
        sendSignal(remote.socketId, {
          type: "offer",
          sdp: peer.pc.localDescription,
          generation: peer.iceGeneration || 0,
          messageId: peer.localOfferMessageId,
        });
      } catch {
        setError("Could not connect the call.");
      } finally {
        makingOfferRef.current.delete(remote.socketId);
      }
    },
    [ensurePeer, sendSignal]
  );

  const applySignal = useCallback(
    async ({ from, type, sdp, candidate, callId, messageId, generation }) => {
      if (shouldIgnoreSignal({ activeCallId: callIdRef.current, signalCallId: callId })) {
        return;
      }
      if (!from) return;
      if (!callPhaseCanSignal(phaseRef.current) || !localStreamRef.current) {
        return;
      }
      const peer = ensurePeer({ socketId: from });
      if (!peer) return;
      try {
        const applied = await applyPeerSignal(
          peer,
          { type, sdp, candidate, messageId, generation },
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
        if (applied && (type === "offer" || type === "answer")) {
          logCallDiagnostic({
            callId: callIdRef.current,
            phase: phaseRef.current,
            signalingState: peer.pc.signalingState,
            connectionState: peer.pc.connectionState,
            iceConnectionState: peer.pc.iceConnectionState,
            signalType: type,
            delivery: "applied",
          });
        }
        syncTiles();
      } catch {
        /* ignore stale signaling */
      }
    },
    [ensurePeer, sendSignal, syncTiles]
  );

  const flushEarlySignals = useCallback(() => {
    if (!callPhaseCanSignal(phaseRef.current) || !localStreamRef.current) return;
    const queued = earlySignalsRef.current.splice(0);
    for (const item of queued) {
      enqueueSerial(signalChainRef.current, () => applySignal(item));
    }
  }, [applySignal]);

  const setCallPhase = useCallback(
    (next) => {
      phaseRef.current = next;
      setPhase(next);
      setDmCallBusy(next !== "idle");
      if (next === "idle") {
        earlySignalsRef.current = [];
        return;
      }
      flushEarlySignals();
    },
    [flushEarlySignals]
  );

  const handleSignal = useCallback(
    (payload) => {
      if (!payload?.from) return;
      if (phaseRef.current === "idle") return;
      const item = {
        from: payload.from,
        type: payload.type,
        sdp: payload.sdp,
        candidate: payload.candidate,
        callId: payload.callId,
        messageId: payload.messageId,
        generation: payload.generation,
      };
      if (!callPhaseCanSignal(phaseRef.current) || !localStreamRef.current) {
        earlySignalsRef.current.push(item);
        return;
      }
      enqueueSerial(signalChainRef.current, () => applySignal(item));
    },
    [applySignal]
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
      setCallPhase("active");
      syncTiles();
      flushEarlySignals();
      await signalChainRef.current.chain;
      const myId = String(getLiveSocket().id || "");
      for (const peer of peers) {
        if (myId > String(peer.socketId)) {
          await enqueueSerial(signalChainRef.current, () => createOffer(peer));
        } else {
          ensurePeer(peer);
        }
      }
      syncTiles();
    },
    [createOffer, ensurePeer, flushEarlySignals, setCallPhase, stopRingtone, syncTiles]
  );

  const endCall = useCallback(
    (emitLeave = true, reasonMessage = "") => {
      if (emitLeave && conversationIdRef.current) {
        const socket = getLiveSocket();
        if (phaseRef.current === "ringing_out") {
          socket.emit("dm_call_cancel", {
            conversationId: conversationIdRef.current,
            callId: callIdRef.current,
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
            callId: callIdRef.current,
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
      const socket = getLiveSocket();
      if (!socket.connected) {
        resetCallUi("Realtime is reconnecting. Please try the call again.");
        return;
      }
      setCallPhase("connecting");
      try {
        iceConfigRef.current = await getIceConfig();
      } catch (err) {
        resetCallUi(
          err?.name === "TurnUnavailableError"
            ? err.message
            : "Reliable calling is temporarily unavailable. Please try again in a moment."
        );
        return;
      }
      try {
        await acquireMedia(nextMode);
        flushEarlySignals();
        socket.timeout(15_000).emit(
          "dm_call_invite",
          { conversationId, mode: nextMode },
          (timeoutError, ack) => {
            if (timeoutError) {
              resetCallUi("The call request timed out. Check your connection and try again.");
              return;
            }
            if (!ack?.success) {
              resetCallUi(ack?.message || "Could not start the call.");
              return;
            }
            if (phaseRef.current === "idle") return;
            callIdRef.current = ack.callId || "";
            setCallPhase("ringing_out");
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
    [acquireMedia, conversationId, disabled, flushEarlySignals, resetCallUi, setCallPhase, syncTiles]
  );

  const acceptIncoming = useCallback(async () => {
    if (phaseRef.current !== "ringing_in" || !conversationId) return;
    setError("");
    setCallPhase("connecting");
    try {
      iceConfigRef.current = await getIceConfig();
    } catch (err) {
      setCallPhase("ringing_in");
      setError(
        err?.name === "TurnUnavailableError"
          ? err.message
          : "Reliable calling is temporarily unavailable. Please try again in a moment."
      );
      return;
    }
    try {
      await acquireMedia(modeRef.current);
      flushEarlySignals();
      const socket = getLiveSocket();
      socket.emit("dm_call_accept", { conversationId, callId: callIdRef.current }, async (ack) => {
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
  }, [acquireMedia, connectToPeers, conversationId, endCall, flushEarlySignals, resetCallUi, setCallPhase]);

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
    applySignal,
    connectToPeers,
    endCall,
    resetCallUi,
    syncTiles,
    acceptIncoming,
    setCallPhase,
  };

  useEffect(() => {
    if (!conversationId) return undefined;
    const socket = getLiveSocket();
    const matches = (payload) =>
      String(payload?.conversationId || "") === String(conversationId);

    const onIncoming = (payload) => {
      if (!matches(payload) || !payload.callId || isRetiredDmCall(payload.callId)) return;
      if (payload.callId === callIdRef.current && phaseRef.current !== "idle") return;
      if (phaseRef.current !== "idle" && phaseRef.current !== "ringing_in") return;
      syncGenRef.current += 1;
      callIdRef.current = payload.callId;
      modeRef.current = payload.mode === "video" ? "video" : "audio";
      setMode(modeRef.current);
      setIncomingFrom(payload.from || null);
      handlersRef.current.setCallPhase("ringing_in");
      setError("");
      startRingtoneRef.current?.();
    };

    const onAccepted = async (payload) => {
      if (!matches(payload)) return;
      if (shouldIgnoreSignal({ activeCallId: callIdRef.current, signalCallId: payload.callId })) return;
      if (phaseRef.current !== "ringing_out") return;
      const peer = payload.peer;
      phaseRef.current = "connecting";
      handlersRef.current.setCallPhase("connecting");
      await handlersRef.current.connectToPeers(peer ? [peer] : []);
    };

    const onEnded = (payload) => {
      if (!matches(payload)) return;
      if (payload?.callId) retireDmCall(payload.callId);
      syncGenRef.current += 1;
      // Starting the next call clears the previous one. Don't tear the new attempt down.
      if (phaseRef.current === "connecting" && !callIdRef.current) return;
      if (!shouldApplyEnd({
        activeCallId: callIdRef.current,
        endedCallId: payload?.callId,
        phase: phaseRef.current,
      })) {
        return;
      }
      const reason = payload?.reason;
      const message =
        reason === "rejected"
          ? "Call declined."
          : reason === "cancelled" || reason === "missed"
            ? "Call cancelled."
            : "Call ended.";
      handlersRef.current.resetCallUi(message);
    };

    const syncCall = () => {
      const generation = ++syncGenRef.current;
      socket.emit("dm_call_sync", { conversationId }, (ack) => {
        if (generation !== syncGenRef.current) return;
        if (!ack?.success) return;
        const call = ack.call;
        if (!call) closeCallPushNotification(conversationId);
        if (
          phaseRef.current === "ringing_in" &&
          call?.callId &&
          call.callId === callIdRef.current
        ) {
          return;
        }
        const phaseForStart = phaseRef.current === "ringing_in" ? "idle" : phaseRef.current;
        if (!shouldStartRing({ phase: phaseForStart, call, retired: { has: isRetiredDmCall } })) {
          if (phaseRef.current === "ringing_in") {
            handlersRef.current.resetCallUi("");
          }
          return;
        }
        callIdRef.current = call.callId;
        modeRef.current = call.mode === "video" ? "video" : "audio";
        setMode(modeRef.current);
        setIncomingFrom(call.from || null);
        handlersRef.current.setCallPhase("ringing_in");
        startRingtoneRef.current?.();
      });
    };

    const onPeerLeft = (payload) => {
      if (!matches(payload)) return;
      handlersRef.current.closePeer(payload.socketId);
      handlersRef.current.resetCallUi("Call ended.");
    };

    const onPresence = (payload) => {
      if (!matches(payload)) return;
      if (shouldIgnoreSignal({ activeCallId: callIdRef.current, signalCallId: payload.callId })) return;
      const peer = peersRef.current.get(payload.socketId);
      if (!peer) return;
      if (typeof payload.mic === "boolean" || typeof payload.camera === "boolean" || payload.mode) {
        applyRemoteCameraState(peer, payload);
      }
      handlersRef.current.syncTiles();
    };

    const onSignal = (payload) => {
      if (!matches(payload)) return;
      if (shouldIgnoreSignal({ activeCallId: callIdRef.current, signalCallId: payload.callId })) return;
      handlersRef.current.handleSignal(payload);
    };

    const rejoinCall = () => {
      if (!callIdRef.current) return;
      if (phaseRef.current !== "active" && phaseRef.current !== "connecting") return;
      socket.emit(
        "dm_call_rejoin",
        { conversationId, callId: callIdRef.current },
        (ack) => {
          if (ack?.success) {
            const mine = new Set((ack.peers || []).map((peer) => peer.socketId));
            for (const socketId of [...peersRef.current.keys()]) {
              if (!mine.has(socketId)) handlersRef.current.closePeer(socketId);
            }
            handlersRef.current.connectToPeers(ack.peers || []);
            return;
          }
          if (/ended|not in this call|do not have access/i.test(ack?.message || "")) {
            handlersRef.current.resetCallUi(ack?.message || "Call ended.");
          }
        }
      );
    };

    const onReplaced = (payload) => {
      if (!matches(payload)) return;
      if (shouldIgnoreSignal({ activeCallId: callIdRef.current, signalCallId: payload.callId })) return;
      if (!payload.previousSocketId || !payload.peer?.socketId) return;
      handlersRef.current.closePeer(payload.previousSocketId);
      handlersRef.current.connectToPeers([payload.peer]);
    };

    const stopNetworkWatch = watchNetworkChanges(() => {
      for (const peer of peersRef.current.values()) {
        if (recoveryNeededAfterNetworkChange(peer.pc)) peer.stopIceRecovery?.request?.();
      }
    });

    socket.emit("join_conversation", { conversationId }, () => {
      syncCall();
      rejoinCall();
    });
    socket.on("connect", syncCall);
    socket.on("connect", rejoinCall);
    socket.on("dm_call_peer_replaced", onReplaced);

    socket.on("dm_call_incoming", onIncoming);
    socket.on("dm_call_accepted", onAccepted);
    socket.on("dm_call_ended", onEnded);
    socket.on("dm_call_peer_left", onPeerLeft);
    socket.on("dm_call_presence", onPresence);
    socket.on("dm_call_signal", onSignal);

    return () => {
      stopNetworkWatch();
      socket.off("dm_call_incoming", onIncoming);
      socket.off("dm_call_accepted", onAccepted);
      socket.off("dm_call_ended", onEnded);
      socket.off("dm_call_peer_left", onPeerLeft);
      socket.off("dm_call_peer_replaced", onReplaced);
      socket.off("dm_call_presence", onPresence);
      socket.off("dm_call_signal", onSignal);
      socket.off("connect", syncCall);
      socket.off("connect", rejoinCall);
      if (phaseRef.current !== "idle") {
        handlersRef.current.endCall(true);
      }
    };
  }, [conversationId]);

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

  useEffect(() => {
    if (phase !== "active" && phase !== "connecting") return undefined;
    let stopped = false;
    let lastSignature = "";
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
          peer.networkStatus = health.status;
        }
        const flow = `${summary.connectionState}:${summary.iceConnectionState}:${summary.audio?.receiving}:${summary.video?.receiving}`;
        const previousFlow = `${previous?.connectionState}:${previous?.iceConnectionState}:${previous?.audio?.receiving}:${previous?.video?.receiving}`;
        if (flow !== previousFlow) changed = true;
        const now = Date.now();
        if (flow !== lastSignature || now - lastLoggedAt >= 15_000) {
          lastSignature = flow;
          lastLoggedAt = now;
          console.info("[dm-call] media", toPublicMediaLog(summary));
        }
        const pair = [
          summary.candidate?.localType || "",
          summary.candidate?.remoteType || "",
          summary.candidate?.relayProtocol || "",
        ].join("|");
        if (pair !== "||" && pair !== peer.lastLoggedPair) {
          peer.lastLoggedPair = pair;
          logCallDiagnostic({
            callId: callIdRef.current,
            phase: phaseRef.current,
            signalingState: peer.pc?.signalingState || "",
            connectionState: summary.connectionState,
            iceConnectionState: summary.iceConnectionState,
            localCandidateType: summary.candidate?.localType || "",
            remoteCandidateType: summary.candidate?.remoteType || "",
            relayProtocol: summary.candidate?.relayProtocol || "",
          });
        }
      }
      if (changed && !stopped) syncTiles();
    };

    sampleStatsRef.current = sample;
    const timer = setInterval(() => {
      void sample();
    }, 5000);
    void sample();
    return () => {
      stopped = true;
      sampleStatsRef.current = async () => {};
      clearInterval(timer);
    };
  }, [phase, syncTiles]);

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

  const publishCamera = (cameraOn) => {
    const payload = cameraPresencePayload(cameraOn);
    modeRef.current = payload.mode;
    setMode(payload.mode);
    setCameraOff(!cameraOn);
    getLiveSocket().emit("dm_call_presence", {
      conversationId: conversationIdRef.current,
      callId: callIdRef.current,
      ...payload,
    });
    syncTiles();
  };

  const renegotiatePeers = () =>
    queuePeerRenegotiation({
      peers: peersRef.current,
      chain: signalChainRef.current,
      makingOffer: makingOfferRef.current,
      isActive: () => phaseRef.current !== "idle",
      sendOffer: (socketId, description) => {
        sendSignal(socketId, { type: "offer", sdp: description });
      },
      onError: () => setError("Video update failed. Audio is still connected."),
    });

  const turnCameraOn = async () => {
    if (cameraBusyRef.current || phaseRef.current !== "active") return;
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
      if (phaseRef.current !== "active") {
        result.track?.stop?.();
        return;
      }
      if (!result.ok) {
        setError(result.message);
        return;
      }
      result.track.onended = () => {
        if (cameraBusyRef.current) return;
        const stillThere = localStreamRef.current
          ?.getVideoTracks()
          .some((track) => track.id === result.track.id);
        if (stillThere) void turnCameraOff();
      };
      publishCamera(true);
      await renegotiatePeers();
    } finally {
      cameraBusyRef.current = false;
      setCameraBusy(false);
      syncTiles();
    }
  };

  const turnCameraOff = async () => {
    if (cameraBusyRef.current || phaseRef.current === "idle") return;
    if (!localStreamRef.current) return;
    const hasLiveVideo = localStreamRef.current
      .getVideoTracks()
      .some((track) => track.readyState === "live");
    if (!hasLiveVideo && modeRef.current !== "video") return;
    cameraBusyRef.current = true;
    setCameraBusy(true);
    try {
      await disableLocalCamera({
        localStream: localStreamRef.current,
        peerConnections: [...peersRef.current.values()].map((peer) => peer.pc),
      });
      if (phaseRef.current === "idle") return;
      publishCamera(false);
      await renegotiatePeers();
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

  const startPreviewDrag = (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const stageRect = previewStageRef.current?.getBoundingClientRect();
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left - (stageRect?.left || 0),
      top: rect.top - (stageRect?.top || 0),
      moved: false,
    };
    suppressPreviewClickRef.current = false;
    setPreviewPosition({ left: rect.left, top: rect.top });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const movePreview = (event) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;

    const preview = previewRef.current;
    const width = preview?.offsetWidth || 160;
    const height = preview?.offsetHeight || 90;
    const stage = previewStageRef.current;
    setPreviewPosition({
      left: Math.max(8, Math.min((stage?.clientWidth || window.innerWidth) - width - 8, drag.left + deltaX)),
      top: Math.max(8, Math.min((stage?.clientHeight || window.innerHeight) - height - 8, drag.top + deltaY)),
    });
  };

  const stopPreviewDrag = (event) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    suppressPreviewClickRef.current = drag.moved;
    previewDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const startWindowDrag = (event) => {
    if (videoExpanded || event.target.closest("button")) return;
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

  if (phase === "idle" && !error) return null;

  const linkStatus = deriveCallLink({
    phase,
    peers: tiles.filter((tile) => !tile.isLocal),
  });
  const linkLabel = callLinkLabel(linkStatus);

  const otherLabel =
    personDisplayName(incomingFrom, "") ||
    personDisplayName(otherUser, DELETED_USER_LABEL);
  const localTile = tiles.find((tile) => tile.isLocal);
  const remoteTile = tiles.find((tile) => !tile.isLocal);

  if (phase === "active" && mode === "video" && localTile && remoteTile) {
    const mainTile = localExpanded ? localTile : remoteTile;
    const previewTile = localExpanded ? remoteTile : localTile;
    const controlButtonClass = videoExpanded
      ? "inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25"
      : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-fo-border px-3 py-2 text-xs text-fo-text hover:border-fo-accent/40";

    return (
      <div
        ref={callWindowRef}
        style={!videoExpanded && windowPosition ? windowPosition : undefined}
        className={videoExpanded
          ? "fixed inset-0 z-[70] overflow-hidden bg-black text-white"
          : `fixed z-[70] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-fo-border bg-fo-surface text-white shadow-2xl ${windowPosition ? "left-0 top-0" : "bottom-20 right-3 sm:bottom-4 sm:right-4"}`}
      >
        <div
          onPointerDown={startWindowDrag}
          onPointerMove={moveWindow}
          onPointerUp={stopWindowDrag}
          onPointerCancel={stopWindowDrag}
          className={`z-10 flex items-start justify-between gap-3 px-4 py-3 touch-none ${videoExpanded ? "absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pt-[max(1rem,env(safe-area-inset-top))] sm:px-6" : "cursor-grab border-b border-fo-border bg-fo-surface active:cursor-grabbing"}`}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fo-text">
              {mainTile.name || (mainTile.isLocal ? "You" : otherLabel)}
            </p>
            <p className={`mt-0.5 text-xs ${videoExpanded ? "text-white/70" : "text-fo-subtle"}`}>
              {cameraBusy ? "Updating camera…" : linkLabel || "Video call"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {error ? <p className="max-w-[10rem] text-right text-xs text-red-300">{error}</p> : null}
            <button
              type="button"
              onClick={() => {
                setVideoExpanded((expanded) => !expanded);
                setPreviewPosition(null);
                setWindowPosition(null);
              }}
              aria-label={videoExpanded ? "Minimize video call" : "Expand video call"}
              title={videoExpanded ? "Minimize" : "Expand"}
              className={videoExpanded
                ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
                : "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-fo-border text-fo-muted hover:text-fo-text"}
            >
              {videoExpanded ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>

        <div
          ref={previewStageRef}
          className={videoExpanded ? "absolute inset-0 overflow-hidden" : "relative aspect-video min-h-[160px] overflow-hidden bg-black"}
        >
          <CallTile
            peer={mainTile}
            isLocal={mainTile.isLocal}
            fallbackLabel="Caller"
            size={videoExpanded ? "full" : "md"}
            mirror={mainTile.isLocal}
          />

          <button
            ref={previewRef}
            type="button"
            aria-label={`Make ${previewTile.isLocal ? "your camera" : "their camera"} the main view`}
            title="Click to enlarge; drag to move"
            onPointerDown={startPreviewDrag}
            onPointerMove={movePreview}
            onPointerUp={stopPreviewDrag}
            onPointerCancel={stopPreviewDrag}
            onClick={() => {
              if (suppressPreviewClickRef.current) {
                suppressPreviewClickRef.current = false;
                return;
              }
              setLocalExpanded((expanded) => !expanded);
            }}
            style={previewPosition || undefined}
            className={`absolute z-20 block aspect-video w-28 touch-none cursor-grab overflow-hidden rounded-xl border border-white/60 bg-black shadow-2xl active:cursor-grabbing sm:w-36 ${
              previewPosition
                ? "left-0 top-0"
                : "right-3 top-3"
            }`}
          >
            <CallTile
              peer={previewTile}
              isLocal={previewTile.isLocal}
              fallbackLabel="Caller"
              size="pip"
              mirror={previewTile.isLocal}
            />
          </button>
        </div>

        <div className={videoExpanded
          ? "absolute inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-black/75 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-12"
          : "flex justify-center gap-2 px-3 py-3"}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              title={muted ? "Unmute" : "Mute"}
              className={controlButtonClass}
            >
              {muted ? <MicOff size={18} /> : <Mic size={18} />}
              {!videoExpanded ? (muted ? "Unmute" : "Mute") : null}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              disabled={cameraBusy}
              aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}
              title={cameraControlLabel({ cameraOn: !cameraOff, busy: cameraBusy })}
              className={`${controlButtonClass} disabled:opacity-60`}
            >
              {cameraBusy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : cameraOff ? (
                <VideoOff size={18} />
              ) : (
                <Video size={18} />
              )}
              {!videoExpanded ? (cameraOff ? "Camera on" : "Camera off") : null}
            </button>
            <button
              type="button"
              onClick={() => endCall(true)}
              aria-label="End call"
              title="End call"
              className={videoExpanded
                ? "inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg hover:bg-red-500"
                : "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs text-white hover:bg-red-500"}
            >
              <PhoneOff size={videoExpanded ? 22 : 16} />
              {!videoExpanded ? "End" : null}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        {error ? <p className="relative mt-3 max-w-sm text-center text-sm text-red-300">{error}</p> : null}
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
      <div className="fixed bottom-20 sm:bottom-4 right-3 sm:right-4 z-[70] w-[min(24rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-fo-border bg-fo-surface shadow-2xl">
      <div className="px-4 py-2.5 border-b border-fo-border flex items-center gap-2 text-xs text-fo-muted">
        {mode === "audio" ? (
          <Phone size={14} className="text-fo-accent" />
        ) : (
          <Video size={14} className="text-fo-accent" />
        )}
        {mode === "audio" ? "Audio call" : "Video call"}
        <span className="ml-auto text-fo-subtle capitalize">
          {cameraBusy ? "Updating camera…" : linkLabel}
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
                fallbackLabel="Caller"
                size="md"
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
                onClick={() => endCall(true)}
                className="inline-flex items-center gap-1.5 min-h-11 px-3 py-2 rounded-lg text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10"
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

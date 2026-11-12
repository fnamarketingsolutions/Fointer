/** Camera capture reused when an audio call gains video. */
import { logCallDiagnostic } from "./callDiagnostics.js";
import { enqueueSerial } from "./iceQueue.js";
export const VIDEO_CONSTRAINTS = {
  facingMode: "user",
  width: { ideal: 640 },
  height: { ideal: 480 },
};

export const cameraFailureMessage = (error) => {
  const name = error?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. The audio call is still on.";
  }
  if (
    name === "NotFoundError" ||
    name === "NotReadableError" ||
    name === "OverconstrainedError" ||
    name === "AbortError"
  ) {
    return "The camera is unavailable. The audio call is still on.";
  }
  return "The camera could not be started. The audio call is still on.";
};

export const cameraPresencePayload = (cameraOn) => ({
  camera: Boolean(cameraOn),
  mode: cameraOn ? "video" : "audio",
});

export const cameraControlLabel = ({ cameraOn = false, busy = false } = {}) => {
  if (busy && cameraOn) return "Turning camera off…";
  if (busy) return "Turning camera on…";
  return cameraOn ? "Turn off camera" : "Turn on camera";
};

/** enable | disable | wait | unavailable */
export const cameraControlAction = ({
  inCall = false,
  busy = false,
  cameraOn = false,
} = {}) => {
  if (!inCall) return "unavailable";
  if (busy) return "wait";
  return cameraOn ? "disable" : "enable";
};

export const shouldAcceptCameraSignal = ({
  inCall = false,
  activeCallId = "",
  signalCallId = "",
} = {}) => {
  if (!inCall) return false;
  if (activeCallId && signalCallId && String(activeCallId) !== String(signalCallId)) {
    return false;
  }
  return true;
};

export const applyRemoteCameraState = (peer, payload = {}) => {
  if (!peer) return peer;
  if (typeof payload.mic === "boolean") peer.mic = payload.mic;
  if (typeof payload.camera === "boolean") peer.camera = payload.camera;
  if (payload.mode === "audio" || payload.mode === "video") peer.mode = payload.mode;
  return peer;
};

export const canStartRenegotiation = ({ signalingState, makingOffer = false } = {}) => {
  if (makingOffer) return false;
  return !signalingState || signalingState === "stable";
};

export const audioStillLive = (stream) =>
  (stream?.getAudioTracks?.() || []).some((track) => track.readyState === "live");

const videoKind = (transceiver) =>
  transceiver?.sender?.track?.kind ||
  transceiver?.receiver?.track?.kind ||
  transceiver?.kind ||
  "";

export const findVideoTransceiver = (pc) =>
  (pc?.getTransceivers?.() || []).find((transceiver) => videoKind(transceiver) === "video") ||
  null;

export const countVideoTransceivers = (pc) =>
  (pc?.getTransceivers?.() || []).filter((transceiver) => videoKind(transceiver) === "video")
    .length;

/** add | replace | none. An existing video transceiver is reused. */
export const planVideoUpgrade = (pc, trackId) => {
  const transceiver = findVideoTransceiver(pc);
  if (!transceiver) return { action: "add", direction: "sendrecv" };
  const current = transceiver.sender?.track;
  if (
    current &&
    trackId &&
    current.id === trackId &&
    current.readyState !== "ended"
  ) {
    return { action: "none", transceiver };
  }
  return { action: "replace", transceiver, direction: "sendrecv" };
};

export const planVideoDowngrade = (pc) => {
  const transceiver = findVideoTransceiver(pc);
  if (!transceiver) return { action: "none" };
  const track = transceiver.sender?.track?.kind === "video" ? transceiver.sender.track : null;
  const sending =
    Boolean(track) ||
    transceiver.direction === "sendrecv" ||
    transceiver.direction === "sendonly";
  if (!sending) return { action: "none", transceiver };
  return { action: "release", transceiver, track };
};

const sendsVideo = (direction) => direction === "sendrecv" || direction === "sendonly";

export const attachVideoTrack = (pc, track, stream) => {
  const plan = planVideoUpgrade(pc, track?.id);
  if (!track || plan.action === "none") return { ...plan, renegotiate: false, iceRestart: false };
  if (plan.action === "replace") {
    const wasSending = sendsVideo(plan.transceiver.direction);
    if (!wasSending) plan.transceiver.direction = "sendrecv";
    const pending = plan.transceiver.sender?.replaceTrack?.(track);
    return { ...plan, renegotiate: !wasSending, iceRestart: false, pending };
  }
  if (pc?.addTrack) pc.addTrack(track, stream);
  else pc?.addTransceiver?.(track, { direction: "sendrecv" });
  return { action: "add", renegotiate: true, iceRestart: false };
};

export const releaseVideoSender = async (pc) => {
  const plan = planVideoDowngrade(pc);
  if (plan.action === "none") return { ...plan, renegotiate: false };
  plan.transceiver.direction = "recvonly";
  if (plan.transceiver.sender?.replaceTrack) {
    await plan.transceiver.sender.replaceTrack(null);
  }
  if (plan.track && plan.track.readyState !== "ended") plan.track.stop?.();
  return { action: "release", renegotiate: true };
};

export const releaseLocalVideo = (stream) => {
  const tracks = stream?.getVideoTracks?.() || [];
  for (const track of tracks) {
    if (track.readyState !== "ended") track.stop?.();
    stream.removeTrack?.(track);
  }
  return tracks;
};

const liveVideoTrack = (stream) =>
  (stream?.getVideoTracks?.() || []).find((track) => track.readyState === "live") || null;

const senderVideoTrack = (pc) => {
  const track = findVideoTransceiver(pc)?.sender?.track;
  return track?.kind === "video" ? track : null;
};

/** Reuse a live camera. A new capture is only opened after the previous track has ended. */
export const enableLocalCamera = async ({
  localStream,
  peerConnections = [],
  getUserMedia,
  constraints = VIDEO_CONSTRAINTS,
} = {}) => {
  const fail = (error) => ({
    ok: false,
    error,
    message: cameraFailureMessage(error || { name: "NotFoundError" }),
    audioPreserved: audioStillLive(localStream),
    renegotiate: false,
    iceRestart: false,
    action: "failed",
  });
  if (!localStream) return fail({ name: "NotFoundError" });

  let track = liveVideoTrack(localStream);
  if (!track) {
    for (const pc of peerConnections) {
      const senderTrack = senderVideoTrack(pc);
      if (senderTrack?.readyState === "live") {
        track = senderTrack;
        if (!localStream.getVideoTracks().some((item) => item.id === track.id)) {
          localStream.addTrack(track);
        }
        break;
      }
    }
  }

  let acquired = false;
  if (track) {
    track.enabled = true;
  } else {
    if (typeof getUserMedia !== "function") return fail({ name: "NotFoundError" });
    let videoStream;
    try {
      videoStream = await getUserMedia({ audio: false, video: constraints });
    } catch (error) {
      return fail(error);
    }
    track = videoStream?.getVideoTracks?.()[0];
    if (!track) {
      videoStream?.getTracks?.().forEach((item) => item.stop?.());
      return fail({ name: "NotFoundError" });
    }
    acquired = true;
    track.enabled = true;
  }

  const results = [];
  for (const pc of peerConnections) {
    if (pc) results.push(attachVideoTrack(pc, track, localStream));
  }
  try {
    for (const result of results) {
      if (result.pending) await result.pending;
    }
  } catch (error) {
    if (acquired) {
      track.stop?.();
      localStream.removeTrack?.(track);
    }
    return fail(error);
  }

  for (const old of localStream.getVideoTracks?.() || []) {
    if (old.id === track.id) continue;
    if (!acquired && old.readyState !== "ended") continue;
    if (old.readyState !== "ended") old.stop?.();
    localStream.removeTrack?.(old);
  }
  if (!localStream.getVideoTracks().some((item) => item.id === track.id)) {
    localStream.addTrack(track);
  }

  const action = !acquired
    ? "enabled"
    : results.some((item) => item.action === "add") || results.length === 0
      ? "added"
      : "replaced";
  return {
    ok: true,
    track,
    action,
    renegotiate: results.some((item) => item.renegotiate),
    iceRestart: false,
    audioPreserved: audioStillLive(localStream),
  };
};

/** Mute the existing camera. The sender, track, and peer connection stay in place. */
export const disableLocalCamera = async ({ localStream, peerConnections = [] } = {}) => {
  const tracks = new Set();
  const current = liveVideoTrack(localStream);
  if (current) tracks.add(current);
  for (const pc of peerConnections) {
    const track = senderVideoTrack(pc);
    if (track?.readyState === "live") tracks.add(track);
  }
  for (const track of tracks) track.enabled = false;
  return {
    ok: true,
    action: "disabled",
    renegotiate: false,
    iceRestart: false,
    audioPreserved: audioStillLive(localStream),
  };
};

const readyLabel = (track) => (track?.readyState === "live" || track?.readyState === "ended" ? track.readyState : "none");

const enabledLabel = (track) => {
  if (!track) return "none";
  return track.enabled === false ? "false" : "true";
};

const audioTransceiver = (pc) =>
  (pc?.getTransceivers?.() || []).find((transceiver) => videoKind(transceiver) === "audio") || null;

export const capturePeerTransport = (peerConnections = []) =>
  peerConnections.filter(Boolean).map((pc) => ({
    connectionState: pc.connectionState || "",
    iceConnectionState: pc.iceConnectionState || "",
  }));

/** Safe camera-toggle record. SDP, credentials, and addresses are not accepted. */
export const cameraToggleRecord = ({
  callId = "",
  action = "",
  localStream = null,
  pc = null,
  connectionBefore = "",
  iceBefore = "",
  renegotiation = false,
  iceRestart = false,
} = {}) => {
  const video = liveVideoTrack(localStream)
    || localStream?.getVideoTracks?.()[0]
    || senderVideoTrack(pc);
  const audio = (localStream?.getAudioTracks?.() || []).find((track) => track.readyState === "live")
    || localStream?.getAudioTracks?.()[0]
    || audioTransceiver(pc)?.sender?.track
    || null;
  const videoSender = findVideoTransceiver(pc)?.sender || null;
  const audioSender = audioTransceiver(pc)?.sender
    || (pc?.getSenders?.() || []).find((sender) => sender.track?.kind === "audio")
    || null;
  return {
    callId,
    event: "camera_toggle",
    cameraAction: action,
    videoReadyState: readyLabel(video),
    videoEnabled: enabledLabel(video),
    audioReadyState: readyLabel(audio),
    audioEnabled: enabledLabel(audio),
    videoSender: videoSender ? "yes" : "no",
    videoSenderState: videoSender?.track ? readyLabel(videoSender.track) : "none",
    audioSender: audioSender ? "yes" : "no",
    connectionBefore,
    connectionAfter: pc?.connectionState || "",
    iceBefore,
    iceAfter: pc?.iceConnectionState || "",
    renegotiation: renegotiation ? "yes" : "no",
    iceRestart: iceRestart ? "yes" : "no",
  };
};

export const logCameraToggle = ({
  peerConnections = [],
  before = [],
  ...details
} = {}) => {
  const connections = peerConnections.filter(Boolean);
  const targets = connections.length ? connections : [null];
  targets.forEach((pc, index) => {
    logCallDiagnostic(cameraToggleRecord({
      ...details,
      pc,
      connectionBefore: before[index]?.connectionState || "",
      iceBefore: before[index]?.iceConnectionState || "",
    }));
  });
};

export const renegotiatePeer = async (peer, { makingOffer = false, sendOffer } = {}) => {
  const pc = peer?.pc;
  if (!pc?.createOffer || typeof sendOffer !== "function") {
    return { ok: false, reason: "no-pc" };
  }
  if (!canStartRenegotiation({ signalingState: pc.signalingState, makingOffer })) {
    return { ok: false, reason: pc.signalingState && pc.signalingState !== "stable" ? "glare" : "busy" };
  }
  const offer = await pc.createOffer();
  if (pc.signalingState && pc.signalingState !== "stable") {
    return { ok: false, reason: "glare" };
  }
  await pc.setLocalDescription(offer);
  sendOffer(pc.localDescription);
  return { ok: true };
};

/** Serializes camera switches so a second click waits for the first. */
export const createSwitchLock = () => {
  let current = Promise.resolve();
  return (fn) => {
    const run = current.then(() => fn(), () => fn());
    current = run.then(
      () => {},
      () => {}
    );
    return run;
  };
};

export const watchRemoteTrack = (track, peer, onChange) => {
  if (!track || track.__fointerWatch) return;
  track.__fointerWatch = true;
  track.onunmute = () => {
    track.__fointerSawMedia = true;
    if (track.kind === "video") {
      peer.camera = true;
      peer.mode = "video";
    }
    peer.streamVersion = (peer.streamVersion || 0) + 1;
    onChange?.();
  };
  track.onmute = () => {
    if (track.kind === "video" && track.__fointerSawMedia) peer.camera = false;
    onChange?.();
  };
  track.onended = () => {
    if (track.kind === "video") peer.camera = false;
    peer.streamVersion = (peer.streamVersion || 0) + 1;
    onChange?.();
  };
};

/** One renegotiation per peer, serialized with the rest of that call's signaling. */
export const queuePeerRenegotiation = ({
  peers,
  chain,
  makingOffer,
  isActive,
  sendOffer,
  onError,
}) => {
  for (const socketId of [...peers.keys()]) {
    enqueueSerial(chain, async () => {
      const peer = peers.get(socketId);
      if (!peer || (typeof isActive === "function" && !isActive())) return;
      if (makingOffer?.has?.(socketId)) return;
      makingOffer?.add?.(socketId);
      try {
        await renegotiatePeer(peer, {
          makingOffer: false,
          sendOffer: (description) => sendOffer(socketId, description),
        });
      } catch (error) {
        onError?.(error);
      } finally {
        makingOffer?.delete?.(socketId);
      }
    });
  }
  return chain.chain;
};

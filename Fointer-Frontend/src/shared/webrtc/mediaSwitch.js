/** Camera capture reused when an audio call gains video. */
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

export const attachVideoTrack = (pc, track, stream) => {
  const plan = planVideoUpgrade(pc, track?.id);
  if (!track || plan.action === "none") return { ...plan, renegotiate: false };
  if (plan.action === "replace") {
    plan.transceiver.direction = "sendrecv";
    const pending = plan.transceiver.sender?.replaceTrack?.(track);
    return { ...plan, renegotiate: true, pending };
  }
  if (pc?.addTrack) pc.addTrack(track, stream);
  else pc?.addTransceiver?.(track, { direction: "sendrecv" });
  return { action: "add", renegotiate: true };
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

export const enableLocalCamera = async ({
  localStream,
  peerConnections = [],
  getUserMedia,
  constraints = VIDEO_CONSTRAINTS,
} = {}) => {
  if (!localStream || typeof getUserMedia !== "function") {
    return {
      ok: false,
      message: cameraFailureMessage({ name: "NotFoundError" }),
      audioPreserved: audioStillLive(localStream),
    };
  }
  let videoStream;
  try {
    videoStream = await getUserMedia({ audio: false, video: constraints });
  } catch (error) {
    return {
      ok: false,
      error,
      message: cameraFailureMessage(error),
      audioPreserved: audioStillLive(localStream),
    };
  }
  const track = videoStream?.getVideoTracks?.()[0];
  if (!track) {
    videoStream?.getTracks?.().forEach((item) => item.stop?.());
    return {
      ok: false,
      message: cameraFailureMessage({ name: "NotFoundError" }),
      audioPreserved: audioStillLive(localStream),
    };
  }
  const results = [];
  for (const pc of peerConnections) {
    if (pc) results.push(attachVideoTrack(pc, track, localStream));
  }
  for (const result of results) {
    if (result.pending) await result.pending;
  }
  for (const old of localStream.getVideoTracks?.() || []) {
    if (old.id !== track.id) {
      old.stop?.();
      localStream.removeTrack?.(old);
    }
  }
  if (!localStream.getVideoTracks().some((item) => item.id === track.id)) {
    localStream.addTrack(track);
  }
  return {
    ok: true,
    track,
    renegotiate: results.some((item) => item.renegotiate),
    audioPreserved: audioStillLive(localStream),
  };
};

export const disableLocalCamera = async ({ localStream, peerConnections = [] } = {}) => {
  for (const pc of peerConnections) {
    if (pc) await releaseVideoSender(pc);
  }
  releaseLocalVideo(localStream);
  return {
    ok: true,
    renegotiate: peerConnections.some((pc) => findVideoTransceiver(pc)),
    audioPreserved: audioStillLive(localStream),
  };
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

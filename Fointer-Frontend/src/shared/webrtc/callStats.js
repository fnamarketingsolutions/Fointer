const directionStats = (report) => ({
  packetsReceived: Number(report?.packetsReceived) || 0,
  bytesReceived: Number(report?.bytesReceived) || 0,
  packetsLost: Number(report?.packetsLost) || 0,
  jitter: Number.isFinite(report?.jitter) ? report.jitter : null,
  packetsSent: Number(report?.packetsSent) || 0,
  bytesSent: Number(report?.bytesSent) || 0,
  receiving: (Number(report?.packetsReceived) || 0) > 0 || (Number(report?.bytesReceived) || 0) > 0,
  sending: (Number(report?.packetsSent) || 0) > 0 || (Number(report?.bytesSent) || 0) > 0,
});

const reportsOf = (stats) => {
  if (!stats) return [];
  if (typeof stats.values === "function") return [...stats.values()];
  return [...stats];
};

const reportKind = (report) => report?.kind || report?.mediaType || "";

/**
 * Safe snapshot of one peer connection.
 * Candidate addresses, related addresses, and TURN URLs are intentionally omitted.
 */
export const summarizeCallStats = (
  stats,
  { connectionState = "", iceConnectionState = "" } = {}
) => {
  const reports = reportsOf(stats);
  const pair =
    reports.find(
      (report) =>
        report?.type === "candidate-pair" &&
        report.state === "succeeded" &&
        (report.selected || report.nominated)
    ) ||
    reports.find((report) => report?.type === "candidate-pair" && (report.selected || report.nominated));
  const local = pair ? reports.find((report) => report.id === pair.localCandidateId) : null;
  const remote = pair ? reports.find((report) => report.id === pair.remoteCandidateId) : null;
  const inbound = reports.filter((report) => report?.type === "inbound-rtp");
  const outbound = reports.filter((report) => report?.type === "outbound-rtp");
  const audioIn = inbound.find((report) => reportKind(report) === "audio");
  const videoIn = inbound.find((report) => reportKind(report) === "video");
  const audioOut = outbound.find((report) => reportKind(report) === "audio");
  const videoOut = outbound.find((report) => reportKind(report) === "video");

  const audio = {
    ...directionStats(audioIn),
    packetsSent: Number(audioOut?.packetsSent) || 0,
    bytesSent: Number(audioOut?.bytesSent) || 0,
  };
  audio.sending = audio.packetsSent > 0 || audio.bytesSent > 0;
  const video = {
    ...directionStats(videoIn),
    packetsSent: Number(videoOut?.packetsSent) || 0,
    bytesSent: Number(videoOut?.bytesSent) || 0,
    framesReceived: Number(videoIn?.framesReceived) || 0,
    framesDropped: Number(videoIn?.framesDropped) || 0,
  };
  video.sending = video.packetsSent > 0 || video.bytesSent > 0;

  return {
    connectionState,
    iceConnectionState,
    candidate: pair
      ? {
          localType: local?.candidateType || null,
          remoteType: remote?.candidateType || null,
          protocol: local?.protocol || remote?.protocol || null,
          relayProtocol: local?.relayProtocol || remote?.relayProtocol || null,
          roundTripTime: Number.isFinite(pair.currentRoundTripTime) ? pair.currentRoundTripTime : null,
        }
      : null,
    audio,
    video,
  };
};

export const emptyMediaStats = () => summarizeCallStats([], {
  connectionState: "new",
  iceConnectionState: "new",
});

export const toPublicMediaLog = (summary) => ({
  connectionState: summary?.connectionState || "",
  iceConnectionState: summary?.iceConnectionState || "",
  localCandidateType: summary?.candidate?.localType || null,
  remoteCandidateType: summary?.candidate?.remoteType || null,
  protocol: summary?.candidate?.protocol || null,
  relayProtocol: summary?.candidate?.relayProtocol || null,
  roundTripTime: summary?.candidate?.roundTripTime ?? null,
  audioPacketsReceived: summary?.audio?.packetsReceived ?? 0,
  audioBytesReceived: summary?.audio?.bytesReceived ?? 0,
  audioPacketsLost: summary?.audio?.packetsLost ?? 0,
  audioJitter: summary?.audio?.jitter ?? null,
  audioPacketsSent: summary?.audio?.packetsSent ?? 0,
  audioBytesSent: summary?.audio?.bytesSent ?? 0,
  videoPacketsReceived: summary?.video?.packetsReceived ?? 0,
  videoBytesReceived: summary?.video?.bytesReceived ?? 0,
  videoPacketsLost: summary?.video?.packetsLost ?? 0,
  videoJitter: summary?.video?.jitter ?? null,
  videoPacketsSent: summary?.video?.packetsSent ?? 0,
  videoBytesSent: summary?.video?.bytesSent ?? 0,
  framesReceived: summary?.video?.framesReceived ?? 0,
  framesDropped: summary?.video?.framesDropped ?? 0,
});

/**
 * Compare two safe snapshots. A quiet video picture is not an ICE failure.
 * Bytes that never started are idle, not a stalled stream.
 */
export const assessMediaHealth = (previous, current) => {
  const connected =
    current?.connectionState === "connected" ||
    current?.iceConnectionState === "connected" ||
    current?.iceConnectionState === "completed";
  if (!connected || !previous) {
    return { status: connected ? "connected" : "", restart: false, direction: connected ? "warming" : "down" };
  }
  const audioIn = (current.audio?.bytesReceived || 0) > (previous.audio?.bytesReceived || 0);
  const audioOut = (current.audio?.bytesSent || 0) > (previous.audio?.bytesSent || 0);
  const hadAudio = (previous.audio?.bytesReceived || 0) > 0;
  const audioStalled = hadAudio && audioOut && !audioIn && current.audio?.bytesReceived === previous.audio?.bytesReceived;
  const videoLossGrew = (current.video?.packetsLost || 0) > (previous.video?.packetsLost || 0);
  if (audioIn && audioOut && videoLossGrew) {
    return { status: "poor-video", restart: false, direction: "two-way" };
  }
  if (audioStalled) return { status: "one-way", restart: true, direction: "send-only" };
  if (audioIn && audioOut) return { status: "connected", restart: false, direction: "two-way" };
  if (audioIn && !audioOut) return { status: "one-way", restart: false, direction: "receive-only" };
  return { status: "connected", restart: false, direction: "idle" };
};

export const readSafeCallStats = async (pc) => {
  if (!pc || typeof pc.getStats !== "function" || pc.connectionState === "closed") return null;
  try {
    const stats = await pc.getStats();
    return summarizeCallStats(stats, {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
    });
  } catch {
    return null;
  }
};

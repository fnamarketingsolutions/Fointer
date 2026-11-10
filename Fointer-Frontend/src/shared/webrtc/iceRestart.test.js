import assert from "node:assert/strict";
import test from "node:test";
import { restartDelayMs, watchPeerConnection } from "./iceRestart.js";

const makePeerConnection = () => {
  const pc = new EventTarget();
  pc.signalingState = "stable";
  pc.connectionState = "connecting";
  pc.iceConnectionState = "checking";
  pc.localDescription = null;
  pc.createOffer = async (options) => ({
    type: "offer",
    options,
  });
  pc.setLocalDescription = async (description) => {
    pc.localDescription = description;
  };
  return pc;
};

test("restarts ICE after an initial connection stays checking", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const statuses = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    sendOffer: (offer) => sent.push(offer),
    onStatus: (status) => statuses.push(status),
  });

  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.iceRestart, true);
  assert.ok(statuses.includes("reconnecting"));
});

test("a successful ICE connection cancels the pending initial restart", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });

  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.dispatchEvent(new Event("connectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();

  assert.equal(sent.length, 0);
});

test("a slow TURN path that connects during checking is not restarted", async () => {
  const pc = makePeerConnection();
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 40,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(sent.length, 0);
});

test("a failed connection restarts once and a later success clears the retry count", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 3,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 1);
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  stop();
  assert.equal(sent.length, 2);
});

test("temporary disconnection waits, then one restart is sent", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    disconnectedGraceMs: 10,
    recoveryDelayMs: 40,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "disconnected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 25));
  stop();
  assert.equal(sent.length, 1);
});

test("retry delay grows and the attempt limit stops further restarts", async () => {
  assert.ok(restartDelayMs(2, { random: () => 0 }) > restartDelayMs(0, { random: () => 0 }));
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const statuses = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 2,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
    onStatus: (status) => statuses.push(status),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(sent.length, 2);
  assert.ok(statuses.includes("failed"));
});

test("an unstable signaling state does not consume a restart attempt", async () => {
  const pc = makePeerConnection();
  pc.signalingState = "have-local-offer";
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 1,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 0);
  pc.signalingState = "stable";
  await new Promise((resolve) => setTimeout(resolve, 15));
  stop();
  assert.equal(sent.length, 1);
});

test("ending the call and closing the peer cancels recovery listeners", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  let active = true;
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    isActive: () => active,
    sendOffer: (offer) => sent.push(offer),
  });
  active = false;
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  stop();
  pc.connectionState = "closed";
  pc.dispatchEvent(new Event("connectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(sent.length, 0);
});

test("a connected media stall can request one restart without looping", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    recoveryDelayMs: 5,
    maxAttempts: 2,
    random: () => 0,
    sendOffer: (offer) => sent.push(offer),
  });
  stop.request();
  stop.request();
  await new Promise((resolve) => setTimeout(resolve, 8));
  assert.equal(sent.length, 1);
  stop();
});

test("disconnected before the first connection does not start recovery", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "disconnected";
  const sent = [];
  const statuses = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 40,
    recoveryDelayMs: 5,
    sendOffer: (offer) => sent.push(offer),
    onStatus: (status) => statuses.push(status),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 15));
  stop();
  assert.equal(sent.length, 0);
  assert.ok(statuses.includes("connecting"));
  assert.equal(statuses.includes("reconnecting"), false);
});

test("initial checking stays inside the checking budget", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "connecting";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 30,
    recoveryDelayMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(sent.length, 0);
  stop();
});

test("failure before the first connection enters bounded recovery", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 500,
    recoveryDelayMs: 5,
    maxAttempts: 1,
    sendOffer: (offer) => sent.push(offer),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 15));
  stop();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.iceRestart, true);
});

test("an unanswered initial offer is resent without an ICE restart", async () => {
  const pc = makePeerConnection();
  pc.signalingState = "have-local-offer";
  pc.localDescription = { type: "offer", sdp: "local-offer" };
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "connecting";
  let created = 0;
  pc.createOffer = async () => {
    created += 1;
    return { type: "offer", options: { iceRestart: true } };
  };
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 8,
    retryInitialOffer: true,
    maxOfferResends: 2,
    sendOffer: (description, meta) => sent.push({ description, meta }),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 40));
  stop();
  assert.equal(created, 0);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].description, sent[1].description);
  assert.equal(sent[0].meta.resend, true);
  assert.equal(sent[1].meta.resend, true);
});

test("a connection during the initial check clears the checking timer", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "disconnected";
  pc.connectionState = "disconnected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    checkingTimeoutMs: 20,
    sendOffer: (offer, meta) => sent.push({ offer, meta }),
  });
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 30));
  stop();
  assert.equal(sent.length, 0);
});

const dueCredentialSession = () => ({
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  credentialUpdate: "renegotiate",
  restartBefore: new Date(Date.now() - 5).toISOString(),
});

test("a healthy call restarts ICE once when the credential deadline is reached", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  let rotations = 0;
  const stop = watchPeerConnection(pc, {
    maxAttempts: 1,
    recoveryDelayMs: 5,
    credentialRetryMs: 20,
    getCredentialSession: dueCredentialSession,
    beforeRestart: async () => {
      rotations += 1;
      return { action: "restart" };
    },
    sendOffer: (offer) => sent.push(offer),
  });
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].options.iceRestart, true);
  assert.equal(rotations, 1);
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(sent.length, 2);
});

test("unknown expiry does not restart a healthy call", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    credentialRetryMs: 5,
    getCredentialSession: () => ({
      expiresAt: null,
      credentialUpdate: "next-peer-connection",
      restartBefore: null,
    }),
    beforeRestart: async () => {
      throw new Error("unknown expiry must not rotate");
    },
    sendOffer: (offer) => sent.push(offer),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(sent.length, 0);
});

test("a failed credential refresh and a rejected restart stay bounded", async () => {
  const failing = makePeerConnection();
  failing.iceConnectionState = "connected";
  failing.connectionState = "connected";
  let refreshes = 0;
  const failedStop = watchPeerConnection(failing, {
    credentialRetryMs: 5,
    maxCredentialFailures: 2,
    getCredentialSession: dueCredentialSession,
    beforeRestart: async () => {
      refreshes += 1;
      throw new Error("refresh failed");
    },
    sendOffer: () => {
      throw new Error("offer should not be sent");
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  failedStop();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(refreshes, 2);

  const rejected = makePeerConnection();
  rejected.iceConnectionState = "connected";
  rejected.connectionState = "connected";
  const statuses = [];
  let offers = 0;
  const rejectedStop = watchPeerConnection(rejected, {
    credentialRetryMs: 5,
    maxCredentialFailures: 2,
    getCredentialSession: dueCredentialSession,
    beforeRestart: async () => ({ action: "restart" }),
    sendOffer: () => {
      offers += 1;
      throw new Error("rejected");
    },
    onStatus: (status) => statuses.push(status),
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  rejectedStop();
  assert.equal(offers, 2);
  assert.equal(statuses.includes("failed"), false);
  assert.equal(rejected.connectionState, "connected");
});

test("a disconnected peer does not start credential rotation", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "connected";
  pc.connectionState = "connected";
  let rotations = 0;
  const sent = [];
  let active = true;
  const stop = watchPeerConnection(pc, {
    credentialRetryMs: 5,
    isActive: () => active,
    getCredentialSession: dueCredentialSession,
    beforeRestart: async () => {
      rotations += 1;
      return { action: "restart" };
    },
    sendOffer: (offer) => sent.push(offer),
  });
  active = false;
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(rotations, 0);
  assert.equal(sent.length, 0);
});

test("the polite peer never sends a competing restart offer", async () => {
  const pc = makePeerConnection();
  pc.iceConnectionState = "failed";
  pc.connectionState = "failed";
  const sent = [];
  const stop = watchPeerConnection(pc, {
    polite: true,
    recoveryDelayMs: 5,
    sendOffer: (offer) => sent.push(offer),
  });
  stop.request();
  pc.dispatchEvent(new Event("iceconnectionstatechange"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  stop();
  assert.equal(sent.length, 0);
});

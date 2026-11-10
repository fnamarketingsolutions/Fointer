import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

const ACCOUNT_ENV = [
  "TEST_USER_A_EMAIL",
  "TEST_USER_A_PASSWORD",
  "TEST_USER_B_EMAIL",
  "TEST_USER_B_PASSWORD",
];

const sanitize = (value) =>
  String(value || "")
    .replace(/apiKey=[^&\s]+/gi, "apiKey=redacted")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]")
    .replace(/\b[0-9a-f]{0,4}:[0-9a-f:]{2,}\b/gi, "[ip]")
    .slice(0, 180);

const installObserver = () => {
  window.__FOINTER_TEST_PCS = [];
  const Native = window.RTCPeerConnection;
  if (!Native || Native.__fointerObserved) return;
  function Observed(config) {
    const pc = new Native(config);
    window.__FOINTER_TEST_PCS.push(pc);
    return pc;
  }
  Observed.prototype = Native.prototype;
  Observed.generateCertificate = Native.generateCertificate?.bind(Native);
  Observed.__fointerObserved = true;
  window.RTCPeerConnection = Observed;
};

const readCallStats = () => {
  const pcs = (window.__FOINTER_TEST_PCS || []).filter(
    (pc) => pc && pc.connectionState !== "closed"
  );
  const pc = pcs[pcs.length - 1];
  if (!pc) return null;
  return pc.getStats().then((stats) => {
    const reports = [...stats.values()];
    const byId = new Map(reports.map((report) => [report.id, report]));
    const transport = reports.find(
      (report) => report.type === "transport" && report.selectedCandidatePairId
    );
    const pair =
      (transport && byId.get(transport.selectedCandidatePairId)) ||
      reports.find(
        (report) =>
          report.type === "candidate-pair" &&
          (report.selected || report.nominated) &&
          report.state === "succeeded"
      ) ||
      null;
    const local = pair ? byId.get(pair.localCandidateId) : null;
    const remote = pair ? byId.get(pair.remoteCandidateId) : null;
    const inbound = (kind) =>
      reports.find((report) => report.type === "inbound-rtp" && report.kind === kind);
    const outbound = (kind) =>
      reports.find((report) => report.type === "outbound-rtp" && report.kind === kind && !report.isRemote);
    const audioIn = inbound("audio");
    const audioOut = outbound("audio");
    const videoIn = inbound("video");
    const videoOut = outbound("video");
    return {
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      signalingState: pc.signalingState,
      iceTransportPolicy: pc.getConfiguration?.().iceTransportPolicy || "",
      gatheredRelay: reports.some(
        (report) => report.type === "local-candidate" && report.candidateType === "relay"
      ),
      selectedLocalType: local?.candidateType || "",
      selectedRemoteType: remote?.candidateType || "",
      relayProtocol: local?.relayProtocol || remote?.relayProtocol || local?.protocol || "",
      audioBytesSent: Number(audioOut?.bytesSent) || 0,
      audioBytesReceived: Number(audioIn?.bytesReceived) || 0,
      videoBytesSent: Number(videoOut?.bytesSent) || 0,
      videoBytesReceived: Number(videoIn?.bytesReceived) || 0,
      framesReceived: Number(videoIn?.framesReceived) || 0,
    };
  });
};

const grew = (before, after, field) => Number(after?.[field] || 0) > Number(before?.[field] || 0);

const diagnose = ({ beforeA, afterA, beforeB, afterB, errors }) => {
  const sides = [afterA, afterB];
  if (sides.some((side) => !side)) return "ICE negotiation: a peer connection was not created.";
  if (sides.some((side) => side.iceTransportPolicy !== "relay")) {
    return "Test relay override was not applied. Production defaults were left unchanged.";
  }
  if (errors.some((entry) => /getUserMedia|NotAllowedError|permission/i.test(entry))) {
    return "Media permissions: the browser did not grant the camera or microphone.";
  }
  if (errors.some((entry) => /signal|socket|not ready|ack/i.test(entry))) {
    return "Socket signaling: a call signal was not delivered.";
  }
  if (!afterA.gatheredRelay || !afterB.gatheredRelay) {
    return "TURN connectivity: a relay candidate was not gathered.";
  }
  const iceDown = sides.some((side) =>
    ["failed", "disconnected", "new", "checking"].includes(side.iceConnectionState)
  );
  const notConnected = sides.some(
    (side) => side.connectionState !== "connected" || !["connected", "completed"].includes(side.iceConnectionState)
  );
  if (notConnected && iceDown) return "ICE negotiation: the relay path did not become connected.";
  if (notConnected) return "Network timeout: the peer connection did not reach connected.";
  if (!grew(beforeA, afterA, "audioBytesReceived") || !grew(beforeB, afterB, "audioBytesReceived")) {
    return "Audio track transmission: inbound audio bytes did not increase on both sides.";
  }
  if (!grew(beforeA, afterA, "audioBytesSent") || !grew(beforeB, afterB, "audioBytesSent")) {
    return "Audio track transmission: outbound audio bytes did not increase on both sides.";
  }
  if (!grew(beforeA, afterA, "videoBytesReceived") || !grew(beforeB, afterB, "videoBytesReceived")) {
    return "Video track transmission: inbound video bytes did not increase on both sides.";
  }
  if (!grew(beforeA, afterA, "videoBytesSent") || !grew(beforeB, afterB, "videoBytesSent")) {
    return "Video track transmission: outbound video bytes did not increase on both sides.";
  }
  if (!grew(beforeA, afterA, "framesReceived") || !grew(beforeB, afterB, "framesReceived")) {
    return "Browser autoplay: video frames were not received on both sides.";
  }
  if (sides.some((side) => side.selectedLocalType !== "relay" || side.selectedRemoteType !== "relay")) {
    return "TURN connectivity: the selected candidate pair was not a relay pair.";
  }
  return "";
};

const sideReport = (stats) => ({
  connectionState: stats?.connectionState || "",
  iceConnectionState: stats?.iceConnectionState || "",
  iceTransportPolicy: stats?.iceTransportPolicy || "",
  selectedCandidateType: stats
    ? `${stats.selectedLocalType || "none"}/${stats.selectedRemoteType || "none"}`
    : "",
  relayProtocol: stats?.relayProtocol || "",
  audioBytesSent: stats?.audioBytesSent || 0,
  audioBytesReceived: stats?.audioBytesReceived || 0,
  videoBytesSent: stats?.videoBytesSent || 0,
  videoBytesReceived: stats?.videoBytesReceived || 0,
  framesReceived: stats?.framesReceived || 0,
});

const missingAccounts = ACCOUNT_ENV.filter((name) => !String(process.env[name] || "").trim());
if (missingAccounts.length) {
  writeFileSync(
    new URL("./relay-call-report.json", import.meta.url),
    JSON.stringify({
      result: "FAIL",
      scope: "localhost forced TURN relay",
      internationalCallingProven: false,
      reason: `Missing test account environment variables: ${missingAccounts.join(", ")}.`,
      userA: null,
      userB: null,
      establishmentMs: null,
      signalingErrors: [],
    }, null, 2)
  );
}
test.skip(
  missingAccounts.length > 0,
  `Missing test account environment variables: ${missingAccounts.join(", ")}.`
);

test("two local browsers exchange relayed audio and video", async ({ browser }) => {
  const report = {
    result: "FAIL",
    scope: "localhost forced TURN relay",
    internationalCallingProven: false,
    userA: null,
    userB: null,
    establishmentMs: null,
    reason: "",
    signalingErrors: [],
  };
  const errors = [];
  const writeReport = () => {
    report.signalingErrors = errors.slice(0, 8);
    writeFileSync(new URL("./relay-call-report.json", import.meta.url), JSON.stringify(report, null, 2));
  };

  try {
    const origin = process.env.FOINTER_E2E_ORIGIN || "http://127.0.0.1:5173";
    const backend = await fetch("http://127.0.0.1:5001/api/auth/me").then(
      (response) => response.status,
      () => 0
    );
    const frontend = await fetch(origin).then((response) => response.status, () => 0);
    if (!backend || !frontend) {
      report.reason = "Local frontend or backend is not reachable.";
      return;
    }

    const openUser = async (email, password) => {
      const context = await browser.newContext({ permissions: ["camera", "microphone"] });
      await context.route("**/webrtc/ice-servers*", async (route) => {
        const url = new URL(route.request().url());
        url.searchParams.set("relayTest", "1");
        await route.continue({ url: url.toString() });
      });
      await context.addInitScript(installObserver);
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(sanitize(error?.message)));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = sanitize(message.text());
        if (/signal|socket|webrtc|turn|ice|getUserMedia|NotAllowed|peer/i.test(text)) {
          errors.push(text);
        }
      });
      await page.goto("/login");
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(password);
      const loginResponse = page.waitForResponse(
        (response) => response.url().includes("/api/auth/login") && response.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Login", exact: true }).click();
      const response = await loginResponse;
      if (!response.ok()) {
        let category = "rejected";
        try {
          const body = await response.json();
          if (body?.requiresEmailVerification) category = "email verification required";
          else if (typeof body?.message === "string" && !body.message.includes("@")) {
            category = sanitize(body.message);
          }
        } catch {
          category = "unreadable";
        }
        throw new Error(`Login failed (${response.status()}): ${category}`);
      }
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));
      const me = await page.evaluate(async () => {
        const result = await fetch("/api/auth/me", { credentials: "include" });
        const body = await result.json();
        return { ok: result.ok, id: String(body?.user?.id || "") };
      });
      if (!me.ok || !me.id) throw new Error("Login did not establish a session.");
      return { context, page, id: me.id };
    };

    const userA = await openUser(process.env.TEST_USER_A_EMAIL, process.env.TEST_USER_A_PASSWORD);
    const userB = await openUser(process.env.TEST_USER_B_EMAIL, process.env.TEST_USER_B_PASSWORD);
    const conversation = await userA.page.evaluate(async (otherId) => {
      const result = await fetch("/api/conversations", { credentials: "include" });
      const body = await result.json();
      const match = (body?.conversations || []).find(
        (item) => String(item?.otherUser?.id || "") === otherId
      );
      return { ok: result.ok, id: match?.id ? String(match.id) : "" };
    }, userB.id);
    if (!conversation.ok || !conversation.id) {
      report.reason = "No existing conversation was found between the two test accounts.";
      await userA.context.close();
      await userB.context.close();
      return;
    }

    await userA.page.goto(`/messages/${conversation.id}`);
    await userB.page.goto(`/messages/${conversation.id}`);
    await userA.page.getByRole("button", { name: "Start video call" }).waitFor();
    await userB.page.getByRole("button", { name: "Start video call" }).waitFor();

    const startedAt = Date.now();
    await userA.page.getByRole("button", { name: "Start video call" }).click();
    await userB.page.getByRole("button", { name: "Accept" }).click();

    const waitUntil = Date.now() + 45_000;
    let beforeA = null;
    let beforeB = null;
    let afterA = null;
    let afterB = null;
    while (Date.now() < waitUntil) {
      afterA = await userA.page.evaluate(readCallStats);
      afterB = await userB.page.evaluate(readCallStats);
      const bothUp =
        afterA?.connectionState === "connected" &&
        afterB?.connectionState === "connected" &&
        ["connected", "completed"].includes(afterA?.iceConnectionState) &&
        ["connected", "completed"].includes(afterB?.iceConnectionState);
      if (bothUp && !beforeA && !beforeB) {
        beforeA = afterA;
        beforeB = afterB;
        report.establishmentMs = Date.now() - startedAt;
        await userA.page.waitForTimeout(2500);
        continue;
      }
      if (beforeA && beforeB) break;
      await userA.page.waitForTimeout(1000);
    }
    if (!beforeA) beforeA = afterA;
    if (!beforeB) beforeB = afterB;
    if (beforeA && beforeB && report.establishmentMs != null) {
      afterA = await userA.page.evaluate(readCallStats);
      afterB = await userB.page.evaluate(readCallStats);
    }

    report.userA = sideReport(afterA);
    report.userB = sideReport(afterB);
    report.reason = diagnose({ beforeA, afterA, beforeB, afterB, errors });
    const relaySelected =
      afterA?.selectedLocalType === "relay" &&
      afterA?.selectedRemoteType === "relay" &&
      afterB?.selectedLocalType === "relay" &&
      afterB?.selectedRemoteType === "relay";
    const mediaGrew =
      grew(beforeA, afterA, "audioBytesReceived") &&
      grew(beforeB, afterB, "audioBytesReceived") &&
      grew(beforeA, afterA, "audioBytesSent") &&
      grew(beforeB, afterB, "audioBytesSent") &&
      grew(beforeA, afterA, "videoBytesReceived") &&
      grew(beforeB, afterB, "videoBytesReceived") &&
      grew(beforeA, afterA, "videoBytesSent") &&
      grew(beforeB, afterB, "videoBytesSent") &&
      grew(beforeA, afterA, "framesReceived") &&
      grew(beforeB, afterB, "framesReceived");
    const connected =
      afterA?.connectionState === "connected" &&
      afterB?.connectionState === "connected" &&
      ["connected", "completed"].includes(afterA?.iceConnectionState) &&
      ["connected", "completed"].includes(afterB?.iceConnectionState);
    if (connected && relaySelected && mediaGrew && !report.reason) report.result = "PASS";

    await userA.page.getByRole("button", { name: "End call" }).click({ timeout: 3000 }).catch(() => {});
    await userA.context.close();
    await userB.context.close();
  } catch (error) {
    report.reason = report.reason || sanitize(error?.message || "test failed");
  } finally {
    writeReport();
  }

  expect(report.reason, JSON.stringify(report)).toBe("");
  expect(report.result).toBe("PASS");
}); 
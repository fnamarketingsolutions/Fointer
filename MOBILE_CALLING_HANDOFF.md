# Mobile Calling Stabilization Handoff

This document is for the developer working on the Expo / React Native app. The mobile app source was not present in the website workspace when this handoff was prepared, so verify all paths and current behavior before editing.

## Backend Contract

The website/backend now exposes `GET /api/webrtc/ice-servers`.

- Requires the same authenticated session/token used by the app's other API requests.
- Successful response: `{ success: true, iceServers: [...], expiresAt: "ISO-8601" }`.
- The response includes STUN entries and validated TURN entries; responses use `Cache-Control: no-store`.
- `503 TURN_NOT_CONFIGURED` means no relay credentials are currently configured. Do not silently treat STUN-only as guaranteed cross-network calling.
- The endpoint is rate-limited. Cache valid credentials in the app only until `expiresAt`, with a one-hour maximum.

Backend configuration uses one of these options:

- Metered: `METERED_DOMAIN` and `METERED_API_KEY` set only in the backend deployment environment.
- Coturn REST: `TURN_URL` and `TURN_SHARED_SECRET` set only in the backend deployment environment. The backend generates time-limited HMAC-SHA1 credentials.
- Legacy static TURN: `TURN_URL`, `TURN_USERNAME`, and `TURN_CREDENTIAL`; prefer one of the time-limited options above.

Never put provider API keys or Coturn shared secrets in Expo `EXPO_PUBLIC_*` variables, mobile bundles, source control, or client logs.

## App Work

1. Inspect the actual `package.json` and confirm Expo, React Native, and `react-native-webrtc` versions. Check whether merge markers really exist; do not replace the package file with a proposed version list without resolving the actual branch history.
2. Inspect the current ICE server module. Fetch `/webrtc/ice-servers` through the app's authenticated API client before creating each new peer connection; reuse unexpired cached credentials. If the endpoint fails, use a known working TURN fallback if configured, and show a clear relay/network setup error rather than claiming that STUN-only will work on every carrier.
3. Instrument the signaling path by event name: invite, accept, offer, answer, and ICE candidate. Record whether Socket.IO is connected, the event acknowledgement duration, and whether it timed out. Do not log auth tokens, SDP bodies, or raw candidate IP addresses.
4. Instrument WebRTC separately: `connectionState`, `iceConnectionState`, `signalingState`, candidate gathering, selected candidate types (`host`/`srflx`/`relay`), transport protocol, and connection RTT. This distinguishes a Socket.IO acknowledgement timeout from a failed media path.
5. On `disconnected`, keep the call alive briefly and allow ICE restart/reconnect. Do not immediately end the call for a transient state. After bounded retries fail, show “Network issue. Check your connection.” and allow the user to retry or end the call.
6. Confirm only the side designated by the existing polite/impolite negotiation logic initiates an ICE restart or mode-switch offer. A remote camera-presence event should update remote UI state; it must not automatically turn on the local camera.
7. Reproduce the Android audio-constraint issue before changing constraints. If confirmed, use the platform-appropriate `getUserMedia` constraints and assert acquired audio tracks are enabled.

## Required Verification

- Same-country Wi-Fi call: audio, video, mute, camera toggle, and hangup.
- Cross-country mobile-to-mobile call, especially Nigeria LTE: invite/accept acknowledgement succeeds and selected candidate pair is `relay` when direct candidates cannot connect.
- Wi-Fi-to-cellular handover during an active call: call does not end on a brief drop; signaling and media recover or produce a clear final network error.
- Audio-to-video switch from one side only: remote camera appears without glare and voice stays active.
- Remote hangup and rejected call: both clients leave the call state promptly.
- Record the exact timed-out Socket.IO event and WebRTC state transitions for any failure. A generic “Socket request timed out” alone is not enough to identify the failing layer.

## Reconnect Protocol Note

The backend currently retains Socket.IO recovery state for up to two minutes, but DM call participants are stored by `socket.id` and the disconnect cleanup runs after twelve seconds. A new socket ID is not automatically rebound to an existing call just because another socket for the same user exists. Before implementing cross-socket call resume, coordinate an authenticated resume event with the backend, validate `conversationId` and `callId`, rebind the participant, notify the other peer, and renegotiate. Do not treat membership in `user:<id>` as proof that the original call has resumed; another browser/device session can be in that room.
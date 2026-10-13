/** Copies remote tracks onto a stream, including events that omit event.streams. */
export const addRemoteTracks = (stream, event) => {
  if (!stream || !event) return false;
  const tracks = [];
  if (event.track) tracks.push(event.track);
  const grouped = event.streams?.[0]?.getTracks?.() || [];
  for (const track of grouped) {
    if (!tracks.some((item) => item.id === track.id)) tracks.push(track);
  }
  let added = false;
  for (const track of tracks) {
    if (stream.getTracks().some((item) => item.id === track.id)) continue;
    for (const existing of stream.getTracks()) {
      if (existing.kind === track.kind && existing.readyState === "ended") {
        stream.removeTrack(existing);
      }
    }
    stream.addTrack(track);
    added = true;
  }
  return added;
};

const MIN_VISIBLE = 0.55;

const players = new Set();

const sync = () => {
  if (typeof document !== "undefined" && document.hidden) {
    players.forEach((player) => player.pause());
    return;
  }

  let best = null;
  players.forEach((player) => {
    if (player.ratio < MIN_VISIBLE) return;
    if (!best || player.ratio > best.ratio) best = player;
  });

  players.forEach((player) => {
    if (player === best) player.play();
    else player.pause();
  });
};

export const registerFeedVideo = (player) => {
  players.add(player);
  sync();
  return () => {
    players.delete(player);
    player.pause();
    sync();
  };
};

export const updateFeedVideoRatio = (player, ratio) => {
  player.ratio = ratio;
  sync();
};

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", sync);
}

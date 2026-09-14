import SystemSetting from "../models/systemSetting.js";
import { WATCH_GROUP_ABSOLUTE_MAX, WATCH_GROUP_DEFAULT_MAX } from "../models/watchGroup.js";

const MIN = 2;
const CACHE_MS = 30_000;

let cachedMax = null;
let cacheAt = 0;

export const invalidateWatchGroupMaxCache = () => {
  cachedMax = null;
  cacheAt = 0;
};

const clampWatchGroupCapacity = (value, maxAllowed = WATCH_GROUP_ABSOLUTE_MAX) => {
  const n = Number(value);
  const cap = Math.min(
    WATCH_GROUP_ABSOLUTE_MAX,
    Math.max(MIN, Number(maxAllowed) || WATCH_GROUP_DEFAULT_MAX)
  );
  if (!Number.isFinite(n)) return cap;
  return Math.min(cap, Math.max(MIN, Math.floor(n)));
};

export const getWatchGroupMaxCapacity = async () => {
  if (cachedMax != null && Date.now() - cacheAt < CACHE_MS) {
    return cachedMax;
  }

  try {
    const setting = await SystemSetting.findOne({ key: "global" })
      .select("watchGroupMaxCapacity")
      .lean();
    if (
      setting?.watchGroupMaxCapacity != null &&
      Number.isFinite(Number(setting.watchGroupMaxCapacity))
    ) {
      cachedMax = clampWatchGroupCapacity(
        setting.watchGroupMaxCapacity,
        WATCH_GROUP_ABSOLUTE_MAX
      );
    } else {
      cachedMax = WATCH_GROUP_DEFAULT_MAX;
    }
  } catch {
    cachedMax = WATCH_GROUP_DEFAULT_MAX;
  }

  cacheAt = Date.now();
  return cachedMax;
};

export const getWatchGroupCreateLimits = async () => {
  const max = await getWatchGroupMaxCapacity();
  return {
    min: MIN,
    max,
    defaultValue: Math.min(WATCH_GROUP_DEFAULT_MAX, max),
  };
};

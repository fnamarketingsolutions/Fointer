/** Production logs for the realtime path. Never include tokens or message text. */
export const logRealtime = (event, fields = {}) => {
  const entry = { scope: "realtime", event };
  for (const [key, value] of Object.entries(fields)) {
    if (value == null || value === "") continue;
    entry[key] = value;
  }
  console.info(JSON.stringify(entry));
};

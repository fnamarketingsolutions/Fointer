const MAX_PER_CALL = 40;
const MAX_AGE_MS = 15000;

export const createSignalBuffer = () => {
  const queues = new Map();

  return {
    push(conversationId, item, now = Date.now()) {
      const id = String(conversationId || "");
      if (!id || !item?.to || !item?.from) return false;
      const list = queues.get(id) || [];
      list.push({ ...item, at: now });
      while (list.length > MAX_PER_CALL) list.shift();
      queues.set(id, list);
      return true;
    },
    takeReady(conversationId, isReady, now = Date.now()) {
      const id = String(conversationId || "");
      const list = queues.get(id) || [];
      const keep = [];
      const ready = [];
      for (const item of list) {
        if (now - item.at > MAX_AGE_MS) continue;
        if (isReady(item)) ready.push(item);
        else keep.push(item);
      }
      if (keep.length) queues.set(id, keep);
      else queues.delete(id);
      return ready;
    },
    drop(conversationId) {
      queues.delete(String(conversationId || ""));
    },
  };
};

export const callSignalBuffer = createSignalBuffer();

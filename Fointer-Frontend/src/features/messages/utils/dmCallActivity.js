let busy = false;
const retiredCallIds = new Set();

export const setDmCallBusy = (value) => {
  busy = Boolean(value);
};

export const isDmCallBusy = () => busy;

export const retireDmCall = (callId) => {
  if (!callId) return;
  retiredCallIds.add(String(callId));
};

export const isRetiredDmCall = (callId) =>
  Boolean(callId) && retiredCallIds.has(String(callId));

export const retiredDmCallIds = () => retiredCallIds;

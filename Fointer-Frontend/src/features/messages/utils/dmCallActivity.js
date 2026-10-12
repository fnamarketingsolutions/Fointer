let busy = false;

export const setDmCallBusy = (value) => {
  busy = Boolean(value);
};

export const isDmCallBusy = () => busy;

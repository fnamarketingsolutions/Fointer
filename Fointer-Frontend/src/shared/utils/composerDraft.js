import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "fointer-draft:";

export const persistableMedia = (media) =>
  (Array.isArray(media) ? media : [])
    .filter((item) => /^https:\/\//.test(String(item?.url || "")))
    .map((item) => ({
      url: item.url,
      publicId: item.publicId || "",
      type: item.type === "video" ? "video" : "image",
    }));

export const readComposerDraft = (key) => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const writeComposerDraft = (key, value) => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private mode or a full disk */
  }
};

export const clearComposerDraft = (key) => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
};

const draftIsEmpty = (value) => {
  const title = String(value?.title || "").trim();
  const text = String(value?.text || value?.description || "").trim();
  const price = String(value?.price || "").trim();
  const city = String(value?.city || "").trim();
  const state = String(value?.state || "").trim();
  const country = String(value?.country || "").trim();
  const communityId = String(value?.communityId || "").trim();
  return (
    !title &&
    !text &&
    !price &&
    !city &&
    !state &&
    !country &&
    !communityId &&
    persistableMedia(value?.media).length === 0
  );
};

const mergeDraft = (key, empty) => {
  const saved = readComposerDraft(key);
  if (!saved) return empty;
  return {
    ...empty,
    ...saved,
    media: persistableMedia(saved.media),
  };
};

export function useComposerDraft(key, empty) {
  const emptyRef = useRef(empty);
  emptyRef.current = empty;
  const keyRef = useRef(key);
  const [value, setValue] = useState(() => mergeDraft(key, empty));

  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setValue(mergeDraft(key, emptyRef.current));
      return;
    }
    const next = { ...value, media: persistableMedia(value.media) };
    if (draftIsEmpty(next)) clearComposerDraft(key);
    else writeComposerDraft(key, next);
  }, [key, value]);

  const clear = useCallback(() => {
    clearComposerDraft(keyRef.current);
    setValue(emptyRef.current);
  }, []);

  return [value, setValue, clear];
}
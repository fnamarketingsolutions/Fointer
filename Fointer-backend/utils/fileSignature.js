const ascii = (buffer, start, end) =>
  buffer.toString("ascii", start, Math.min(end, buffer.length));

const hasPrefix = (buffer, bytes) => {
  if (!buffer || buffer.length < bytes.length) return false;
  return bytes.every((b, i) => buffer[i] === b);
};

const isFtypBrand = (buffer, brands) => {
  if (!buffer || buffer.length < 12) return false;
  if (ascii(buffer, 4, 8) !== "ftyp") return false;
  const brand = ascii(buffer, 8, 12).replace(/\0/g, " ").trim();
  return brands.includes(brand);
}; 
export const sniffMediaBuffer = (buffer) => {
  if (!buffer || buffer.length < 12) return null;

  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: "image/jpeg", kind: "image" };
  }
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: "image/png", kind: "image" };
  }
  if (hasPrefix(buffer, [0x47, 0x49, 0x46, 0x38])) {
    return { mime: "image/gif", kind: "image" };
  }
  if (
    ascii(buffer, 0, 4) === "RIFF" &&
    ascii(buffer, 8, 12) === "WEBP"
  ) {
    return { mime: "image/webp", kind: "image" };
  }
  if (hasPrefix(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mime: "video/webm", kind: "video" };
  }
  if (
    isFtypBrand(buffer, ["qt"]) ||
    ascii(buffer, 8, 12) === "qt  "
  ) {
    return { mime: "video/quicktime", kind: "video" };
  }
  if (
    isFtypBrand(buffer, [
      "isom",
      "iso2",
      "iso4",
      "iso5",
      "iso6",
      "mp41",
      "mp42",
      "mp71",
      "avc1",
      "dash",
      "mmp4",
      "msnv",
      "ndas",
    ])
  ) {
    return { mime: "video/mp4", kind: "video" };
  }
  return null;
};
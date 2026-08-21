import SystemSetting from "../models/systemSetting.js";
import { escapeRegex } from "./validate.js";

const CACHE_MS = 30_000;
const MAX_KEYWORDS = 200;
const MIN_KEYWORD_LEN = 2;
const MAX_KEYWORD_LEN = 64;

let cachedKeywords = null;
let cacheAt = 0;

export class BannedKeywordError extends Error {
  constructor(matches = []) {
    const labels = matches.join(", ");
    super(
      labels
        ? `This content includes banned keywords: ${labels}.`
        : "This content includes banned keywords."
    );
    this.name = "BannedKeywordError";
    this.statusCode = 400;
    this.matches = matches;
  }
}

export const invalidateBannedKeywordsCache = () => {
  cachedKeywords = null;
  cacheAt = 0;
};

export const parseBannedKeywords = (input) => {
  const parts = Array.isArray(input)
    ? input
    : String(input || "").split(/[,;\n]+/);
  const seen = new Set();
  const out = [];

  for (const part of parts) {
    const keyword = String(part || "")
      .trim()
      .replace(/\s+/g, " ");
    if (
      keyword.length < MIN_KEYWORD_LEN ||
      keyword.length > MAX_KEYWORD_LEN
    ) {
      continue;
    }
    const key = keyword.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(keyword);
    if (out.length >= MAX_KEYWORDS) break;
  }

  return out;
};

const normalizeForMatch = (text) =>
  ` ${String(text || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

export const findBannedKeywords = (texts, keywords) => {
  if (!keywords?.length) return [];
  const haystack = normalizeForMatch(
    (Array.isArray(texts) ? texts : [texts]).filter(Boolean).join(" \n ")
  );
  if (!haystack.trim()) return [];

  return keywords.filter((keyword) => {
    const needle = normalizeForMatch(keyword).trim();
    if (!needle) return false;
    return new RegExp(` ${escapeRegex(needle)} `).test(haystack);
  });
};

export const getBannedKeywords = async () => {
  if (cachedKeywords != null && Date.now() - cacheAt < CACHE_MS) {
    return cachedKeywords;
  }

  try {
    const setting = await SystemSetting.findOne({ key: "global" })
      .select("bannedKeywords")
      .lean();
    cachedKeywords = parseBannedKeywords(setting?.bannedKeywords || []);
  } catch {
    cachedKeywords = [];
  }

  cacheAt = Date.now();
  return cachedKeywords;
};

export const assertNoBannedKeywords = async (...texts) => {
  const keywords = await getBannedKeywords();
  const matches = findBannedKeywords(texts, keywords);
  if (matches.length) {
    throw new BannedKeywordError(matches);
  }
};

export const respondIfBanned = async (res, ...texts) => {
  try {
    await assertNoBannedKeywords(...texts);
    return false;
  } catch (error) {
    if (error instanceof BannedKeywordError) {
      res.status(400).json({
        success: false,
        message: error.message,
        bannedKeywords: error.matches,
      });
      return true;
    }
    throw error;
  }
};

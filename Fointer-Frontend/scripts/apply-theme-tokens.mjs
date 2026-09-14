import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const replacements = [
  [/bg-\[#0[Ee]0[Cc]0[Aa]\]/g, "bg-fo-bg"],
  [/bg-\[#14100[Dd]\]/g, "bg-fo-surface"],
  [/bg-\[#0[Aa]0806\]/g, "bg-fo-surface-2"],
  [/bg-\[#251[Ee]17\]/g, "bg-fo-surface-3"],
  [/bg-\[#1[Cc]1612\]/g, "bg-fo-surface-hover"],
  [/bg-\[#1[cC]140[dD]\]/g, "bg-fo-surface-hover"],
  [/bg-\[#130[Dd]08\]/g, "bg-fo-auth"],
  [/bg-\[#130[dD]08\]/g, "bg-fo-auth"],
  [/text-\[#130[Dd]08\]/g, "text-fo-brand-fg"],
  [/text-\[#130[dD]08\]/g, "text-fo-brand-fg"],
  [/text-\[#0[Ee]0[Cc]0[Aa]\]/g, "text-fo-bg"],
  [/text-\[#14100[Dd]\]/g, "text-fo-surface"],
  [/text-\[#0[Aa]0806\]/g, "text-fo-surface-2"],
  [/text-\[#251[Ee]17\]/g, "text-fo-surface-3"],
  [/text-\[#1[Cc]1612\]/g, "text-fo-surface-hover"],
  [/text-\[#2[Aa]241[Ee]\]/g, "text-fo-border"],
  [/text-\[#8[Cc]8070\]/g, "text-fo-subtle"],
  [/text-\[#A69B8D\]/g, "text-fo-muted"],
  [/text-\[#E5E0D8\]/g, "text-fo-text"],
  [/text-\[#D4AF37\]/g, "text-fo-accent"],
  [/text-\[#F8A201\]/g, "text-fo-brand"],
  [/border-\[#2[Aa]241[Ee]\]/g, "border-fo-border"],
  [/border-\[#D4AF37\]/g, "border-fo-accent"],
  [/border-\[#F8A201\]/g, "border-fo-brand"],
  [/ring-\[#130[Dd]08\]/g, "ring-fo-auth"],
  [/ring-\[#130[dD]08\]/g, "ring-fo-auth"],
  [/bg-\[#D4AF37\]/g, "bg-fo-accent"],
  [/bg-\[#F8A201\]/g, "bg-fo-brand"],
  [/hover:bg-\[#1[Cc]1612\]/g, "hover:bg-fo-surface-hover"],
  [/hover:bg-\[#e0c04a\]/gi, "hover:bg-fo-accent-hover"],
  [/hover:bg-\[#e09200\]/gi, "hover:bg-fo-brand-hover"],
  [/hover:text-\[#E5E0D8\]/g, "hover:text-fo-text"],
  [/hover:text-\[#D4AF37\]/g, "hover:text-fo-accent"],
  [/hover:text-\[#e0c04a\]/gi, "hover:text-fo-accent-hover"],
  [/hover:text-\[#F8A201\]/g, "hover:text-fo-brand"],
  [/hover:border-\[#D4AF37\]/g, "hover:border-fo-accent"],
  [/hover:border-\[#F8A201\]/g, "hover:border-fo-brand"],
  [/group-hover:text-\[#D4AF37\]/g, "group-hover:text-fo-accent"],
  [/group-hover:text-\[#E5E0D8\]/g, "group-hover:text-fo-text"],
  [/group-hover:text-\[#e0c04a\]/gi, "group-hover:text-fo-accent-hover"],
  [/selection:bg-\[#D4AF37\]/g, "selection:bg-fo-accent"],
  [/shadow-\[#F8A201\]/g, "shadow-fo-brand"],
  [/from-\[#0[Ee]0[Cc]0[Aa]\]/g, "from-fo-bg"],
  [/to-\[#14100[Dd]\]/g, "to-fo-surface"],
  [/via-\[#14100[Dd]\]/g, "via-fo-surface"],
  [/fill-\[#D4AF37\]/g, "fill-fo-accent"],
  [/stroke-\[#D4AF37\]/g, "stroke-fo-accent"],
  /* Text colors still hardcoded from dark theme */
  [/\btext-white\b/g, "text-fo-text"],
  [/\btext-amber-50\b/g, "text-fo-text"],
  [/\btext-gray-300\b/g, "text-fo-muted"],
  [/\btext-gray-400\b/g, "text-fo-subtle"],
  [/\btext-gray-500\b/g, "text-fo-subtle"],
  [/\btext-gray-200\b/g, "text-fo-muted"],
  [/\btext-\[#C9C0B4\]/g, "text-fo-muted"],
  [/\btext-\[#E0D8D0\]/g, "text-fo-text"],
  [/\btext-\[#5C5348\]/g, "text-fo-subtle"],
  [/\bplaceholder-gray-500\b/g, "placeholder:text-fo-subtle"],
  /* Borders / dividers */
  [/\bborder-white\/10\b/g, "border-fo-border"],
  [/\bborder-white\/20\b/g, "border-fo-border"],
  [/\bhover:border-white\b/g, "hover:border-fo-border"],
  [/\bdivide-\[#2A241E\]/g, "divide-fo-border"],
  [/\bborder-\[#261E15\]/g, "border-fo-border"],
  [/\bborder-\[#0E0C0A\]/g, "border-fo-bg"],
  [/\bborder-amber-900\/20\b/g, "border-fo-border"],
  [/\bborder-amber-900\/30\b/g, "border-fo-border/60"],
  /* Backgrounds missed in first pass */
  [/\bbg-\[#110C08\]/g, "bg-fo-bg"],
  [/\bbg-\[#1A1A1A\]/g, "bg-fo-surface"],
  [/\bbg-\[#261E15\]/g, "bg-fo-surface-3"],
  [/\bbg-\[#241C16\]/g, "bg-fo-surface-3"],
  [/\bbg-\[#1F1914\]/g, "bg-fo-surface-hover"],
  [/\bhover:bg-\[#1A140F\]/g, "hover:bg-fo-surface-hover"],
  [/\bhover:bg-\[#261E15\]/g, "hover:bg-fo-surface-hover"],
  [/\bhover:text-gray-200\b/g, "hover:text-fo-text"],
  [/\bhover:text-white\b/g, "hover:text-fo-text"],
];

function walk(dir) {
  let files = 0;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      files += walk(full);
    } else if (/\.(jsx|js|tsx|ts|css)$/.test(ent.name)) {
      let content = fs.readFileSync(full, "utf8");
      const original = content;
      for (const [pattern, value] of replacements) {
        content = content.replace(pattern, value);
      }
      if (content !== original) {
        fs.writeFileSync(full, content);
        files += 1;
      }
    }
  }
  return files;
}

const updated = walk(root);
console.log(`Updated ${updated} files with theme tokens.`);

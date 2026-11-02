import { useEffect, useRef, useState } from "react";
import {
  LuAtSign as AtSign,
  LuBold as Bold,
  LuCode as Code,
  LuHeading2 as Heading,
  LuItalic as Italic,
  LuLink as Link,
  LuList as List,
  LuListOrdered as ListOrdered,
  LuQuote as Quote,
  LuRedo2 as Redo,
  LuRemoveFormatting as RemoveFormatting,
  LuStrikethrough as Strikethrough,
  LuUnderline as Underline,
  LuUndo2 as Undo,
} from "react-icons/lu";
import { globalSearch } from "../../../features/search/services/searchService";

const TOOLBAR = [
  [Bold, "Bold", "bold"],
  [Italic, "Italic", "italic"],
  [Underline, "Underline", "underline"],
  [Strikethrough, "Strikethrough", "strikeThrough"],
  [AtSign, "Mention a person", "mention"],
  [Heading, "Heading", "heading"],
  [Code, "Inline code", "code"],
  [Quote, "Quote", "quote"],
  [List, "Bulleted list", "insertUnorderedList"],
  [ListOrdered, "Numbered list", "insertOrderedList"],
];

export default function RichTextEditor({ value = "", onChange, disabled = false }) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const [completion, setCompletion] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  useEffect(() => {
    if (!completion) {
      return undefined;
    }
    if (completion.type === "@" && completion.query.length < 2) {
      return undefined;
    }
    let active = true;
    globalSearch({ q: completion.query, types: "profiles", limit: 6 })
      .then((data) => {
        if (!active) return;
        setSuggestions(data?.results?.profiles || data?.profiles || []);
      })
      .catch(() => {
        if (active) setSuggestions([]);
      })
    return () => {
      active = false;
    };
  }, [completion]);

  const updateCompletion = () => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return setCompletion(null);
    const range = selection.getRangeAt(0).cloneRange();
    // Posts are composed at the end of this editor. `innerText` is more
    // dependable than a cross-node Range when Enter has created new blocks.
    const match = (editorRef.current?.innerText || "").match(
      /(?:^|\s)(@)([A-Za-z0-9_]*)\s*$/
    );
    if (!match) return setCompletion(null);
    selectionRef.current = range;
    setCompletion({ type: match[1], query: match[2], length: match[1].length + match[2].length });
  };

  const emitValue = () => {
    onChange?.(editorRef.current?.innerHTML || "");
    updateCompletion();
  };
  const run = (command) => {
    if (disabled) return;
    editorRef.current?.focus();
    if (command === "mention") document.execCommand("insertText", false, "@");
    else if (command === "heading") document.execCommand("formatBlock", false, "h2");
    else if (command === "code") document.execCommand("formatBlock", false, "pre");
    else if (command === "quote") document.execCommand("formatBlock", false, "blockquote");
    else document.execCommand(command, false);
    emitValue();
  };
  const addLink = () => {
    if (disabled) return;
    const input = window.prompt("Paste link URL");
    if (!input) return;
    const url = input.trim();
    const normalizedUrl = /^(https?:|mailto:|\/)/i.test(url)
      ? url
      : `https://${url}`;
    editorRef.current?.focus();
    document.execCommand("createLink", false, normalizedUrl);
    emitValue();
  };
  const applySuggestion = (item) => {
    const token = `@${item.username}`;
    const range = selectionRef.current;
    const selection = window.getSelection();
    editorRef.current?.focus();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
      for (let index = 0; index < completion.length; index += 1) {
        selection.modify("extend", "backward", "character");
      }
    }
    document.execCommand("insertText", false, `${token} `);
    setCompletion(null);
    emitValue();
  };

  return (
    <div className="relative overflow-visible rounded-xl border border-fo-border bg-fo-bg focus-within:border-fo-accent/60 focus-within:ring-1 focus-within:ring-fo-accent/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-fo-border px-2 py-1.5">
        {TOOLBAR.map(([Icon, label, command]) => (
          <button key={command} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run(command)} disabled={disabled} title={label} aria-label={label} className="grid size-8 place-items-center rounded text-fo-muted hover:bg-fo-surface-2 hover:text-fo-text disabled:opacity-50">
            <Icon size={16} />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-fo-border" />
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={addLink} disabled={disabled} title="Add link" aria-label="Add link" className="grid size-8 place-items-center rounded text-fo-muted hover:bg-fo-surface-2 hover:text-fo-text disabled:opacity-50"><Link size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("removeFormat")} disabled={disabled} title="Clear formatting" aria-label="Clear formatting" className="grid size-8 place-items-center rounded text-fo-muted hover:bg-fo-surface-2 hover:text-fo-text disabled:opacity-50"><RemoveFormatting size={16} /></button>
        <span className="mx-1 h-5 w-px bg-fo-border" />
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("undo")} disabled={disabled} title="Undo" aria-label="Undo" className="grid size-8 place-items-center rounded text-fo-muted hover:bg-fo-surface-2 hover:text-fo-text disabled:opacity-50"><Undo size={16} /></button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => run("redo")} disabled={disabled} title="Redo" aria-label="Redo" className="grid size-8 place-items-center rounded text-fo-muted hover:bg-fo-surface-2 hover:text-fo-text disabled:opacity-50"><Redo size={16} /></button>
      </div>
      <div ref={editorRef} contentEditable={!disabled} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Post content editor" data-placeholder="Share something with the community…" onInput={emitValue} onKeyUp={updateCompletion} onBlur={() => window.setTimeout(() => setCompletion(null), 150)} onPaste={(event) => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); emitValue(); }} className="rich-text-editor min-h-[260px] px-4 py-4 text-[15px] leading-7 text-fo-text outline-none empty:before:pointer-events-none empty:before:text-fo-subtle empty:before:content-[attr(data-placeholder)] [&_a]:text-fo-accent [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-fo-accent [&_blockquote]:pl-3 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-fo-surface-2 [&_pre]:p-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6" />
      {completion ? (
        <div className="absolute left-3 top-[calc(100%+0.375rem)] z-20 w-72 overflow-hidden rounded-lg border border-fo-border bg-fo-surface py-1 shadow-xl">
          {completion.query.length < 2 ? <p className="px-3 py-2 text-xs text-fo-subtle">Type 2 or more characters to find people.</p> : suggestions.length === 0 ? <p className="px-3 py-2 text-xs text-fo-subtle">Loading suggestions…</p> : null}
          {completion.query.length >= 2 && suggestions.map((item) => {
            const label = `@${item.username}`;
            const detail = item.name || item.username;
            return <button key={item.id || item.tag} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applySuggestion(item)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-fo-surface-2"><span className="truncate text-sm font-medium text-fo-text">{label}</span><span className="shrink-0 truncate text-xs text-fo-subtle">{detail}</span></button>;
          })}
        </div>
      ) : null}
    </div>
  );
}

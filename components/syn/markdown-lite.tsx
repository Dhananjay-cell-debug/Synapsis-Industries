// ─── markdown-lite ─────────────────────────────────────────────────────────
// Small, dependable markdown renderer for Syn chat bubbles.
// Replaces react-markdown@10 which silently failed to parse `**bold**`, `### h3`,
// list items and inline code inside the SynChatPanel bubble cascade.
// Supports: # / ## / ### headings, **bold**, *italic*, _italic_, `code`,
// fenced ```code blocks```, bullet (-/*/+) and numeric (1.) lists, paragraphs
// separated by blank lines. Sanitizes against HTML injection.
//
// All inline rules override globals.css heading reset via Tailwind `!` prefix.

import React, { Fragment } from "react";

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Inline pass — runs left-to-right and outputs an array of React nodes.
// Order: code → bold → italic → links. Inline code stays raw (no nested parsing).
function inline(text: string, keyBase = ""): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let i = 0, key = 0;
    while (i < text.length) {
        const rest = text.slice(i);

        // Inline `code`
        const code = rest.match(/^`([^`\n]+)`/);
        if (code) {
            out.push(
                <code key={`${keyBase}c${key++}`} className="!bg-slate-200/70 !text-slate-800 px-1.5 py-[1px] rounded font-mono text-[11.5px]">
                    {code[1]}
                </code>
            );
            i += code[0].length; continue;
        }

        // **bold** or __bold__
        const bold = rest.match(/^\*\*([^*\n]+?)\*\*|^__([^_\n]+?)__/);
        if (bold) {
            out.push(
                <strong key={`${keyBase}b${key++}`} className="!font-bold !text-slate-900">
                    {bold[1] || bold[2]}
                </strong>
            );
            i += bold[0].length; continue;
        }

        // *italic* or _italic_  (single delimiter, not part of ** already consumed)
        const ital = rest.match(/^\*([^*\n]+?)\*|^_([^_\n]+?)_/);
        if (ital) {
            out.push(<em key={`${keyBase}i${key++}`} className="!italic">{ital[1] || ital[2]}</em>);
            i += ital[0].length; continue;
        }

        // [label](url)
        const link = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/);
        if (link) {
            out.push(
                <a key={`${keyBase}l${key++}`} href={link[2]} className="!text-blue-600 underline" target="_blank" rel="noreferrer">
                    {link[1]}
                </a>
            );
            i += link[0].length; continue;
        }

        // Plain character — accumulate until next special
        const nextSpecial = rest.search(/[`*_\[]/);
        const chunk = nextSpecial === -1 ? rest : rest.slice(0, Math.max(1, nextSpecial));
        out.push(<Fragment key={`${keyBase}t${key++}`}>{chunk}</Fragment>);
        i += chunk.length;
    }
    return out;
}

type Block =
    | { kind: "h"; level: 1 | 2 | 3 | 4; text: string }
    | { kind: "p"; text: string }
    | { kind: "ul"; items: string[] }
    | { kind: "ol"; items: string[] }
    | { kind: "pre"; code: string }
    | { kind: "hr" };

// Block pass — split on newlines, group lists and code fences.
function parse(md: string): Block[] {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const blocks: Block[] = [];
    let i = 0;

    while (i < lines.length) {
        const ln = lines[i];

        // Fenced code block
        if (ln.startsWith("```")) {
            const buf: string[] = []; i++;
            while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
            if (i < lines.length) i++; // skip closing ```
            blocks.push({ kind: "pre", code: buf.join("\n") });
            continue;
        }

        // Blank line → flush
        if (/^\s*$/.test(ln)) { i++; continue; }

        // Horizontal rule
        if (/^---+\s*$/.test(ln)) { blocks.push({ kind: "hr" }); i++; continue; }

        // Heading
        const h = ln.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
            blocks.push({ kind: "h", level: h[1].length as 1 | 2 | 3 | 4, text: h[2].trim() });
            i++; continue;
        }

        // Bullet list
        if (/^\s*[-*+]\s+/.test(ln)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
                i++;
            }
            blocks.push({ kind: "ul", items });
            continue;
        }

        // Numbered list
        if (/^\s*\d+\.\s+/.test(ln)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
                i++;
            }
            blocks.push({ kind: "ol", items });
            continue;
        }

        // Paragraph — collect until blank line or block boundary
        const buf: string[] = [];
        while (
            i < lines.length &&
            !/^\s*$/.test(lines[i]) &&
            !/^(#{1,4})\s+/.test(lines[i]) &&
            !/^\s*[-*+]\s+/.test(lines[i]) &&
            !/^\s*\d+\.\s+/.test(lines[i]) &&
            !lines[i].startsWith("```")
        ) { buf.push(lines[i]); i++; }
        blocks.push({ kind: "p", text: buf.join(" ") });
    }

    return blocks;
}

// Heading visual scale tuned for chat bubble — overrides globals.css h1-h6 reset.
const H_CLS: Record<number, string> = {
    1: "!font-sans !text-[15px] !font-bold !text-slate-900 !leading-tight !tracking-normal mt-1 mb-1",
    2: "!font-sans !text-[14px] !font-bold !text-slate-900 !leading-tight !tracking-normal mt-1 mb-1",
    3: "!font-sans !text-[13.5px] !font-bold !text-slate-900 !leading-tight !tracking-normal mt-1 mb-1",
    4: "!font-sans !text-[13px] !font-bold !text-slate-900 !leading-tight !tracking-normal mt-1 mb-1",
};

export function renderSynMarkdown(md: string): React.ReactNode {
    const blocks = parse(md || "");
    return blocks.map((b, idx) => {
        const k = `b${idx}`;
        switch (b.kind) {
            case "h": {
                const Tag = (`h${b.level}` as "h1" | "h2" | "h3" | "h4");
                return <Tag key={k} className={H_CLS[b.level]}>{inline(b.text, k)}</Tag>;
            }
            case "p":
                return <p key={k} className="mb-2 last:mb-0 whitespace-pre-wrap">{inline(b.text, k)}</p>;
            case "ul":
                return (
                    <ul key={k} className="list-disc pl-5 mb-2 space-y-0.5">
                        {b.items.map((it, j) => <li key={`${k}u${j}`}>{inline(it, `${k}u${j}`)}</li>)}
                    </ul>
                );
            case "ol":
                return (
                    <ol key={k} className="list-decimal pl-5 mb-2 space-y-0.5">
                        {b.items.map((it, j) => <li key={`${k}o${j}`}>{inline(it, `${k}o${j}`)}</li>)}
                    </ol>
                );
            case "pre":
                return (
                    <pre key={k} className="bg-slate-100 text-slate-800 rounded-md p-2 my-2 overflow-x-auto text-[11.5px] font-mono leading-snug">
                        <code dangerouslySetInnerHTML={{ __html: esc(b.code) }} />
                    </pre>
                );
            case "hr":
                return <hr key={k} className="my-3 border-slate-300" />;
        }
    });
}

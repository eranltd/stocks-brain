// Minimal markdown for our own docs: headings, paragraphs, nested lists, `code`, **bold**, *em*.
import { Fragment } from "react";

function inline(text, key) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (p.startsWith("`")) return <code key={k}>{p.slice(1, -1)}</code>;
    if (p.startsWith("**")) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={k}>{p.slice(1, -1)}</em>;
    return <Fragment key={k}>{p}</Fragment>;
  });
}

export function stripFrontMatter(src) {
  return src.replace(/^---\n[\s\S]*?\n---\n/, "");
}

export function Markdown({ source }) {
  const lines = stripFrontMatter(source).split("\n");
  const out = [];
  let para = [];
  let list = null; // { ordered, items: [{ text, children: [] }] }

  const flushPara = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(" "), out.length)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    const k = out.length;
    out.push(
      <Tag key={k}>
        {list.items.map((it, i) => (
          <li key={i}>
            {inline(it.text, `${k}-${i}`)}
            {it.children.length > 0 && <ul>{it.children.map((c, j) => <li key={j}>{inline(c, `${k}-${i}-${j}`)}</li>)}</ul>}
          </li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const h = raw.match(/^(#{1,3})\s+(.*)$/);
    const li = raw.match(/^(\s*)(-|\d+\.)\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const Tag = `h${h[1].length}`;
      out.push(<Tag key={out.length}>{inline(h[2], out.length)}</Tag>);
    } else if (li) {
      flushPara();
      const nested = li[1].length >= 2;
      if (nested && list?.items.length) list.items.at(-1).children.push(li[3]);
      else {
        if (!list) list = { ordered: /\d/.test(li[2]), items: [] };
        list.items.push({ text: li[3], children: [] });
      }
    } else if (/^\s{2,}\S/.test(raw) && list) {
      const last = list.items.at(-1);
      if (last.children.length) last.children[last.children.length - 1] += " " + raw.trim();
      else last.text += " " + raw.trim();
    } else if (!raw.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(raw.trim());
    }
  }
  flushPara(); flushList();
  return <div className="md">{out}</div>;
}

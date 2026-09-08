"use client";

/**
 * رندر مارک‌داون سبک و بدون وابستگی.
 * فقط زیرمجموعه‌ای که در صفحات CMS استفاده می‌شود: عنوان، پاراگراف،
 * فهرست، نقل‌قول، پیوند، پررنگ و کد درون‌خطی.
 */

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/`([^`]+)`/g, '<code class="ltr-nums rounded bg-canvas-alt px-1.5 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black text-ink">$1</strong>')
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="font-bold text-brand-600 hover:underline">$1</a>',
    );
}

export function Markdown({ source }: { source: string }) {
  const out: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (list) {
      out.push(
        `<ul class="my-4 space-y-2 ps-5 list-disc marker:text-brand-500">${list
          .map((li) => `<li class="text-ink-muted leading-8">${inline(li)}</li>`)
          .join("")}</ul>`,
      );
      list = null;
    }
  };

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { (list ||= []).push(li[1]); continue; }
    flush();

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const size = ["text-3xl", "text-2xl", "text-xl", "text-lg"][h[1].length - 1];
      out.push(`<h${h[1].length} class="mt-8 mb-3 ${size} font-black text-ink">${inline(h[2])}</h${h[1].length}>`);
      continue;
    }

    if (line.startsWith("> ")) {
      out.push(
        `<blockquote class="my-4 border-s-4 border-brand-500 bg-brand-50 px-5 py-3 text-sm leading-8 text-ink-soft">${inline(line.slice(2))}</blockquote>`,
      );
      continue;
    }

    if (/^(---|\*\*\*)$/.test(line)) {
      out.push('<hr class="my-8 border-ink/10" />');
      continue;
    }

    out.push(`<p class="my-3 leading-8 text-ink-muted">${inline(line)}</p>`);
  }
  flush();

  return <div dangerouslySetInnerHTML={{ __html: out.join("") }} />;
}

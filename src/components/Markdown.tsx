"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownProps = {
  children: string | null | undefined;
  className?: string;
  /** Tighter spacing for inline-ish places like card summaries. */
  variant?: "default" | "tight";
};

export function Markdown({ children, className, variant = "default" }: MarkdownProps) {
  if (!children) return null;
  const tight = variant === "tight";
  return (
    <div
      className={cn(
        "markdown-host",
        tight ? "markdown-tight" : "markdown-default",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={tight ? "leading-snug" : "leading-relaxed"}>
              {children}
            </p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline decoration-border decoration-1 underline-offset-2 transition-colors hover:decoration-foreground"
            >
              {children}
            </a>
          ),
          code: ({ className: cls, children, ...rest }) => {
            const isBlock = /^language-/.test(cls ?? "");
            if (isBlock) {
              return (
                <code className={cls} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded-[4px] border border-border/60 px-1 py-px font-mono text-[0.9em]"
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  background: "var(--code-bg)",
                  color: "var(--code-fg)",
                }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre
              className="overflow-x-auto rounded-inner border px-3 py-2 font-mono text-[11.5px] leading-relaxed"
              style={{
                fontFamily: "var(--font-mono), monospace",
                background: "var(--code-bg)",
                color: "var(--code-fg)",
                borderColor: "var(--code-border)",
              }}
            >
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="my-1 ml-4 list-disc space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 ml-4 list-decimal space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-medium text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground">{children}</em>
          ),
          h1: ({ children }) => (
            <h3 className="mt-1 text-[13px] font-medium">{children}</h3>
          ),
          h2: ({ children }) => (
            <h4 className="mt-1 text-[12.5px] font-medium">{children}</h4>
          ),
          h3: ({ children }) => (
            <h5 className="mt-1 text-[12px] font-medium">{children}</h5>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

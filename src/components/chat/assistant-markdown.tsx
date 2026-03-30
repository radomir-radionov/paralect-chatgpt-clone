"use client";

import { code } from "@streamdown/code";
import { createMathPlugin } from "@streamdown/math";
import { memo } from "react";
import { Streamdown, type Components } from "streamdown";
import "katex/dist/katex.min.css";

const math = createMathPlugin({
  singleDollarTextMath: true,
});

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary font-medium underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc pl-5 [li]:my-0.5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal pl-5 [li]:my-0.5">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-muted-foreground/40 my-2 border-l-2 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-background/80 rounded px-1.5 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-background/80 my-2 overflow-x-auto rounded-lg p-3 text-xs leading-relaxed [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  h1: ({ children }) => (
    <h1 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-3 mb-1 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold first:mt-0">{children}</h3>
  ),
  hr: () => <hr className="border-border my-3" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full min-w-48 border-collapse text-left text-xs">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-border/60 border-b">{children}</tr>,
  th: ({ children }) => (
    <th className="px-2 py-1.5 font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
};

type AssistantMarkdownProps = {
  content: string;
};

export const AssistantMarkdown = memo(function AssistantMarkdown({
  content,
}: AssistantMarkdownProps) {
  return (
    <div className="min-w-0 wrap-break-word [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
      <Streamdown
        mode="static"
        isAnimating={false}
        parseIncompleteMarkdown
        animated={false}
        components={markdownComponents}
        plugins={{ code, math }}
        shikiTheme={["github-light", "github-dark"]}
        controls={{ code: true, table: true }}
      >
        {content}
      </Streamdown>
    </div>
  );
});

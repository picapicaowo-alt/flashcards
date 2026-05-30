"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

export function MarkdownContent({ value, large = false }: { value: string; large?: boolean }) {
  return (
    <div className={large ? "markdown markdown-large" : "markdown"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {value}
      </ReactMarkdown>
    </div>
  );
}

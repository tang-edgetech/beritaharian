import type { RichTextNode } from "@cendol/api-client";
import type { ReactNode } from "react";

/**
 * Turns the stored story document into page elements. Only the node types the API allows are drawn,
 * and no HTML string is ever injected, so nothing in a story can run code on the reader's phone.
 */
export function RichText({ doc }: { doc: RichTextNode | null | undefined }) {
  if (!doc?.content?.length) return null;
  return <div className="article-body">{doc.content.map((node, i) => renderNode(node, i))}</div>;
}

function renderMarks(text: string, marks: RichTextNode["marks"], key: number): ReactNode {
  let out: ReactNode = text;
  for (const mark of marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>;
    else if (mark.type === "italic") out = <em>{out}</em>;
    else if (mark.type === "strike") out = <s>{out}</s>;
    else if (mark.type === "link") {
      const href = String(mark.attrs?.href ?? "");
      out = (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {out}
        </a>
      );
    }
  }
  return <span key={key}>{out}</span>;
}

function children(node: RichTextNode): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, i));
}

function renderNode(node: RichTextNode, key: number): ReactNode {
  switch (node.type) {
    case "text":
      return renderMarks(node.text ?? "", node.marks, key);
    case "paragraph":
      return node.content?.length ? <p key={key}>{children(node)}</p> : null;
    case "heading":
      return node.attrs?.level === 3 ? <h3 key={key}>{children(node)}</h3> : <h2 key={key}>{children(node)}</h2>;
    case "bulletList":
      return <ul key={key}>{children(node)}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(node.attrs?.start ?? 1)}>
          {children(node)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children(node)}</li>;
    case "blockquote":
      return <blockquote key={key}>{children(node)}</blockquote>;
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image":
      return (
        <figure key={key} className="article-body-figure">
          {/* eslint-disable-next-line @next/next/no-img-element -- pictures come from the API media library */}
          <img src={String(node.attrs?.src ?? "")} alt={String(node.attrs?.alt ?? "")} loading="lazy" decoding="async" />
          {node.attrs?.title ? <figcaption>{String(node.attrs.title)}</figcaption> : null}
        </figure>
      );
    default:
      return null;
  }
}

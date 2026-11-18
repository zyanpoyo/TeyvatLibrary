import { Fragment } from "react";
import { splitHighlightedText } from "../../domain/search";

export interface HighlightedTextProps {
  text: string;
  query?: string;
  markClassName?: string;
}

/**
 * テキスト内の検索語一致箇所を <mark> 要素で強調描画する共通コンポーネント。
 */
export function HighlightedText({ text, query, markClassName }: HighlightedTextProps) {
  if (!query || !query.trim()) {
    return <>{text}</>;
  }
  const segments = splitHighlightedText(text, query);
  return (
    <>
      {segments.map((seg, idx) =>
        seg.highlighted ? (
          <mark key={idx} className={markClassName}>
            {seg.text}
          </mark>
        ) : (
          <Fragment key={idx}>{seg.text}</Fragment>
        )
      )}
    </>
  );
}

import { useState, type MouseEvent } from "react";
import type { StorySearchMatch } from "../../domain/search";
import type { SearchJumpTarget } from "../../types/story";
import { HighlightedText } from "../common/HighlightedText";
import styles from "./SearchSnippets.module.css";

const INITIAL_VISIBLE_SNIPPETS = 3;

export interface SearchSnippetsProps {
  storyId: string;
  query: string;
  match: StorySearchMatch;
  onSelectSnippet: (storyId: string, target: SearchJumpTarget) => void;
}

/**
 * 検索一致カード内に表示する一致スニペット一覧と該当箇所への直通ジャンプ操作。
 */
export function SearchSnippets({
  storyId,
  query,
  match,
  onSelectSnippet,
}: SearchSnippetsProps) {
  const [expanded, setExpanded] = useState(false);

  if (match.snippets.length === 0) {
    return null;
  }

  const visibleSnippets = expanded
    ? match.snippets
    : match.snippets.slice(0, INITIAL_VISIBLE_SNIPPETS);
  const hiddenCount = match.snippets.length - INITIAL_VISIBLE_SNIPPETS;

  const stopCardOpen = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      className={`${styles.snippetsBox} search-snippets`}
      data-search-snippets="true"
      onClick={stopCardOpen}
    >
      <ul className={styles.snippetsList}>
        {visibleSnippets.map((snippet) => (
          <li key={snippet.id} className={styles.snippetRow}>
            <button
              type="button"
              className={`${styles.snippetBtn} search-snippet-btn`}
              data-snippet-kind={snippet.kind}
              onClick={(e) => {
                e.stopPropagation();
                onSelectSnippet(storyId, snippet.target);
              }}
            >
              <span className={styles.snippetLabel}>{snippet.label}</span>
              <span className={styles.snippetText}>
                <HighlightedText
                  text={snippet.text}
                  query={query}
                  markClassName={styles.searchMark}
                />
              </span>
              <span className={styles.snippetArrow} aria-hidden="true">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          className={`${styles.expandBtn} search-snippets-toggle`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((prev) => !prev);
          }}
        >
          {expanded
            ? "✕ 一致スニペットを折りたたむ"
            : `✦ 他 ${hiddenCount} 件の一致を表示`}
        </button>
      ) : null}
    </div>
  );
}

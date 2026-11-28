import { Link } from "react-router";
import { parseEvidenceTokens } from "../../domain/text-parser";
import type { EvidenceLink } from "../../types/story";

export interface EvidenceTextProps {
  evidence: string;
  evidenceLinks?: ReadonlyArray<EvidenceLink>;
  linkClassName?: string;
  onSelectEvidenceLink?: (targetStoryId: string) => void;
}

/**
 * 出典・根拠テキスト内の収録済み作品名（『作品名』）をリーダーへのリンクへ解決して描画する共通部品。
 */
export function EvidenceText({
  evidence,
  evidenceLinks,
  linkClassName,
  onSelectEvidenceLink,
}: EvidenceTextProps) {
  const tokens = parseEvidenceTokens(evidence, evidenceLinks);
  const resolvedLinkClass = linkClassName ? `${linkClassName} evidence-link` : "evidence-link";

  return (
    <>
      {tokens.map((token, idx) =>
        token.type === "link" ? (
          <Link
            key={`${token.storyId}-${idx}`}
            className={resolvedLinkClass}
            to={`/story/${encodeURIComponent(token.storyId)}`}
            data-target-id={token.storyId}
            onClick={() => onSelectEvidenceLink?.(token.storyId)}
          >
            『{token.title}』
          </Link>
        ) : (
          <span key={`txt-${idx}`}>{token.value}</span>
        )
      )}
    </>
  );
}

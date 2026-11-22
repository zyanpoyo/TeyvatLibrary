import { useMemo } from "react";
import type { StoryShareMethod } from "../../analytics/ga4";
import { buildStoryShareUrl, buildXShareIntentUrl } from "../../domain/share";
import type { StoryDetail } from "../../types/story";
import { ShareBar } from "../common/ShareBar";

export interface StoryShareBarProps {
  story: Pick<StoryDetail, "id" | "title" | "shelfCategory" | "categoryLabel" | "tags">;
  onShare?: (method: StoryShareMethod) => void;
}

/**
 * リーダー末尾に控えめに配置する作品単位のシェアバー（X シェア／URL コピー）。
 */
export function StoryShareBar({ story, onShare }: StoryShareBarProps) {
  const shareUrl = useMemo(() => buildStoryShareUrl(story.id), [story.id]);
  const xIntentUrl = useMemo(() => buildXShareIntentUrl(story), [story]);

  return (
    <ShareBar
      id="story-share-bar"
      ariaLabel="作品を共有"
      shareUrl={shareUrl}
      xIntentUrl={xIntentUrl}
      xActionName="share-story-x"
      copyActionName="copy-story-url"
      resetKey={story.id}
      onShare={onShare}
    />
  );
}

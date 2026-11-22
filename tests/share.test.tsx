import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryShareBar } from "../src/components/reader/StoryShareBar";
import {
  buildCourseShareText,
  buildCourseShareUrl,
  buildCourseXShareIntentUrl,
  buildStoryShareText,
  buildStoryShareUrl,
  buildXShareIntentUrl,
} from "../src/domain/share";

const SAMPLE_STORY = {
  id: "crimson_witch",
  title: "燃え盛る炎の魔女",
  shelfCategory: "artifact" as const,
  categoryLabel: "聖遺物（連作短編）",
  tags: ["ロザリン（淑女）", "500年前の災厄"],
};

describe("story share helpers and StoryShareBar", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("builds canonical share URL, X share text, and X intent URL", () => {
    expect(buildStoryShareUrl("crimson_witch")).toBe("https://teyvat-bunko.com/story/crimson_witch");
    expect(buildStoryShareText(SAMPLE_STORY)).toBe(
      "聖遺物『燃え盛る炎の魔女』（ロザリン（淑女））｜テイワット文庫"
    );

    const intent = new URL(buildXShareIntentUrl(SAMPLE_STORY));
    expect(intent.origin + intent.pathname).toBe("https://x.com/intent/tweet");
    expect(intent.searchParams.get("url")).toBe("https://teyvat-bunko.com/story/crimson_witch");
    expect(intent.searchParams.get("text")).toBe(
      "聖遺物『燃え盛る炎の魔女』（ロザリン（淑女））｜テイワット文庫"
    );
    expect(intent.searchParams.get("hashtags")).toBe("原神,原神考察,テイワット文庫");

    const sampleCourse = {
      id: "rosalyne_chronicle",
      title: "ロザリン（淑女）とルースタンの500年",
      storyCount: 5,
      totalReadingTime: "約7分",
    };
    expect(buildCourseShareUrl(sampleCourse.id)).toBe(
      "https://teyvat-bunko.com/courses/rosalyne_chronicle"
    );
    expect(buildCourseShareText(sampleCourse)).toBe(
      "読書コース『ロザリン（淑女）とルースタンの500年』（全5篇・約7分）｜テイワット文庫"
    );
    const courseIntent = new URL(buildCourseXShareIntentUrl(sampleCourse));
    expect(courseIntent.searchParams.get("url")).toBe(
      "https://teyvat-bunko.com/courses/rosalyne_chronicle"
    );
  });

  it("copies canonical URL without disabling button, updates external status region, and fires onShare", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onShare = vi.fn();

    render(<StoryShareBar story={SAMPLE_STORY} onShare={onShare} />);

    const xLink = screen.getByRole("link", { name: "X でシェア" });
    expect(xLink).toHaveAttribute("target", "_blank");
    expect(xLink).toHaveAttribute("rel", "noopener noreferrer");

    const copyBtn = screen.getByRole("button", { name: "URL をコピー" });
    const statusRegion = screen.getByRole("status");
    expect(copyBtn.contains(statusRegion)).toBe(false);
    expect(statusRegion).toHaveTextContent("");

    await user.click(copyBtn);
    expect(writeText).toHaveBeenCalledWith("https://teyvat-bunko.com/story/crimson_witch");
    expect(onShare).toHaveBeenCalledWith("copy");
    expect(copyBtn).not.toBeDisabled();
    expect(copyBtn).toHaveAttribute("data-copied", "true");
    expect(statusRegion.textContent).toBe("URL をコピーしました");

    // 連続押下で VoiceOver 対策の NBSP 付与により文字列が切り替わる
    await user.click(copyBtn);
    expect(statusRegion.textContent).toBe("URL をコピーしました\u00A0");

    // X シェア押下で x メソッドが通知される
    await user.click(xLink);
    expect(onShare).toHaveBeenLastCalledWith("x");
  });

  it("surfaces failure message when clipboard write rejects and clears feedback after timeout", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockRejectedValue(new Error("Permission denied"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onShare = vi.fn();

    render(<StoryShareBar story={SAMPLE_STORY} onShare={onShare} />);

    const copyBtn = screen.getByRole("button", { name: "URL をコピー" });
    const statusRegion = screen.getByRole("status");

    await act(async () => {
      copyBtn.click();
      await Promise.resolve();
    });

    expect(onShare).not.toHaveBeenCalled();
    expect(copyBtn).not.toBeDisabled();
    expect(copyBtn).toHaveAttribute("data-failed", "true");
    expect(statusRegion.textContent).toBe("コピーできませんでした");

    act(() => {
      vi.advanceTimersByTime(2300);
    });
    expect(copyBtn).not.toHaveAttribute("data-failed");
    expect(statusRegion.textContent).toBe("");
  });
});

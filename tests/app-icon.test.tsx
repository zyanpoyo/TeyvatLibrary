import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppIcon, type AppIconName } from "../src/components/common/AppIcon";

const ALL_ICONS: readonly AppIconName[] = [
  "bookmark",
  "hourglass",
  "magnifier",
  "dice",
  "open-book",
  "lantern",
  "link-rings",
  "books",
];

const RAW_SOURCE_FILES = import.meta.glob<string>("../src/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("AppIcon", () => {
  it("renders all 8 icon variants as decorative SVGs with data-icon", () => {
    for (const name of ALL_ICONS) {
      const { container } = render(<AppIcon name={name} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("data-icon", name);
      expect(svg).toHaveAttribute("data-active", "false");
    }
  });

  it("toggles data-active state for stateful icons", () => {
    const { container, rerender } = render(<AppIcon name="bookmark" active={false} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-active", "false");

    rerender(<AppIcon name="bookmark" active={true} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-active", "true");

    rerender(<AppIcon name="magnifier" active={true} />);
    expect(container.querySelector("svg")).toHaveAttribute("data-icon", "magnifier");
    expect(container.querySelector("svg")).toHaveAttribute("data-active", "true");
  });

  it("ensures none of the replaced color emojis remain in src/", () => {
    const entries = Object.entries(RAW_SOURCE_FILES);
    expect(entries.length).toBeGreaterThan(0);

    const replacedEmojis = /[⏱🔖🔍🎲📖💡🔗📚]/u;
    const hits = entries.filter(([, content]) => replacedEmojis.test(content)).map(([filePath]) => filePath);

    expect(hits).toEqual([]);
  });
});

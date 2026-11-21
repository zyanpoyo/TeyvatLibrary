import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTACT_FORM_URL,
  DEFAULT_CONTACT_X_URL,
  DEFAULT_GITHUB_ISSUES_URL,
  DEFAULT_OPERATOR_NAME,
  resolveSiteContactConfig,
  sanitizeContactEmail,
  sanitizeExternalHttpUrl,
} from "../src/config/site-contact";

describe("site-contact config resolver", () => {
  it("falls back to default operator, GitHub Issues, contact form, and X URLs and hides email when env vars are unset", () => {
    expect(resolveSiteContactConfig({})).toEqual({
      operatorName: DEFAULT_OPERATOR_NAME,
      githubIssuesUrl: DEFAULT_GITHUB_ISSUES_URL,
      contactFormUrl: DEFAULT_CONTACT_FORM_URL,
      contactEmail: null,
      contactXUrl: DEFAULT_CONTACT_X_URL,
    });
  });

  it("resolves valid http(s) URLs and trimmed email addresses", () => {
    expect(
      resolveSiteContactConfig({
        VITE_GITHUB_ISSUES_URL: "  https://github.com/example/repo/issues  ",
        VITE_CONTACT_FORM_URL: " https://docs.google.com/forms/d/e/test/viewform ",
        VITE_CONTACT_EMAIL: "  support@example.com  ",
        VITE_CONTACT_X_URL: "  https://x.com/example_handle  ",
      })
    ).toEqual({
      operatorName: DEFAULT_OPERATOR_NAME,
      githubIssuesUrl: "https://github.com/example/repo/issues",
      contactFormUrl: "https://docs.google.com/forms/d/e/test/viewform",
      contactEmail: "support@example.com",
      contactXUrl: "https://x.com/example_handle",
    });
  });

  it("rejects dangerous or non-http(s) URL schemes and relative paths", () => {
    expect(sanitizeExternalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeExternalHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(sanitizeExternalHttpUrl("/relative/path")).toBeNull();
    expect(sanitizeExternalHttpUrl("not a url")).toBeNull();

    expect(
      resolveSiteContactConfig({
        VITE_GITHUB_ISSUES_URL: "javascript:alert(1)",
        VITE_CONTACT_FORM_URL: "ftp://example.com/form",
        VITE_CONTACT_X_URL: "javascript:void(0)",
      })
    ).toEqual({
      operatorName: DEFAULT_OPERATOR_NAME,
      githubIssuesUrl: DEFAULT_GITHUB_ISSUES_URL,
      contactFormUrl: DEFAULT_CONTACT_FORM_URL,
      contactEmail: null,
      contactXUrl: DEFAULT_CONTACT_X_URL,
    });
  });

  it("rejects malformed email addresses", () => {
    expect(sanitizeContactEmail("")).toBeNull();
    expect(sanitizeContactEmail("invalid-email")).toBeNull();
    expect(sanitizeContactEmail("user name@example.com")).toBeNull();
    expect(sanitizeContactEmail("user@example.com\ncc:evil@example.com")).toBeNull();
    expect(sanitizeContactEmail("user@domain")).toBeNull();
  });
});

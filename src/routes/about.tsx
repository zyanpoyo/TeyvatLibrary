import { ABOUT_DOCUMENT_TITLE, AboutPage } from "../components/about/AboutPage";
import { buildCanonicalMetaTag } from "../config/site-url";

export function meta() {
  return [{ title: ABOUT_DOCUMENT_TITLE }, ...buildCanonicalMetaTag("/about")];
}

export default function AboutRoute() {
  return <AboutPage />;
}

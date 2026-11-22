import { AboutPage } from "../components/about/AboutPage";
import { buildAboutMeta } from "../domain/seo";

export function meta() {
  return buildAboutMeta();
}

export default function AboutRoute() {
  return <AboutPage />;
}

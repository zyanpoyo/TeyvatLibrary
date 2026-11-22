import { ABOUT_DOCUMENT_TITLE, AboutPage } from "../components/about/AboutPage";

export function meta() {
  return [{ title: ABOUT_DOCUMENT_TITLE }];
}

export default function AboutRoute() {
  return <AboutPage />;
}

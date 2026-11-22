import { ShelfPage } from "../components/shelf/ShelfPage";
import { BASE_DOCUMENT_TITLE } from "../state/AppProviders";

export function meta() {
  return [{ title: BASE_DOCUMENT_TITLE }];
}

export default function ShelfRoute() {
  return <ShelfPage />;
}

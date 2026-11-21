/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_GA_DEBUG?: string;
  readonly VITE_GITHUB_ISSUES_URL?: string;
  readonly VITE_CONTACT_FORM_URL?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_CONTACT_X_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

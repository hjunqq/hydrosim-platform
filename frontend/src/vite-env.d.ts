/// <reference types="vite/client" />

type OptionalString = string | undefined

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: OptionalString
  readonly VITE_APP_TITLE: OptionalString
  readonly VITE_DEVEXTREME_LICENSE: OptionalString
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

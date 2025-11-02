declare module '@stoplight/elements/web-components.min.js';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elements-api': {
        apiDescriptionUrl?: string;
        router?: string;
        layout?: string;
        logo?: string;
        hideInternal?: boolean;
        hideExport?: boolean;
        tryItCredentialsPolicy?: string;
        basePath?: string;
        hideTryIt?: boolean;
        hideSchemas?: boolean;
        hideDownloadButton?: boolean;
      };
    }
  }
}
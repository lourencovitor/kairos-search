/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_AD_SLOT_LEADERBOARD?: string;
  readonly VITE_AD_SLOT_FEED?: string;
  readonly VITE_AD_SLOT_SIDEBAR_TOP?: string;
  readonly VITE_AD_SLOT_SIDEBAR_BOT?: string;
  readonly VITE_FEATURE_ATS_ANALYSIS?: string;
  readonly VITE_FEATURE_AUTH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  adsbygoogle: object[];
}

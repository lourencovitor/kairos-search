export const ADSENSE_CLIENT =
  (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined) ?? 'ca-pub-XXXXXXXXXXXXXXXX';

export const ADS_ENABLED = import.meta.env.PROD && ADSENSE_CLIENT !== 'ca-pub-XXXXXXXXXXXXXXXX';

export const AD_SLOTS = {
  leaderboard: (import.meta.env.VITE_AD_SLOT_LEADERBOARD as string | undefined) ?? '0000000001',
  feed: (import.meta.env.VITE_AD_SLOT_FEED as string | undefined) ?? '0000000002',
  sidebarTop: (import.meta.env.VITE_AD_SLOT_SIDEBAR_TOP as string | undefined) ?? '0000000003',
  sidebarBot: (import.meta.env.VITE_AD_SLOT_SIDEBAR_BOT as string | undefined) ?? '0000000004',
} as const;

export const GLOBAL_CSS = {
  '::selection': { background: '#1A2E4A28' },
  '*::-webkit-scrollbar': { width: '5px', height: '5px' },
  '*::-webkit-scrollbar-track': { background: 'transparent' },
  '*::-webkit-scrollbar-thumb': { background: '#CBD5E1', borderRadius: '3px' },
  '*::-webkit-scrollbar-thumb:hover': { background: '#94A3B8' },
  '@keyframes kairosIn': {
    from: { opacity: 0, transform: 'translateY(10px)' },
    to: { opacity: 1, transform: 'translateY(0)' },
  },
};

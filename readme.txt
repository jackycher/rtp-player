rtp2httpd-player/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── public/
│   └── favicon.ico
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── types/
    │   └── player.ts
    ├── lib/
    │   ├── player-storage.ts
    │   ├── epg-parser.ts
    │   ├── m3u-parser.ts
    │   ├── locale.ts
    │   └── utils.ts
    ├── hooks/
    │   ├── use-player-translation.ts
    │   ├── use-m3u-loader.ts
    │   └── use-epg-loader.ts
    └── components/
        ├── ui/
        │   └── card.tsx
        ├── player/
        │   ├── Player.tsx
        │   ├── EPGView.tsx
        │   ├── ChannelList.tsx
        │   └── PlayerControls.tsx
        └── layout/
            └── MainLayout.tsx

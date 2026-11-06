# NO COMMENT PWA

## Project structure
```text
no-comment-pwa/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── service-worker.js
├── assets/
│   └── icon.svg
├── data/
│   └── cards.json
└── README.md
```

- `index.html`: app screens and controls.
- `styles.css`: responsive black, charcoal and red visual design.
- `app.js`: player setup, turn rotation, card selection and game flow.
- `data/cards.json`: editable card library. The starter currently embeds the same sample cards in `app.js`; next step is to load this JSON as the single source of truth.
- `manifest.webmanifest`: install metadata and app icon.
- `service-worker.js`: offline app-shell caching.
- `assets/icon.svg`: install icon.

## Publish
Upload the folder contents to a GitHub repository and enable GitHub Pages from Settings → Pages. PWAs require HTTPS (GitHub Pages supplies it). Open the published URL in Chrome on Android and use the browser menu → Install app / Add to Home screen.

## Current scaffold
This is a working visual and gameplay starter, not the finished January release. Full deck content, persistent player settings, intensity controls, functional Double Down spending, and final device/offline testing are next.

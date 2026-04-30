# Public media assets

Files placed in this directory are served from the site root by Vite (and later Cloudflare Pages deployment).

Example:

- `public/assets/sounds/timer-warning.mp3` becomes `/assets/sounds/timer-warning.mp3`

Google Sheets should store relative paths such as:

- `/assets/question-images/year5-science/matter/example.png`

Do not use private GitHub raw URLs in Google Sheets.

If the media library grows large, move media to Cloudflare R2 or another dedicated object storage/CDN.

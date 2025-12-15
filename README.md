## Kalyan AI marketing site

Astro + Tailwind, static build. Canonical host: https://www.kalyanai.io (Nginx handles apex→www and http→https).

### Local development
- `npm install`
- `npm run dev -- --host 127.0.0.1 --port 4321`

### Build and preview
- `npm run build` (outputs to `dist/`)
- `npm run preview -- --host 127.0.0.1 --port 4322`

### Production deploy (current VPS)
- Build locally: `npm run build`
- Deploy: `sudo rsync -a --delete dist/ /var/www/kalyanai.io/`

### SEO
- Sitemap: `/sitemap-index.xml`
- Robots: `/robots.txt`

### Analytics
- Plausible enabled for `www.kalyanai.io`
- Events tracked via `data-plausible` attributes: `BookACall`, `EmailClick`

### Server notes (no secrets)
- Nginx config: `/etc/nginx/conf.d/kalyanai-live.conf`
- Certbot manages TLS
- Firewall must allow HTTPS (`firewall-cmd --add-service=https`)
- Do **not** store passwords/keys in the repo.

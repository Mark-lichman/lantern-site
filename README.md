# Lantern site

Static marketing site for **Lantern**, a bedtime reading app for kids under 12.
Hosted on GitHub Pages at https://lanternbook.org.

Plain HTML, one shared stylesheet, one small script. No build step.

```
site/
  index.html        home (families, waitlist)
  pilot/index.html  design partners (schools and nonprofits, application form)
  404.html
  styles.css        shared styles and color tokens
  app.js            forms, CRM submit, analytics
  favicon.svg
  CNAME             lanternbook.org
  .nojekyll
  robots.txt
  sitemap.xml
```

## Preview locally

```
cd site && python -m http.server 5190
```

Then open http://localhost:5190. Links use root paths (`/`, `/pilot/`, `/styles.css`),
so serve from inside `site/`, not the repo root.

On localhost, form submissions are logged to the browser console instead of being sent.
Add `?crm=1` to the URL to send to the real webhook from localhost.

## Deploy

Push to `main`. The workflow in `.github/workflows/pages.yml` uploads the `site/`
folder and deploys it with GitHub Pages. In the repo settings, set
**Pages > Build and deployment > Source** to **GitHub Actions**, and set the custom
domain to `lanternbook.org` (the `site/CNAME` file matches).

## Configuration

Both values live at the top of `site/app.js`:

- `WEBHOOK_URL`: the GoHighLevel inbound webhook that receives waitlist signups
  (`event: "waitlist"`) and pilot applications (`event: "pilot_application"`).
  While it is empty, submissions are only logged to the console.
- `GA_ID`: the Google Analytics 4 measurement ID (`G-...`). While it is empty, no
  analytics script loads. Analytics only receives `sign_up` and `generate_lead`
  events with fixed labels, never an email address or free text.

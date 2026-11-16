# Ryan "Big R" Thomas memorial website

A simple website with no build step. Every file here is the site.

| File | What it is |
| --- | --- |
| `index.html` | The page: Ryan's story, the bench, the outing |
| `site-config.js` | **The file to edit** for the park name, bench photo, map link and photo gallery |
| `styles.css`, `script.js` | Look and behavior |
| `images/` | Photos |
| `tools/qr-maker.html` | Makes the QR code file for the engraver |

## Put it online with GitHub Pages (free)

1. Sign in at github.com and click **New repository**. Name it `bigr` (or anything), set it to **Public**, click **Create**.
2. On the new repository page click **uploading an existing file**. Drag in everything from this folder, including the `images` and `tools` folders. Click **Commit changes**.
3. Go to **Settings → Pages**. Under **Branch** choose `main` and `/ (root)`, then **Save**.
4. After about a minute the site is live at `https://YOUR-USERNAME.github.io/bigr/`.

## Use your own domain

1. Buy the domain from a registrar (Cloudflare, Namecheap, Porkbun, Squarespace).
2. In the repository, **Settings → Pages → Custom domain**: enter the domain and save.
3. At the registrar, add these DNS records:
   - Four `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record for `www` pointing to `YOUR-USERNAME.github.io`
4. Back in **Settings → Pages**, tick **Enforce HTTPS** once it becomes available (can take up to a day).

To use a free subdomain of bigrgolf.com instead (for example `ryan.bigrgolf.com`), skip step 1, enter that name in step 2, and add a single `CNAME` record for `ryan` pointing to `YOUR-USERNAME.github.io` wherever bigrgolf.com's DNS is managed.

## Add photos or bench details later

Open `site-config.js` on GitHub, click the pencil icon, edit, and **Commit changes**. Upload new photos into the `images` folder first. The site updates in about a minute.

## Make the QR code

Open `tools/qr-maker.html` in a browser, type the final website address, and download the SVG for the engraver. Read the checklist on that page before engraving.

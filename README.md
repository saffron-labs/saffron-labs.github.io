# saffron-labs.github.io

The Saffron Labs website, served by GitHub Pages at **https://saffronlabs.in**.

Static HTML, no build step, no dependencies. Edit and push to `main`; Pages redeploys in about a minute.

## Pages

| Page | File | What's on it |
| --- | --- | --- |
| Home | `index.html` | Statement and showreel, the needs picker, recent work (3 pieces), Start with one week |
| Work | `work/index.html` | All work in three tabs: Media, Websites and software, Automation |
| Services | `services/index.html` | What we build, How a project runs, Start with one week |
| About | `about/index.html` | How we work (four points), and how we use AI |
| FAQs | `faq/index.html` | Question chips; each answer opens in a side panel |
| Contact | `contact/index.html` | WhatsApp, email, partnerships, Instagram |
| Links | `links/index.html` | The Instagram bio link page |

Every page except Contact ends with a "Let's talk →" band linking to `/contact/`.

## Shared parts

There's no build step, so the **header, menu and footer are copied into every page**. If you change one (a new menu item, a new phone number), change it in all six pages. The menu marks the current page with `aria-current="page"`, so move that attribute when you copy it.

Paths start with `/` (`/style.css`, `/media/...`) so they work from any folder.

## Files

| File | What it is |
| --- | --- |
| `style.css` | All styles. Colour and type tokens are at the top in `:root` |
| `script.js` | Menu, needs picker, work tabs, demos, FAQ panel, video loading and the pause button. Each part only runs on pages that have it |
| `media/loops/` | The short video loops and poster images the site uses |
| `media/` | Older full-length films, not loaded by any page |
| `404.html` | Not-found page |
| `CNAME` | Tells GitHub Pages to serve this repo at `saffronlabs.in`. Do not delete it |

## FAQs

Each question is a `<button class="chip" data-faq="key">` in a `.faq-group` in `faq/index.html`, and its answer is a `<div id="faq-key" data-group="Group name">` inside `.faq-answers` (an `<h4>` for the question, `<p>` for the answer). Keep answers to things we actually do; don't promise anything not on the site.

## Adding work

The Work page has three tabs, each a `<div class="grid" role="tabpanel">` in `work/index.html`:

- `#p-media` for films, reels and posters
- `#p-soft` for websites and software
- `#p-auto` for automations

Add a client project as the first `<figure class="piece">` in its tab and update the count in the matching tab button. `piece wide` takes half the row, `piece` a third, `piece full` the whole row.

A video piece looks like this. Videos load and play only while on screen:

```html
<figure class="piece"><div class="frame">
  <video muted loop playsinline preload="metadata" poster="/media/loops/cafe.jpg" data-src="/media/loops/cafe.mp4" aria-label="What the video shows"></video>
</div><figcaption>Client name <span>What it is</span></figcaption></figure>
```

Keep each loop under 1 MB: about 8 seconds, no sound, H.264, roughly 600 px on the short side. For example:

```sh
ffmpeg -i input.mp4 -t 8 -an -vf "scale=480:-2,fps=24" -c:v libx264 -crf 30 -pix_fmt yuv420p -movflags +faststart media/loops/name.mp4
ffmpeg -i media/loops/name.mp4 -frames:v 1 -q:v 5 media/loops/name.jpg
```

## Honesty rules baked into the page

These are deliberate and should not be quietly removed:

1. Every film in the Media tab is a concept made for a brand that did not hire us, and carries a "Concept" tag. Do not present them as client work.
2. Every piece in the Websites and software and Automation tabs is a demo on invented data, tagged "Demo" or "Live demo", and its caption says so. Replace demos with real projects as they ship; never relabel a demo as a client.
3. No client logos, testimonials, stats or prices we can't back with a named client.
4. The site presents Saffron Labs as an agency that works remotely with clients anywhere. Don't add a city or region, or describe the team's size.

## Contact details used on the page

WhatsApp +91 82816 96632 (every WhatsApp button links to `wa.me/918281696632` with a pre-filled message) and hello@saffronlabs.in.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

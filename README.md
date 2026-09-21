# saffron-labs.github.io

The Saffron Labs website, served by GitHub Pages at **https://saffronlabs.in**.

Static HTML, no build step, no dependencies. Edit `index.html` and push; Pages redeploys in about a minute.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole site — markup, styles and content in one file |
| `404.html` | Not-found page, same brand |
| `CNAME` | Tells GitHub Pages to serve this repo at `saffronlabs.in`. Do not delete it |

## Adding work to the portfolio

The six cards under **Selected concepts** are placeholders. Each one looks like this:

```html
<div class="piece">
  <div class="slot"><span>9:16 · 15 sec<br>replace with hero cut</span></div>
  <h3>Café &amp; restaurant</h3>
  <p class="note">Evening menu, one dish, three hooks.</p>
</div>
```

To fill one, replace the `<div class="slot">…</div>` with the real asset:

```html
<!-- a still -->
<img src="work/cafe-hero.jpg" alt="Evening menu ad for a Phagwara café" style="aspect-ratio:9/14;object-fit:cover;width:100%">

<!-- or a video -->
<video src="work/cafe-hero.mp4" poster="work/cafe-hero.jpg" muted loop playsinline controls
       style="aspect-ratio:9/14;object-fit:cover;width:100%"></video>
```

Put the files in a `work/` folder at the repo root. Keep each video under ~10 MB — GitHub Pages is not a video host, and a heavy page loses the visitor before it loads. For anything larger, upload to YouTube or Vimeo unlisted and embed.

## Brand

Colours, type and usage rules live in the Saffron Labs design system. The short version, both defined at the top of `index.html`:

- Ground is white, text is near-black, saffron appears **once per section** and never as a large field.
- Corners are square by default. Only status pills are round.
- Type is Archivo (display), Anek Latin / Anek Devanagari (text), IBM Plex Mono (utility).

## Honesty rules baked into the page

Two things on this site are deliberate and should not be quietly removed:

1. The concepts section states that those pieces were made for businesses that have not commissioned us. Do not present them as client work.
2. The Clients section is empty and says so. Fill it with real work and real numbers, or leave it.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

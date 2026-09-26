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

The **Ads** section (`#work`) has three groups of placeholders: one hero film (16:9), six reels (9:16) and four posters (4:5). Each placeholder is a `<div class="slot">…</div>` inside a `<figure class="piece">`. Replace the slot with the real asset and keep the caption:

```html
<!-- a poster -->
<img src="work/cafe-weekend.jpg" alt="Weekend offer poster for a Phagwara café" style="aspect-ratio:4/5">

<!-- a reel (use 16/9 for the hero film) -->
<video src="work/cafe-reel.mp4" poster="work/cafe-reel.jpg" muted loop playsinline preload="metadata"
       style="aspect-ratio:9/16"></video>
```

Videos in the Ads section play muted automatically while on screen and pause when scrolled away (skipped for visitors who prefer reduced motion). Update the `meta` line under each piece with the real format, length and language.

Put files in a `work/` folder at the repo root. Keep each video under ~10 MB — GitHub Pages is not a video host, and a heavy page loses the visitor before it loads. For anything larger, upload to YouTube or Vimeo unlisted and embed.

## Software section

`#software` lists the four software offers, the discovery → pilot → rollout process, and two sample builds in `work/samples/`. When a real software project ships, add it under **Software clients** with before-and-after numbers.

## Brand

Colours, type and usage rules live in the Saffron Labs design system. The short version, both defined at the top of `index.html`:

- Ground is white, text is near-black, saffron appears **once per section** and never as a large field.
- Corners are square by default. Only status pills are round.
- Type is Archivo (display), Anek Latin / Anek Devanagari (text), IBM Plex Mono (utility).

## Honesty rules baked into the page

Two things on this site are deliberate and should not be quietly removed:

1. The concepts section states that those pieces were made for businesses that have not commissioned us. Do not present them as client work.
2. The Clients section is empty and says so. Fill it with real work and real numbers, or leave it.
3. The software sample builds are labelled as made on invented data. Do not present them as client projects.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

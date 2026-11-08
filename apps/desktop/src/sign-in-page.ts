import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'bg-mountain.png');

// The loopback server closes right after answering the redirect, so the browser could not fetch the
// background afterwards: it goes inline as a data URI. Read once, on the first sign-in.
let bgDataUri: string | null = null;
function background() {
	if (bgDataUri === null) {
		try {
			bgDataUri = `data:image/png;base64,${readFileSync(BG_PATH).toString('base64')}`;
		} catch {
			bgDataUri = '';
		}
	}
	return bgDataUri;
}

/**
 * Plain-CSS copy of apps/www `not-found.tsx` (same tokens, glass surface, Manrope type scale and
 * mountain artwork), shown in the system browser when Google redirects back to the app.
 * Messages are static strings, never user input.
 */
export function signInPage(title: string, subtitle: string, lead: string) {
	const bg = background();
	return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>useGonche</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap" rel="stylesheet">
<style>
:root{--background:#0a0a0a;--foreground:#fff;color-scheme:dark;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
html,body{height:100%}
body{min-height:100svh;width:100%;display:flex;flex-direction:column;align-items:center;background:var(--background);color:var(--foreground);font-family:Manrope,sans-serif}
.section{position:relative;display:flex;min-height:100svh;width:100%;align-items:center;overflow:hidden;background-color:var(--background);background-size:cover;background-position:center${bg ? `;background-image:url("${bg}")` : ''}}
.shade{pointer-events:none;position:absolute;inset:0;background-image:linear-gradient(to bottom in oklab,rgb(10 10 10/.7) 0%,rgb(10 10 10/.5) 50%,var(--background) 100%)}
.container{position:relative;margin-inline:auto;width:100%;max-width:80rem;padding:6rem 1rem;display:flex;min-height:100svh;flex-direction:column;align-items:center;justify-content:center;gap:2.5rem;text-align:center}
@media (min-width:40rem){.container{padding-inline:1.5rem}}
@media (min-width:64rem){.container{padding-inline:2rem}}
.badge{display:flex;width:3.5rem;height:3.5rem;align-items:center;justify-content:center;border-radius:9999px;border:1px solid rgb(255 255 255/.1);background-color:transparent;background-image:linear-gradient(to bottom in oklab,rgb(255 255 255/.07),rgb(255 255 255/.02));box-shadow:0 24px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.06);-webkit-backdrop-filter:blur(40px);backdrop-filter:blur(40px)}
.badge svg{width:1.5rem;height:1.5rem}
.stack{display:flex;flex-direction:column;align-items:center;gap:1.5rem}
h1{scroll-margin-top:5rem;font-size:2.25rem;line-height:1.1;font-weight:400;letter-spacing:-.025em;color:var(--foreground)}
@media (min-width:40rem){h1{font-size:3rem}}
@media (min-width:64rem){h1{font-size:3.75rem}}
h1 span{display:block}
h1 .dim{color:rgb(255 255 255/.6)}
p{max-width:28rem;font-size:1rem;line-height:1.625;color:rgb(255 255 255/.7)}
</style>
</head>
<body>
<section class="section">
<div aria-hidden="true" class="shade"></div>
<div class="container">
<span class="badge"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/></svg></span>
<div class="stack">
<h1><span>${title}</span><span class="dim">${subtitle}</span></h1>
<p>${lead}</p>
</div>
</div>
</section>
</body>
</html>`;
}

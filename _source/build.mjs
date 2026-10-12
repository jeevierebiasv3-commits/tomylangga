// Build standalone index.html from My Langga v2.dc.html
import fs from 'node:fs';

const src = fs.readFileSync('My Langga v2.dc.html', 'utf8');

// 1. Grab helmet content (inside <helmet>...</helmet>)
const helmet = src.match(/<helmet>([\s\S]*?)<\/helmet>/)[1];

// 2. Grab x-dc body (between <x-dc> and </x-dc>) minus helmet
let bodyInner = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
bodyInner = bodyInner.replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();

// 3. Grab component script body
const scriptMatch = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
let script = scriptMatch[1].trim();
// Drop the class wrapper "class Component extends DCLogic { ... }"
script = script.replace(/^class Component extends DCLogic \{/, '').replace(/\}\s*$/, '');
// script now contains the method definitions: componentDidMount() {...}  applyAccent() {...} etc.

// 4. Rewrite template bindings in bodyInner
// onClick="{{ handler }}" -> data-action="handler"
bodyInner = bodyInner.replace(/onClick="\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}"/g, 'data-action="$1"');
// {{ days }} inline text -> <span data-tpl="days"></span>
bodyInner = bodyInner.replace(/\{\{\s*days\s*\}\}/g, '<span data-tpl="days"></span>');

// 5. Sanity check — no more {{ }} bindings
const leftover = bodyInner.match(/\{\{[^}]*\}\}/g);
if (leftover) { console.error('LEFTOVER BINDINGS:', leftover); process.exit(1); }

// 6. Build final HTML
const out = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>My Langga — Britney &amp; Jeevie</title>
${helmet.trim()}
</head>
<body>
${bodyInner}
<script>
const APP_PROPS = { accent: '#EF4056', showIntro: true, particles: true };

class App {
  constructor(props) { this.props = props; }
${script}
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App(APP_PROPS);

  // Fill template values
  const days = Math.max(0, Math.floor((Date.now() - new Date('2022-05-14T00:00:00')) / 86400000)).toLocaleString();
  document.querySelectorAll('[data-tpl="days"]').forEach(el => el.textContent = days);

  // Build handler table from renderVals()
  const handlers = app.renderVals();

  // Wire data-action click handlers
  document.querySelectorAll('[data-action]').forEach(el => {
    const name = el.dataset.action;
    const fn = handlers[name];
    if (typeof fn === 'function') el.addEventListener('click', fn);
  });

  app.componentDidMount();
});
</script>
</body>
</html>
`;

fs.writeFileSync('index.html', out);
console.log('wrote index.html', fs.statSync('index.html').size, 'bytes');

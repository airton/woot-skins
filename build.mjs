// Builds dist/ (CSS, JS and a paste-ready snippet) and copies it into site/ for Vercel.
//   node build.mjs           build once
//   node build.mjs --watch   rebuild when themes/ or src/ change
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, watch } from 'node:fs';

const root = new URL('./', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const THEMES = ['fox', 'cilo'];
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// html.wsk -> html.wsk[data-wsk-theme="name"], leaving html.wsk-focus and friends alone
const scope = (css, name) => css.replace(/html\.wsk(?![-\w])/g, `html.wsk[data-wsk-theme="${name}"]`);

function build() {
  const banner = `/*! woot-skins v${pkg.version} | MIT | https://github.com/airton/woot-skins */\n`;
  const css = banner + [read('themes/_base.css'), ...THEMES.map((t) => scope(read(`themes/${t}.css`), t))].join('\n');
  const js = read('src/woot-skins.js');
  mkdirSync(new URL('dist/', root), { recursive: true });
  writeFileSync(new URL('dist/woot-skins.css', root), css);
  writeFileSync(new URL('dist/woot-skins.js', root), js);
  const snippet = `<!-- woot-skins v${pkg.version}: paste into Super Admin > Settings > Dashboard Scripts -->
<script>
  // Optional config, see README. Delete this block to use the defaults.
  window.WOOT_SKINS = { themes: ['fox', 'cilo'] };
</script>
<style id="woot-skins-css">
${css}</style>
<script id="woot-skins-js">
${js}</script>
`;
  writeFileSync(new URL('dist/snippet.html', root), snippet);
  mkdirSync(new URL('site/dist/', root), { recursive: true });
  for (const f of ['woot-skins.css', 'woot-skins.js', 'snippet.html']) copyFileSync(new URL(`dist/${f}`, root), new URL(`site/dist/${f}`, root));
  console.log(`woot-skins v${pkg.version}: dist/ (${((css.length + js.length) / 1024) | 0} kB)`);
}

build();
if (process.argv.includes('--watch')) {
  let t;
  const again = () => { clearTimeout(t); t = setTimeout(() => { try { build(); } catch (e) { console.error(e.message); } }, 100); };
  watch(new URL('themes/', root), again);
  watch(new URL('src/', root), again);
  console.log('watching themes/ and src/ ...');
}

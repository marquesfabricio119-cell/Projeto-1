/* Exporta cada .art de posts.html como PNG no tamanho nativo do Instagram.
   Uso: node gerar.mjs   (com um servidor estático servindo esta pasta)  */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const URL  = process.env.URL  || 'http://localhost:8799/skincare/social/posts.html';
const SAIDA = process.env.SAIDA || 'png';
mkdirSync(SAIDA, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
});
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

const usouFraunces = await page.evaluate(() => document.fonts.check('600 86px Fraunces'));
if(!usouFraunces) console.warn('⚠️  Fraunces não carregou — as artes vão sair com a fonte de fallback.');

const ids = await page.locator('.art').evaluateAll(els => els.map(e => e.id));
for(const id of ids){
  const el = page.locator('#' + id);
  const { width, height } = await el.evaluate(e => e.getBoundingClientRect());
  await el.screenshot({ path: `${SAIDA}/${id}.png` });
  console.log(`${id}.png  ${Math.round(width)}×${Math.round(height)}`);
}
await browser.close();
console.log(`\n${ids.length} artes exportadas em ${SAIDA}/`);

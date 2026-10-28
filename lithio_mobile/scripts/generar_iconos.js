// Uso: npx -y -p @resvg/resvg-js@2.6.2 node scripts/generar_iconos.js assets [public]
// Genera los íconos de LITHIO (opción A: átomo de litio) a partir de SVG.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const OUT = process.argv[2];
const BG = '#10191C';
const TEAL = '#45D6C5';
const CORAL = '#FF765E';

// Átomo: 3 órbitas, núcleo y 3 electrones, centrado en 512,512.
function atom({ teal = TEAL, coral = CORAL, glow = true } = {}) {
  return `
  ${glow ? `<circle cx="512" cy="512" r="380" fill="${teal}" opacity="0.08"/>` : ''}
  <g fill="none" stroke="${teal}" stroke-width="30">
    <ellipse cx="512" cy="512" rx="330" ry="120"/>
    <ellipse cx="512" cy="512" rx="330" ry="120" transform="rotate(60 512 512)"/>
    <ellipse cx="512" cy="512" rx="330" ry="120" transform="rotate(-60 512 512)"/>
  </g>
  <circle cx="512" cy="512" r="82" fill="${coral}"/>
  <circle cx="842" cy="512" r="38" fill="${teal}"/>
  <circle cx="347" cy="226" r="38" fill="${teal}"/>
  <circle cx="347" cy="798" r="38" fill="${teal}"/>`;
}

// Escala el átomo alrededor del centro (para la zona segura del ícono adaptativo).
const scaled = (inner, s) => `<g transform="translate(512 512) scale(${s}) translate(-512 -512)">${inner}</g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

function render(file, body, size = 1024) {
  const png = new Resvg(svg(body), { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), png);
  console.log(file, size, png.length, 'bytes');
}

// Ícono clásico (iOS, web, tiendas): fondo + átomo.
render('icon.png', `<rect width="1024" height="1024" fill="${BG}"/>${scaled(atom(), 0.92)}`);
// Android adaptativo: el sistema recorta círculo/squircle; la figura va en la zona segura (~66 %).
render('android-icon-background.png', `<rect width="1024" height="1024" fill="${BG}"/>`);
render('android-icon-foreground.png', scaled(atom({ glow: false }), 0.62));
// Monocromo (Android 13+ temático y barra de notificaciones): solo la silueta en blanco.
render('android-icon-monochrome.png', scaled(atom({ teal: '#FFFFFF', coral: '#FFFFFF', glow: false }), 0.62));
// Pantalla de inicio y favicon.
render('splash-icon.png', scaled(atom({ glow: false }), 0.8));
render('favicon.png', `<rect width="1024" height="1024" rx="200" fill="${BG}"/>${scaled(atom({ glow: false }), 0.92)}`, 196);

// Web instalable (manifest.json y Safari en iPhone): van a public/ si se pasa como segundo argumento.
const WEB_OUT = process.argv[3];
if (WEB_OUT) {
  const full = `<rect width="1024" height="1024" fill="${BG}"/>${scaled(atom(), 0.92)}`;
  const renderWeb = (file, body, size) => {
    const png = new Resvg(svg(body), { fitTo: { mode: 'width', value: size } }).render().asPng();
    fs.writeFileSync(path.join(WEB_OUT, file), png);
    console.log(file, size, png.length, 'bytes');
  };
  renderWeb('logo192.png', full, 192);
  renderWeb('logo512.png', full, 512);
  // Maskable: el sistema recorta; la figura en la zona segura (80 %).
  renderWeb('logo512-maskable.png', `<rect width="1024" height="1024" fill="${BG}"/>${scaled(atom({ glow: false }), 0.66)}`, 512);
  // iOS redondea las esquinas solo: fondo completo, sin transparencia.
  renderWeb('apple-touch-icon.png', full, 180);
}

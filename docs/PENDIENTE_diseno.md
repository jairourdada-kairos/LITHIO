# Pulido visual (pedido por Jairo el 10-nov) — APLICADO el 11-nov, sin publicar (pendiente de auditoría de Jairo)

Estado: ✅ 1 BottomTabBar · ✅ 2 Decor.tsx · ✅ 3 pantallas (Billetera, Viajes, RidesList, Perfil, Explora, Tienda Fe) · ✅ 4 botones y encabezado.

La app ya tiene cristal, sombras, aurora y brillo (`lithio_mobile/src/constants/theme.ts` → `fx` y `glass`).
No hace falta volver a explorar: aplicar esta lista tal cual, en este orden.

## 1. Arreglo necesario (lo rompió la 5ª pestaña "Tienda Fe")
`src/components/nav/BottomTabBar.tsx`: con 5 pestañas la píldora activa no cabe ("Billetera" y "Perfil"
se salen, y el globo rojo de "Viajes" tapa el texto).
- La pestaña activa debe ocupar el doble: `containerStyle={[styles.tab, selected && { flex: 2 }]}`.
- El globo (`badge`) va pegado al ícono (envolver el `Icon` en un `View` y poner ahí el globo, `top: -6, right: -10`).

## 2. Componente nuevo `src/components/ui/Decor.tsx`
- `ScreenTitle`: título de 26 + línea de 44×4 con degradado turquesa→coral debajo.
- `SectionLabel`: rombo de 8 px del color de acento + texto de 17 en negrita.
- `OrbitDecor`: tres órbitas tenues en la esquina de una tarjeta (copiar `watermark`/`watermarkOrbit` de `PassengerHome.tsx`).
- `IconChip`: ícono en un cuadro redondeado teñido (`${color}1C` de fondo, `${color}38` de borde).

## 3. Dónde usarlos
- `WalletScreen.tsx`: `ScreenTitle` en "Billetera", `SectionLabel` en "Movimientos", `OrbitDecor` (color diamante) en
  `balanceCard` (añadir `overflow: 'hidden'`), e `IconChip` en cada movimiento: verde si entra, coral si sale, dorado si está en revisión.
- `TripsScreen.tsx`: `ScreenTitle` en "Viajes". `RidesListScreen.tsx`: franja de 3 px a la izquierda de cada tarjeta con el color del estado.
- `AccountScreen.tsx`: `ScreenTitle` en "Perfil" e `IconChip` con el color de acento en cada fila del menú (rojo en "Cerrar sesión").
- `PassengerHome.tsx`: `SectionLabel` en "Explora".
- `FeStoreModal.tsx`: `ScreenTitle` en la variante de pestaña y `SectionLabel` en "COMBOS", "Cupones" y "Pasar con 20".

## 4. Botones y encabezado
- `theme.ts` → `fx.glowOf`: añadir `, inset 0 -2px 0 rgba(0, 0, 0, 0.10)` (el botón gana volumen).
- `PrimaryButton.tsx`: `borderWidth: 1`, `borderColor: 'rgba(255,255,255,0.22)'`, `letterSpacing: 0.3` en el texto.
- `PressableScale.tsx` (variant `solid`): en reposo usar `theme.fx.glowOf(accent)` en vez de la sombra plana, para no perder el brillo interior.
- `ScreenHeader.tsx`: flecha de volver dentro de un círculo de cristal (borde `glassBorder`, fondo `glassBg`) y una línea
  corta de energía bajo el título.

## Reglas de Jairo
Mantener las pantallas actuales y hacerlas más ricas (nada plano ni distribuciones nuevas); botones simétricos.
Después: `npx tsc --noEmit`, mostrarle el resultado y publicar solo con su aprobación.

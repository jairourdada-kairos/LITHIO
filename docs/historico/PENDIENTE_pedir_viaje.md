# Pendiente: módulo "Pedir viaje" (aprobado por Jairo, sin código aún)

## Diseño aprobado
- Paso nuevo al inicio de `lithio_mobile/src/screens/passenger/TripRequestScreen.tsx`:
  pasos **Tipo → Ruta → Conductor** (hoy `type Step = 'route' | 'driver'`, línea ~308).
- Dos tarjetas grandes y simétricas: **Rutas Internas** (dentro del IVIC, turquesa, icono `home-outline`)
  y **Rutas Externas** (del IVIC hacia afuera, coral, icono `navigation-2-outline`).
  Cada una muestra cuántas rutas hay y "desde $X" calculado con las rutas reales.
- La lista de rutas del paso "Ruta" se filtra por el tipo elegido. Ahora/Programar se queda en "Ruta".
- Si se abre con `initialRoute` (desde el inicio), se salta el paso Tipo.

## Clasificación confirmada
Internas: UNC → BIBLIOTECA, UNC → RESTO DEL IVIC. Todas las demás: externas.

## Backend (lithio_backend/app)
- `models.py` Route: columna `scope` ('interna' | 'externa', por defecto 'externa').
- `seed.py`: `ADDED_COLUMNS["routes"] = {"scope": "VARCHAR NOT NULL DEFAULT 'externa'"}`; al crear la
  columna, marcar como 'interna' las 2 rutas de arriba. Añadir `"scope"` a cada ruta de `ROUTE_CATALOG`.
- `schemas.py`: `scope` en AdminRouteIn (Literal, default 'externa'), AdminRouteUpdate y AdminRouteResponse.
- `main.py`: devolver `scope` en GET /api/routes (línea ~476) y en POST/PUT /api/admin/routes; guardarlo al crear/editar.
- Prueba nueva en `tests/`.

## Admin dentro de la app (pedido de Jairo)
- Ya existe la sección "Rutas" en `screens/admin/AdminScreen.tsx` con crear/editar/eliminar.
- Añadir selector Interna/Externa (dos botones iguales) en `components/admin/RouteFormSheet.tsx`
  (`RouteDraft` + estado + envío) y mostrar el tipo en la lista (AdminScreen línea ~283).
- `types/index.ts` PresetRoute: `scope?: 'interna' | 'externa'`.
- Panel web (`lithio_dashboard/app.js`): agregar el tipo al formulario de rutas (opcional).

## Estado al 10-nov (tarde): TODO PROGRAMADO, SIN COMMIT Y SIN PUBLICAR
- Hecho y probado: tipo Interna/Externa, bono de bienvenida de 2 ◆ (en vez del viaje de regalo),
  pagos en orden Diamantes → Efectivo → Pago Móvil → Binance Pay, recarga por Binance Pay
  (`BINANCE_PAY_ID` en `lithio_backend/.env`), pestaña "Tienda Fe" y COMBOS de pases
  (`COMBOS` en `app/routers/fe_store.py`; cada pase paga un viaje interno y el conductor cobra la tarifa en ◆).
- Decisiones de Jairo: Binance Pay SOLO recarga diamantes (no paga viajes directo); los pases solo valen en rutas internas.
- Falta: publicar con `publicar_actualizacion.bat` (app) y reiniciar el servidor para que tome el código nuevo.
- No se hizo: abrir sola la app del banco en Pago Móvil (no hay un enlace común a los bancos) ni el
  botón "copiar" (necesita un módulo nativo = APK nuevo); los datos se copian manteniéndolos presionados.

## Después (texto original)
Probar en el navegador (`.claude/launch.json` → lithio-mobile-web), presentar a Jairo para auditoría y
publicar con `publicar_actualizacion.bat` solo cuando lo apruebe. Nada de esto está commiteado.
Módulos siguientes: viaje de regalo (solo rutas internas), pagos (Diamantes, Efectivo, Pago Móvil,
Binance Pay con Jairourdada@gmail.com), Tienda Fe con pestaña propia y COMBOS.

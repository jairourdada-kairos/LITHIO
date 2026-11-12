# LITHIO en Google Play — material listo para copiar

Guía de pasos para Jairo: https://claude.ai/artifact/1A4cDDzSztC5xcdg7J9QNi

## Ficha de la tienda

**Nombre:** LITHIO

**Descripción corta** (máx. 80 caracteres):
> Moto-taxi universitario seguro entre la UNC, el IVIC y sus alrededores.

**Descripción larga:**

> LITHIO es el moto-taxi de la comunidad universitaria. Pide tu viaje en segundos, con conductores verificados y tarifas fijas que conoces antes de subir.
>
> **Rutas pensadas para tu día**
> • Rutas Internas: dentro de las instalaciones del IVIC.
> • Rutas Externas: del IVIC hacia la Redoma de San Antonio, Caracas y más.
> • Invierte cualquier ruta con un toque: ida y vuelta sin buscar dos veces.
> • Viaja ahora o programa tu viaje para más tarde.
>
> **Conductores de confianza**
> Cada conductor pasa por verificación de documentos e inspección de la moto. Ves su nombre, su foto, su moto, su placa y sus reseñas antes de elegirlo, y puedes llamarlo desde la app.
>
> **Paga como prefieras**
> • Iones Li⁺: tu saldo dentro de LITHIO (1 Li⁺ = 1 USD).
> • Efectivo, Pago Móvil o Binance Pay.
> • COMBOS de viajes internos: 5, 10, 20 o 30 viajes pagados con Iones Li⁺.
>
> **Gana mientras viajas**
> Suma Fe en cada viaje y reseña, sube de nivel como un elemento de la tabla periódica, mantén tu racha semanal y canjea cupones en la Tienda de Fe.
>
> **Para toda la comunidad**
> Estudiantes y trabajadores de la UNC y el IVIC. Con cada donación al Fondo Solidario LITHIO ayudas a pagar viajes de compañeros que lo necesitan.

**Categoría:** Mapas y navegación · **Etiquetas sugeridas:** Transporte, Taxi, Universidad

**Imágenes:** `docs/play_store/icono-512.png` y `docs/play_store/destacada-1024x500.png`. Faltan las capturas de pantalla del teléfono (2 a 8, verticales).

## Seguridad de los datos (respuestas del formulario)

Sacado de `lithio_backend/app/models.py`. Todo viaja cifrado (HTTPS) y el usuario puede borrar su cuenta desde la app.

| Tipo de dato (categoría de Google) | ¿Se recoge? | Para qué | ¿Obligatorio? |
|---|---|---|---|
| Nombre | Sí | Cuenta, mostrarlo al conductor o pasajero | Sí |
| Correo electrónico | Sí | Cuenta e inicio de sesión | Sí |
| Número de teléfono | Sí | Que conductor y pasajero se llamen | Sí |
| Otra información personal (cédula, edad, carrera, semestre, institución, área de trabajo) | Sí | Verificar que es de la comunidad UNC/IVIC | Cédula: conductores; el resto, opcional |
| Fotos | Sí | Foto de perfil y capturas de pago | No |
| Historial de compras | Sí | Recargas, combos, cupones y pagos de viajes | Sí, al usarlos |
| Otra información financiera (cuenta bancaria, Pago Móvil, dirección de Binance, referencias de pago) | Sí | Cobros de los conductores y verificación de pagos | Solo conductores |
| Contenido generado por el usuario (reseñas y comentarios) | Sí | Reseñas de viajes | No |
| Otras acciones en la app (viajes: origen, destino, hora) | Sí | Funcionamiento del servicio e historial | Sí |
| ID del dispositivo u otros (token de notificaciones) | Sí | Avisos de viajes | No |
| Ubicación (GPS) | **No** | Las rutas son puntos fijos, la app no lee el GPS | — |

- ¿Se comparten con terceros? **No.** Firebase (Google) solo procesa inicio de sesión y notificaciones como proveedor del servicio.
- ¿Datos cifrados en tránsito? **Sí.**
- ¿El usuario puede pedir que se borren? **Sí**, desde Perfil › eliminar cuenta.

## Notas técnicas (para Claude)

- El perfil `production` de `lithio_mobile/eas.json` compila `.aab` y ahora usa el canal `preview` (antes `production`): así la versión de Play recibe las mismas actualizaciones que publica `publicar_actualizacion.bat`, sin publicar dos veces.
- El entorno `production` de EAS ya tiene el `.env` y el secreto `GOOGLE_SERVICES_JSON` (11-nov).
- La primera subida a Play es manual (paso 3 de la guía). Después, `eas submit --platform android --profile production` con la clave JSON del paso 7.

## Pendiente de Jairo

- [ ] Visto bueno para redactar la política de privacidad (texto legal).
- [ ] Cuenta de prueba para los revisores de Google: créala tú desde la app y pásame el correo (la contraseña va directo en la consola, no por chat).
- [ ] Servidor en la nube antes de publicar para todos.

# DESCARTADO por Jairo (10-nov): en vez del viaje de regalo, cada usuario NUEVO recibe 2 diamantes.
Quedó programado como "bono de bienvenida" (`WELCOME_BONUS_CENTS` en `app/wallet_service.py`, 200 = 2 ◆,
con 0 se apaga; movimiento `bono_bienvenida` en el historial). Lo de abajo queda solo como referencia.

# Diseño archivado: Viaje de regalo (no se programó)

## Idea
Un pasajero paga un viaje y se lo regala a un amigo **ya enlazado** (el sistema de Enlaces/código de amigo
ya existe: `links.py`, `Link`, `friend_code`). Solo rutas **internas** (dentro del IVIC), por eso depende del
campo `scope` recién agregado.

## Flujo del pasajero (Pedir viaje)
1. Paso **Tipo**: tarjeta Internas gana una tercera acción pequeña, centrada y del mismo ancho que las
   tarjetas: **"Regalar un viaje"** (icono `gift-outline`). Externas no la ofrece.
2. Paso **Ruta**: igual, filtrado a rutas internas; arriba una franja "Regalo para: [amigo]" con "Cambiar".
3. Paso nuevo **Amigo** (solo en modo regalo, antes de Conductor): lista de enlaces aceptados con avatar y
   nombre; un toque elige. Sin enlaces: aviso "Primero enlaza a tu amigo con su código" + botón a Enlaces.
4. Paso **Conductor**: igual. Al confirmar, el resumen dice "Regalo para Ana · UNC → BIBLIOTECA".
5. Pago: solo **Diamantes** o **Pago Móvil**, pagados por quien regala. Sin Efectivo, porque el amigo no
   tendría por qué pagar un regalo.

## Reglas
- El que regala paga y gana el Fe del viaje; el amigo es quien viaja (sube a la moto).
- El amigo recibe notificación push "Ana te regaló un viaje UNC → BIBLIOTECA" y ve el viaje en su Inicio
  con el conductor, la hora y el estado en vivo (solo lectura).
- Puede cancelar el que regala (reglas de cancelación actuales). El amigo no cancela.
- Solo con enlace aceptado y solo rutas internas (validado en el servidor, no solo en la app).
- Límite anti-abuso: máx. 5 regalos activos a la vez por pasajero.

## Backend
- `rides`: columna `recipient_id` (nullable, FK users) → `ADDED_COLUMNS["rides"]`.
- `RideCreate.recipient_id: Optional[int]`; al crear, validar: ruta con `scope == 'interna'`, enlace
  aceptado entre ambos, método de pago ∈ {diamantes, pago_movil}, límite de activos.
- `RideResponse`: `recipient_id`, `recipient_name`.
- Lista de viajes del amigo: incluir los que tiene como `recipient_id` (marcados `is_gift_received`).
- Push al amigo al crear y en cada cambio de estado importante.
- Pruebas: regalo válido, ruta externa rechazada, sin enlace rechazado, efectivo rechazado, límite.

## App
- `TripRequestScreen`: `mode: 'self' | 'gift'`, paso `friend`, stepper dinámico (Tipo, Ruta, Amigo, Conductor).
- `RequestRideModal`: ocultar Efectivo en modo regalo y mostrar "Regalo para …".
- Inicio del pasajero: tarjeta "Te regalaron un viaje" con detalle.

## Preguntas para ti
1. ¿Solo a amigos enlazados (propuesto) o también por código/teléfono sin enlace?
2. ¿Efectivo no (propuesto) o sí, pagando el amigo al conductor?
3. ¿Quién gana el Fe: quien regala (propuesto) o también el amigo?
4. ¿La tarjeta "Regalar un viaje" va dentro de Internas (propuesto) o como tercera tarjeta en el paso Tipo?
5. ¿Límite de 5 regalos activos está bien?

Nada de esto está programado ni commiteado.

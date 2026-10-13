import { PresetRoute } from '../types';

export const PRESET_ROUTES: PresetRoute[] = [
  {
    id: 1,
    origin: "UNC",
    destination: "BIBLIOTECA",
    fare_usd: 1.50,
    estimated_minutes: 8,
    popular: true,
    tag: "Ruta corta estudiantil"
  },
  {
    id: 2,
    origin: "UNC",
    destination: "REDOMA DE SAN ANTONIO",
    fare_usd: 2.50,
    estimated_minutes: 12,
    popular: true,
    tag: "Ruta principal"
  },
  {
    id: 3,
    origin: "UNC",
    destination: "RESTO DEL IVIC",
    fare_usd: 2.00,
    estimated_minutes: 10,
    popular: true,
    tag: "Conexión IVIC"
  },
  {
    id: 4,
    origin: "BIBLIOTECA",
    destination: "REDOMA DE SAN ANTONIO",
    fare_usd: 2.50,
    estimated_minutes: 12,
    popular: true,
    tag: "Ruta bibliotecaria"
  },
  {
    id: 5,
    origin: "UNC",
    destination: "CARACAS",
    fare_usd: 6.00,
    estimated_minutes: 35,
    popular: true,
    tag: "Bajada a Caracas"
  },
  {
    id: 6,
    origin: "BIBLIOTECA",
    destination: "CARACAS",
    fare_usd: 6.50,
    estimated_minutes: 38,
    popular: false,
    tag: "Ruta referencia"
  }
];

// Configuración de Railway para LITHIO (reemplaza a railway.json desde el 12 de noviembre de 2026).
// Para ver qué cambiaría: railway config plan. Para aplicarlo: railway config apply.
import { defineRailway, project, service, volume } from "railway/iac";

// Este repositorio solo gestiona el servicio del servidor; la base Postgres se administra aparte.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "lithio-api";

export default defineRailway(() => {
  // Disco permanente: fotos (media), comprobantes (evidence), registros (logs) y el APK.
  // No quitar: sin él, el servidor perdería esos archivos en cada despliegue.
  // CAMBIA AQUÍ el tamaño del disco (MB) si el plan de Railway lo permite.
  const disco = volume("lithio-api-volume", { region: "sfo", sizeMB: 500 });

  const lithioApi = service("lithio-api", {
    build: { buildEnvironment: "V3", builder: "DOCKERFILE", dockerfilePath: "Dockerfile" },
    healthcheck: "/health",
    healthcheckTimeout: 60,
    replicas: { "sfo": 1 }, // Una sola réplica: WebSockets y recordatorios viven en memoria
    volumeMounts: { "/data": disco },
  });

  return project("lithio", {
    variables: { managed: false },
    resources: [lithioApi, disco],
  });
});

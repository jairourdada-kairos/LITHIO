/**
 * Configuración dinámica sobre app.json.
 *
 * google-services.json (Firebase para Android, necesario para las
 * notificaciones push) no se sube a GitHub. En la compilación de EAS llega como
 * variable de tipo archivo GOOGLE_SERVICES_JSON (la crea generar_apk.ps1); en
 * esta PC se usa el archivo de la carpeta del proyecto si existe.
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const localFile = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(localFile) ? './google-services.json' : undefined);
  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};

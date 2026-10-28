/**
 * Configuración dinámica sobre app.json.
 *
 * google-services.json (Firebase para Android, necesario para las
 * notificaciones push) no se sube a GitHub. En la compilación de EAS llega como
 * variable de tipo archivo GOOGLE_SERVICES_JSON (la crea generar_apk.ps1); en
 * esta PC se usa el archivo de la carpeta del proyecto si existe.
 *
 * Acceso con Google: el plugin lee los datos de google-services.json.
 * Acceso con Facebook: solo se incluye si EXPO_PUBLIC_FACEBOOK_APP_ID y
 * FACEBOOK_CLIENT_TOKEN están definidos (ver DESPLIEGUE.md).
 */
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const localFile = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(localFile) ? './google-services.json' : undefined);
  const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
  const facebookClientToken = process.env.FACEBOOK_CLIENT_TOKEN;

  const plugins = [...(config.plugins || [])];
  if (googleServicesFile) plugins.push('@react-native-google-signin/google-signin');
  if (facebookAppId && facebookClientToken) {
    plugins.push([
      'react-native-fbsdk-next',
      {
        appID: facebookAppId,
        clientToken: facebookClientToken,
        displayName: 'LITHIO',
        scheme: `fb${facebookAppId}`,
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: true,
      },
    ]);
  }

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};

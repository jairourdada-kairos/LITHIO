/**
 * avatar.ts — Foto de perfil: elegir, recortar, comprimir, subir y eliminar
 *
 * La foto se recorta en cuadrado al elegirla y se reduce a 1024 px en JPG
 * antes de subirla, así pesa poco aunque la conexión sea lenta.
 */

import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { authenticatedFetch } from './firebase';

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.17.101.213:8000';

/** Las fotos subidas a LITHIO llegan como ruta relativa (/media/...). */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/') ? `${BACKEND_URL}${url}` : url;
}

export type AvatarSource = 'camera' | 'library';

/** Abre la cámara o la galería con recorte cuadrado. Devuelve null si se cancela. */
export async function pickAvatar(source: AvatarSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permiso necesario',
      source === 'camera'
        ? 'Activa el acceso a la cámara en los ajustes del teléfono para tomar tu foto.'
        : 'Activa el acceso a tus fotos en los ajustes del teléfono para elegir una.'
    );
    return null;
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true, // Pantalla de recorte: el usuario ajusta el encuadre
    aspect: [1, 1],
    quality: 0.9,
  };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

async function shrink(uri: string): Promise<string> {
  try {
    const context = ImageManipulator.manipulate(uri).resize({ width: 1024 });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    // Si el teléfono no puede reducirla, se sube la foto ya recortada.
    return uri;
  }
}

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return typeof body.detail === 'string' ? body.detail : `No se pudo guardar la foto (${response.status}).`;
}

/** Foto reducida lista para FormData (web: Blob; iOS/Android: { uri, name, type }). */
export async function photoFormValue(uri: string, name = 'foto.jpg'): Promise<Blob> {
  const small = await shrink(uri);
  if (Platform.OS === 'web') return (await fetch(small)).blob();
  return { uri: small, name, type: 'image/jpeg' } as unknown as Blob;
}

/** Elige una foto de la galería sin recorte (p. ej. la captura de una nota). */
export async function pickDocumentPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permiso necesario', 'Activa el acceso a tus fotos en los ajustes del teléfono para elegir una.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

export async function uploadAvatar(uri: string): Promise<string> {
  const form = new FormData();
  form.append('photo', await photoFormValue(uri, 'avatar.jpg'));
  let response: Response;
  try {
    response = await authenticatedFetch(`${BACKEND_URL}/api/users/me/avatar`, { method: 'POST', body: form });
  } catch {
    throw new Error('No hay conexión con el servidor de LITHIO. Revisa tu Wi-Fi e intenta de nuevo.');
  }
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json();
  return body.avatar_url;
}

export async function deleteAvatar(): Promise<void> {
  const response = await authenticatedFetch(`${BACKEND_URL}/api/users/me/avatar`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await readError(response));
}

import { useSyncExternalStore } from 'react';
import { deleteAsset, getAsset, putAsset } from '../fonts/storage';

// Eigenes Foto als Vorschau-Hintergrund (nur zur Ansicht, wird nicht exportiert).

const KEY = 'backdrop-photo';
let url: string | null = null;
let requested = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function ensureLoaded() {
  if (requested) return;
  requested = true;
  getAsset(KEY).then((blob) => {
    if (blob && !url) {
      url = URL.createObjectURL(blob);
      emit();
    }
  });
}

export async function setBackdropPhoto(file: Blob): Promise<void> {
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(file);
  emit();
  await putAsset(KEY, file);
}

export async function clearBackdropPhoto(): Promise<void> {
  if (url) URL.revokeObjectURL(url);
  url = null;
  emit();
  await deleteAsset(KEY);
}

export function useBackdropPhoto(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      ensureLoaded();
      return () => listeners.delete(cb);
    },
    () => url,
  );
}

/** Ersatz-„Foto“ (Farbverlauf), damit helle und dunkle Kästchen in Vorschauen sichtbar sind. */
export const FAKE_PHOTO = 'linear-gradient(135deg, #6f8fb8 0%, #9fb59a 48%, #d7b38c 100%)';

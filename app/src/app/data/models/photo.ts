export type PhotoPose = 'FRONT' | 'SIDE' | 'BACK' | 'OTHER';

export const POSE_LABEL: Record<PhotoPose, string> = {
  FRONT: 'Frente', SIDE: 'Lado', BACK: 'Costas', OTHER: 'Outra',
};

export interface ProgressPhoto {
  id: string;
  /** Data local, YYYY-MM-DD. */
  date: string;
  pose: PhotoPose;
  note: string | null;
  /** data URL JPEG. */
  image: string;
}

export class PhotoError extends Error {}

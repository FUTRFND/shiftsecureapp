/**
 * PlatformCamera — camera + photo library (stub for Phase 6+).
 * Wire `@capacitor/camera` when a feature needs it.
 */
export interface CameraPhoto {
  dataUrl: string;
  format: string;
}

export interface PlatformCamera {
  takePhoto(): Promise<CameraPhoto>;
  pickFromGallery(): Promise<CameraPhoto>;
}

export const platformCamera: PlatformCamera = {
  async takePhoto() {
    throw new Error("Camera not yet implemented; planned for a later phase.");
  },
  async pickFromGallery() {
    throw new Error("Gallery picker not yet implemented; planned for a later phase.");
  },
};

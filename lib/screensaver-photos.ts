export const SCREENSAVER_BUCKET = "screensaver-photos";
export const SCREENSAVER_PHOTO_LIMIT = 50;
export const SCREENSAVER_PHOTO_SIZE = 5 * 1024 * 1024;
export const SCREENSAVER_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function screensaverPhotoUrl(name: string) {
  return "/api/screensaver/photos/" + encodeURIComponent(name);
}

/** Minimal shape of a multer memory-storage file (avoids depending on @types/multer). */
export interface UploadedImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

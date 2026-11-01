export type PhotoPack = {
  url: string;
  length: number;
  entries: { index: number; offset: number; length: number }[];
};

/** Slices share the downloaded buffer; no raster decoding or image conversion. */
export function unpackPhotographs(pack: PhotoPack, blob: Blob) {
  if (blob.size !== pack.length) throw new Error('Incomplete photograph pack');
  let end = 0;
  const seen = new Set<number>();
  const photos = new Map<number, Blob>();
  for (const entry of pack.entries) {
    if (!Number.isSafeInteger(entry.length) || entry.length <= 0 || entry.offset !== end || seen.has(entry.index)) {
      throw new Error('Invalid photograph pack index');
    }
    end += entry.length;
    if (end > blob.size) throw new Error('Photograph pack overflow');
    seen.add(entry.index);
    photos.set(entry.index, blob.slice(entry.offset, end, 'image/webp'));
  }
  if (end !== blob.size) throw new Error('Unindexed photograph pack data');
  return photos;
}

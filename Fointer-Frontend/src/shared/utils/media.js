export const makeGalleryItem = (file) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  file,
  preview: URL.createObjectURL(file),
});

export const revokeGalleryPreviews = (items = []) => {
  items.forEach((item) => {
    if (item.preview) URL.revokeObjectURL(item.preview);
  });
};

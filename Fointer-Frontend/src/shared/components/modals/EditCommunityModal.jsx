import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Upload, ImagePlus } from 'lucide-react';
import { updateCommunity } from '../../../api/communities';
import { uploadMedia } from '../../../api/uploads';
import { getErrorMessage } from '../../utils/errors';
import { makeGalleryItem, revokeGalleryPreviews } from '../../utils/media';
import { MAX_GALLERY_IMAGES, MAX_FILE_SIZE } from '../../constants/uploads';

const emptyForm = {
  name: '',
  description: '',
  rules: '',
  tags: '',
  coverImage: '',
  galleryImages: [],
  type: 'public',
};

function buildFormFromCommunity(community) {
  if (!community) return emptyForm;
  return {
    name: community.name || '',
    description: community.description || '',
    rules: community.rules || '',
    tags: (community.tags || []).join(', '),
    coverImage: community.coverImage || '',
    galleryImages: Array.isArray(community.galleryImages)
      ? [...community.galleryImages]
      : [],
    type: community.type || 'public',
  };
}

/**
 * Shared edit-community popup used by owner manage and admin detail.
 */
export default function EditCommunityModal({ community, onClose, onSuccess }) {
  const open = Boolean(community);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [newGalleryItems, setNewGalleryItems] = useState([]);

  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const communityId = community?.id;

  useEffect(() => {
    if (!open) return;

    setForm(buildFormFromCommunity(community));
    setCoverFile(null);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setError('');
    setNewGalleryItems((prev) => {
      revokeGalleryPreviews(prev);
      return [];
    });
  }, [open, communityId]); // eslint-disable-line react-hooks/exhaustive-deps -- seed once per open community

  const clearNewGallery = () => {
    revokeGalleryPreviews(newGalleryItems);
    setNewGalleryItems([]);
  };

  const handleClose = () => {
    if (saving) return;
    clearNewGallery();
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview('');
    setForm(emptyForm);
    setError('');
    onClose?.();
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const galleryCount = form.galleryImages.length + newGalleryItems.length;
    const remaining = MAX_GALLERY_IMAGES - galleryCount;
    if (remaining <= 0) {
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      return;
    }

    const valid = files
      .filter((f) => f.size <= MAX_FILE_SIZE)
      .slice(0, remaining)
      .map(makeGalleryItem);

    setNewGalleryItems((prev) => [...prev, ...valid]);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeExistingGallery = (url) => {
    setForm((prev) => ({
      ...prev,
      galleryImages: prev.galleryImages.filter((img) => img !== url),
    }));
  };

  const removeNewGallery = (id) => {
    setNewGalleryItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!community?.id) return;
    if (!form.name.trim()) {
      setError('Community name is required.');
      return;
    }

    const totalGallery = form.galleryImages.length + newGalleryItems.length;
    if (totalGallery > MAX_GALLERY_IMAGES) {
      setError(`You can add up to ${MAX_GALLERY_IMAGES} gallery images.`);
      return;
    }

    setSaving(true);
    setError('');
    try {
      let coverImage = form.coverImage.trim();
      if (coverFile) {
        const upload = await uploadMedia(coverFile, 'fointer/communities');
        coverImage = upload?.media?.url || coverImage;
      }

      const uploadedGallery = [];
      for (const item of newGalleryItems) {
        const upload = await uploadMedia(item.file, 'fointer/communities');
        const url = upload?.media?.url;
        if (url) uploadedGallery.push(url);
      }

      await updateCommunity(community.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        coverImage,
        galleryImages: [...form.galleryImages, ...uploadedGallery],
        type: form.type,
      });

      clearNewGallery();
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(null);
      setCoverPreview('');
      await onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update community.'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const displayCover = coverPreview || form.coverImage;
  const galleryCount = form.galleryImages.length + newGalleryItems.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md bg-[#120F0D] border border-[#2A241E] rounded-xl p-4 sm:p-5 shadow-2xl z-10 max-h-[90vh] overflow-y-auto fointer-scrollbar">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-[#D4AF37]">
            Edit Community
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 text-[#A69B8D] hover:text-[#E5E0D8] rounded-lg"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 text-xs sm:text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-3.5">
          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Primary Cover Image
            </label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="relative w-full h-32 rounded-lg bg-[#0A0807] border border-dashed border-[#2A241E] hover:border-[#D4AF37]/50 overflow-hidden flex items-center justify-center"
            >
              {displayCover ? (
                <img
                  src={displayCover}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-[#8C8070] text-xs">
                  <Upload size={18} className="text-[#D4AF37]" />
                  Upload from system
                </div>
              )}
            </button>
            {displayCover && (
              <button
                type="button"
                onClick={() => {
                  if (coverPreview) URL.revokeObjectURL(coverPreview);
                  setCoverFile(null);
                  setCoverPreview('');
                  setForm((prev) => ({ ...prev, coverImage: '' }));
                  if (coverInputRef.current) coverInputRef.current.value = '';
                }}
                className="mt-1.5 text-[11px] text-red-400 hover:text-red-300"
              >
                Remove cover
              </button>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D]">
                Gallery Images
              </label>
              <span className="text-[10px] text-[#8C8070]">
                {galleryCount}/{MAX_GALLERY_IMAGES}
              </span>
            </div>

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryChange}
              className="hidden"
            />

            <div className="grid grid-cols-3 gap-2">
              {form.galleryImages.map((url) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-lg overflow-hidden border border-[#2A241E] bg-[#0A0807]"
                >
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingGallery(url)}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/70 text-red-400 border border-red-500/30"
                    aria-label="Remove gallery image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {newGalleryItems.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-[#D4AF37]/40 bg-[#0A0807]"
                >
                  <img
                    src={item.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewGallery(item.id)}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/70 text-red-400 border border-red-500/30"
                    aria-label="Remove new gallery image"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              {galleryCount < MAX_GALLERY_IMAGES && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="aspect-square rounded-lg border border-dashed border-[#2A241E] hover:border-[#D4AF37]/50 bg-[#0A0807] flex flex-col items-center justify-center gap-1 text-[#8C8070]"
                >
                  <ImagePlus size={16} className="text-[#D4AF37]" />
                  <span className="text-[9px]">Add</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60 resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Rules
            </label>
            <textarea
              value={form.rules}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, rules: e.target.value }))
              }
              rows={2}
              className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60 resize-y"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tags: e.target.value }))
              }
              className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
              placeholder="finance, startups"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value }))
              }
              className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#E5E0D8] text-xs sm:text-sm focus:outline-none focus:border-[#D4AF37]/60"
            >
              <option value="public">Public</option>
              <option value="private_invite">Private-Invite</option>
              <option value="private_request">Private-Request</option>
            </select>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#D4AF37] text-black text-xs sm:text-sm font-semibold disabled:opacity-60 hover:bg-[#e0c04a] transition-colors"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-[#2A241E] text-xs sm:text-sm text-[#A69B8D] hover:text-[#E5E0D8]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

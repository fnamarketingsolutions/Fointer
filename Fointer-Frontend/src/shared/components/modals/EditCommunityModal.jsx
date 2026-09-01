import { useEffect, useRef, useState } from 'react';
import {
  LuX as X,
  LuLoaderCircle as Loader2,
  LuUpload as Upload,
  LuImagePlus as ImagePlus,
  LuChevronDown as ChevronDown,
  LuLayers as Layers,
  LuLayoutGrid as Grid
} from 'react-icons/lu';
import { updateCommunity } from '../../../api/communities';
import { uploadMedia } from '../../../api/uploads';
import { fetchChannels, fetchSubchannels } from '../../../api/channels';
import { getErrorMessage } from '../../utils/errors';
import { makeGalleryItem, revokeGalleryPreviews } from '../../utils/media';
import { MAX_GALLERY_IMAGES, MAX_FILE_SIZE } from '../../constants/uploads';
import { useToast } from '../feedback/ToastContext';

const emptyForm = {
  name: '',
  description: '',
  rules: '',
  tags: '',
  coverImage: '',
  galleryImages: [],
  type: 'public',
  channelId: '',
  subchannelIds: [],
};

function getChannelNameFromCommunity(community) {
  if (!community?.channel) return '';
  if (typeof community.channel === 'object') {
    return community.channel?.name || '';
  }
  return String(community.channel);
}

function getSubchannelKeysFromCommunity(community) {
  if (!Array.isArray(community?.subchannels)) return [];
  return community.subchannels
    .map((sub) => {
      if (typeof sub === 'object') {
        return {
          id: String(sub.id || sub._id || '').trim(),
          name: String(sub.name || '').trim().toLowerCase(),
        };
      }
      return { id: '', name: String(sub || '').trim().toLowerCase() };
    })
    .filter((s) => s.id || s.name);
}

function buildFormFromCommunity(community) {
  if (!community) return emptyForm;

  const channelId =
    typeof community.channel === 'object'
      ? community.channel?.id || community.channel?._id || ''
      : '';

  // Prefer ObjectIds when present; otherwise keep name keys until resolved on open
  const subchannelIds = getSubchannelKeysFromCommunity(community)
    .map((s) => s.id || s.name)
    .filter(Boolean);

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
    channelId,
    subchannelIds,
  };
}

export default function EditCommunityModal({ community, onClose, onSuccess }) {
  const { showToast } = useToast();
  const open = Boolean(community);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [newGalleryItems, setNewGalleryItems] = useState([]);

  // Channel & Subchannel States
  const [channelName, setChannelName] = useState('');
  const [subchannels, setSubchannels] = useState([]);
  const [loadingSubchannels, setLoadingSubchannels] = useState(false);
  const [subchannelDropdownOpen, setSubchannelDropdownOpen] = useState(false);

  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const subchannelRef = useRef(null);
  const communityId = community?.id;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (subchannelRef.current && !subchannelRef.current.contains(event.target)) {
        setSubchannelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;

    const initialForm = buildFormFromCommunity(community);
    setForm(initialForm);
    setCoverFile(null);
    setSubchannelDropdownOpen(false);
    setCoverPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
    setNewGalleryItems((prev) => {
      revokeGalleryPreviews(prev);
      return [];
    });

    const chName = getChannelNameFromCommunity(community);
    setChannelName(chName);

    (async () => {
      setLoadingSubchannels(true);
      try {
        let resolvedChannelId = initialForm.channelId;

        if (!resolvedChannelId && chName) {
          const chData = await fetchChannels();
          const foundCh = (chData?.channels || []).find(
            (c) =>
              String(c.name || '').trim().toLowerCase() ===
              chName.trim().toLowerCase()
          );
          if (foundCh) {
            resolvedChannelId = foundCh.id;
            setChannelName(foundCh.name);
          }
        } else if (resolvedChannelId && !chName) {
          const chData = await fetchChannels();
          const foundCh = (chData?.channels || []).find(
            (c) => String(c.id) === String(resolvedChannelId)
          );
          if (foundCh) setChannelName(foundCh.name);
        }

        if (!resolvedChannelId) {
          setSubchannels([]);
          return;
        }

        setForm((prev) => ({ ...prev, channelId: resolvedChannelId }));

        const data = await fetchSubchannels({ channelId: resolvedChannelId });
        const list = data?.subchannels || [];
        setSubchannels(list);

        // Map stored names (or ids) to current subchannel ObjectIds for the form
        const selectedKeys = getSubchannelKeysFromCommunity(community);
        const resolvedIds = list
          .filter((sub) =>
            selectedKeys.some(
              (key) =>
                (key.id && String(sub.id) === key.id) ||
                (key.name &&
                  String(sub.name || '').trim().toLowerCase() === key.name)
            )
          )
          .map((sub) => String(sub.id));

        if (resolvedIds.length) {
          setForm((prev) => ({ ...prev, subchannelIds: resolvedIds }));
        }
      } catch (err) {
        showToast(getErrorMessage(err, 'Failed to load subchannels.'));
        setSubchannels([]);
      } finally {
        setLoadingSubchannels(false);
      }
    })();
  }, [open, communityId, community, showToast]);

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
    setSubchannelDropdownOpen(false);
    onClose?.();
  };

  const toggleSubchannel = (id) => {
    const subId = String(id);
    setForm((prev) => {
      const exists = prev.subchannelIds.some((sid) => String(sid) === subId);
      if (exists) {
        return {
          ...prev,
          subchannelIds: prev.subchannelIds.filter((sid) => String(sid) !== subId),
        };
      }
      if (prev.subchannelIds.length >= 5) {
        showToast('You can select at most 5 subchannels.');
        return prev;
      }
      return { ...prev, subchannelIds: [...prev.subchannelIds, subId] };
    });
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
      showToast('Community name is required.');
      return;
    }

    if (form.subchannelIds.length < 1 || form.subchannelIds.length > 5) {
      showToast('Select between 1 and 5 subchannels.');
      return;
    }

    const totalGallery = form.galleryImages.length + newGalleryItems.length;
    if (totalGallery > MAX_GALLERY_IMAGES) {
      showToast(`You can add up to ${MAX_GALLERY_IMAGES} gallery images.`);
      return;
    }

    setSaving(true);
    try {
      let coverImage = form.coverImage.trim();
      if (coverFile) {
        const upload = await uploadMedia(coverFile, 'fointer/communities');
        coverImage = upload?.media || coverImage;
      }

      const uploadedGallery = [];
      for (const item of newGalleryItems) {
        const upload = await uploadMedia(item.file, 'fointer/communities');
        if (upload?.media) uploadedGallery.push(upload.media);
      }

      const selectedIds = form.subchannelIds.map(String);
      const res = await updateCommunity(community.id, {
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
        subchannels: selectedIds,
      });

      clearNewGallery();
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(null);
      setCoverPreview('');

      // Prefer API-populated subchannels; fall back to local list for instant UI
      const apiCommunity = res?.community || {};
      const localSubchannels = subchannels.filter((s) =>
        selectedIds.includes(String(s.id))
      );
      await onSuccess?.({
        ...apiCommunity,
        subchannels:
          Array.isArray(apiCommunity.subchannels) && apiCommunity.subchannels.length
            ? apiCommunity.subchannels
            : localSubchannels,
      });
      onClose?.();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to update community.'));
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
      <div className="relative w-full max-w-md bg-[#120F0D] border border-[#2A241E] rounded-xl p-4 sm:p-5 shadow-2xl z-10 max-h-[90vh] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#120F0D] [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
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

        <form onSubmit={handleUpdate} className="space-y-3.5">
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] mb-1 flex items-center gap-1">
                <Layers size={12} className="text-[#D4AF37]" /> Channel (Primary)
              </label>
              <div className="w-full px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-[#8C8070] text-xs sm:text-sm flex items-center justify-between cursor-not-allowed">
                <span className="truncate">{channelName || 'Channel Assigned'}</span>
                <span className="text-[10px] uppercase text-[#D4AF37] font-semibold bg-[#D4AF37]/10 px-1.5 py-0.5 rounded">
                  Locked
                </span>
              </div>
            </div>

            <div className="relative" ref={subchannelRef}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] sm:text-xs uppercase tracking-wider text-[#A69B8D] flex items-center gap-1">
                  <Grid size={12} className="text-[#D4AF37]" /> Subchannels
                </label>
                <span className="text-[10px] text-[#8C8070]">
                  {form.subchannelIds.length}/5
                </span>
              </div>

              <button
                type="button"
                disabled={loadingSubchannels}
                onClick={() => setSubchannelDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 sm:py-2.5 rounded-lg bg-[#0A0807] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/60"
              >
                <span className="truncate">
                  {loadingSubchannels
                    ? 'Loading subchannels...'
                    : form.subchannelIds.length > 0
                    ? `${form.subchannelIds.length} subchannel(s) selected`
                    : 'Select subchannels'}
                </span>
                {loadingSubchannels ? (
                  <Loader2 size={14} className="animate-spin text-[#8C8070]" />
                ) : (
                  <ChevronDown
                    size={16}
                    className={`text-[#8C8070] transition-transform ${
                      subchannelDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>

              {subchannelDropdownOpen && !loadingSubchannels && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 max-h-48 overflow-y-auto bg-[#0A0807] border border-[#2A241E] rounded-lg shadow-xl py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#2A241E]">
                  {subchannels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[#8C8070]">
                      No subchannels available for this channel.
                    </div>
                  ) : (
                    subchannels.map((sub) => {
                      const selected = form.subchannelIds.some(
                        (sid) => String(sid) === String(sub.id)
                      );
                      return (
                        <label
                          key={sub.id}
                          className={`flex items-center gap-2.5 px-3 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
                            selected
                              ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-medium'
                              : 'text-[#E5E0D8] hover:bg-[#1a1510]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSubchannel(sub.id)}
                            className="accent-[#D4AF37] rounded border-[#2A241E] bg-[#120F0D]"
                          />
                          <span className="truncate">{sub.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

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
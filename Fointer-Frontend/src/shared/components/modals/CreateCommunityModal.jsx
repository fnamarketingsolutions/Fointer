import { useEffect, useRef, useState } from 'react';
import {
  LuLoaderCircle as Loader2,
  LuUpload as Upload,
  LuGlobe as Globe,
  LuLock as Lock,
  LuShieldCheck as ShieldCheck,
  LuX as X,
  LuImagePlus as ImagePlus,
  LuChevronDown as ChevronDown,
  LuCheck as Check
} from 'react-icons/lu';
import { createCommunity } from '../../../api/communities';
import { uploadMedia } from '../../../api/uploads';
import { fetchChannels, fetchSubchannels } from '../../../api/channels';
import { makeGalleryItem } from '../../utils/media';
import { MAX_GALLERY_IMAGES, MAX_FILE_SIZE } from '../../constants/uploads';
import { useToast } from '../feedback/ToastContext';
import { getErrorMessage } from '../../utils/errors';

const emptyForm = {
  name: '',
  description: '',
  rules: '',
  tags: [],
  coverImage: '',
  type: 'private_request',
  channelId: '',
  subchannelIds: [],
};

const TYPE_OPTIONS = [
  {
    value: 'public',
    label: 'Public',
    description: 'Visible to all members. Open enrollment.',
    icon: Globe,
  },
  {
    value: 'private_invite',
    label: 'Private-Invite',
    description: 'Hidden from search. Owner invites members.',
    icon: ShieldCheck,
  },
  {
    value: 'private_request',
    label: 'Private-Request',
    description: 'Discoverable. Members request access.',
    icon: Lock,
  },
];

export default function CreateCommunityModal({ open, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [galleryItems, setGalleryItems] = useState([]);
  const [channels, setChannels] = useState([]);
  const [subchannels, setSubchannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingSubchannels, setLoadingSubchannels] = useState(false);

  // Custom Dropdown Open States
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false);
  const [subchannelDropdownOpen, setSubchannelDropdownOpen] = useState(false);

  const coverInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const channelRef = useRef(null);
  const subchannelRef = useRef(null);

  const resetForm = () => {
    setForm(emptyForm);
    setTagInput('');
    setCoverFile(null);
    setCoverPreview('');
    setGalleryItems((prev) => {
      prev.forEach((item) => {
        if (item.preview) URL.revokeObjectURL(item.preview);
      });
      return [];
    });
    setSubchannels([]);
    setChannelDropdownOpen(false);
    setSubchannelDropdownOpen(false);
    if (coverInputRef.current) coverInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  // Close custom dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (channelRef.current && !channelRef.current.contains(event.target)) {
        setChannelDropdownOpen(false);
      }
      if (
        subchannelRef.current &&
        !subchannelRef.current.contains(event.target)
      ) {
        setSubchannelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    resetForm();
    let cancelled = false;
    (async () => {
      setLoadingChannels(true);
      try {
        const data = await fetchChannels();
        if (!cancelled) setChannels(data?.channels || []);
      } catch (err) {
        if (!cancelled) {
          showToast(getErrorMessage(err, 'Failed to load channels.'));
        }
      } finally {
        if (!cancelled) setLoadingChannels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, showToast]);

  useEffect(() => {
    if (!open || !form.channelId) {
      setSubchannels([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setLoadingSubchannels(true);
      try {
        const data = await fetchSubchannels({ channelId: form.channelId });
        if (!cancelled) setSubchannels(data?.subchannels || []);
      } catch (err) {
        if (!cancelled) {
          showToast(getErrorMessage(err, 'Failed to load subchannels.'));
          setSubchannels([]);
        }
      } finally {
        if (!cancelled) setLoadingSubchannels(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, form.channelId, showToast]);

  if (!open) return null;

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleChannelSelect = (channelId) => {
    setForm((prev) => ({
      ...prev,
      channelId,
      subchannelIds: [],
    }));
    setChannelDropdownOpen(false);
  };

  const toggleSubchannel = (id) => {
    setForm((prev) => {
      const exists = prev.subchannelIds.includes(id);
      if (exists) {
        return {
          ...prev,
          subchannelIds: prev.subchannelIds.filter((sid) => sid !== id),
        };
      }
      if (prev.subchannelIds.length >= 5) {
        showToast('You can select at most 5 subchannels.');
        return prev;
      }
      return { ...prev, subchannelIds: [...prev.subchannelIds, id] };
    });
  };

  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      showToast('Cover image size should be under 5MB.');
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const clearCover = () => {
    setCoverFile(null);
    setCoverPreview('');
    handleInputChange('coverImage', '');
    if (coverInputRef.current) coverInputRef.current.value = '';
  };

  const handleGalleryChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_GALLERY_IMAGES - galleryItems.length;
    if (remaining <= 0) {
      showToast(`You can add up to ${MAX_GALLERY_IMAGES} gallery images.`);
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      return;
    }
    const oversized = files.find((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      showToast('Each gallery image must be under 5MB.');
      if (galleryInputRef.current) galleryInputRef.current.value = '';
      return;
    }
    const accepted = files.slice(0, remaining).map(makeGalleryItem);
    setGalleryItems((prev) => [...prev, ...accepted]);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const removeGalleryItem = (id) => {
    setGalleryItems((prev) => {
      const removed = prev.find((item) => item.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const addTag = (raw) => {
    const value = raw.trim().toLowerCase();
    if (!value) return;
    setForm((prev) => {
      if (prev.tags.includes(value) || prev.tags.length >= 12) return prev;
      return { ...prev, tags: [...prev.tags, value] };
    });
    setTagInput('');
  };

  const removeTag = (tag) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput.replace(/,/g, ''));
    } else if (e.key === 'Backspace' && !tagInput && form.tags.length) {
      removeTag(form.tags[form.tags.length - 1]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('Community name is required.');
      return;
    }
    if (!form.channelId) {
      showToast('Please select a channel.');
      return;
    }
    if (form.subchannelIds.length < 1 || form.subchannelIds.length > 5) {
      showToast('Select between 1 and 5 subchannels.');
      return;
    }

    setSaving(true);
    try {
      const pendingTag = tagInput.trim();
      const tags = pendingTag
        ? [...new Set([...form.tags, pendingTag.toLowerCase()])]
        : form.tags;

      let coverImage = form.coverImage || '';
      if (coverFile) {
        const upload = await uploadMedia(coverFile, 'fointer/communities');
        coverImage = upload?.media || '';
      }

      const galleryImages = [];
      for (const item of galleryItems) {
        const upload = await uploadMedia(item.file, 'fointer/communities');
        if (upload?.media) galleryImages.push(upload.media);
      }

      await createCommunity({
        name: form.name.trim(),
        description: form.description.trim(),
        rules: form.rules.trim(),
        tags,
        coverImage,
        galleryImages,
        type: form.type,
        channel: form.channelId,
        subchannels: form.subchannelIds,
      });

      resetForm();
      showToast('Community created.');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to create community.'));
    } finally {
      setSaving(false);
    }
  };

  const displayCover = coverPreview || form.coverImage;
  const selectedChannel = channels.find((c) => c.id === form.channelId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#120F0D] border border-[#2A241E] rounded-2xl shadow-2xl text-[#E5E0D8] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#120F0D] [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#D4AF37]/50">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 px-5 py-4 border-b border-[#2A241E] bg-[#120F0D]/95 backdrop-blur">
          <div>
            <h3 className="text-lg sm:text-xl font-serif font-semibold text-[#E5E0D8]">
              Create Community
            </h3>
            <p className="text-[11px] text-[#A69B8D] mt-0.5">
              Select a channel and 1–5 subchannels, then fill in the rest.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="text-[#8C8070] hover:text-[#E5E0D8] p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Custom Channel Dropdown */}
            <div className="relative" ref={channelRef}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
                Channel
              </label>
              <button
                type="button"
                disabled={loadingChannels}
                onClick={() => setChannelDropdownOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/80"
              >
                <span className="truncate">
                  {loadingChannels
                    ? 'Loading channels...'
                    : selectedChannel
                    ? selectedChannel.name
                    : 'Select a channel'}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-[#8C8070] transition-transform ${
                    channelDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {channelDropdownOpen && !loadingChannels && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-48 overflow-y-auto bg-[#0E0C0A] border border-[#2A241E] rounded-lg shadow-xl py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
                  {channels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[#8C8070]">
                      No channels available
                    </div>
                  ) : (
                    channels.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleChannelSelect(ch.id)}
                        className={`w-full text-left px-3.5 py-2 text-xs sm:text-sm transition-colors flex items-center justify-between ${
                          form.channelId === ch.id
                            ? 'bg-[#D4AF37]/15 text-[#D4AF37] font-semibold'
                            : 'text-[#E5E0D8] hover:bg-[#1a1510]'
                        }`}
                      >
                        <span className="truncate">{ch.name}</span>
                        {form.channelId === ch.id && <Check size={14} />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Custom Subchannel Multi-Select Dropdown */}
            <div className="relative" ref={subchannelRef}>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] mb-2">
                Subchannels ({form.subchannelIds.length}/5)
              </label>

              {!form.channelId ? (
                <div className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A]/60 border border-[#2A241E] text-xs text-[#8C8070]">
                  Select a channel first.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={loadingSubchannels}
                    onClick={() => setSubchannelDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] focus:outline-none focus:border-[#D4AF37]/80"
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
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 max-h-48 overflow-y-auto bg-[#0E0C0A] border border-[#2A241E] rounded-lg shadow-xl py-1 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[#2A241E] [&::-webkit-scrollbar-thumb]:rounded-full">
                      {subchannels.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[#8C8070]">
                          No subchannels for this channel yet.
                        </div>
                      ) : (
                        subchannels.map((sub) => {
                          const selected = form.subchannelIds.includes(sub.id);
                          return (
                            <label
                              key={sub.id}
                              className={`flex items-center gap-2.5 px-3.5 py-2 text-xs sm:text-sm cursor-pointer transition-colors ${
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
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Primary Cover Image
            </label>
            <input
              type="file"
              ref={coverInputRef}
              accept="image/*"
              onChange={handleCoverChange}
              className="hidden"
            />
            <div
              onClick={() => coverInputRef.current?.click()}
              className="relative w-full h-40 rounded-xl bg-[#0E0C0A] border border-dashed border-[#2A241E] hover:border-[#D4AF37]/50 overflow-hidden flex items-center justify-center cursor-pointer group"
            >
              {displayCover ? (
                <>
                  <img
                    src={displayCover}
                    alt="Community cover"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearCover();
                    }}
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-black/70 text-red-400 border border-red-500/30"
                  >
                    <X size={16} />
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-[#8C8070] p-4 text-center">
                  <Upload size={20} className="text-[#D4AF37]" />
                  <span className="text-xs">Click to upload cover</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
                Gallery Images
              </label>
              <span className="text-[10px] text-[#8C8070]">
                {galleryItems.length}/{MAX_GALLERY_IMAGES}
              </span>
            </div>
            <input
              type="file"
              ref={galleryInputRef}
              accept="image/*"
              multiple
              onChange={handleGalleryChange}
              className="hidden"
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {galleryItems.map((item) => (
                <div
                  key={item.id}
                  className="relative aspect-[4/3] rounded-lg overflow-hidden border border-[#2A241E]"
                >
                  <img
                    src={item.preview}
                    alt="Gallery"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeGalleryItem(item.id)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/70 text-red-400"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {galleryItems.length < MAX_GALLERY_IMAGES && (
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="aspect-[4/3] rounded-lg border border-dashed border-[#2A241E] hover:border-[#D4AF37]/50 flex flex-col items-center justify-center gap-1 text-[#8C8070]"
                >
                  <ImagePlus size={18} className="text-[#D4AF37]" />
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Community Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g. Sovereign Wealth Circle"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              placeholder="Define the purpose of your community..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Rules
            </label>
            <textarea
              value={form.rules}
              onChange={(e) => handleInputChange('rules', e.target.value)}
              rows={3}
              placeholder="House rules and expectations..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0E0C0A] border border-[#2A241E] text-xs sm:text-sm text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none focus:border-[#D4AF37]/80 resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#E5E0D8] mb-2">
              Tags / Topics
            </label>
            <div className="w-full min-h-[42px] px-2.5 py-2 rounded-lg bg-[#0E0C0A] border border-[#2A241E] flex flex-wrap items-center gap-1.5 focus-within:border-[#D4AF37]/80">
              {form.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4AF37]/15 text-[#D4AF37] text-[11px]"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => addTag(tagInput)}
                placeholder={form.tags.length ? '' : 'finance, startups'}
                className="flex-1 min-w-[120px] bg-transparent text-xs text-[#E5E0D8] placeholder-[#5A5046] focus:outline-none px-1"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#D4AF37]">
              Community Type
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TYPE_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = form.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleInputChange('type', value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selected
                        ? 'bg-[#251E17] border-[#D4AF37] text-white'
                        : 'bg-[#0E0C0A] border-[#2A241E] text-[#8C8070] hover:border-[#3D332A]'
                    }`}
                  >
                    <Icon
                      size={16}
                      className={`mb-1.5 ${selected ? 'text-[#D4AF37]' : ''}`}
                    />
                    <div className="text-xs font-bold text-[#E5E0D8]">{label}</div>
                    <div className="text-[10px] text-[#A69B8D] mt-0.5 leading-tight">
                      {description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2A241E]">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="text-xs text-[#A69B8D] hover:text-[#E5E0D8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black text-xs sm:text-sm font-bold disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              Create Community
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LuLoaderCircle as Loader2 } from "react-icons/lu";
import { useAuth } from "../../../../context/AuthContext";
import { useToast } from "../../../../shared/components/feedback/ToastContext";
import {
  fetchUserSupportCategories,
  submitUserSupportRequest,
} from "../../../../api/userSupport";
import { getErrorMessage } from "../../../../shared/utils/errors";

const inputClass =
  "w-full bg-fo-bg border border-fo-border focus:border-fo-accent text-fo-text placeholder:text-fo-subtle rounded-lg px-4 py-3 text-sm outline-none transition duration-200";

export default function UserSupport() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    categoryId: "",
    email: "",
    phone: "",
    message: "",
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchUserSupportCategories();
        if (!cancelled) setCategories(data?.categories || []);
      } catch (err) {
        if (!cancelled) {
          showToast(getErrorMessage(err, "Failed to load support categories."));
          setCategories([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      email: prev.email || user.email || "",
      phone: prev.phone || user.phone || "",
    }));
  }, [user]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.categoryId) {
      showToast("Select a support category.");
      return;
    }
    if (!form.email.trim()) {
      showToast("Email is required.");
      return;
    }
    if (!form.phone.trim()) {
      showToast("Phone number is required.");
      return;
    }
    if (!form.message.trim()) {
      showToast("Please describe your request.");
      return;
    }

    setSubmitting(true);
    try {
      await submitUserSupportRequest({
        categoryId: form.categoryId,
        email: form.email.trim(),
        phone: form.phone.trim(),
        message: form.message.trim(),
      });
      showToast("Support request submitted.");
      setForm({
        categoryId: "",
        email: user?.email || "",
        phone: user?.phone || "",
        message: "",
      });
    } catch (err) {
      showToast(getErrorMessage(err, "Failed to submit support request."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className="relative bg-fo-bg text-fo-text pt-28 pb-12 min-h-[40vh] flex flex-col justify-center items-center overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-fo-accent/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 border border-fo-accent/30 bg-fo-surface/80 px-4 py-1.5 rounded-full mb-8 backdrop-blur-md"
          >
            <span className="text-[11px] font-semibold tracking-[0.25em] text-fo-accent uppercase">
              User Support
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl sm:text-6xl md:text-7xl font-serif text-center max-w-4xl leading-[1.15] text-fo-text/95"
          >
            How can we{" "}
            <span className="italic font-normal text-fo-accent">help you</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-6 text-fo-subtle text-sm sm:text-base md:text-lg text-center max-w-2xl leading-relaxed font-light"
          >
            Choose a category, share your email and phone, and tell us what you
            need. Our team will review your request.
          </motion.p>
        </div>
      </section>

      <section className="relative w-full bg-fo-bg text-fo-text pb-20 overflow-hidden">
        <div className="relative max-w-xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
          <div className="bg-fo-surface/40 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-2xl border border-fo-border shadow-2xl">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-fo-muted">
                <Loader2 size={16} className="animate-spin text-fo-accent" />
                Loading categories…
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-fo-subtle text-center py-8">
                Support categories will appear here once an admin adds them.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="support-category"
                    className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5"
                  >
                    Category
                  </label>
                  <select
                    id="support-category"
                    value={form.categoryId}
                    onChange={handleChange("categoryId")}
                    className={inputClass}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="support-email"
                    className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    value={form.email}
                    onChange={handleChange("email")}
                    placeholder="you@example.com"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="support-phone"
                    className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5"
                  >
                    Phone
                  </label>
                  <input
                    id="support-phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange("phone")}
                    placeholder="+1 555 000 0000"
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="support-message"
                    className="block text-xs md:text-sm font-medium text-fo-muted mb-1.5"
                  >
                    Your request
                  </label>
                  <textarea
                    id="support-message"
                    rows={5}
                    value={form.message}
                    onChange={handleChange("message")}
                    placeholder="Tell us what you need help with…"
                    className={`${inputClass} resize-y min-h-[120px]`}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 bg-fo-accent hover:bg-fo-accent-hover text-fo-bg font-bold text-sm sm:text-base py-3.5 px-6 rounded-lg transition duration-200 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : null}
                  Submit request
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

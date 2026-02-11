"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { formatInTimeZone, toDate } from "date-fns-tz";
import { Post, PostPlatform } from "@/lib/data-access";
import { X, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useRouter } from "next/navigation";

interface PostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post | null;
  initialDate: Date | null;
  enabledPlatforms: { id: string; name: string; constraints: any }[];
}

export default function PostDialog({
  isOpen,
  onClose,
  post,
  initialDate,
  enabledPlatforms
}: PostDialogProps) {
  const router = useRouter();
  const [content, setContent] = useState(post?.content || "");
  const TIMEZONE = "Europe/Rome";

  const [scheduledAt, setScheduledAt] = useState(
    post ? formatInTimeZone(new Date(post.scheduled_at), TIMEZONE, "yyyy-MM-dd'T'HH:mm") :
    initialDate ? formatInTimeZone(initialDate, TIMEZONE, "yyyy-MM-dd'T'12:00") :
    formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd'T'12:00")
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    post?.platforms?.map(p => p.platform) || []
  );
  const [overrides, setOverrides] = useState<Record<string, string>>(
    post?.platforms?.reduce((acc, p) => {
      if (p.override_content) acc[p.platform] = p.override_content;
      return acc;
    }, {} as Record<string, string>) || {}
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePlatform = (id: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleOverrideChange = (platformId: string, value: string) => {
    setOverrides(prev => ({ ...prev, [platformId]: value }));
  };

  const handleSave = async () => {
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Convert Rome time to UTC
    const dateInRome = toDate(scheduledAt, { timeZone: TIMEZONE });

    const payload = {
      content,
      scheduled_at: dateInRome.toISOString(),
      platforms: selectedPlatforms.map(p => ({
        platform: p,
        override_content: overrides[p] || null
      }))
    };

    try {
      if (post) {
        await axios.patch(`/api/posts/${post.id}`, payload);
      } else {
        await axios.post("/api/posts", payload);
      }
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm("Are you sure you want to delete this post?")) return;

    setIsSubmitting(true);
    try {
      await axios.delete(`/api/posts/${post.id}`);
      router.refresh();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete post");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">{post ? "Edit Post" : "Create New Post"}</h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-3 border border-red-100 dark:border-red-800">
              <AlertCircle size={20} />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Time (Europe/Rome)</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full p-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Base Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary outline-none min-h-[120px] transition-all"
              placeholder="What do you want to share?"
            />
            <div className="flex justify-end">
               <span className="text-xs text-muted-foreground">{content.length} characters</span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Target Platforms</label>
            <div className="flex flex-wrap gap-2">
              {enabledPlatforms.map((p) => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={cn(
                    "px-4 py-2 rounded-full border text-sm font-medium transition-all",
                    selectedPlatforms.includes(p.id)
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted text-muted-foreground hover:bg-accent border-transparent"
                  )}
                >
                  {p.name}
                </button>
              ))}
              {enabledPlatforms.length === 0 && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 italic">No platforms configured. Check your environment variables.</p>
              )}
            </div>
          </div>

          {selectedPlatforms.map(platformId => {
            const platform = enabledPlatforms.find(p => p.id === platformId);
            const charLimit = platform?.constraints?.characterLimit;
            const currentContent = overrides[platformId] || content;
            const isOverLimit = charLimit && currentContent.length > charLimit;

            return (
              <div key={platformId} className="p-4 rounded-lg border bg-accent/30 space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm">{platform?.name} Override</h4>
                  {charLimit && (
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded",
                      isOverLimit ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                    )}>
                      {currentContent.length} / {charLimit}
                    </span>
                  )}
                </div>
                <textarea
                  value={overrides[platformId] || ""}
                  onChange={(e) => handleOverrideChange(platformId, e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-background outline-none min-h-[80px]"
                  placeholder={`Optional override for ${platform?.name}...`}
                />
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t flex justify-between gap-4">
          {post ? (
            <button
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSubmitting || (selectedPlatforms.length === 0)}
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : post ? "Update Post" : "Schedule Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

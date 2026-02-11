"use client";

import {
  format,
  isSameDay
} from "date-fns";
import { Post } from "@/lib/data-access";
import { RecurrenceEvent } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

interface DayViewProps {
  date: Date;
  posts: Post[];
  recurrences: RecurrenceEvent[];
  onEditPost: (post: Post) => void;
  onAddPost: (date: Date) => void;
}

export default function DayView({
  date,
  posts,
  recurrences,
  onEditPost,
  onAddPost
}: DayViewProps) {
  const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduled_at), date));
  const dayRecurrences = recurrences.filter((r) => isSameDay(new Date(r.start), date));

  return (
    <div className="flex flex-col h-full p-6 gap-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 border-b pb-4">
        <span className="text-5xl font-bold">{format(date, "d")}</span>
        <div className="flex flex-col">
          <span className="text-xl font-medium">{format(date, "EEEE")}</span>
          <span className="text-muted-foreground">{format(date, "MMMM yyyy")}</span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recurrence Events</h3>
        {dayRecurrences.length === 0 && <p className="text-muted-foreground italic">No events today</p>}
        {dayRecurrences.map((r) => (
          <div
            key={r.id}
            className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800"
          >
            <h4 className="font-bold text-blue-900 dark:text-blue-100">{r.title}</h4>
            {r.description && <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">{r.description}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Scheduled Posts</h3>
          <button
            onClick={() => onAddPost(date)}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Add Post
          </button>
        </div>
        {dayPosts.length === 0 && <p className="text-muted-foreground italic">No posts scheduled</p>}
        {dayPosts.map((p) => (
          <div
            key={p.id}
            onClick={() => onEditPost(p)}
            className={cn(
              "p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md",
              p.status === "published"
                ? "bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800"
                : p.status === "failed"
                ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800"
                : "bg-orange-50 dark:bg-orange-900/10 border-orange-100 dark:border-orange-800"
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <span className="text-lg font-bold">{format(new Date(p.scheduled_at), "HH:mm")}</span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                p.status === "published" ? "bg-green-200 text-green-800" :
                p.status === "failed" ? "bg-red-200 text-red-800" :
                "bg-orange-200 text-orange-800"
              )}>
                {p.status}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{p.content}</p>
            <div className="mt-4 flex gap-2">
              {p.platforms?.map(pp => (
                <span key={pp.id} className="text-xs px-2 py-1 rounded bg-background border">
                  {pp.platform}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

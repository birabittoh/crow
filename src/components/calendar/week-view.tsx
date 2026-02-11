"use client";

import {
  format,
  startOfWeek,
  eachDayOfInterval,
  addDays,
  isSameDay,
  isToday
} from "date-fns";
import { Post } from "@/lib/data-access";
import { RecurrenceEvent } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

interface WeekViewProps {
  date: Date;
  posts: Post[];
  recurrences: RecurrenceEvent[];
  onEditPost: (post: Post) => void;
  onAddPost: (date: Date) => void;
}

export default function WeekView({
  date,
  posts,
  recurrences,
  onEditPost,
  onAddPost
}: WeekViewProps) {
  const weekStart = startOfWeek(date);
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/20">
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "p-4 border-r text-center last:border-r-0 flex flex-col items-center gap-1",
              isToday(day) && "bg-primary/5"
            )}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase">{format(day, "EEE")}</span>
            <span className={cn(
              "text-xl font-semibold w-10 h-10 flex items-center justify-center rounded-full",
              isToday(day) && "bg-primary text-primary-foreground"
            )}>
              {format(day, "d")}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 overflow-y-auto min-h-0">
        {days.map((day) => {
          const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduled_at), day));
          const dayRecurrences = recurrences.filter((r) => isSameDay(new Date(r.start), day));

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r p-2 flex flex-col gap-2 last:border-r-0 hover:bg-accent/20 cursor-pointer",
                isToday(day) && "bg-primary/5"
              )}
              onClick={() => onAddPost(day)}
            >
              {dayRecurrences.map((r) => (
                <div
                  key={r.id}
                  className="text-xs p-2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                >
                  <div className="font-bold">Event</div>
                  <div>{r.title}</div>
                </div>
              ))}
              {dayPosts.map((p) => (
                <div
                  key={p.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPost(p);
                  }}
                  className={cn(
                    "text-xs p-2 rounded-md border transition-all shadow-sm",
                    p.status === "published"
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                      : p.status === "failed"
                      ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                      : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                  )}
                >
                  <div className="font-bold mb-1">{format(new Date(p.scheduled_at), "HH:mm")}</div>
                  <div className="line-clamp-3">{p.content}</div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                    {p.platforms?.map(pp => (
                      <span key={pp.id} className="text-[8px] uppercase px-1 rounded bg-background/50 border border-foreground/10">
                        {pp.platform}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

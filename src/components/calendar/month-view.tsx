"use client";

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday
} from "date-fns";
import { Post } from "@/lib/data-access";
import { RecurrenceEvent } from "@/lib/recurrence";
import { cn } from "@/lib/utils";

interface MonthViewProps {
  date: Date;
  posts: Post[];
  recurrences: RecurrenceEvent[];
  onEditPost: (post: Post) => void;
  onAddPost: (date: Date) => void;
}

export default function MonthView({
  date,
  posts,
  recurrences,
  onEditPost,
  onAddPost
}: MonthViewProps) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-7 border-b">
        {dayNames.map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground uppercase">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {days.map((day, idx) => {
          const dayPosts = posts.filter((p) => isSameDay(new Date(p.scheduled_at), day));
          const dayRecurrences = recurrences.filter((r) => isSameDay(new Date(r.start), day));
          const isCurrentMonth = isSameMonth(day, monthStart);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[120px] border-b border-r p-1 flex flex-col gap-1 hover:bg-accent/50 transition-colors cursor-pointer",
                !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                idx % 7 === 6 && "border-r-0"
              )}
              onClick={() => onAddPost(day)}
            >
              <div className="flex justify-between items-center p-1">
                <span className={cn(
                  "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                  isToday(day) && "bg-primary text-primary-foreground"
                )}>
                  {format(day, "d")}
                </span>
              </div>
              <div className="flex flex-col gap-1 overflow-y-auto max-h-[100px]">
                {dayRecurrences.map((r) => (
                  <div
                    key={r.id}
                    className="text-[10px] px-1.5 py-0.5 rounded-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 truncate border border-blue-200 dark:border-blue-800"
                    title={r.title}
                  >
                    {r.title}
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
                      "text-[10px] px-1.5 py-0.5 rounded-sm truncate border transition-all",
                      p.status === "published"
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        : p.status === "failed"
                        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800"
                        : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800"
                    )}
                  >
                    <span className="font-bold mr-1">{format(new Date(p.scheduled_at), "HH:mm")}</span>
                    {p.content}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

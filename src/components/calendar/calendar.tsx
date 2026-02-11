"use client";

import { useState } from "react";
import { format, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, isSameDay } from "date-fns";
import { Post } from "@/lib/data-access";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import MonthView from "./month-view";
import WeekView from "./week-view";
import DayView from "./day-view";
import PostDialog from "./post-dialog";

// Correct import
import { RecurrenceEvent as IRecurrenceEvent } from "@/lib/recurrence";

interface CalendarProps {
  initialPosts: Post[];
  recurrences: IRecurrenceEvent[];
  initialDate: string;
  initialView: "month" | "week" | "day";
  enabledPlatforms: any[];
}

export default function Calendar({
  initialPosts,
  recurrences,
  initialDate,
  initialView,
  enabledPlatforms
}: CalendarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [date, setDate] = useState(new Date(initialDate));
  const [view, setView] = useState(initialView);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const updateUrl = (newDate: Date, newView: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    params.set("view", newView);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePrev = () => {
    let newDate: Date;
    if (view === "month") newDate = subMonths(date, 1);
    else if (view === "week") newDate = subWeeks(date, 1);
    else newDate = subDays(date, 1);
    setDate(newDate);
    updateUrl(newDate, view);
  };

  const handleNext = () => {
    let newDate: Date;
    if (view === "month") newDate = addMonths(date, 1);
    else if (view === "week") newDate = addWeeks(date, 1);
    else newDate = addDays(date, 1);
    setDate(newDate);
    updateUrl(newDate, view);
  };

  const handleViewChange = (newView: "month" | "week" | "day") => {
    setView(newView);
    updateUrl(date, newView);
  };

  const handleAddPost = (d?: Date) => {
    setSelectedPost(null);
    setSelectedDate(d || new Date());
    setIsDialogOpen(true);
  };

  const handleEditPost = (post: Post) => {
    setSelectedPost(post);
    setSelectedDate(new Date(post.scheduled_at));
    setIsDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full bg-background border rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">
            {format(date, view === "month" ? "MMMM yyyy" : "MMM d, yyyy")}
          </h2>
          <div className="flex border rounded-md overflow-hidden">
            <button onClick={handlePrev} className="p-2 hover:bg-accent border-r">
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => { setDate(new Date()); updateUrl(new Date(), view); }}
              className="px-3 py-1 text-sm font-medium hover:bg-accent border-r"
            >
              Today
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-accent">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex border rounded-md overflow-hidden bg-muted p-1">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => handleViewChange(v)}
                className={`px-3 py-1 text-sm font-medium rounded-sm capitalize ${
                  view === v ? "bg-background shadow-sm" : "hover:bg-transparent opacity-70"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => handleAddPost()}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            <span>New Post</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {view === "month" && (
          <MonthView
            date={date}
            posts={initialPosts}
            recurrences={recurrences}
            onEditPost={handleEditPost}
            onAddPost={handleAddPost}
          />
        )}
        {view === "week" && (
          <WeekView
            date={date}
            posts={initialPosts}
            recurrences={recurrences}
            onEditPost={handleEditPost}
            onAddPost={handleAddPost}
          />
        )}
        {view === "day" && (
          <DayView
            date={date}
            posts={initialPosts}
            recurrences={recurrences}
            onEditPost={handleEditPost}
            onAddPost={handleAddPost}
          />
        )}
      </div>

      {isDialogOpen && (
        <PostDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          post={selectedPost}
          initialDate={selectedDate}
          enabledPlatforms={enabledPlatforms}
        />
      )}
    </div>
  );
}

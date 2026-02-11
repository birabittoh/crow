import { getPosts } from "@/lib/data-access";
import { getRecurrenceEvents } from "@/lib/recurrence";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import Calendar from "@/components/calendar/calendar";
import { getEnabledPlatforms } from "@/integrations";
import Link from "next/link";
import { BarChart2, User } from "lucide-react";
import { getAutheliaUserInfo } from "@/lib/authelia";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date: dateStr, view = "month" } = await searchParams;
  const date = dateStr ? new Date(dateStr) : new Date();

  let start: Date;
  let end: Date;

  if (view === "month") {
    start = startOfWeek(startOfMonth(date));
    end = endOfWeek(endOfMonth(date));
  } else if (view === "week") {
    start = startOfWeek(date);
    end = endOfWeek(date);
  } else {
    start = startOfDay(date);
    end = endOfDay(date);
  }

  const [posts, recurrences, userInfo] = await Promise.all([
    getPosts(start.toISOString(), end.toISOString()),
    getRecurrenceEvents(start.toISOString(), end.toISOString()),
    getAutheliaUserInfo(),
  ]);

  const enabledPlatforms = getEnabledPlatforms().map(p => ({
    id: p.id,
    name: p.name,
    constraints: p.getConstraints()
  }));

  return (
    <div className="p-4">
      <header className="mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold">Crow</h1>
          {userInfo && (
            <div className="flex items-center gap-2 px-3 py-1 bg-accent rounded-full text-sm">
              <User size={14} />
              <span>{userInfo.display_name}</span>
            </div>
          )}
        </div>
        <div className="flex gap-4">
           <Link
            href="/analytics"
            className="flex items-center gap-2 px-4 py-2 rounded-md border hover:bg-accent transition-colors"
           >
            <BarChart2 size={18} />
            <span>Analytics</span>
           </Link>
        </div>
      </header>

      <Calendar
        initialPosts={posts}
        recurrences={recurrences}
        initialDate={date.toISOString()}
        initialView={view as any}
        enabledPlatforms={enabledPlatforms}
      />
    </div>
  );
}

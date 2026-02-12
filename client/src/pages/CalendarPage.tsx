import React, { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  startOfDay,
  endOfDay,
  parseISO,
  getHours,
  getMinutes,
} from 'date-fns';
import { usePosts, useRecurrentEvents } from '../hooks';
import type { Post, RecurrentEvent } from '../api';

type CalendarView = 'month' | 'week' | 'day';

interface CalendarProps {
  onSelectPost: (post: Post) => void;
  onSelectDate: (date: Date) => void;
  recurrentEventsUrl: string | null | undefined;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled': return 'var(--color-scheduled)';
    case 'publishing': return 'var(--color-publishing)';
    case 'published': return 'var(--color-published)';
    case 'partially_published': return 'var(--color-partial)';
    case 'failed': return 'var(--color-failed)';
    default: return 'var(--color-muted)';
  }
}

function isRecurrentOnDate(event: RecurrentEvent, date: Date): boolean {
  return event.day === date.getDate() && event.month === date.getMonth() + 1;
}

export default function CalendarPage({ onSelectPost, onSelectDate, recurrentEventsUrl }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const { data: posts = [] } = usePosts();
  const { data: recurrentEvents = [] } = useRecurrentEvents(recurrentEventsUrl);

  const navigate = (direction: 1 | -1) => {
    if (viewMode === 'month') {
      setCurrentDate((d) => (direction === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    } else if (viewMode === 'week') {
      setCurrentDate((d) => (direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
    } else {
      setCurrentDate((d) => addDays(d, direction));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const title = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  }, [currentDate, viewMode]);

  return (
    <div className="calendar">
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>&lt;</button>
          <button className="btn btn-ghost" onClick={goToday}>Today</button>
          <button className="btn btn-ghost" onClick={() => navigate(1)}>&gt;</button>
          <h2 className="calendar-title">{title}</h2>
        </div>
        <div className="view-switcher">
          {(['month', 'week', 'day'] as const).map((v) => (
            <button
              key={v}
              className={`btn btn-ghost ${viewMode === v ? 'active' : ''}`}
              onClick={() => setViewMode(v)}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
          onSwitchToDay={(date) => {
            setCurrentDate(date);
            setViewMode('day');
          }}
        />
      )}
      {viewMode === 'week' && (
        <WeekView
          currentDate={currentDate}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
        />
      )}
      {viewMode === 'day' && (
        <DayView
          currentDate={currentDate}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
        />
      )}
    </div>
  );
}

interface ViewProps {
  currentDate: Date;
  posts: Post[];
  recurrentEvents: RecurrentEvent[];
  onSelectPost: (post: Post) => void;
  onSelectDate: (date: Date) => void;
}

function MonthView({
  currentDate,
  posts,
  recurrentEvents,
  onSelectPost,
  onSelectDate,
  onSwitchToDay,
}: ViewProps & { onSwitchToDay: (date: Date) => void }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weeks: Date[][] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="month-view">
      <div className="month-header">
        {dayNames.map((name) => (
          <div key={name} className="month-header-cell">{name}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="month-row">
          {week.map((d) => {
            const dayPosts = posts.filter((p) =>
              isSameDay(parseISO(p.scheduled_at_utc), d)
            );
            const dayEvents = recurrentEvents.filter((e) => isRecurrentOnDate(e, d));
            const inMonth = isSameMonth(d, currentDate);

            return (
              <div
                key={d.toISOString()}
                className={`month-cell ${!inMonth ? 'other-month' : ''} ${isToday(d) ? 'today' : ''}`}
                onClick={() => onSelectDate(d)}
              >
                <span
                  className="day-number"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwitchToDay(d);
                  }}
                >
                  {format(d, 'd')}
                </span>
                <div className="cell-events">
                  {dayEvents.map((ev) => (
                    <div key={ev.id} className="event-chip recurrent-event" title={ev.description}>
                      {ev.name}
                    </div>
                  ))}
                  {dayPosts.map((p) => (
                    <div
                      key={p.id}
                      className="event-chip post-event"
                      style={{ borderLeftColor: getStatusColor(p.status) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPost(p);
                      }}
                    >
                      {format(parseISO(p.scheduled_at_utc), 'HH:mm')}{' '}
                      {p.base_content.substring(0, 30)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({ currentDate, posts, recurrentEvents, onSelectPost, onSelectDate }: ViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const hasAnyEvents = days.some((d) =>
    recurrentEvents.some((e) => isRecurrentOnDate(e, d))
  );

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="time-gutter-header" />
        {days.map((d) => (
          <div key={d.toISOString()} className={`week-header-cell ${isToday(d) ? 'today' : ''}`}>
            <span className="week-day-name">{format(d, 'EEE')}</span>
            <span className="week-day-num">{format(d, 'd')}</span>
          </div>
        ))}
      </div>
      {hasAnyEvents && (
        <div className="week-allday-row">
          <div className="time-gutter allday-gutter">All day</div>
          {days.map((d) => {
            const dayEvents = recurrentEvents.filter((e) => isRecurrentOnDate(e, d));
            return (
              <div key={d.toISOString()} className="week-allday-cell">
                {dayEvents.map((ev) => (
                  <div key={ev.id} className="event-chip recurrent-event" title={ev.description}>
                    {ev.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      <div className="week-body">
        {hours.map((hour) => (
          <div key={hour} className="week-row">
            <div className="time-gutter">{format(new Date(2000, 0, 1, hour), 'HH:mm')}</div>
            {days.map((d) => {
              const cellTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour);
              const cellPosts = posts.filter((p) => {
                const pDate = parseISO(p.scheduled_at_utc);
                return isSameDay(pDate, d) && getHours(pDate) === hour;
              });

              return (
                <div
                  key={d.toISOString()}
                  className="week-cell"
                  onClick={() => onSelectDate(cellTime)}
                >
                  {cellPosts.map((p) => (
                    <div
                      key={p.id}
                      className="event-chip post-event"
                      style={{ borderLeftColor: getStatusColor(p.status) }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPost(p);
                      }}
                    >
                      {format(parseISO(p.scheduled_at_utc), 'HH:mm')}{' '}
                      {p.base_content.substring(0, 20)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView({ currentDate, posts, recurrentEvents, onSelectPost, onSelectDate }: ViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = recurrentEvents.filter((e) => isRecurrentOnDate(e, currentDate));

  return (
    <div className="day-view">
      {dayEvents.length > 0 && (
        <div className="day-events-banner">
          {dayEvents.map((ev) => (
            <div key={ev.id} className="event-chip recurrent-event" title={ev.description}>
              {ev.name}
            </div>
          ))}
        </div>
      )}
      <div className="day-body">
        {hours.map((hour) => {
          const cellTime = new Date(
            currentDate.getFullYear(),
            currentDate.getMonth(),
            currentDate.getDate(),
            hour
          );
          const hourPosts = posts.filter((p) => {
            const pDate = parseISO(p.scheduled_at_utc);
            return isSameDay(pDate, currentDate) && getHours(pDate) === hour;
          });

          return (
            <div key={hour} className="day-row" onClick={() => onSelectDate(cellTime)}>
              <div className="time-gutter">{format(new Date(2000, 0, 1, hour), 'HH:mm')}</div>
              <div className="day-cell">
                {hourPosts.map((p) => (
                  <div
                    key={p.id}
                    className="event-chip post-event post-event-large"
                    style={{ borderLeftColor: getStatusColor(p.status) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPost(p);
                    }}
                  >
                    <div className="post-event-time">
                      {format(parseISO(p.scheduled_at_utc), 'HH:mm')}
                    </div>
                    <div className="post-event-content">{p.base_content.substring(0, 80)}</div>
                    <div className="post-event-platforms">
                      {p.platform_targets.map((t) => (
                        <span
                          key={t.id}
                          className="badge badge-small"
                          style={{ backgroundColor: getStatusColor(t.publish_status) }}
                        >
                          {t.platform}
                        </span>
                      ))}
                    </div>
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

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  onSelectDate: (date: Date, theme?: string) => void;
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

function getEventDisplayName(event: RecurrentEvent, date: Date): string {
  if (event.year === undefined || event.year === null) return event.name;
  const age = date.getFullYear() - event.year;
  return `${event.name} (${age})`;
}

function buildEventTheme(event: RecurrentEvent, date: Date): string {
  const parts: string[] = [event.name];
  if (event.description) parts.push(event.description);
  if (event.year !== undefined && event.year !== null) {
    const diff = date.getFullYear() - event.year;
    if (diff > 0) parts.push(`${diff} years`);
  }
  return parts.join(' - ');
}

export default function CalendarPage({ onSelectPost, onSelectDate }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarView>('month');
  const { data: posts = [] } = usePosts();
  const { data: recurrentEvents = [] } = useRecurrentEvents();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // On mobile, week view becomes day view
  const effectiveView = (viewMode === 'week' && isMobile) ? 'day' : viewMode;

  const navigate = (direction: 1 | -1) => {
    if (isMobile || effectiveView === 'month') {
      setCurrentDate((d) => (direction === 1 ? addMonths(d, 1) : subMonths(d, 1)));
    } else if (effectiveView === 'week') {
      setCurrentDate((d) => (direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1)));
    } else {
      setCurrentDate((d) => addDays(d, direction));
    }
  };

  const goToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  };

  // Swipe navigation
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) {
      navigate(diff > 0 ? -1 : 1);
    }
    touchStartX.current = null;
  };

  const title = useMemo(() => {
    if (isMobile) return format(currentDate, 'MMMM yyyy');
    if (effectiveView === 'month') return format(currentDate, 'MMMM yyyy');
    if (effectiveView === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  }, [currentDate, effectiveView, isMobile]);

  const desktopViews: CalendarView[] = ['month', 'week', 'day'];

  // Mobile: single combined view (month + selected day)
  if (isMobile) {
    return (
      <div className="calendar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="calendar-toolbar">
          <div className="calendar-nav">
            <button className="btn btn-ghost" onClick={() => navigate(-1)}>&lt;</button>
            <button className="btn btn-ghost" onClick={goToday}>Today</button>
            <button className="btn btn-ghost" onClick={() => navigate(1)}>&gt;</button>
            <h2 className="calendar-title">{title}</h2>
          </div>
        </div>

        <MonthView
          currentDate={currentDate}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
          onSwitchToDay={(date) => {
            setSelectedDay(date);
            if (!isSameMonth(date, currentDate)) {
              setCurrentDate(date);
            }
          }}
          isMobile={true}
          selectedDay={selectedDay}
        />

        <h3 className="mobile-day-title">{format(selectedDay, 'EEE, MMM d')}</h3>

        <DayView
          currentDate={selectedDay}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
        />
      </div>
    );
  }

  // Desktop: three separate views
  return (
    <div className="calendar" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button className="btn btn-ghost" onClick={() => navigate(-1)}>&lt;</button>
          <button className="btn btn-ghost" onClick={goToday}>Today</button>
          <button className="btn btn-ghost" onClick={() => navigate(1)}>&gt;</button>
          <h2 className="calendar-title">{title}</h2>
        </div>
        <div className="view-switcher">
          {desktopViews.map((v) => (
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

      {effectiveView === 'month' && (
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
          isMobile={false}
        />
      )}
      {effectiveView === 'week' && (
        <WeekView
          currentDate={currentDate}
          posts={posts}
          recurrentEvents={recurrentEvents}
          onSelectPost={onSelectPost}
          onSelectDate={onSelectDate}
        />
      )}
      {effectiveView === 'day' && (
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
  onSelectDate: (date: Date, theme?: string) => void;
}

function MonthView({
  currentDate,
  posts,
  recurrentEvents,
  onSelectPost,
  onSelectDate,
  onSwitchToDay,
  isMobile,
  selectedDay,
}: ViewProps & { onSwitchToDay: (date: Date) => void; isMobile: boolean; selectedDay?: Date }) {
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

  const dayNames = isMobile
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="month-view">
      <div className="month-header">
        {dayNames.map((name, i) => (
          <div key={i} className="month-header-cell">{name}</div>
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
                className={`month-cell ${!inMonth ? 'other-month' : ''} ${isToday(d) ? 'today' : ''} ${selectedDay && isSameDay(d, selectedDay) ? 'selected' : ''}`}
                onClick={() => isMobile ? onSwitchToDay(d) : onSelectDate(d)}
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
                {isMobile ? (
                  <div className="cell-events-dots">
                    {dayEvents.map((ev) => (
                      <span key={ev.id} className="event-dot" style={{ backgroundColor: 'var(--color-recurrent)' }} />
                    ))}
                    {dayPosts.slice(0, 3).map((p) => (
                      <span key={p.id} className="event-dot" style={{ backgroundColor: getStatusColor(p.status) }} />
                    ))}
                    {dayPosts.length > 3 && (
                      <span className="event-dot-more">+{dayPosts.length - 3}</span>
                    )}
                  </div>
                ) : (
                  <div className="cell-events">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="event-chip recurrent-event"
                        title={ev.description}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectDate(d, buildEventTheme(ev, d));
                        }}
                      >
                        {getEventDisplayName(ev, d)}
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
                )}
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
                  <div
                    key={ev.id}
                    className="event-chip recurrent-event"
                    title={ev.description}
                    onClick={() => onSelectDate(d, buildEventTheme(ev, d))}
                  >
                    {getEventDisplayName(ev, d)}
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
            <div
              key={ev.id}
              className="event-chip recurrent-event"
              title={ev.description}
              onClick={() => onSelectDate(currentDate, buildEventTheme(ev, currentDate))}
            >
              {getEventDisplayName(ev, currentDate)}
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

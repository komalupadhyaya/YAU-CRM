import React from 'react';
import { Calendar, Video, Clock, Building, UserCheck, ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface MeetingItem {
  _id: string;
  title: string;
  category: 'school' | 'hr' | string;
  dateTime: string;
  duration?: number;
  meetingType?: string;
  meetingLink?: string;
  status?: string;
  leadName?: string;
  candidateName?: string;
  attendees?: string[];
  createdByName?: string;
}

interface MeetingsThisWeekWidgetProps {
  meetings: MeetingItem[];
  loading?: boolean;
}

export const MeetingsThisWeekWidget: React.FC<MeetingsThisWeekWidgetProps> = ({
  meetings,
  loading = false
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm relative overflow-hidden">
      {/* Priority 9 Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Calendar size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-sm">
                Priority 9
              </span>
              <h2 className="text-base font-bold text-foreground">Meetings Scheduled This Week</h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {meetings.length} Scheduled
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Upcoming School partner consultations and HR candidate interviews
            </p>
          </div>
        </div>

        <Link
          to="/calendar"
          className="text-xs text-primary font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
        >
          View Team Calendar <ArrowRight size={13} />
        </Link>
      </div>

      {/* Meetings List */}
      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
          Loading scheduled meetings...
        </div>
      ) : meetings.length === 0 ? (
        <div className="py-8 text-center bg-background/40 rounded-xl border border-dashed">
          <Calendar size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-sm font-semibold text-foreground">No Meetings Scheduled This Week</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use the dialer or follow-up tasks to schedule upcoming partner consultations.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {meetings.map((m) => {
            const isSchool = m.category === 'school';
            const meetingDate = new Date(m.dateTime);
            const dateStr = meetingDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return (
              <div
                key={m._id}
                className="bg-background/60 hover:bg-background border rounded-xl p-3.5 transition-all hover:shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      isSchool 
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' 
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    }`}>
                      {isSchool ? <Building size={10} /> : <UserCheck size={10} />}
                      {isSchool ? 'School Partner' : 'HR Candidate'}
                    </span>

                    <h4 className="font-bold text-sm text-foreground truncate">
                      {m.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Clock size={11} className="text-primary" /> {dateStr} at {timeStr} ({m.duration} min)
                    </span>
                    {(m.leadName || m.candidateName) && (
                      <span className="truncate">
                        • With: <strong className="text-foreground">{m.leadName || m.candidateName}</strong>
                      </span>
                    )}
                  </div>

                  {m.attendees && m.attendees.length > 0 && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      Attendees: {m.attendees.join(', ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {m.meetingLink ? (
                    <a
                      href={m.meetingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                    >
                      <Video size={12} /> Join Meeting
                    </a>
                  ) : (
                    <span className="text-[11px] text-muted-foreground px-2 py-1 bg-accent/40 rounded">
                      In-Person / Phone
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MeetingsThisWeekWidget;

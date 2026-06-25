import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { cn } from "@/lib/utils";

export interface DateTimePickerProps {
  id?: string;
  value: string; // UTC ISO string (from DB / state)
  onChange: (value: string) => void; // emits UTC ISO string
  className?: string;
  size?: "default" | "sm";
  required?: boolean;
  layout?: "default" | "stacked";
}

/**
 * Parses a UTC ISO string into display parts in the BROWSER'S LOCAL timezone.
 * If the value has no timezone info (legacy "YYYY-MM-DDTHH:mm"), treat it as
 * local time directly to stay backward-compatible with any in-flight form state.
 */
const parseToLocal = (utcStr: string) => {
  if (!utcStr) return { date: "", hour: "10", minute: "00", ampm: "AM" };

  let year: number, month: number, day: number, h24: number, minute: number;

  // If it already looks like a UTC ISO string (has Z or +), parse and extract local parts
  if (utcStr.includes("Z") || utcStr.includes("+")) {
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return { date: "", hour: "10", minute: "00", ampm: "AM" };
    year = d.getFullYear();
    month = d.getMonth() + 1;
    day = d.getDate();
    h24 = d.getHours();
    minute = d.getMinutes();
  } else {
    // Naive string (legacy YYYY-MM-DDTHH:mm) — treat as local time already
    const [datePart, timePart = "00:00"] = utcStr.split("T");
    [year, month, day] = datePart.split("-").map(Number);
    [h24, minute] = timePart.split(":").map(Number);
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return { date: "", hour: "10", minute: "00", ampm: "AM" };
    }
  }

  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;

  return {
    date: dateStr,
    hour: String(h12).padStart(2, "0"),
    minute: String(minute).padStart(2, "0"),
    ampm,
  };
};

/**
 * Combines date + 12-h time parts into a Date in the browser's LOCAL timezone,
 * then emits the UTC ISO string for storage/API.
 * Using new Date(year, month-1, day, h24, minute) constructs in local time.
 */
const buildUTCIso = (date: string, hour: string, minute: string, ampm: string): string => {
  if (!date) return "";
  let h24 = parseInt(hour, 10);
  if (ampm === "PM" && h24 < 12) h24 += 12;
  else if (ampm === "AM" && h24 === 12) h24 = 0;
  const [year, month, day] = date.split("-").map(Number);
  // new Date(year, month-1, day, h24, minute) uses local timezone — no hardcoded EST offset
  const localDate = new Date(year, month - 1, day, h24, parseInt(minute, 10));
  return localDate.toISOString();
};


export const DateTimePicker = React.forwardRef<HTMLInputElement, DateTimePickerProps>(
  ({ id, value, onChange, className, size = "default", required, layout = "default" }, ref) => {
    const { date, hour: parsedHour, minute: parsedMinute, ampm: parsedAmPm } = React.useMemo(
      () => parseToLocal(value),
      [value]
    );

    const [localHour, setLocalHour] = React.useState(parsedHour);
    const [localMinute, setLocalMinute] = React.useState(parsedMinute);
    const [localAmPm, setLocalAmPm] = React.useState(parsedAmPm);

    // Sync local states when parsed props change (from parent updates)
    React.useEffect(() => {
      setLocalHour(parsedHour);
      setLocalMinute(parsedMinute);
      setLocalAmPm(parsedAmPm);
    }, [parsedHour, parsedMinute, parsedAmPm]);

    const handleDateChange = (newDate: string) => {
      if (!newDate) {
        onChange("");
      } else {
        onChange(buildUTCIso(newDate, localHour, localMinute, localAmPm));
      }
    };

    const handleHourChange = (newHour: string) => {
      setLocalHour(newHour);
      if (date) onChange(buildUTCIso(date, newHour, localMinute, localAmPm));
    };

    const handleMinuteChange = (newMinute: string) => {
      setLocalMinute(newMinute);
      if (date) onChange(buildUTCIso(date, localHour, newMinute, localAmPm));
    };

    const handleAmPmChange = (newAmPm: string) => {
      setLocalAmPm(newAmPm);
      if (date) onChange(buildUTCIso(date, localHour, localMinute, newAmPm));
    };

    const isSm = size === "sm";
    const isStacked = layout === "stacked";

    return (
      <div className={cn(
        "flex gap-2",
        isStacked ? "flex-col" : "flex-row flex-wrap sm:flex-nowrap items-center",
        className
      )}>
        <input
          type="date"
          ref={ref}
          id={id}
          value={date}
          required={required}
          onChange={(e) => handleDateChange(e.target.value)}
          className={cn(
            "bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-violet-500",
            isStacked ? "w-full" : "flex-1 min-w-[120px]",
            isSm ? "px-2 py-1 text-xs h-8" : "px-3 py-1.5 text-sm h-9"
          )}
        />
        <div className="flex gap-2 items-center">
          <Select value={localHour} onValueChange={handleHourChange}>
            <SelectTrigger className={cn("shrink-0", isSm ? "w-[58px] h-8 text-xs px-1.5" : "w-[68px] h-9")}>
              <SelectValue placeholder="Hr" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((hr) => (
                <SelectItem key={hr} value={hr}>{hr}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className={cn("text-muted-foreground font-bold shrink-0", isSm ? "text-xs" : "text-sm")}>:</span>
          <Select value={localMinute} onValueChange={handleMinuteChange}>
            <SelectTrigger className={cn("shrink-0", isSm ? "w-[58px] h-8 text-xs px-1.5" : "w-[68px] h-9")}>
              <SelectValue placeholder="Min" />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((min) => (
                <SelectItem key={min} value={min}>{min}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={localAmPm} onValueChange={handleAmPmChange}>
            <SelectTrigger className={cn("shrink-0", isSm ? "w-[68px] h-8 text-xs px-1.5" : "w-[78px] h-9")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
);

DateTimePicker.displayName = "DateTimePicker";

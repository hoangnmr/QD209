const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const SURCHARGE_APPLY_HOUR = 8;

const pad = (value: number | string) => String(value).padStart(2, "0");

export const buildIsoDate = (year: number | string, month: number | string, day: number | string) =>
  `${year}-${pad(month)}-${pad(day)}`;

export const buildIsoDateTime = (
  year: number | string,
  month: number | string,
  day: number | string,
  hour = 0,
  minute = 0,
  second = 0
) => `${buildIsoDate(year, month, day)}T${pad(hour)}:${pad(minute)}:${pad(second)}+07:00`;

export const getVietnamDateTimeParts = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "00";

  return {
    year: Number(getPart("year")),
    month: Number(getPart("month")),
    day: Number(getPart("day")),
    hour: Number(getPart("hour")),
    minute: Number(getPart("minute")),
    second: Number(getPart("second"))
  };
};

export const getVietnamTodayIsoDate = () => {
  const now = getVietnamDateTimeParts();
  return buildIsoDate(now.year, now.month, now.day);
};

const shiftIsoDateByDays = (isoDate: string, dayOffset: number) => {
  const baseTimestamp = new Date(`${isoDate}T00:00:00+07:00`).getTime() + dayOffset * 86400000;
  const parts = getVietnamDateTimeParts(new Date(baseTimestamp));
  return buildIsoDate(parts.year, parts.month, parts.day);
};

export const getSurchargeApplyAt = (effectiveDate: string, effectiveAt?: string | null) => {
  if (effectiveAt && !effectiveAt.endsWith("T00:00:00+07:00")) {
    const nextDate = shiftIsoDateByDays(effectiveAt.slice(0, 10), 1);
    return buildIsoDateTime(nextDate.slice(0, 4), nextDate.slice(5, 7), nextDate.slice(8, 10), SURCHARGE_APPLY_HOUR, 0, 0);
  }

  return buildIsoDateTime(
    effectiveDate.slice(0, 4),
    effectiveDate.slice(5, 7),
    effectiveDate.slice(8, 10),
    SURCHARGE_APPLY_HOUR,
    0,
    0
  );
};

export const getSurchargeApplyDate = (effectiveDate: string, effectiveAt?: string | null) =>
  getSurchargeApplyAt(effectiveDate, effectiveAt).slice(0, 10);

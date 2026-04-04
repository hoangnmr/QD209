import { FuelPrice } from '../types';

const padDatePart = (value: number) => String(value).padStart(2, '0');
const padTimePart = (value: number) => String(value).padStart(2, '0');
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const SURCHARGE_APPLY_HOUR = 8;

export const buildIsoDate = (year: number, month: number, day: number) =>
  `${year}-${padDatePart(month)}-${padDatePart(day)}`;

export const buildIsoDateTime = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
) => `${buildIsoDate(year, month, day)}T${padTimePart(hour)}:${padTimePart(minute)}:${padTimePart(second)}+07:00`;

const getVietnamDateTimeParts = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '00';

  return {
    year: Number(getPart('year')),
    month: Number(getPart('month')),
    day: Number(getPart('day')),
    hour: Number(getPart('hour')),
    minute: Number(getPart('minute')),
    second: Number(getPart('second'))
  };
};

export const getVietnamNowParts = () => getVietnamDateTimeParts(new Date());

export const getVietnamTodayIsoDate = () => {
  const parts = getVietnamNowParts();
  return buildIsoDate(parts.year, parts.month, parts.day);
};

export const getVietnamCurrentHour = () => getVietnamNowParts().hour;

const shiftIsoDateByDays = (isoDate: string, dayOffset: number) => {
  const baseTimestamp = new Date(`${isoDate}T00:00:00+07:00`).getTime() + dayOffset * 86400000;
  const parts = getVietnamDateTimeParts(new Date(baseTimestamp));
  return buildIsoDate(parts.year, parts.month, parts.day);
};

export const normalizeDateInput = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = getVietnamDateTimeParts(value);
    return buildIsoDate(parts.year, parts.month, parts.day);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const millis = excelEpoch + Math.round(value * 86400000);
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return buildIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  }

  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  const viMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (viMatch) {
    const [, day, month, year] = viMatch;
    return buildIsoDate(Number(year), Number(month), Number(day));
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = getVietnamDateTimeParts(parsed);
    return buildIsoDate(parts.year, parts.month, parts.day);
  }

  return null;
};

export const normalizeDateTimeInput = (value: unknown): string | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const parts = getVietnamDateTimeParts(value);
    return buildIsoDateTime(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const millis = excelEpoch + Math.round(value * 86400000);
    const date = new Date(millis);
    if (!Number.isNaN(date.getTime())) {
      return buildIsoDateTime(
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds()
      );
    }
  }

  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const isoWithTimeMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:([+-]\d{2}:\d{2}|Z))?$/);
  if (isoWithTimeMatch) {
    const [, year, month, day, hour, minute, second = '00', offset] = isoWithTimeMatch;
    if (offset) {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) {
        const parts = getVietnamDateTimeParts(parsed);
        return buildIsoDateTime(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
      }
    }
    return buildIsoDateTime(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const viWithTimeMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (viWithTimeMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = viWithTimeMatch;
    return buildIsoDateTime(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  }

  const isoDate = normalizeDateInput(raw);
  if (isoDate) {
    const [year, month, day] = isoDate.split('-').map(Number);
    return buildIsoDateTime(year, month, day, 0, 0, 0);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const parts = getVietnamDateTimeParts(parsed);
    return buildIsoDateTime(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  }

  return null;
};

export const formatIsoDateToVi = (value: string) => {
  const normalized = normalizeDateInput(value);
  if (!normalized) return String(value);
  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
};

export const formatIsoDateTimeToVi = (value: string) => {
  const normalized = normalizeDateTimeInput(value);
  if (!normalized) return String(value);
  const [datePart, timeWithOffset] = normalized.split('T');
  const [year, month, day] = datePart.split('-');
  const timePart = timeWithOffset.slice(0, 8);
  return `${day}/${month}/${year} ${timePart}`;
};

const getDateTimestamp = (value: unknown, endOfDay = false) => {
  const normalized = normalizeDateInput(value);
  if (!normalized) return Number.NaN;
  const timePart = endOfDay ? '23:59:59' : '00:00:00';
  return new Date(`${normalized}T${timePart}+07:00`).getTime();
};

const getDateTimeTimestamp = (value: unknown) => {
  const normalized = normalizeDateTimeInput(value);
  return normalized ? new Date(normalized).getTime() : Number.NaN;
};

export const getSourcePriceEffectiveTimestamp = (price: FuelPrice) =>
  price.effectiveAt
    ? getDateTimeTimestamp(price.effectiveAt)
    : getDateTimestamp(price.date);

const shouldRollToNextBusinessMorning = (price: FuelPrice) => {
  const normalizedSource = normalizeDateTimeInput(price.effectiveAt);
  if (!normalizedSource) return false;
  return !normalizedSource.endsWith('T00:00:00+07:00');
};

export const getSurchargeEffectiveAt = (price: FuelPrice) => {
  const normalizedDate = normalizeDateInput(price.date);
  const normalizedSource = normalizeDateTimeInput(price.effectiveAt || price.date);

  if (shouldRollToNextBusinessMorning(price) && normalizedSource) {
    const sourceDate = normalizedSource.slice(0, 10);
    const nextDate = shiftIsoDateByDays(sourceDate, 1);
    return buildIsoDateTime(
      Number(nextDate.slice(0, 4)),
      Number(nextDate.slice(5, 7)),
      Number(nextDate.slice(8, 10)),
      SURCHARGE_APPLY_HOUR,
      0,
      0
    );
  }

  if (normalizedDate) {
    return buildIsoDateTime(
      Number(normalizedDate.slice(0, 4)),
      Number(normalizedDate.slice(5, 7)),
      Number(normalizedDate.slice(8, 10)),
      SURCHARGE_APPLY_HOUR,
      0,
      0
    );
  }

  return normalizedSource;
};

export const getPriceEffectiveTimestamp = (price: FuelPrice) => {
  const surchargeEffectiveAt = getSurchargeEffectiveAt(price);
  return surchargeEffectiveAt ? getDateTimeTimestamp(surchargeEffectiveAt) : Number.NaN;
};

export const buildSurchargeCheckDateTime = (date: string) => {
  const normalizedDate = normalizeDateInput(date);
  if (!normalizedDate) return null;
  return buildIsoDateTime(
    Number(normalizedDate.slice(0, 4)),
    Number(normalizedDate.slice(5, 7)),
    Number(normalizedDate.slice(8, 10)),
    SURCHARGE_APPLY_HOUR,
    0,
    0
  );
};

export const getLatestPriceByFuelType = (
  prices: FuelPrice[],
  fuelType: string
): FuelPrice | undefined => {
  const matchingPrices = prices
    .filter(price => price.fuelType === fuelType)
    .sort((a, b) => getPriceEffectiveTimestamp(b) - getPriceEffectiveTimestamp(a));

  if (matchingPrices.length === 0) return undefined;

  const latestApplicable = matchingPrices.find(price => {
    const effectiveTimestamp = getPriceEffectiveTimestamp(price);
    return !Number.isNaN(effectiveTimestamp) && effectiveTimestamp <= Date.now();
  });

  return latestApplicable ?? matchingPrices[0];
};

export const getLatestPricesByFuelTypes = (
  prices: FuelPrice[],
  fuelTypes: string[]
): FuelPrice[] =>
  fuelTypes
    .map(fuelType => getLatestPriceByFuelType(prices, fuelType))
    .filter((price): price is FuelPrice => Boolean(price));

export const getLatestPriceByFuelTypeOnOrBeforeDate = (
  prices: FuelPrice[],
  fuelType: string,
  targetDate: unknown
): FuelPrice | undefined => {
  const normalizedDate = normalizeDateInput(targetDate);
  const targetDateTime = normalizedDate ? buildSurchargeCheckDateTime(normalizedDate) : null;
  const targetTimestamp = targetDateTime ? getDateTimeTimestamp(targetDateTime) : Number.NaN;
  if (Number.isNaN(targetTimestamp)) return undefined;

  return prices
    .filter(price => price.fuelType === fuelType)
    .filter(price => {
      const priceTimestamp = getPriceEffectiveTimestamp(price);
      return !Number.isNaN(priceTimestamp) && priceTimestamp <= targetTimestamp;
    })
    .sort((a, b) => getPriceEffectiveTimestamp(b) - getPriceEffectiveTimestamp(a))[0];
};

export const getLatestPriceByFuelTypeAt = (
  prices: FuelPrice[],
  fuelType: string,
  targetDateTime: unknown
): FuelPrice | undefined => {
  const targetTimestamp = getDateTimeTimestamp(targetDateTime);
  if (Number.isNaN(targetTimestamp)) return undefined;

  return prices
    .filter(price => price.fuelType === fuelType)
    .filter(price => {
      const priceTimestamp = getPriceEffectiveTimestamp(price);
      return !Number.isNaN(priceTimestamp) && priceTimestamp <= targetTimestamp;
    })
    .sort((a, b) => getPriceEffectiveTimestamp(b) - getPriceEffectiveTimestamp(a))[0];
};

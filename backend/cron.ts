import { syncAndSave } from "./scrapers/petrolimex.js";
import { getVietnamDateTimeParts, buildIsoDate } from "./utils/vietnamTime.js";

const CRON_HOUR = 6; // 6:00 AM giờ Việt Nam
const DAY_MS = 24 * 60 * 60 * 1000;

function msUntilNext6AM(): number {
  const now = new Date();
  const { year, month, day, hour, minute, second } = getVietnamDateTimeParts(now);

  const todayStr = buildIsoDate(year, month, day);
  const target6AM = new Date(`${todayStr}T06:00:00+07:00`).getTime();
  const nowMs = now.getTime();

  if (hour < CRON_HOUR) {
    // Chưa tới 6h hôm nay → chờ đến 6h hôm nay
    return target6AM - nowMs;
  }
  // Đã qua 6h hôm nay → chờ đến 6h ngày mai
  return target6AM + DAY_MS - nowMs;
}

async function cronTask(): Promise<void> {
  console.log("[Cron] 🕕 6:00 AM VN — Bắt đầu cào giá Petrolimex...");
  try {
    const result = await syncAndSave(true);
    console.log(`[Cron] ✅ Kết quả: ${result.message}`);
  } catch (err: any) {
    console.error(`[Cron] ❌ Lỗi cào giá: ${err.message}`);
  }
}

function scheduleNext(): void {
  const ms = msUntilNext6AM();
  const hours = (ms / (1000 * 60 * 60)).toFixed(1);
  console.log(`[Cron] ⏰ Lần cào tiếp theo sau ${hours} giờ`);

  setTimeout(async () => {
    await cronTask();
    // Lặp lại mỗi 24 giờ
    setInterval(cronTask, DAY_MS);
  }, ms);
}

export function startCronJobs(): void {
  console.log("[Cron] 🚀 Khởi động lịch cào giá Petrolimex hằng ngày lúc 6:00 AM (VN)");
  scheduleNext();
}

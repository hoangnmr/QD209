import React, { useMemo } from 'react';
import { Minimize, Fuel, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Tier } from '../types';

function findContainerTierIndex(price: number, tiers: Tier[]): number {
  const sorted = [...tiers].sort((a, b) => a.minPrice - b.minPrice);
  for (let i = 0; i < sorted.length; i++) {
    if (price >= sorted[i].minPrice && price <= sorted[i].maxPrice) return i + 1;
  }
  return sorted.length;
}

function fmt(n: number): string {
  return n.toLocaleString('vi-VN');
}

interface Props {
  onExit: () => void;
}

const FullscreenOverlay: React.FC<Props> = ({ onExit }) => {
  const { prices, tiers, bulkTiers } = useAppContext();

  const sortedPrices = useMemo(
    () => [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [prices],
  );

  const latestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : null;
  const prevPrice = sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 2] : null;
  const currentPriceValue = latestPrice?.priceV1 ?? 0;

  const sortedTiers = useMemo(() => [...tiers].sort((a, b) => a.minPrice - b.minPrice), [tiers]);
  const tierIndex = findContainerTierIndex(currentPriceValue, sortedTiers);
  const currentTier = sortedTiers[tierIndex - 1] ?? null;

  const sortedBulkTiers = useMemo(() => [...bulkTiers].sort((a, b) => a.minPrice - b.minPrice), [bulkTiers]);
  const activeBulk = sortedBulkTiers.find(
    (t) => currentPriceValue >= t.minPrice && currentPriceValue <= t.maxPrice,
  );
  const bulkTierIndex = activeBulk ? sortedBulkTiers.indexOf(activeBulk) + 1 : 0;

  const priceDelta = latestPrice && prevPrice ? latestPrice.priceV1 - prevPrice.priceV1 : 0;
  const isUp = priceDelta > 0;
  const isDown = priceDelta < 0;

  const dateStr = latestPrice
    ? new Date(latestPrice.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-br from-[#0a1628] via-[#0d2137] to-[#091a2a] text-white flex flex-col select-none">

      {/* ─── Header bar ─── */}
      <header className="flex items-center justify-between px-6 py-3 bg-black/20 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-tight uppercase">Cảng Sài Gòn — Tân Thuận Terminal</h1>
            <p className="text-[10px] text-white/40 font-bold tracking-widest uppercase">Hệ thống phụ thu nhiên liệu • QĐ 209/QĐ-CSG</p>
          </div>
        </div>
        <button
          onClick={onExit}
          className="flex items-center gap-2 bg-white/10 hover:bg-rose-600 text-white font-bold text-sm px-4 py-2 rounded-lg transition-all"
        >
          <Minimize className="w-4 h-4" />
          Thoát
        </button>
      </header>

      {/* ─── Main content: fill remaining space ─── */}
      <div className="flex-1 flex flex-col p-6 gap-5 min-h-0">

        {/* Row 1: Fuel price hero + tier badge */}
        <div className="grid grid-cols-12 gap-5 shrink-0">
          {/* Fuel price card */}
          <div className="col-span-8 bg-gradient-to-br from-[#0d3b66] to-[#0a2a4a] rounded-2xl p-6 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <p className="text-white/50 font-bold text-sm mb-1">Giá Dầu DO 0,05S-II Hiện Tại</p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl xl:text-6xl font-black tracking-tight">{latestPrice ? fmt(latestPrice.priceV1) : '—'}</span>
                <span className="text-white/50 font-bold text-lg">VND / Lít</span>
              </div>
            </div>
            <div className="relative z-10 flex flex-col items-end gap-2">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
                <Clock className="w-4 h-4 text-white/50" />
                <span className="font-bold text-white/70 text-sm">{dateStr}</span>
              </div>
              {priceDelta !== 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-sm ${isUp ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  <span>{isUp ? '+' : ''}{fmt(priceDelta)} đ</span>
                </div>
              )}
            </div>
          </div>

          {/* Tier badge */}
          <div className="col-span-4 bg-white/5 backdrop-blur border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center p-6">
            <p className="text-white/40 font-bold text-xs uppercase tracking-widest mb-2">Bậc Phụ Thu Hiện Tại</p>
            <div className="relative mb-2">
              <div className="w-20 h-24 bg-amber-500/10 border-2 border-amber-400 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/10">
                <span className="text-5xl font-black text-amber-400">{tierIndex}</span>
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-400 rounded-full animate-pulse" />
            </div>
            <p className="text-white/50 font-bold text-sm">
              {currentTier ? `${fmt(currentTier.minPrice)} – ${currentTier.maxPrice >= 99999 ? 'Trở lên' : fmt(currentTier.maxPrice)}` : '—'} VND
            </p>
          </div>
        </div>

        {/* Row 2: Surcharge tables — fill remaining vertical space */}
        <div className="grid grid-cols-12 gap-5 flex-1 min-h-0">
          {/* Container surcharge */}
          <div className="col-span-8 bg-white/5 backdrop-blur border border-white/10 rounded-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
              <div className="bg-indigo-500/20 p-1.5 rounded-md"><Fuel className="w-4 h-4 text-indigo-400" /></div>
              <h3 className="font-bold text-base">Hàng Container — Bậc {tierIndex}</h3>
            </div>
            <div className="flex-1 flex items-center justify-center p-5">
              {currentTier ? (
                <table className="w-full">
                  <thead>
                    <tr className="text-white/40 text-xs font-bold uppercase tracking-widest">
                      <th className="pb-3 text-left">Khoảng giá DO</th>
                      <th className="pb-3 text-right">20 Full</th>
                      <th className="pb-3 text-right">40 Full</th>
                      <th className="pb-3 text-right">20 Empty</th>
                      <th className="pb-3 text-right">40 Empty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-white/10">
                      <td className="py-4 text-lg font-bold text-white/80">
                        {fmt(currentTier.minPrice)} – {currentTier.maxPrice >= 99999 ? 'Trở lên' : fmt(currentTier.maxPrice)}
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-3xl xl:text-4xl font-black text-indigo-400">{fmt(currentTier.surcharge20F)}</span>
                        <span className="text-white/40 text-sm ml-1">đ</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-3xl xl:text-4xl font-black text-indigo-400">{fmt(currentTier.surcharge40F)}</span>
                        <span className="text-white/40 text-sm ml-1">đ</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-3xl xl:text-4xl font-black text-emerald-400">{fmt(currentTier.surcharge20E)}</span>
                        <span className="text-white/40 text-sm ml-1">đ</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-3xl xl:text-4xl font-black text-emerald-400">{fmt(currentTier.surcharge40E)}</span>
                        <span className="text-white/40 text-sm ml-1">đ</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-white/30 font-bold">Không có dữ liệu bậc phụ thu</p>
              )}
            </div>
          </div>

          {/* Bulk cargo surcharge */}
          <div className="col-span-4 bg-white/5 backdrop-blur border border-white/10 rounded-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10 flex items-center gap-2 shrink-0">
              <div className="bg-emerald-500/20 p-1.5 rounded-md"><Fuel className="w-4 h-4 text-emerald-400" /></div>
              <h3 className="font-bold text-base">Hàng Ngoài Container — Bậc {bulkTierIndex}</h3>
            </div>
            <div className="flex-1 flex items-center justify-center p-5">
              {activeBulk ? (
                <div className="text-center">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Khoảng giá DO</p>
                  <p className="text-lg font-bold text-white/80 mb-4">
                    {fmt(activeBulk.minPrice)} – {activeBulk.maxPrice >= 99999 ? 'Trở lên' : fmt(activeBulk.maxPrice)}
                  </p>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Mức phụ thu</p>
                  <span className="text-5xl xl:text-6xl font-black text-emerald-400">{Number(activeBulk.percentSurcharge).toFixed(2)}</span>
                  <span className="text-2xl font-black text-emerald-400/60 ml-1">%</span>
                </div>
              ) : (
                <p className="text-white/30 font-bold">Không có dữ liệu bậc phụ thu</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="shrink-0 text-center">
          <p className="text-white/20 text-xs font-bold tracking-widest uppercase">
            Quyết định số 209/QĐ-CSG ngày 24/03/2026 • Áp dụng từ 01/04/2026 • Nhấn ESC hoặc nút Thoát để trở lại
          </p>
        </div>
      </div>
    </div>
  );
};

export default FullscreenOverlay;

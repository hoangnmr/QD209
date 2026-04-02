import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Clock, Fuel, Info, List, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAppContext } from '../context/AppContext';
import { cn } from '../lib/utils';
import { Tier } from '../types';
import * as S from '../styles/Dashboard.styles';
import { motionFadeUp } from '../styles/shared';

// ─── Helpers ────────────────────────────────────────────────────────────────

function findContainerTierIndex(price: number, tiers: Tier[]): number {
  const sorted = [...tiers].sort((a, b) => a.minPrice - b.minPrice);
  for (let i = 0; i < sorted.length; i++) {
    if (price >= sorted[i].minPrice && price <= sorted[i].maxPrice) return i + 1;
  }
  return sorted.length;
}

function formatPrice(n: number): string {
  return n.toLocaleString('vi-VN');
}

function formatDateVN(dateStr: string): string {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm}, ${dd}/${mo}/${yyyy}`;
}

type ChartRange = 'day' | 'week' | 'month';

const CHART_RANGES: { key: ChartRange; label: string }[] = [
  { key: 'day', label: '7 ngày' },
  { key: 'week', label: '30 ngày' },
  { key: 'month', label: '6 tháng' },
];

// ─── Component ──────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const { prices, tiers, bulkTiers } = useAppContext();
  const [chartRange, setChartRange] = useState<ChartRange>('month');

  const sortedPrices = useMemo(
    () => [...prices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [prices],
  );

  const latestPrice = sortedPrices.length > 0 ? sortedPrices[sortedPrices.length - 1] : null;
  const prevPrice = sortedPrices.length > 1 ? sortedPrices[sortedPrices.length - 2] : null;
  const currentPriceValue = latestPrice?.priceV1 ?? 0;
  const tierIndex = findContainerTierIndex(currentPriceValue, tiers);
  const sortedTiers = useMemo(() => [...tiers].sort((a, b) => a.minPrice - b.minPrice), [tiers]);
  const currentTier = sortedTiers[tierIndex - 1] ?? null;

  const priceDelta = latestPrice && prevPrice ? latestPrice.priceV1 - prevPrice.priceV1 : 0;
  const priceDeltaPct = prevPrice && prevPrice.priceV1 > 0
    ? ((priceDelta / prevPrice.priceV1) * 100).toFixed(1)
    : '0.0';
  const isUp = priceDelta > 0;
  const isDown = priceDelta < 0;
  const deltaStyle = isUp ? S.fuelDeltaUp : isDown ? S.fuelDeltaDown : S.fuelDeltaFlat;

  const chartData = useMemo(() => {
    if (sortedPrices.length === 0) return [];
    const now = new Date();
    let cutoff: Date;
    if (chartRange === 'day') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 7); }
    else if (chartRange === 'week') { cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - 30); }
    else { cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 6); }
    return sortedPrices
      .filter(p => new Date(p.date) >= cutoff)
      .map(p => ({
        ...p,
        tier: findContainerTierIndex(p.priceV1, tiers),
        label: new Date(p.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      }));
  }, [sortedPrices, chartRange, tiers]);

  const tierBoundaries = useMemo(
    () => sortedTiers.map(t => t.minPrice).filter(v => v > 0),
    [sortedTiers],
  );

  return (
    <div className={S.wrapper}>

      {/* ═══ SECTION 1: HERO ═══ */}
      <motion.div {...motionFadeUp} transition={{ duration: 0.5 }}>
        <h1 className={S.heroTitle}>Hệ Thống Phụ Thu Nhiên Liệu</h1>
        <p className={S.heroSubtitle}>Cảng Sài Gòn — Tân Thuận Terminal</p>

        <div className={S.heroGrid}>
          {/* Live Fuel Index Card */}
          <div className={S.fuelCard}>
            <div className={S.fuelCardBubbleTopRight} />
            <div className={S.fuelCardBubbleBottomLeft} />
            <div className={S.fuelCardContent}>
             {/* <div className={S.fuelBadgeRow}>
                <div className={S.fuelBadgeIcon}><Fuel className={S.fuelBadgeIconInner} /></div>
                <span className={S.fuelBadgeLabel}>Live Fuel Index</span>
              </div>*/}
              <p className={S.fuelSubLabel}>Giá Dầu DO 0,05S-II Hiện Tại:</p>
              <div className={S.fuelPriceRow}>
                <span className={S.fuelPriceValue}>{latestPrice ? formatPrice(latestPrice.priceV1) : '—'}</span>
                <span className={S.fuelPriceUnit}>VND / Lít</span>
              </div>
              <div className={S.fuelMetaRow}>
                <div className={S.fuelDateChip}>
                  <Clock className={S.fuelDateIcon} />
                  <span className={S.fuelDateText}>{latestPrice ? formatDateVN(latestPrice.date) : '—'}</span>
                </div>
                <div className={cn(S.fuelDeltaBase, deltaStyle)}>
                  {isUp ? <TrendingUp className={S.fuelDeltaIcon} /> : isDown ? <TrendingDown className={S.fuelDeltaIcon} /> : <TrendingUp className={S.fuelDeltaIcon} />}
                  <span>{isUp ? '+' : ''}{priceDeltaPct}% so với hôm trước</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Surcharge Tier Card */}
          <div className={S.tierCard}>
          
            <h2 className={S.tierStatusTitle}>Bậc Phụ Thu</h2>
            <div className={S.tierBadgeWrapper}>
              <div className={S.tierBadgeBox}><span className={S.tierBadgeNumber}>{tierIndex}</span></div>
              <div className={S.tierBadgeDot} />
            </div>
            
            <p className={S.tierRange}>
              ({currentTier ? `${formatPrice(currentTier.minPrice)} – ${currentTier.maxPrice >= 99999 ? 'Trở lên' : formatPrice(currentTier.maxPrice)}` : '—'} VND)
            </p>
            
          </div>
        </div>
      </motion.div>

      {/* ═══ SECTION 2: SURCHARGE TABLES ═══ */}
      <motion.div {...motionFadeUp} transition={{ duration: 0.5, delay: 0.15 }} className={S.tablesGrid}>
        {/* Container Surcharge Table */}
        <div className={S.tableCard}>
          <div className={S.tableHeaderRow}>
            <div className={S.tableHeaderIcon}><List className="w-5 h-5" /></div>
            <h3 className={S.tableHeaderTitle}>Hàng Container</h3>
          </div>
          <div className={S.tableScrollWrapper}>
            <table className={S.table}>
              <thead>
                <tr className={S.thead}>
                  <th className={S.thStt}>STT</th>
                  <th className={S.thLeft}>Khoảng giá DO</th>
                  <th className={S.thRight}>20F</th>
                  <th className={S.thRight}>40F</th>
                  <th className={S.thRight}>20E</th>
                  <th className={S.thRight}>40E</th>
                </tr>
              </thead>
              <tbody>
                {sortedTiers.map((t, i) => {
                  const active = tierIndex === i + 1;
                  return (
                    <tr key={t.id} className={cn(S.rowBase, active ? S.rowActive : S.rowIdle)}>
                      <td className={S.tdCenter}>
                        {active ? <span className={S.sttActive}>{i + 1}</span> : <span className={S.sttIdle}>{i + 1}</span>}
                      </td>
                      <td className={S.cellRange(active)}>
                        {formatPrice(t.minPrice)} – {t.maxPrice >= 99999 ? 'Trở lên' : formatPrice(t.maxPrice)}
                      </td>
                      <td className={S.cellValue(active)}>{formatPrice(t.surcharge20F)}</td>
                      <td className={S.cellValue(active)}>{formatPrice(t.surcharge40F)}</td>
                      <td className={S.cellValue(active)}>{formatPrice(t.surcharge20E)}</td>
                      <td className={S.cellValue(active)}>{formatPrice(t.surcharge40E)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk Cargo Surcharge Table */}
        <div className={S.tableCard}>
          <div className={S.tableHeaderRow}>
            <div className={S.tableHeaderIcon}><List className="w-5 h-5" /></div>
            <h3 className={S.tableHeaderTitle}>Hàng ngoài container</h3>
          </div>
          <div className={S.tableScrollWrapper}>
            <table className={S.table}>
              <thead>
                <tr className={S.thead}>
                  <th className={S.thStt}>STT</th>
                  <th className={S.thLeft}>Khoảng giá DO</th>
                  <th className={S.thRight}>Mức phụ thu (%)</th>
                </tr>
              </thead>
              <tbody>
                {[...bulkTiers].sort((a, b) => a.minPrice - b.minPrice).map((bt, i) => {
                  const active = currentPriceValue >= bt.minPrice && currentPriceValue <= bt.maxPrice;
                  return (
                    <tr key={bt.id} className={cn(S.rowBase, active ? S.rowActive : S.rowIdle)}>
                      <td className={S.tdCenter}>
                        {active ? <span className={S.sttActive}>{i + 1}</span> : <span className={S.sttIdle}>{i + 1}</span>}
                      </td>
                      <td className={S.cellRange(active)}>
                        {formatPrice(bt.minPrice)} – {bt.maxPrice >= 99999 ? 'Trở lên' : formatPrice(bt.maxPrice)}
                      </td>
                      <td className={S.cellPercent(active)}>{Number(bt.percentSurcharge).toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* ═══ SECTION 3: FUEL PRICE CHART ═══ */}
      <motion.div {...motionFadeUp} transition={{ duration: 0.5, delay: 0.3 }} className={S.chartCard}>
        <div className={S.chartHeader}>
          <div className={S.chartHeaderLeft}>
            <div className={S.chartHeaderIcon}><BarChart3 className="w-5 h-5" /></div>
            <h3 className={S.chartTitle}>Diễn biến giá dầu</h3>
          </div>
          <div className={S.rangeToggle}>
            {CHART_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setChartRange(r.key)}
                className={cn(S.rangeBtn, chartRange === r.key ? S.rangeBtnActive : S.rangeBtnIdle)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className={S.chartBody}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={S.chartColors.gradientStart} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={S.chartColors.gradientStart} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={S.chartColors.gridStroke} />
                <XAxis dataKey="label" tick={S.axisTick} tickMargin={12} axisLine={false} tickLine={false} />
                <YAxis
                  domain={['dataMin - 1000', 'dataMax + 1000']}
                  tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}k`}
                  tick={S.axisTick} tickMargin={12} axisLine={false} tickLine={false}
                />
                {tierBoundaries.map((boundary, idx) => (
                  <ReferenceLine
                    key={idx} y={boundary}
                    stroke={S.chartColors.refLineStroke} strokeDasharray="6 4"
                    label={{ value: `Bậc ${idx + 1}`, position: 'right', fontSize: 10, fill: S.chartColors.refLabelFill }}
                  />
                ))}
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className={S.tooltipCard}>
                        <p className={S.tooltipDate}>{label}</p>
                        <p className={S.tooltipPrice}>{formatPrice(data.priceV1)} đ</p>
                        <div className={S.tooltipTierRow}>
                          <span className={S.tooltipTierBadge}>{data.tier}</span>
                          <span className={S.tooltipTierLabel}>Bậc {data.tier}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone" dataKey="priceV1" name="DO 0,05S-II"
                  stroke={S.chartColors.stroke} strokeWidth={3} fill="url(#fuelGradient)"
                  dot={{ fill: S.chartColors.stroke, r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 8, stroke: '#fff', strokeWidth: 3, fill: S.chartColors.stroke }}
                  label={({ x, y, index }: any) => {
                    const pt = chartData[index];
                    if (!pt) return null;
                    return (
                      <g>
                        <text x={x} y={y - 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0d3b66">
                          {formatPrice(pt.priceV1)}
                        </text>
                        <text x={x} y={y - 6} textAnchor="middle" fontSize={9} fontWeight={600} fill="#6366f1">
                          Bậc {pt.tier}
                        </text>
                      </g>
                    );
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={S.chartEmpty}>
              <p className={S.chartEmptyText}>Chưa có dữ liệu giá dầu. Vui lòng thêm trong phần cấu hình.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;

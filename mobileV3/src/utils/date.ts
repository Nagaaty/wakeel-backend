/** Relative time — same pattern as LinkedIn (e.g. منذ 3 ساعات) */
export function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'الآن';
  if (mins < 60)  return `منذ ${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `منذ ${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `منذ ${days} يوم`;
  const wks = Math.floor(days / 7);
  if (wks < 4)    return `منذ ${wks} أسبوع`;
  const mos = Math.floor(days / 30);
  if (mos < 12)   return `منذ ${mos} شهر`;
  return `منذ ${Math.floor(days / 365)} سنة`;
}

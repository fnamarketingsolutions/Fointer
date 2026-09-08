export const formatCount = (value) => {
  const n = Number(value ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};

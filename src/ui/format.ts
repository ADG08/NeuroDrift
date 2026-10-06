const twoDecimals = new Intl.NumberFormat("fr-FR", {minimumFractionDigits: 2, maximumFractionDigits: 2});

export function formatLapTime(seconds: number | null): string {
    return seconds === null ? "—" : `${twoDecimals.format(seconds)} s`;
}

export function formatClock(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

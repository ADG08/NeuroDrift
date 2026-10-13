// Historique des courses du joueur, conservé dans le navigateur (localStorage) d'une session à l'autre.

const KEY = "neurodrift.history";
const MAX_RACES_PER_TRACK = 20;

export interface RaceEntry {
    date: string;      // ISO 8601
    bestLap: number;   // secondes
}

type History = Record<string, RaceEntry[]>;

export function racesOn(trackId: string): RaceEntry[] {
    return read()[trackId] ?? [];
}

export function personalBest(trackId: string): number | null {
    const laps = racesOn(trackId).map(race => race.bestLap);
    return laps.length === 0 ? null : Math.min(...laps);
}

export function saveRace(trackId: string, bestLap: number) {
    const history = read();
    history[trackId] = [...(history[trackId] ?? []), {date: new Date().toISOString(), bestLap}].slice(-MAX_RACES_PER_TRACK);
    try {
        localStorage.setItem(KEY, JSON.stringify(history));
    } catch {
        // Stockage plein ou désactivé (navigation privée) : on perd l'historique, pas la course.
    }
}

function read(): History {
    try {
        return JSON.parse(localStorage.getItem(KEY) ?? "{}") as History;
    } catch {
        return {};
    }
}

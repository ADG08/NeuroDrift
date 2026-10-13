import type { Entrant } from "../game/Race";

export interface Sample {
    time: number;      // temps de course, en secondes
    index: number;     // point de la ligne centrale
    speed: number;
    throttle: boolean;
    brake: boolean;
    drifting: boolean;
    contact: boolean;
}

// Un tour : son temps et la plage d'échantillons qu'il couvre, [from, to[.
export interface LapRecord {
    time: number;
    from: number;
    to: number;
}

// Enregistre l'état d'une voiture à chaque image. Les échantillons forment une seule suite continue :
// un virage à cheval sur la ligne d'arrivée reste ainsi d'un seul tenant.
export class Telemetry {
    readonly samples: Sample[] = [];
    readonly laps: LapRecord[] = [];

    record(entrant: Entrant, time: number) {
        const {car, controls, progress, simulation} = entrant;
        this.samples.push({
            time,
            index: progress.index,
            speed: car.forwardSpeed,
            throttle: controls.forward,
            brake: controls.backward && car.forwardSpeed > 0,
            drifting: car.isDrifting,
            contact: simulation.inContact,
        });
    }

    completeLap(lapTime: number) {
        const from = this.laps.at(-1)?.to ?? 0;
        this.laps.push({time: lapTime, from, to: this.samples.length});
    }

    get bestLap(): LapRecord | null {
        return this.laps.reduce<LapRecord | null>((best, lap) => (best === null || lap.time < best.time ? lap : best), null);
    }
}

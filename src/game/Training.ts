import { nextGeneration } from "../ai/evolution";
import { NETWORK_LAYERS, NeuralDriver } from "../ai/NeuralDriver";
import { NeuralNetwork } from "../ai/NeuralNetwork";
import type { TrackDefinition } from "../simulation/tracks";
import { Race, type Entrant } from "./Race";

export const POPULATION_SIZE = 40;
// Une génération s'arrête quand plus aucune voiture ne roule (éliminée ou arrivée), ou au bout de ce temps.
export const GENERATION_TIME = 90;
// Une voiture qui n'a pas battu sa meilleure avancée depuis ce délai est éliminée (arrêtée, en rond, à reculons).
const STALL_TIMEOUT = 3;
// La voiture 0 porte le meilleur génome de la génération précédente (élitisme) : on la distingue.
const CHAMPION_COLOR = 0x087f9f;
const AI_COLOR = 0x9aa3ad;

export interface GenerationResult {
    generation: number;
    best: number;              // meilleure distance, en mètres (plafonnée à un tour)
    average: number;           // distance moyenne, en mètres
    bestLap: number | null;    // meilleur temps au tour en secondes, null si personne n'a bouclé le tour
    finishers: number;         // nombre de voitures qui ont bouclé le tour
}

// Neuro-évolution : une population d'IA roule ensemble sur un tour, chacune reçoit un score (fitness),
// puis l'algorithme génétique produit la génération suivante à partir des meilleurs.
export class Training {
    readonly race: Race;
    readonly history: GenerationResult[] = [];
    generation = 1;
    private readonly drivers: NeuralDriver[] = [];
    // Par voiture : meilleure avancée (en points de la ligne centrale), moment où elle a été atteinte,
    // et temps du tour si la voiture a franchi l'arrivée.
    private readonly bestTraveled: number[] = [];
    private readonly improvedAt: number[] = [];
    private readonly lapTimes: (number | null)[] = [];

    constructor(definition: TrackDefinition) {
        this.race = new Race(definition);
        for (let i = 0; i < POPULATION_SIZE; i++) {
            const driver = new NeuralDriver(NeuralNetwork.random(NETWORK_LAYERS));
            this.drivers.push(driver);
            this.race.addDriver(`IA ${i + 1}`, i === 0 ? CHAMPION_COLOR : AI_COLOR, driver);
            this.bestTraveled.push(0);
            this.improvedAt.push(0);
            this.lapTimes.push(null);
        }
    }

    get alive(): number {
        return this.race.entrants.filter(entrant => !entrant.retired).length;
    }

    // Voiture en tête : la plus avancée parmi celles encore en course (ou toutes, si aucune ne roule plus).
    get leader(): Entrant {
        const {entrants} = this.race;
        const candidates = entrants.some(entrant => !entrant.retired) ? entrants.filter(entrant => !entrant.retired) : entrants;
        return candidates.reduce((best, entrant) => (entrant.progress.traveled > best.progress.traveled ? entrant : best));
    }

    // Distance de la voiture la plus avancée de la génération en cours, en mètres.
    get currentBest(): number {
        return this.toMeters(Math.max(...this.bestTraveled));
    }

    // Meilleur temps au tour de la génération en cours.
    get currentBestLap(): number | null {
        return bestOf(this.lapTimes);
    }

    // Meilleur temps au tour de tout l'entraînement, génération en cours comprise.
    get recordLap(): number | null {
        return bestOf([...this.history.map(result => result.bestLap), this.currentBestLap]);
    }

    // Classement : d'abord les voitures arrivées, de la plus rapide à la plus lente, puis les autres par distance.
    position(entrant: Entrant): number {
        const {entrants} = this.race;
        const i = entrants.indexOf(entrant);
        const lapTime = this.lapTimes[i];
        if (lapTime !== null) return 1 + this.lapTimes.filter(time => time !== null && time < lapTime).length;

        const finishers = this.lapTimes.filter(time => time !== null).length;
        const ahead = entrants.filter((other, j) => this.lapTimes[j] === null && other.progress.traveled > entrant.progress.traveled).length;
        return 1 + finishers + ahead;
    }

    // Écart avec la voiture suivante encore en course, en secondes : la distance qui les sépare,
    // divisée par la vitesse de la poursuivante (le temps qu'elle mettrait à la combler). null s'il n'y en a pas.
    gapToNext(entrant: Entrant): number | null {
        const {traveled} = entrant.progress;
        let next: Entrant | null = null;
        for (const other of this.race.entrants) {
            if (other === entrant || other.retired || other.progress.traveled > traveled) continue;
            if (next === null || other.progress.traveled > next.progress.traveled) next = other;
        }
        if (next === null) return null;
        const meters = this.toMeters(traveled - next.progress.traveled);
        return meters / Math.max(Math.abs(next.car.forwardSpeed), 1);
    }

    // Avance la simulation ; renvoie le bilan de la génération quand elle se termine.
    update(dt: number): GenerationResult | null {
        const {race} = this;
        const lapPoints = race.track.centerline.length;
        race.update(dt);

        race.entrants.forEach((entrant, i) => {
            if (entrant.retired) return;
            const {traveled} = entrant.progress;
            if (traveled > this.bestTraveled[i]) {
                this.bestTraveled[i] = traveled;
                this.improvedAt[i] = race.time;
            }

            if (traveled >= lapPoints) {
                // Arrivée : on note le temps et la voiture s'arrête, sans être grisée.
                this.lapTimes[i] = race.time;
                race.retire(entrant, false);
            } else if (entrant.simulation.inContact || race.time - this.improvedAt[i] > STALL_TIMEOUT) {
                // Toucher un mur élimine : c'est ce qui pousse l'évolution à apprendre à rester sur la piste.
                race.retire(entrant);
            }
        });

        return this.alive === 0 || race.time >= GENERATION_TIME ? this.endGeneration() : null;
    }

    endGeneration(): GenerationResult {
        const distances = this.bestTraveled.map(traveled => Math.min(this.toMeters(traveled), this.race.track.length));
        const result: GenerationResult = {
            generation: this.generation,
            best: Math.max(...distances),
            average: distances.reduce((sum, value) => sum + value, 0) / distances.length,
            bestLap: bestOf(this.lapTimes),
            finishers: this.lapTimes.filter(time => time !== null).length,
        };
        this.history.push(result);

        const genomes = nextGeneration(this.drivers.map((driver, i) => ({genome: driver.network.weights, fitness: this.fitness(i)})));
        genomes.forEach((genome, i) => {
            this.drivers[i].network = new NeuralNetwork(NETWORK_LAYERS, genome);
        });

        this.generation++;
        this.bestTraveled.fill(0);
        this.improvedAt.fill(0);
        this.lapTimes.fill(null);
        this.race.restart();
        return result;
    }

    // Score utilisé par l'évolution, en deux étages :
    // - tour pas bouclé : la distance parcourue, entre 0 et L (longueur du tour) ;
    // - tour bouclé : entre L et 2L, d'autant plus haut que le tour est rapide.
    // Un tour bouclé bat donc toujours un tour inachevé, et entre deux tours bouclés, le plus rapide gagne.
    private fitness(i: number): number {
        const lapLength = this.race.track.length;
        const lapTime = this.lapTimes[i];
        if (lapTime === null) return Math.min(this.toMeters(this.bestTraveled[i]), lapLength);
        return lapLength * (2 - lapTime / GENERATION_TIME);
    }

    private toMeters(points: number): number {
        return (points / this.race.track.centerline.length) * this.race.track.length;
    }
}

function bestOf(times: (number | null)[]): number | null {
    const finished = times.filter((time): time is number => time !== null);
    return finished.length === 0 ? null : Math.min(...finished);
}

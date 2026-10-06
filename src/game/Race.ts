import { Group, Line, Mesh } from "three";
import { CarView } from "../render/CarView";
import { DebugView } from "../render/DebugView";
import { TrackView } from "../render/TrackView";
import { Autopilot, type AutopilotSettings } from "../simulation/Autopilot";
import { Car } from "../simulation/Car";
import type { CarControls } from "../simulation/CarControls";
import { Progress } from "../simulation/Progress";
import { Sensors } from "../simulation/Sensors";
import { Simulation } from "../simulation/Simulation";
import { Track } from "../simulation/Track";
import type { TrackDefinition } from "../simulation/tracks";

// Évite de remplir le fil d'événements quand une voiture frotte un mur plusieurs fois de suite.
const WALL_EVENT_COOLDOWN = 3;

export interface BotProfile extends AutopilotSettings {
    name: string;
    color: number;
}

export interface Entrant {
    name: string;
    color: number;
    car: Car;
    simulation: Simulation;
    progress: Progress;
    sensors: Sensors;
    controls: CarControls;
    autopilot: Autopilot | null;
    view: CarView;
    laps: number;
    lapStartedAt: number | null;   // null : tour en cours non chronométré
    bestLap: number | null;
    wasInContact: boolean;
    lastWallEventAt: number;
}

export type RaceEvent =
    | {type: "lap"; entrant: Entrant; time: number; isRecord: boolean}
    | {type: "wall"; entrant: Entrant};

// Une course : un circuit et des concurrents (joueur ou pilotes automatiques), chacun avec sa Simulation.
export class Race {
    readonly definition: TrackDefinition;
    readonly track: Track;
    readonly group = new Group();
    readonly debugView: DebugView;
    readonly entrants: Entrant[] = [];
    time = 0;
    record: number | null = null;

    constructor(definition: TrackDefinition) {
        this.definition = definition;
        this.track = new Track(definition.centerline, definition.width);

        const trackView = new TrackView(this.track);
        this.debugView = new DebugView(this.track);
        this.group.add(trackView.group, this.debugView.group);
    }

    addPlayer(name: string, color: number, controls: CarControls): Entrant {
        return this.addEntrant(name, color, 0, () => controls);
    }

    addBot(profile: BotProfile, startIndex: number): Entrant {
        return this.addEntrant(profile.name, profile.color, startIndex,
            progress => new Autopilot(this.track, progress, profile));
    }

    update(dt: number): RaceEvent[] {
        this.time += dt;
        const events: RaceEvent[] = [];

        for (const entrant of this.entrants) {
            entrant.autopilot?.drive(entrant.car);
            entrant.simulation.update(dt, entrant.controls);
            entrant.sensors.update(entrant.car, this.track.walls);

            const crossing = entrant.progress.update(entrant.car);
            if (crossing === -1) entrant.lapStartedAt = null;
            if (crossing === 1) {
                if (entrant.lapStartedAt !== null) events.push(this.completeLap(entrant, this.time - entrant.lapStartedAt));
                entrant.lapStartedAt = this.time;
            }

            const inContact = entrant.simulation.inContact;
            if (inContact && !entrant.wasInContact && this.time - entrant.lastWallEventAt > WALL_EVENT_COOLDOWN) {
                entrant.lastWallEventAt = this.time;
                events.push({type: "wall", entrant});
            }
            entrant.wasInContact = inContact;
        }
        return events;
    }

    sync() {
        for (const {view, simulation} of this.entrants) view.sync(simulation.renderPose());
        this.debugView.sync();
    }

    // Libère la mémoire GPU (géométries et matériaux) : three.js ne le fait pas tout seul.
    dispose() {
        this.group.traverse(object => {
            if (object instanceof Mesh || object instanceof Line) {
                object.geometry.dispose();
                for (const material of [object.material].flat()) material.dispose();
            }
        });
    }

    private addEntrant(
        name: string,
        color: number,
        startIndex: number,
        createControls: (progress: Progress) => CarControls,
    ): Entrant {
        const start = this.track.pointAt(startIndex);
        const car = new Car(start.x, start.z, this.track.headingAt(startIndex));
        const simulation = new Simulation(car, this.track);
        const progress = new Progress(this.track, startIndex);
        const sensors = new Sensors();
        const controls = createControls(progress);
        const view = new CarView(color);

        const entrant: Entrant = {
            name, color, car, simulation, progress, sensors, controls, view,
            autopilot: controls instanceof Autopilot ? controls : null,
            laps: 0,
            // Le joueur part sur la ligne : son premier tour compte. Les autres démarrent au chrono au premier passage.
            lapStartedAt: startIndex === 0 ? 0 : null,
            bestLap: null,
            wasInContact: false,
            lastWallEventAt: -Infinity,
        };
        this.entrants.push(entrant);
        this.group.add(view.object);
        this.debugView.addCar(simulation, sensors);
        return entrant;
    }

    private completeLap(entrant: Entrant, time: number): RaceEvent {
        entrant.laps++;
        entrant.bestLap = Math.min(entrant.bestLap ?? Infinity, time);
        const isRecord = this.record === null || time < this.record;
        if (isRecord) this.record = time;
        return {type: "lap", entrant, time, isRecord};
    }
}

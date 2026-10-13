import { Group, Line, Mesh } from "three";
import { CarView } from "../render/CarView";
import { DebugView } from "../render/DebugView";
import { SkidMarks } from "../render/SkidMarks";
import { TrackView } from "../render/TrackView";
import { Autopilot, type AutopilotSettings } from "../simulation/Autopilot";
import { Car } from "../simulation/Car";
import type { CarControls } from "../simulation/CarControls";
import type { Driver } from "../simulation/Driver";
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
    driver: Driver | null;   // null : commandes venant du joueur
    view: CarView;
    startIndex: number;
    retired: boolean;   // éliminée : plus simulée, affichée en transparence
    laps: number;
    lapStartedAt: number | null;   // null : tour en cours non chronométré
    bestLap: number | null;
    wasInContact: boolean;
    lastWallEventAt: number;
}

export type RaceEvent =
    | {type: "lap"; entrant: Entrant; time: number; isRecord: boolean}
    | {type: "wall"; entrant: Entrant};

// Une course : un circuit et des concurrents (joueur, pilotes automatiques ou IA), chacun avec sa Simulation.
export class Race {
    readonly definition: TrackDefinition;
    readonly track: Track;
    readonly group = new Group();
    readonly debugView: DebugView;
    readonly skidMarks = new SkidMarks();
    readonly entrants: Entrant[] = [];
    time = 0;
    record: number | null = null;

    constructor(definition: TrackDefinition) {
        this.definition = definition;
        this.track = new Track(definition.centerline, definition.width);

        const trackView = new TrackView(this.track);
        this.debugView = new DebugView(this.track);
        this.group.add(trackView.group, this.skidMarks.mesh, this.debugView.group);
    }

    addPlayer(name: string, color: number, controls: CarControls): Entrant {
        return this.addEntrant(name, color, 0, () => controls);
    }

    addBot(profile: BotProfile, startIndex: number): Entrant {
        return this.addEntrant(profile.name, profile.color, startIndex,
            progress => new Autopilot(this.track, progress, profile));
    }

    addDriver(name: string, color: number, driver: Driver, startIndex = 0): Entrant {
        return this.addEntrant(name, color, startIndex, () => driver);
    }

    // Sort une voiture de la course : elle n'est plus simulée. Grisée si elle est éliminée, pas si elle est arrivée.
    retire(entrant: Entrant, dim = true) {
        entrant.retired = true;
        entrant.view.setRetired(dim);
    }

    // Replace tous les concurrents sur leur ligne de départ, sans reconstruire la scène.
    restart() {
        this.time = 0;
        this.skidMarks.clear();
        this.record = null;
        for (const entrant of this.entrants) {
            const {car, startIndex} = entrant;
            const start = this.track.pointAt(startIndex);
            car.x = start.x;
            car.z = start.z;
            car.rotation = this.track.headingAt(startIndex);
            car.stop();
            entrant.simulation.reset();
            entrant.progress.reset(startIndex);
            entrant.sensors.update(car, this.track);
            entrant.retired = false;
            entrant.view.setRetired(false);
            entrant.laps = 0;
            entrant.lapStartedAt = startIndex === 0 ? 0 : null;
            entrant.bestLap = null;
            entrant.wasInContact = false;
            entrant.lastWallEventAt = -Infinity;
        }
    }

    update(dt: number): RaceEvent[] {
        this.time += dt;
        const events: RaceEvent[] = [];

        for (const entrant of this.entrants) {
            if (entrant.retired) continue;
            entrant.driver?.drive(entrant.car, entrant.sensors);
            entrant.simulation.update(dt, entrant.controls);
            entrant.sensors.update(entrant.car, this.track);

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
        for (const entrant of this.entrants) {
            const pose = entrant.simulation.renderPose();
            entrant.view.sync(pose, entrant.car.steerAngle);
            this.skidMarks.add(entrant, pose, entrant.car.isDrifting && !entrant.retired);
        }
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
        sensors.update(car, this.track);
        const controls = createControls(progress);
        const view = new CarView(color);

        const entrant: Entrant = {
            name, color, car, simulation, progress, sensors, controls, view, startIndex,
            driver: isDriver(controls) ? controls : null,
            retired: false,
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

function isDriver(controls: CarControls): controls is Driver {
    return "drive" in controls;
}

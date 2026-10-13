import { NeuralDriver } from "../ai/NeuralDriver";
import { analyzeRace } from "../analysis/coach";
import { Telemetry } from "../analysis/Telemetry";
import { buildTrackProfile, type TrackProfile } from "../analysis/trackProfile";
import { InputState } from "../input/InputState";
import type { Stage } from "../render/Stage";
import type { Pose } from "../simulation/geometry";
import { TRACKS, type TrackDefinition } from "../simulation/tracks";
import { personalBest, racesOn, saveRace } from "../storage";
import { CarTooltip } from "../ui/CarTooltip";
import { Hud } from "../ui/Hud";
import { Menu } from "../ui/Menu";
import { ReportScreen } from "../ui/ReportScreen";
import { TrainingHud } from "../ui/TrainingHud";
import { FocusTracker } from "./FocusTracker";
import { Race, type BotProfile, type Entrant } from "./Race";
import { Training } from "./Training";

const PLAYER_COLOR = 0x087f9f;
// Nombre de tours d'une course du joueur, avant le récap.
const RACE_LAPS = 3;
// En menu, la caméra change de pilote à intervalle régulier, ou dès qu'un record tombe.
const FEATURE_DURATION = 12;
// Vitesses de l'entraînement (touches 1 à 4) : nombre de pas de simulation par image.
const TRAINING_SPEEDS = [1, 2, 5, 10];

// Pilotes de la course de fond du menu : chacun a sa vitesse, son anticipation et sa trajectoire.
const BOTS: BotProfile[] = [
    {name: "Volt", color: 0xff5a36, topSpeed: 48, lookahead: 5, line: 0.3},
    {name: "Nova", color: 0x8b7bff, topSpeed: 44, lookahead: 4, line: -0.2},
    {name: "Pulse", color: 0x3df5d0, topSpeed: 52, lookahead: 5, line: 0},
    {name: "Echo", color: 0xffd23f, topSpeed: 42, lookahead: 6, line: 0.15},
    {name: "Flux", color: 0xf25ca2, topSpeed: 46, lookahead: 4, line: -0.25},
];

type Screen =
    | {kind: "menu"}
    | {kind: "race"; player: Entrant; telemetry: Telemetry; profile: TrackProfile}
    | {kind: "report"; player: Entrant}
    | {kind: "training"; training: Training};

// Enchaîne les écrans : le menu (course de pilotes automatiques en fond), la course du joueur et l'entraînement de l'IA.
export class Game {
    private readonly stage: Stage;
    private readonly input = new InputState();
    private readonly menu: Menu;
    private readonly hud: Hud;
    private readonly trainingHud: TrainingHud;
    private readonly carTooltip: CarTooltip;
    private readonly report: ReportScreen;
    private readonly focus = new FocusTracker();
    private screen: Screen = {kind: "menu"};
    private race!: Race;
    private featured!: Entrant;
    private featuredSince = 0;
    private overheadView = false;
    private showColliders = false;
    private trainingSpeed = TRAINING_SPEEDS[0];
    private elapsed = 0;

    constructor(stage: Stage, ui: HTMLElement) {
        this.stage = stage;
        this.menu = new Menu(ui, TRACKS, {
            select: track => this.openMenu(track),
            start: track => this.startRace(track),
            train: track => this.startTraining(track),
        });
        this.hud = new Hud(ui);
        this.trainingHud = new TrainingHud(ui);
        this.carTooltip = new CarTooltip(ui);
        this.report = new ReportScreen(ui, {
            replay: () => this.startRace(this.race.definition),
            menu: () => this.openMenu(this.race.definition),
        });
        window.addEventListener("keydown", event => this.onKey(event));
        this.openMenu(TRACKS[0]);
    }

    update(dt: number) {
        this.elapsed += dt;
        const rig = this.stage.cameraRig;
        const {screen} = this;

        if (screen.kind === "report") {
            // Course figée : la caméra tourne lentement autour de la voiture pendant le récap.
            rig.showcase(screen.player.simulation.renderPose(), this.elapsed, dt);
            return;
        }

        if (screen.kind === "training") {
            const {training} = screen;
            // Accéléré : plusieurs pas de simulation par image, un seul rendu.
            for (let i = 0; i < this.trainingSpeed; i++) {
                if (training.update(dt)) this.trainingHud.drawChart(training.history, training.race.track.length);
            }
            this.race.sync();
            this.trainingHud.update(training, this.trainingSpeed);

            // La caméra et la bulle suivent le premier, avec un délai et un glissement lors des changements.
            const focused = this.focus.update(training.leader, this.elapsed);
            const pose = this.focus.pose(this.elapsed);
            this.follow(pose, dt);
            const {driver} = focused;
            this.carTooltip.update(pose, this.stage.camera, {
                speed: focused.car.forwardSpeed,
                position: training.position(focused),
                // Intention brute du réseau (avant le seuil) ; à défaut, la commande tout-ou-rien.
                throttle: driver instanceof NeuralDriver ? driver.throttle : Number(focused.controls.forward),
                brake: driver instanceof NeuralDriver ? driver.brake : Number(focused.controls.backward),
                gapToNext: training.gapToNext(focused),
                currentLap: training.race.time,
                bestLap: training.recordLap,
                network: driver instanceof NeuralDriver ? driver.network : null,
            });
            return;
        }

        const events = this.race.update(dt);
        this.race.sync();

        if (screen.kind === "race") {
            const {player, telemetry} = screen;
            telemetry.record(player, this.race.time);
            for (const event of events) {
                if (event.entrant !== player) continue;
                this.hud.announce(event);
                if (event.type === "lap") telemetry.completeLap(event.time);
            }
            this.hud.update(player, this.race.time);
            this.follow(player.simulation.renderPose(), dt);
            if (telemetry.laps.length >= RACE_LAPS) this.finishRace(screen);
        } else {
            for (const event of events) {
                this.menu.addEvent(event, this.race.time);
                if (event.type === "lap" && event.isRecord) this.feature(event.entrant);
            }
            if (this.elapsed - this.featuredSince > FEATURE_DURATION) {
                const {entrants} = this.race;
                this.feature(entrants[(entrants.indexOf(this.featured) + 1) % entrants.length]);
            }
            rig.showcase(this.featured.simulation.renderPose(), this.elapsed, dt);
        }
    }

    private follow(pose: Pose, dt: number) {
        if (this.overheadView) this.stage.cameraRig.overhead(pose, dt);
        else this.stage.cameraRig.chase(pose, dt);
    }

    private openMenu(track: TrackDefinition) {
        const race = new Race(track);
        const n = race.track.centerline.length;
        BOTS.forEach((bot, i) => race.addBot(bot, Math.round((i * n) / BOTS.length)));

        this.load(race, {kind: "menu"});
        this.feature(race.entrants[0]);
        this.menu.reset(track);
        this.menu.show();
    }

    private startRace(track: TrackDefinition) {
        const race = new Race(track);
        const player = race.addPlayer("Toi", PLAYER_COLOR, this.input);
        const profile = buildTrackProfile(race.track, player.car);

        this.load(race, {kind: "race", player, telemetry: new Telemetry(), profile});
        this.overheadView = false;
        this.hud.show(track.name, RACE_LAPS);
    }

    private finishRace({player, telemetry, profile}: {player: Entrant; telemetry: Telemetry; profile: TrackProfile}) {
        const report = analyzeRace(telemetry, profile);
        if (report === null) return;

        const {id, name} = this.race.definition;
        const previousBest = personalBest(id);
        saveRace(id, report.bestLap);

        this.screen = {kind: "report", player};
        this.hud.hide();
        this.report.show(report, {trackName: name, centerline: this.race.track.centerline, history: racesOn(id), previousBest});
    }

    private startTraining(track: TrackDefinition) {
        const training = new Training(track);

        this.load(training.race, {kind: "training", training});
        // Vue de dessus par défaut : on voit tout l'essaim de voitures.
        this.overheadView = true;
        this.trainingSpeed = TRAINING_SPEEDS[0];
        this.focus.reset();
        this.trainingHud.show(track.name);
    }

    private load(race: Race, screen: Screen) {
        if (this.race) {
            this.stage.scene.remove(this.race.group);
            this.race.dispose();
        }
        this.race = race;
        this.screen = screen;
        race.debugView.group.visible = this.showColliders;
        this.stage.scene.add(race.group);
        this.stage.cameraRig.cut();

        this.menu.hide();
        this.hud.hide();
        this.trainingHud.hide();
        this.carTooltip.hide();
        this.report.hide();
    }

    // Plan de coupe vers une autre voiture, comme une réalisation TV.
    private feature(entrant: Entrant) {
        this.featured = entrant;
        this.featuredSince = this.elapsed;
        this.stage.cameraRig.cut();
    }

    private onKey(event: KeyboardEvent) {
        const {screen} = this;
        if (event.code === "KeyC") {
            this.showColliders = !this.showColliders;
            this.race.debugView.group.visible = this.showColliders;
        }
        if (screen.kind === "menu") return;

        if (screen.kind === "report" && event.code === "Enter") {
            this.startRace(this.race.definition);
        } else if (event.code === "KeyV") {
            this.overheadView = !this.overheadView;
            this.stage.cameraRig.cut();
        } else if (event.code === "Escape") {
            this.openMenu(this.race.definition);
        } else if (screen.kind === "training") {
            const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
            const speed = digit ? TRAINING_SPEEDS[Number(digit[1]) - 1] : undefined;
            if (speed) this.trainingSpeed = speed;
            else if (event.code === "KeyN") {
                screen.training.endGeneration();
                this.trainingHud.drawChart(screen.training.history, this.race.track.length);
            }
        }
    }
}

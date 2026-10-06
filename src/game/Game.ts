import { InputState } from "../input/InputState";
import type { Stage } from "../render/Stage";
import { TRACKS, type TrackDefinition } from "../simulation/tracks";
import { Hud } from "../ui/Hud";
import { Menu } from "../ui/Menu";
import { Race, type BotProfile, type Entrant } from "./Race";

const PLAYER_COLOR = 0x087f9f;
// En menu, la caméra change de pilote à intervalle régulier, ou dès qu'un record tombe.
const FEATURE_DURATION = 12;

// Pilotes de la course de fond du menu : chacun a sa vitesse, son anticipation et sa trajectoire.
const BOTS: BotProfile[] = [
    {name: "Volt", color: 0xff5a36, topSpeed: 48, lookahead: 5, line: 0.3},
    {name: "Nova", color: 0x8b7bff, topSpeed: 44, lookahead: 4, line: -0.2},
    {name: "Pulse", color: 0x3df5d0, topSpeed: 52, lookahead: 5, line: 0},
    {name: "Echo", color: 0xffd23f, topSpeed: 42, lookahead: 6, line: 0.15},
    {name: "Flux", color: 0xf25ca2, topSpeed: 46, lookahead: 4, line: -0.25},
];

// Enchaîne les deux écrans : le menu (course de pilotes automatiques en fond) et la course du joueur.
export class Game {
    private readonly stage: Stage;
    private readonly input = new InputState();
    private readonly menu: Menu;
    private readonly hud: Hud;
    private race!: Race;
    private player: Entrant | null = null;
    private featured!: Entrant;
    private featuredSince = 0;
    private overheadView = false;
    private showColliders = false;
    private elapsed = 0;

    constructor(stage: Stage, ui: HTMLElement) {
        this.stage = stage;
        this.menu = new Menu(ui, TRACKS, {
            select: track => this.openMenu(track),
            start: track => this.startRace(track),
        });
        this.hud = new Hud(ui);
        window.addEventListener("keydown", event => this.onKey(event));
        this.openMenu(TRACKS[0]);
    }

    update(dt: number) {
        this.elapsed += dt;
        const events = this.race.update(dt);
        this.race.sync();

        const rig = this.stage.cameraRig;
        if (this.player) {
            for (const event of events) if (event.entrant === this.player) this.hud.announce(event);
            this.hud.update(this.player, this.race.time);

            const pose = this.player.simulation.renderPose();
            if (this.overheadView) rig.overhead(pose, dt);
            else rig.chase(pose, dt);
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

    private openMenu(track: TrackDefinition) {
        const race = new Race(track);
        const n = race.track.centerline.length;
        BOTS.forEach((bot, i) => race.addBot(bot, Math.round((i * n) / BOTS.length)));

        this.load(race);
        this.feature(race.entrants[0]);
        this.player = null;
        this.hud.hide();
        this.menu.reset(track);
        this.menu.show();
    }

    private startRace(track: TrackDefinition) {
        const race = new Race(track);
        this.player = race.addPlayer("Toi", PLAYER_COLOR, this.input);

        this.load(race);
        this.stage.cameraRig.cut();
        this.menu.hide();
        this.hud.show(track.name);
    }

    private load(race: Race) {
        if (this.race) {
            this.stage.scene.remove(this.race.group);
            this.race.dispose();
        }
        this.race = race;
        race.debugView.group.visible = this.showColliders;
        this.stage.scene.add(race.group);
    }

    // Plan de coupe vers une autre voiture, comme une réalisation TV.
    private feature(entrant: Entrant) {
        this.featured = entrant;
        this.featuredSince = this.elapsed;
        this.stage.cameraRig.cut();
    }

    private onKey(event: KeyboardEvent) {
        if (event.code === "KeyC") {
            this.showColliders = !this.showColliders;
            this.race.debugView.group.visible = this.showColliders;
        } else if (event.code === "KeyV" && this.player) {
            this.overheadView = !this.overheadView;
            this.stage.cameraRig.cut();
        } else if (event.code === "Escape" && this.player) {
            this.openMenu(this.race.definition);
        }
    }
}

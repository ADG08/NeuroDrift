import type { Car } from "../simulation/Car";
import type { CarControls } from "../simulation/CarControls";

// Vitesses (unités/s) où l'on change de rapport : le régime monte dans chaque rapport puis retombe.
const GEAR_SPEEDS = [0, 12, 24, 38, 54, 72, 100];
const IDLE_RPM = 900;
const LOW_RPM = 3500;
const SHIFT_RPM = 7200;
const MASTER_VOLUME = 0.5;
// Durée de lissage des réglages : sans elle, chaque changement brusque fait un « clic ».
const SMOOTHING = 0.04;

// Sons de la voiture du joueur, synthétisés avec la Web Audio API (aucun fichier) : moteur, pneus et chocs.
export class CarAudio {
    private context: AudioContext | null = null;
    private master!: GainNode;
    private engineOscillators: OscillatorNode[] = [];
    private engineFilter!: BiquadFilterNode;
    private engineGain!: GainNode;
    private tireFilter!: BiquadFilterNode;
    private tireGain!: GainNode;
    private noise!: AudioBuffer;
    private muted = false;
    private wasInContact = false;

    // Les navigateurs n'autorisent le son qu'après une action de l'utilisateur : on crée le contexte à ce moment-là.
    unlock() {
        if (this.context) {
            if (this.context.state === "suspended") void this.context.resume();
            return;
        }
        const context = new AudioContext();
        this.context = context;
        this.master = gainNode(context, this.muted ? 0 : MASTER_VOLUME, context.destination);

        // Moteur : une dent de scie et un carré une octave plus bas, assombris par un filtre passe-bas.
        this.engineGain = gainNode(context, 0, this.master);
        this.engineFilter = new BiquadFilterNode(context, {type: "lowpass", frequency: 600, Q: 4});
        this.engineFilter.connect(this.engineGain);
        this.engineOscillators = (["sawtooth", "square"] as const).map(type => {
            const oscillator = new OscillatorNode(context, {type, frequency: 30});
            oscillator.connect(gainNode(context, type === "square" ? 0.5 : 1, this.engineFilter));
            oscillator.start();
            return oscillator;
        });

        // Pneus : du bruit blanc en boucle, filtré autour du crissement.
        this.noise = whiteNoise(context, 2);
        this.tireGain = gainNode(context, 0, this.master);
        this.tireFilter = new BiquadFilterNode(context, {type: "bandpass", frequency: 1400, Q: 1.5});
        this.tireFilter.connect(this.tireGain);
        const tireSource = new AudioBufferSourceNode(context, {buffer: this.noise, loop: true});
        tireSource.connect(this.tireFilter);
        tireSource.start();
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_VOLUME, this.context.currentTime, SMOOTHING);
    }

    update(car: Car, controls: CarControls, inContact: boolean) {
        const context = this.context;
        if (!context) return;
        const now = context.currentTime;
        const speed = Math.abs(car.forwardSpeed);

        // Fréquence d'un 4 cylindres : deux explosions par tour, soit régime / 30 Hz.
        const rpm = engineRpm(speed);
        this.engineOscillators[0].frequency.setTargetAtTime(rpm / 30, now, SMOOTHING);
        this.engineOscillators[1].frequency.setTargetAtTime(rpm / 60, now, SMOOTHING);
        // Pied au plancher : filtre plus ouvert et volume plus fort, le moteur « rugit ».
        this.engineFilter.frequency.setTargetAtTime(controls.forward ? 800 + rpm / 4 : 400 + rpm / 12, now, SMOOTHING);
        this.engineGain.gain.setTargetAtTime(controls.forward ? 0.16 : 0.08, now, SMOOTHING);

        const screech = car.isDrifting ? Math.min(1, car.slipAngle / 0.6) * Math.min(1, speed / 20) : 0;
        this.tireGain.gain.setTargetAtTime(screech * 0.25, now, SMOOTHING);
        this.tireFilter.frequency.setTargetAtTime(1200 + screech * 800, now, SMOOTHING);

        if (inContact && !this.wasInContact) this.impact(Math.min(1, speed / 30));
        this.wasInContact = inContact;
    }

    // Coupe moteur et pneus (hors course), sans détruire le graphe audio.
    silence() {
        if (!this.context) return;
        const now = this.context.currentTime;
        this.engineGain.gain.setTargetAtTime(0, now, SMOOTHING);
        this.tireGain.gain.setTargetAtTime(0, now, SMOOTHING);
    }

    // Choc : une rafale de bruit grave qui s'éteint en un dixième de seconde.
    private impact(strength: number) {
        const context = this.context!;
        const now = context.currentTime;
        const envelope = gainNode(context, 0.6 * strength, this.master);
        envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        const filter = new BiquadFilterNode(context, {type: "lowpass", frequency: 350});
        filter.connect(envelope);
        const burst = new AudioBufferSourceNode(context, {buffer: this.noise});
        burst.connect(filter);
        burst.start(now, 0, 0.2);
    }
}

function engineRpm(speed: number): number {
    for (let gear = 1; gear < GEAR_SPEEDS.length; gear++) {
        if (speed < GEAR_SPEEDS[gear]) {
            const t = (speed - GEAR_SPEEDS[gear - 1]) / (GEAR_SPEEDS[gear] - GEAR_SPEEDS[gear - 1]);
            const from = gear === 1 ? IDLE_RPM : LOW_RPM;
            return from + t * (SHIFT_RPM - from);
        }
    }
    return SHIFT_RPM;
}

function gainNode(context: AudioContext, gain: number, destination: AudioNode): GainNode {
    const node = new GainNode(context, {gain});
    node.connect(destination);
    return node;
}

function whiteNoise(context: AudioContext, seconds: number): AudioBuffer {
    const buffer = new AudioBuffer({length: context.sampleRate * seconds, sampleRate: context.sampleRate});
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
}

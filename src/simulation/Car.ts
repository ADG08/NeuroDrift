import type { CarControls } from "./CarControls";

// Voiture propulsion en « modèle bicyclette » : un essieu avant qui braque, un essieu arrière qui pousse.
// Chaque essieu produit une force latérale selon son angle de dérive (l'écart entre la direction de la roue
// et celle où elle va vraiment). Ces deux forces, de part et d'autre du centre, font tourner la voiture.
// Quand l'arrière perd son adhérence, la voiture pivote plus vite qu'elle ne tourne : c'est le drift.
export class Car {
    x: number;
    z: number;
    rotation: number;
    velocityX = 0;
    velocityZ = 0;
    // Vitesse de rotation de la voiture (rad/s), positive vers la gauche.
    yawRate = 0;
    // Angle des roues avant (rad), positif vers la gauche.
    steerAngle = 0;

    maxSpeed: number;
    maxReverseSpeed = 5;
    acceleration = 15;
    reverseAcceleration = 8;
    braking = 30;
    friction = 5;
    radius = 2;

    // Distance du centre à chaque essieu, et inertie (moment d'inertie / masse) : plus elle est grande, plus la voiture pivote lentement.
    axleDistance = 1.3;
    inertia = 1.6;
    // Braquage maximal des roues, divisé par deux à steerFalloff ; le volant tourne à steerSpeed rad/s.
    maxSteer = 0.55;
    steerFalloff = 30;
    steerSpeed = 2.5;
    // Force latérale d'un pneu par radian de dérive, plafonnée par l'adhérence (en accélération, unités/s²).
    // L'arrière accroche un peu plus que l'avant : la voiture est stable et ne décroche que si on la provoque.
    corneringStiffness = 80;
    frontGrip = 28;
    rearGrip = 33;
    // Part de l'adhérence arrière qui reste au frein à main.
    handbrakeGrip = 0.15;
    // Angle de dérive de la caisse au-delà duquel on parle de drift.
    driftAngle = 0.15;

    constructor(x = 0, z = 0, rotation = 0, maxSpeed = 100) {
        this.x = x;
        this.z = z;
        this.rotation = rotation;
        this.maxSpeed = maxSpeed;
    }

    // Vitesse dans l'axe du nez (négative en marche arrière).
    get forwardSpeed(): number {
        return this.velocityX * Math.sin(this.rotation) + this.velocityZ * Math.cos(this.rotation);
    }

    // Vitesse sur le côté, positive vers la gauche : nulle quand la voiture roule droit, grande quand elle drifte.
    get lateralSpeed(): number {
        return this.velocityX * Math.cos(this.rotation) - this.velocityZ * Math.sin(this.rotation);
    }

    // Angle entre le nez et la direction réelle de la voiture, en radians.
    get slipAngle(): number {
        return Math.atan2(Math.abs(this.lateralSpeed), Math.abs(this.forwardSpeed));
    }

    get isDrifting(): boolean {
        return this.slipAngle > this.driftAngle && Math.hypot(this.velocityX, this.velocityZ) > 8;
    }

    stop() {
        this.velocityX = 0;
        this.velocityZ = 0;
        this.yawRate = 0;
        this.steerAngle = 0;
    }

    public update(dt: number, controls: CarControls) {
        const sin = Math.sin(this.rotation);
        const cos = Math.cos(this.rotation);
        const forward = this.velocityX * sin + this.velocityZ * cos;
        const lateral = this.velocityX * cos - this.velocityZ * sin;

        //volant : les roues rejoignent la consigne progressivement, et braquent moins à haute vitesse
        const steering = Number(controls.left) - Number(controls.right);
        const target = (steering * this.maxSteer) / (1 + Math.abs(forward) / this.steerFalloff);
        this.steerAngle += clamp(target - this.steerAngle, this.steerSpeed * dt);

        //moteur et freins : accélération dans l'axe du nez
        let drive = 0;
        if (controls.forward) {
            if (forward < this.maxSpeed) drive = this.acceleration;
        } else if (controls.backward) {
            if (forward > 0) drive = -this.braking; // on freine
            else if (forward > -this.maxReverseSpeed) drive = -this.reverseAcceleration; // on recule
        } else {
            drive = -clamp(forward / dt, this.friction);
        }

        //pneus : angle de dérive de chaque essieu (la rotation déplace l'avant vers la gauche, l'arrière vers la droite)
        const rolling = Math.max(Math.abs(forward), 3);
        const steer = this.steerAngle * Math.sign(forward || 1) * Math.min(1, Math.abs(forward) / 2);
        const frontSlip = Math.atan2(lateral + this.yawRate * this.axleDistance, rolling) - steer;
        const rearSlip = Math.atan2(lateral - this.yawRate * this.axleDistance, rolling);

        //cercle de friction : l'arrière partage son adhérence entre pousser et tenir ; le frein à main le bloque
        const rearGrip = controls.handbrake
            ? this.rearGrip * this.handbrakeGrip
            : Math.sqrt(Math.max(0, this.rearGrip ** 2 - drive ** 2));
        const frontForce = clamp(-this.corneringStiffness * frontSlip, this.frontGrip);
        const rearForce = clamp(-this.corneringStiffness * rearSlip, rearGrip);

        //rota : les deux forces latérales, de part et d'autre du centre, font pivoter la voiture
        const steerCos = Math.cos(this.steerAngle);
        this.yawRate += ((frontForce * steerCos - rearForce) * this.axleDistance / this.inertia) * dt;

        //vit : accélérations dans le repère de la voiture, ramenées dans le monde
        const forwardAccel = drive - frontForce * Math.sin(this.steerAngle);
        const lateralAccel = frontForce * steerCos + rearForce;
        this.velocityX += (sin * forwardAccel + cos * lateralAccel) * dt;
        this.velocityZ += (cos * forwardAccel - sin * lateralAccel) * dt;

        //pos
        this.rotation += this.yawRate * dt;
        this.x += this.velocityX * dt;
        this.z += this.velocityZ * dt;
    }
}

function clamp(value: number, limit: number): number {
    return Math.min(Math.max(value, -limit), limit);
}

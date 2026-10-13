import type { CarControls } from "./CarControls";

export class Car {
    x: number;
    z: number;
    rotation: number;
    // Vitesse dans le monde. Elle peut différer de l'orientation du nez : c'est ce qui permet de glisser.
    velocityX = 0;
    velocityZ = 0;

    maxSpeed: number;
    maxReverseSpeed = 5;
    acceleration = 15;
    reverseAcceleration = 8;
    braking = 30;
    friction = 5;
    turnSpeed = 2;
    // Direction qui se durcit avec la vitesse : à cette vitesse, le nez tourne deux fois moins vite.
    steeringFalloff = 40;
    radius = 2;
    // Vitesse latérale que les pneus peuvent annuler par seconde. Tourner plus fort que ça fait glisser.
    grip = 40;
    // Adhérence restante une fois que les pneus glissent (ou au frein à main) : plus faible, la glisse s'entretient.
    slideGrip = 25;
    // Vitesse latérale au-delà de laquelle les pneus décrochent.
    driftThreshold = 3;

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

    get isDrifting(): boolean {
        return Math.abs(this.lateralSpeed) > this.driftThreshold;
    }

    // Angle entre le nez et la direction réelle de la voiture, en radians.
    get slipAngle(): number {
        return Math.atan2(Math.abs(this.lateralSpeed), Math.abs(this.forwardSpeed));
    }

    stop() {
        this.velocityX = 0;
        this.velocityZ = 0;
    }

    public update(dt: number, controls: CarControls) {
        // On découpe la vitesse en deux avec le produit scalaire : dans l'axe du nez, et sur le côté.
        let forward = this.forwardSpeed;
        let lateral = this.lateralSpeed;

        //vit
        if (controls.forward) {
            forward += this.acceleration * dt;
        } else if (controls.backward) {
            if (forward > 0) {
                forward -= this.braking * dt; // on freine
            } else {
                forward -= this.reverseAcceleration * dt; // on recule
            }
        } else if (forward > 0) {
            forward = Math.max(0, forward - this.friction * dt);
        } else if (forward < 0) {
            forward = Math.min(0, forward + this.friction * dt);
        }
        forward = Math.min(Math.max(forward, -this.maxReverseSpeed), this.maxSpeed);

        //adhérence : les pneus ramènent la vitesse latérale vers 0, mais avec une force limitée
        const sliding = controls.handbrake || Math.abs(lateral) > this.driftThreshold;
        const correction = (sliding ? this.slideGrip : this.grip) * dt;
        lateral -= Math.min(Math.max(lateral, -correction), correction);

        //vit dans le monde : on recompose les deux parties, dans l'orientation d'avant le braquage
        const sin = Math.sin(this.rotation);
        const cos = Math.cos(this.rotation);
        this.velocityX = sin * forward + cos * lateral;
        this.velocityZ = cos * forward - sin * lateral;

        //rota : le nez tourne, mais la vitesse ne suit qu'au pas suivant, via l'adhérence.
        //C'est cet écart entre le nez et la vitesse qui devient de la vitesse latérale, donc de la glisse.
        const steering = Number(controls.left) - Number(controls.right);
        if (Math.abs(forward) > 0.1) {
            const turnRate = this.turnSpeed / (1 + Math.abs(forward) / this.steeringFalloff);
            this.rotation += steering * turnRate * Math.sign(forward) * dt;
        }

        //pos
        this.x += this.velocityX * dt;
        this.z += this.velocityZ * dt;
    }
}

import type { CarControls } from "./CarControls";

export class Car {
    x: number;
    z: number;
    rotation: number;
    currentSpeed: number = 0;

    maxSpeed: number;
    maxReverseSpeed = 5;
    acceleration = 15;
    reverseAcceleration = 8;
    braking = 30;
    friction = 5;
    turnSpeed = 2;
    radius = 2;

    constructor(x = 0, z = 0, rotation = 0, maxSpeed = 100) {
        this.x = x;
        this.z = z;
        this.rotation = rotation;
        this.maxSpeed = maxSpeed;
    }

    public update(dt:number, controls: CarControls) {
        // on devrait calculer le x et le z avec un calcul en fonction de la currentSpeed

        //vit
        if (controls.forward) {
            this.currentSpeed += this.acceleration * dt;
        } else if (controls.backward) {
            if (this.currentSpeed > 0) {
                this.currentSpeed -= this.braking * dt; // on freine
            } else {
                this.currentSpeed -= this.reverseAcceleration * dt; // on recule
            }
        } else if (this.currentSpeed > 0) {
            this.currentSpeed = Math.max(0, this.currentSpeed - this.friction * dt);
        } else if (this.currentSpeed < 0) {
            this.currentSpeed = Math.min(0, this.currentSpeed + this.friction * dt);
        }

        this.currentSpeed = Math.min(
            Math.max(this.currentSpeed, -this.maxReverseSpeed),
            this.maxSpeed
        );

        //rota
        const steering = Number(controls.left) - Number(controls.right);
        if (Math.abs(this.currentSpeed) > 0.1) {
            this.rotation += steering * this.turnSpeed * Math.sign(this.currentSpeed) * dt;
        }

        //pos
        this.x += Math.sin(this.rotation) * this.currentSpeed * dt
        this.z += Math.cos(this.rotation) * this.currentSpeed * dt
    }
}

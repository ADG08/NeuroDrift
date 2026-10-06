import {
    BoxGeometry,
    CylinderGeometry,
    ConeGeometry,
    Mesh,
    MeshBasicMaterial,
    TorusGeometry
} from "three";
import { Car } from "../simulation/Car";

export class CarView {
    readonly car: Car;
    readonly mesh: Mesh;

    constructor(car: Car) {
        this.car = car
        const bodyMaterial = new MeshBasicMaterial({color: 0x087f9f});
        const darkMaterial = new MeshBasicMaterial({color: 0x111820});
        const orangeMaterial = new MeshBasicMaterial({color: 0xe87922});
        const body = new Mesh(new BoxGeometry(1.55, 0.4, 3.2), bodyMaterial);
        this.mesh = body;
        body.position.y = 0.05;

        const floor = new Mesh(new BoxGeometry(2.2, 0.12, 4.9), darkMaterial);
        floor.position.y = -0.22;
        this.mesh.add(floor);

        const nose = new Mesh(new ConeGeometry(0.7, 3.8, 4), bodyMaterial);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.05, 2.95);
        this.mesh.add(nose);

        const sidepodMaterial = new MeshBasicMaterial({color: 0x07647d});
        for (const x of [-0.85, 0.85]) {
            const sidepod = new Mesh(new BoxGeometry(0.7, 0.62, 1.9), sidepodMaterial);
            sidepod.position.set(x, 0.12, -0.45);
            this.mesh.add(sidepod);

            const sidepodDetail = new Mesh(new BoxGeometry(0.76, 0.08, 0.75), orangeMaterial);
            sidepodDetail.position.set(x, 0.45, -0.2);
            this.mesh.add(sidepodDetail);
        }

        const cockpit = new Mesh(
            new BoxGeometry(0.72, 0.2, 1.15),
            darkMaterial
        );
        cockpit.position.set(0, 0.4, -0.2);
        this.mesh.add(cockpit);

        const halo = new Mesh(
            new TorusGeometry(0.45, 0.06, 4, 8),
            darkMaterial
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 0.55, -0.2);
        this.mesh.add(halo);

        const wheelGeometry = new CylinderGeometry(0.58, 0.58, 0.42, 10);
        for (const x of [-1, 1]) {
            for (const z of [-1.55, 1.55]) {
                const wheel = new Mesh(wheelGeometry, darkMaterial);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(x * 1.25, 0, z);
                this.mesh.add(wheel);

                const rim = new Mesh(new TorusGeometry(0.3, 0.06, 4, 8), orangeMaterial);
                rim.rotation.y = Math.PI / 2;
                rim.position.set(x * 1.47, 0, z);
                this.mesh.add(rim);
            }
        }

        const wingMaterial = darkMaterial;
        const frontWing = new Mesh(new BoxGeometry(3.35, 0.12, 0.22), wingMaterial);
        frontWing.position.set(0, -0.05, 4.65);
        this.mesh.add(frontWing);

        const frontWingLower = new Mesh(new BoxGeometry(2.85, 0.1, 0.18), orangeMaterial);
        frontWingLower.position.set(0, -0.15, 4.35);
        this.mesh.add(frontWingLower);

        const rearWing = new Mesh(new BoxGeometry(3.1, 0.16, 0.25), orangeMaterial);
        rearWing.position.set(0, 0.8, -2.45);
        this.mesh.add(rearWing);

        const rearWingLower = new Mesh(new BoxGeometry(2.7, 0.12, 0.2), darkMaterial);
        rearWingLower.position.set(0, 0.55, -2.15);
        this.mesh.add(rearWingLower);

        const rearWingSupport = new Mesh(new BoxGeometry(0.12, 0.9, 0.12), darkMaterial);
        for (const x of [-0.7, 0.7]) {
            rearWingSupport.position.set(x, 0.35, -2.25);
            this.mesh.add(rearWingSupport.clone());
        }

        const suspensionMaterial = new MeshBasicMaterial({color: 0x8b9499});
        for (const z of [-1.55, 1.55]) {
            for (const x of [-1, 1]) {
                const suspension = new Mesh(new BoxGeometry(0.08, 0.08, 0.95), suspensionMaterial);
                suspension.position.set(x * 1.05, 0.18, z);
                suspension.rotation.y = x * 0.35;
                this.mesh.add(suspension);
            }
        }
    }

    sync() {
        //surement faire des calculs de la positions vis a vis de la currentSpeed aussi afin de calculer ou le x et z devrait etre
        //ah non je crois que le calcul sera plutot du cote Car.ts

        this.mesh.position.setX(this.car.x)
        this.mesh.position.setZ(this.car.z)
        this.mesh.rotation.y = this.car.rotation
    }
}
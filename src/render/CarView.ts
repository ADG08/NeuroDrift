import {
    BoxGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    TorusGeometry
} from "three";
import type { Pose } from "../simulation/geometry";

export class CarView {
    readonly object = new Group();

    constructor(color = 0x087f9f) {
        const bodyMaterial = new MeshStandardMaterial({color, roughness: 0.35, metalness: 0.2});
        const darkMaterial = new MeshStandardMaterial({color: 0x111820});
        const orangeMaterial = new MeshStandardMaterial({color: 0xe87922});
        const body = new Mesh(new BoxGeometry(1.55, 0.4, 3.2), bodyMaterial);
        // Le modèle va de -2,5 (aileron arrière) à +4,8 (aileron avant) : on le recule pour que
        // son centre soit sur le centre du cercle de collision, et on le pose sur ses roues.
        body.position.set(0, 0.63, -1.1);
        this.object.add(body);

        const floor = new Mesh(new BoxGeometry(2.2, 0.12, 4.9), darkMaterial);
        floor.position.y = -0.22;
        body.add(floor);

        const nose = new Mesh(new ConeGeometry(0.7, 3.8, 4), bodyMaterial);
        nose.rotation.x = Math.PI / 2;
        nose.position.set(0, 0.05, 2.95);
        body.add(nose);

        const sidepodMaterial = new MeshStandardMaterial({color: new Color(color).multiplyScalar(0.75), roughness: 0.35, metalness: 0.2});
        for (const x of [-0.85, 0.85]) {
            const sidepod = new Mesh(new BoxGeometry(0.7, 0.62, 1.9), sidepodMaterial);
            sidepod.position.set(x, 0.12, -0.45);
            body.add(sidepod);

            const sidepodDetail = new Mesh(new BoxGeometry(0.76, 0.08, 0.75), orangeMaterial);
            sidepodDetail.position.set(x, 0.45, -0.2);
            body.add(sidepodDetail);
        }

        const cockpit = new Mesh(
            new BoxGeometry(0.72, 0.2, 1.15),
            darkMaterial
        );
        cockpit.position.set(0, 0.4, -0.2);
        body.add(cockpit);

        const halo = new Mesh(
            new TorusGeometry(0.45, 0.06, 4, 8),
            darkMaterial
        );
        halo.rotation.x = Math.PI / 2;
        halo.position.set(0, 0.55, -0.2);
        body.add(halo);

        const wheelGeometry = new CylinderGeometry(0.58, 0.58, 0.42, 10);
        for (const x of [-1, 1]) {
            for (const z of [-1.55, 1.55]) {
                const wheel = new Mesh(wheelGeometry, darkMaterial);
                wheel.rotation.z = Math.PI / 2;
                wheel.position.set(x * 1.25, 0, z);
                body.add(wheel);

                const rim = new Mesh(new TorusGeometry(0.3, 0.06, 4, 8), orangeMaterial);
                rim.rotation.y = Math.PI / 2;
                rim.position.set(x * 1.47, 0, z);
                body.add(rim);
            }
        }

        const wingMaterial = darkMaterial;
        const frontWing = new Mesh(new BoxGeometry(3.35, 0.12, 0.22), wingMaterial);
        frontWing.position.set(0, -0.05, 4.65);
        body.add(frontWing);

        const frontWingLower = new Mesh(new BoxGeometry(2.85, 0.1, 0.18), orangeMaterial);
        frontWingLower.position.set(0, -0.15, 4.35);
        body.add(frontWingLower);

        const rearWing = new Mesh(new BoxGeometry(3.1, 0.16, 0.25), orangeMaterial);
        rearWing.position.set(0, 0.8, -2.45);
        body.add(rearWing);

        const rearWingLower = new Mesh(new BoxGeometry(2.7, 0.12, 0.2), darkMaterial);
        rearWingLower.position.set(0, 0.55, -2.15);
        body.add(rearWingLower);

        const rearWingSupport = new Mesh(new BoxGeometry(0.12, 0.9, 0.12), darkMaterial);
        for (const x of [-0.7, 0.7]) {
            rearWingSupport.position.set(x, 0.35, -2.25);
            body.add(rearWingSupport.clone());
        }

        const suspensionMaterial = new MeshStandardMaterial({color: 0x8b9499});
        for (const z of [-1.55, 1.55]) {
            for (const x of [-1, 1]) {
                const suspension = new Mesh(new BoxGeometry(0.08, 0.08, 0.95), suspensionMaterial);
                suspension.position.set(x * 1.05, 0.18, z);
                suspension.rotation.y = x * 0.35;
                body.add(suspension);
            }
        }
    }

    // La vue ne lit plus la voiture directement : elle affiche la pose interpolée fournie par la Simulation.
    sync(pose: Pose) {
        this.object.position.setX(pose.x)
        this.object.position.setZ(pose.z)
        this.object.rotation.y = pose.rotation
    }
}

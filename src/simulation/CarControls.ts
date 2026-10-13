export interface CarControls {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    handbrake?: boolean;   // fait décrocher les pneus pour lancer une glisse
}
import * as THREE from 'three';
import { Car } from './src/simulation/car';
import { CarView } from './src/render/CarView';
import { InputState } from './src/input/InputState';

let dt = 0;
let lastTime: number | null = null;

const controls = new InputState();

const scene = new THREE.Scene();

const c = new Car(2,2)
const carV = new CarView(c)
scene.add(carV.mesh)

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.set( 0, 20, 0 );
camera.lookAt( 0, 0, 0 );

const size = 100;
const divisions = 100;
const gridHelper = new THREE.GridHelper( size, divisions );
scene.add( gridHelper );

const axesHelper = new THREE.AxesHelper( 50 );
scene.add( axesHelper );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

function animate( time: number ) {
  if (lastTime === null) {
    lastTime = time
  } else {
    dt = (time - lastTime) / 1000
    dt = Math.min(dt, 0.1)
  }

  lastTime = time
  c.update(dt, controls)
  carV.sync()
  renderer.render( scene, camera );
}
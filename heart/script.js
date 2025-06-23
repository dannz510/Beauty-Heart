// THREE.JS IMPORTS (for 3D heart globe)
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { SUBTRACTION as CSG_SUBTRACTION, Brush as CSG_Brush, Evaluator as CSG_Evaluator } from "three-bvh-csg";

// --- GLOBAL VARIABLES FOR BOTH ANIMATIONS ---
let animationTimer = 0; // Unified timer for animation synchronization


// --- 3D HEART GLOBE LOGIC ---
(function () {
    "use strict";

    // Random number helper
    function randomFloat() {
        return THREE.MathUtils.randInt(0, 1e3) / 1e3;
    }

    let camera3D, scene3D, renderer3D, instancedHeartMesh, mainHeartMesh3D;

    // Three.js object for temporary matrix operations
    const dummyObject = new THREE.Object3D();
    const tempVector3 = new THREE.Vector3();
    const tempEuler = new THREE.Euler();
    const tempQuaternion = new THREE.Quaternion();
    const tempScaleVector = new THREE.Vector3();

    // Configuration constants
    const NUM_INSTANCES = 500;
    const GLOBE_RADIUS = 60;

    // Animation variables for 3D globe
    let mouseX = 0, mouseY = 0;
    let prevMouseX = 0, prevMouseY = 0;
    let targetRotationX = 0, targetRotationY = 0;
    const ROTATION_SPEED_X = 0.0025;
    const ROTATION_SPEED_Y = 0.0015;
    let animationFrameCount3D = 0; // Separate frame counter for 3D animation's internal timing
    const INSTANCE_SCALE_CYCLE_DURATION = 10;
    const INSTANCE_SCALE_AMPLITUDE = 0.15;
    const MAIN_HEART_PULSE_DURATION = 22;
    const MAIN_HEART_PULSE_AMPLITUDE = 0.07;

    // Touch/Mouse event mapping
    const Event = {};
    if ("ontouchstart" in window) {
        Event.TOUCH_START = "touchstart";
        Event.TOUCH_MOVE = "touchmove";
        Event.TOUCH_END = "touchend";
    } else {
        Event.TOUCH_START = "mousedown";
        Event.TOUCH_MOVE = "mousemove";
        Event.TOUCH_END = "mouseup";
    }

    // Function to initialize the Three.js scene
    function init3DScene() {
        console.log("init3DScene() started.");
        const canvas3D = document.getElementById('heart3D');
        if (!canvas3D) {
            console.error("3D Canvas element with ID 'heart3D' not found!");
            return;
        }
        console.log("3D Canvas element found.");

        try {
            // Scene setup
            scene3D = new THREE.Scene();
            scene3D.background = new THREE.Color(0x000000); // Solid black background for Three.js scene
            console.log("3D Scene created.");

            // Renderer setup
            renderer3D = new THREE.WebGLRenderer({
                canvas: canvas3D,
                antialias: true,
                alpha: true
            });
            renderer3D.setPixelRatio(window.devicePixelRatio);
            renderer3D.setSize(window.innerWidth, window.innerHeight);
            renderer3D.useLegacyLights = false;
            console.log("3D Renderer created and sized.");

            // Camera setup
            camera3D = new THREE.PerspectiveCamera(
                35,
                window.innerWidth / window.innerHeight,
                0.1,
                3 * GLOBE_RADIUS
            );
            camera3D.position.set(0, 0, GLOBE_RADIUS * Math.sqrt(2));
            camera3D.lookAt(0, 0, 0);
            console.log("3D Camera created and positioned.");

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.3);
            scene3D.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1);
            directionalLight.position.set(0, 2 * GLOBE_RADIUS, 0);
            scene3D.add(directionalLight);
            console.log("3D Lights added.");

            // Fog (optional, from CodePen)
            scene3D.fog = new THREE.FogExp2(0xF5E6ED, 0.005);
            console.log("3D Fog added.");

            // Material for hearts
            const heartMaterial3D = new THREE.MeshStandardMaterial({
                metalness: 1,
                roughness: 0,
                color: new THREE.Color(0xFF0000)
            });
            console.log("3D Heart material created.");

            // Create the base heart geometry using CSG (Constructive Solid Geometry)
            let baseCapsuleGeometry = new THREE.CapsuleGeometry(3, 6, 5, 20);
            baseCapsuleGeometry.rotateZ(-Math.PI / 3.78);
            baseCapsuleGeometry.translate(0, -1, 0);
            baseCapsuleGeometry.scale(1, 1, 0.85);
            baseCapsuleGeometry.scale(0.23, 0.23, 0.23);
            
            let evaluator = new CSG_Evaluator();
            let dummyMaterial = new THREE.MeshBasicMaterial({});
            let boxSizeX = 2 * baseCapsuleGeometry.parameters.radius;
            let boxSizeY = 2 * baseCapsuleGeometry.parameters.height;
            let cutBoxGeometry = new THREE.BoxGeometry(boxSizeX, boxSizeY, boxSizeX);
            cutBoxGeometry.translate(-boxSizeX / 2, 0, 0);
            
            let brush1 = new CSG_Brush(baseCapsuleGeometry, dummyMaterial);
            let brush2 = new CSG_Brush(cutBoxGeometry, dummyMaterial);
            evaluator.useGroups = true;
            let finalHeartGeometry = evaluator.evaluate(brush1, brush2, CSG_SUBTRACTION).geometry;
            console.log("CSG operation completed, final heart geometry created.");

            // Clone and merge geometries for symmetry
            let mergedInstancedHeartGeometry = BufferGeometryUtils.mergeGeometries([finalHeartGeometry, finalHeartGeometry.clone().rotateY(Math.PI)]);
            mergedInstancedHeartGeometry = BufferGeometryUtils.mergeVertices(mergedInstancedHeartGeometry);
            mergedInstancedHeartGeometry.computeVertexNormals();
            console.log("Merged geometry for instanced hearts created.");

            // Create InstancedMesh for the "surround" hearts
            instancedHeartMesh = new THREE.InstancedMesh(mergedInstancedHeartGeometry, heartMaterial3D, NUM_INSTANCES);
            console.log("InstancedMesh created.");

            // Populate InstancedMesh
            const instanceColor = new THREE.Color();
            const instanceMatrix = new THREE.Matrix4();
            for (let i = 0; i < NUM_INSTANCES; i++) {
                let phi = randomFloat() * Math.PI * 2;
                let theta = THREE.MathUtils.randInt(-1e3, 1e3) / 1e3;
                tempVector3.x = 24 * Math.sqrt(1 - theta * theta) * Math.cos(phi);
                tempVector3.y = 24 * Math.sqrt(1 - theta * theta) * Math.sin(phi);
                tempVector3.z = 24 * theta;
                tempEuler.z = 2 * randomFloat() * Math.PI;
                tempEuler.y = 2 * randomFloat() * Math.PI;
                tempEuler.x = 2 * randomFloat() * Math.PI;
                tempQuaternion.setFromEuler(tempEuler);
                tempScaleVector.set(1, 1, 1);
                instanceMatrix.compose(tempVector3, tempQuaternion, tempScaleVector);
                instancedHeartMesh.setMatrixAt(i, instanceMatrix);
                instancedHeartMesh.setColorAt(
                    i,
                    instanceColor.setHSL(
                        Math.abs(THREE.MathUtils.randInt(9750, 1e4) / 1e4),
                        1,
                        THREE.MathUtils.randInt(500, 700) / 1e3
                    )
                );
            }
            scene3D.add(instancedHeartMesh);
            console.log("Instanced hearts populated and added to scene.");

            // Create the main central heart (3D version)
            let mainHeartGeometry3D = mergedInstancedHeartGeometry.clone();
            mainHeartGeometry3D.scale(10, 10, 10);
            let mainHeartColorMaterial3D = heartMaterial3D.clone();
            mainHeartColorMaterial3D.color.set("red");
            mainHeartMesh3D = new THREE.Mesh(mainHeartGeometry3D, mainHeartColorMaterial3D);
            mainHeartMesh3D.name = "heart3D";
            scene3D.add(mainHeartMesh3D);
            console.log("Main 3D heart created and added to scene.");

            // Add class to 3D canvas to make it visible
            canvas3D.classList.add('canvas-visible');
            console.log("3D Canvas visibility class added.");

            // Event listeners for window resize and mouse/touch interaction
            window.addEventListener("resize", onWindowResize3D);
            document.addEventListener(Event.TOUCH_START, onTouchStart, false);
            console.log("3D Event listeners added.");

            // Start 3D animation loop
            animate3D();
            console.log("3D Animation loop started.");

        } catch (error) {
            console.error("Error during Three.js initialization:", error);
        }
    }

    // Handle window resizing for 3D scene
    function onWindowResize3D() {
        camera3D.aspect = window.innerWidth / window.innerHeight;
        camera3D.updateProjectionMatrix();
        renderer3D.setSize(window.innerWidth, window.innerHeight);
    }

    // Variables for mouse/touch interaction (shared between 3D globe)
    let currentDragX = 0, currentDragY = 0;
    let startDragX = 0, startDragY = 0;
    let initialRotationX = 0, initialRotationY = 0;

    // Handle touch/mouse start for interaction
    function onTouchStart(event) {
        event.preventDefault();
        
        let clientX, clientY;
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        startDragX = clientX;
        startDragY = clientY;
        initialRotationX = currentDragX;
        initialRotationY = currentDragY;

        document.addEventListener(Event.TOUCH_MOVE, onTouchMove, false);
        document.addEventListener(Event.TOUCH_END, onTouchEnd, false);
    }

    // Handle touch/mouse move for interaction
    function onTouchMove(event) {
        event.preventDefault();
        
        let clientX, clientY;
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }

        currentDragX = initialRotationX + 0.01 * (clientX - startDragX);
        currentDragY = initialRotationY + 0.01 * (clientY - startDragY);

        targetRotationX = currentDragX;
        targetRotationY = currentDragY;
    }

    // Handle touch/mouse end for interaction
    function onTouchEnd() {
        document.removeEventListener(Event.TOUCH_MOVE, onTouchMove, false);
        document.removeEventListener(Event.TOUCH_END, onTouchEnd, false);
    }

    // Main 3D animation loop
    function animate3D() {
        requestAnimationFrame(animate3D);
        if (!renderer3D || !scene3D || !camera3D) {
            console.error("3D Renderer, scene, or camera not initialized. Stopping 3D animate loop.");
            return;
        }

        // Update scaling for instanced hearts
        let instanceScaleFactorInner = Math.cos(animationFrameCount3D / INSTANCE_SCALE_CYCLE_DURATION + 1) * INSTANCE_SCALE_AMPLITUDE + 1;
        let instanceScaleFactorOuter = Math.sin(animationFrameCount3D / INSTANCE_SCALE_CYCLE_DURATION + 1) * INSTANCE_SCALE_AMPLITUDE + 1;

        for (let i = 0; i < NUM_INSTANCES; i++) {
            instancedHeartMesh.getMatrixAt(i, dummyObject.matrix);
            dummyObject.matrix.decompose(dummyObject.position, dummyObject.quaternion, dummyObject.scale);

            let currentScale = (i % 2 === 0) ?
                (1 / dummyObject.scale.x) * instanceScaleFactorInner :
                (1 / dummyObject.scale.x) * instanceScaleFactorOuter;
            tempScaleVector.set(currentScale, currentScale, currentScale);

            dummyObject.matrix.compose(dummyObject.position, dummyObject.quaternion, tempScaleVector);
            instancedHeartMesh.setMatrixAt(i, dummyObject.matrix);
        }
        instancedHeartMesh.instanceMatrix.needsUpdate = true;

        // Apply rotation from mouse/touch interaction
        instancedHeartMesh.rotation.y = targetRotationX;
        instancedHeartMesh.rotation.x = targetRotationY;

        // Apply continuous auto-rotation
        instancedHeartMesh.rotation.x += ROTATION_SPEED_Y;
        instancedHeartMesh.rotation.z -= ROTATION_SPEED_X;

        // Update scaling for the main central heart (pulsing effect)
        let mainHeartPulseFactor = Math.cos(animationFrameCount3D / MAIN_HEART_PULSE_DURATION + 1) * MAIN_HEART_PULSE_AMPLITUDE + 1;
        mainHeartMesh3D.scale.set(mainHeartPulseFactor, mainHeartPulseFactor, mainHeartPulseFactor);

        animationFrameCount3D++;
        renderer3D.render(scene3D, camera3D);
    }

    // Initial call will be triggered by the main DOMContentLoaded listener below
})();


// --- 2D HEART ANIMATION LOGIC (from your original snippet) ---
(function () {
    // Ensure requestAnimationFrame is available (polyfill is in main window scope)
    window.requestAnimationFrame =
        window.__requestAnimationFrame ||
        window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        (function () {
            return function (callback, element) {
                var lastTime = element.__lastTime;
                if (lastTime === undefined) {
                    lastTime = 0;
                }
                var currTime = Date.now();
                var timeToCall = Math.max(1, 33 - (currTime - lastTime));
                window.setTimeout(callback, timeToCall);
                element.__lastTime = currTime + timeToCall;
            };
        })();

    window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()));
    
    var loaded2D = false; // Separate flag for 2D initialization

    var init2DHeart = function () {
        if (loaded2D) return;
        loaded2D = true;
        console.log("init2DHeart() started.");

        var mobile = window.isDevice;
        var koef = mobile ? 0.5 : 1; // Coefficient for 2D canvas size

        var canvas2D = document.getElementById('heart2D');
        if (!canvas2D) {
            console.error("2D Canvas element with ID 'heart2D' not found!");
            return;
        }
        var ctx = canvas2D.getContext('2d');
        console.log("2D Canvas element found and context obtained.");

        var width = canvas2D.width = koef * window.innerWidth;
        var height = canvas2D.height = koef * window.innerHeight;

        var rand = Math.random;

        ctx.fillStyle = "rgba(0,0,0,1)"; // Black background for 2D heart
        ctx.fillRect(0, 0, width, height);

        var heartPosition = function (rad) {
            return [
                16 * Math.pow(Math.sin(rad), 3),
                -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad))
            ];
        };
        var scaleAndTranslate = function (pos, sx, sy, dx, dy) {
            return [dx + pos[0] * sx, dy + pos[1] * sy];
        };

        window.addEventListener('resize', function () {
            width = canvas2D.width = koef * window.innerWidth;
            height = canvas2D.height = koef * window.innerHeight;
            ctx.fillStyle = "rgba(0,0,0,1)";
            ctx.fillRect(0, 0, width, height);
            // Re-pulse the heart points to adjust their target positions for the new size.
            pulse2D((1 + -Math.cos(animationTimer)) * .5, (1 + -Math.cos(animationTimer)) * .5);
        });

        var traceCount = mobile ? 20 : 50;
        var pointsOrigin = [];
        var i;
        var dr = mobile ? 0.3 : 0.1;

        // Adjusted scaling factors (sx, sy) for 2D heart to be proportional and visible
        for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 15, 15, 0, 0));
        for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 10, 10, 0, 0));
        for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 5, 5, 0, 0));
        var heartPointsCount = pointsOrigin.length;

        var targetPoints = [];
        var pulse2D = function (kx, ky) {
            var pulseAmplitude = 0.1; // Amount of size variation
            var pulseSpeed = 5;       // How fast the pulse cycle is
            var currentPulseFactor = 1 + (Math.sin(animationTimer * pulseSpeed) * pulseAmplitude);

            for (i = 0; i < pointsOrigin.length; i++) {
                targetPoints[i] = [];
                targetPoints[i][0] = kx * pointsOrigin[i][0] * currentPulseFactor + width / 2;
                targetPoints[i][1] = ky * pointsOrigin[i][1] * currentPulseFactor + height / 2;
            }
        };

        var e = [];
        for (i = 0; i < heartPointsCount; i++) {
            var x = rand() * width;
            var y = rand() * height;
            e[i] = {
                vx: 0,
                vy: 0,
                R: 2,
                speed: rand() + 5,
                q: ~~(rand() * heartPointsCount),
                D: 2 * (i % 2) - 1,
                force: 0.2 * rand() + 0.7,
                f: "hsla(0," + ~~(40 * rand() + 60) + "%," + ~~(60 * rand() + 20) + "%,.3)",
                trace: []
            };
            for (var k = 0; k < traceCount; k++) e[i].trace[k] = { x: x, y: y };
        }

        var config2D = {
            traceK: 0.4,
            timeDelta: 0.01
        };

        var loop2D = function () {
            var n = -Math.cos(animationTimer); // Use global animationTimer
            pulse2D((1 + n) * .5, (1 + n) * .5);

            animationTimer += ((Math.sin(animationTimer)) < 0 ? 9 : (n > 0.8) ? .2 : 1) * config2D.timeDelta; // Update global timer

            ctx.fillStyle = "rgba(0,0,0,.1)";
            ctx.fillRect(0, 0, width, height);

            for (i = e.length; i--;) {
                var u = e[i];
                var q = targetPoints[u.q];
                var dx = u.trace[0].x - q[0];
                var dy = u.trace[0].y - q[1];
                var length = Math.sqrt(dx * dx + dy * dy);

                if (10 > length) {
                    if (0.95 < rand()) {
                        u.q = ~~(rand() * heartPointsCount);
                    }
                    else {
                        if (0.99 < rand()) {
                            u.D *= -1;
                        }
                        u.q += u.D;
                        u.q %= heartPointsCount;
                        if (0 > u.q) {
                            u.q += heartPointsCount;
                        }
                    }
                }
                u.vx += -dx / length * u.speed;
                u.vy += -dy / length * u.speed;
                u.trace[0].x += u.vx;
                u.trace[0].y += u.vy;
                u.vx *= u.force;
                u.vy *= u.force;
                for (k = 0; k < u.trace.length - 1;) {
                    var T = u.trace[k];
                    var N = u.trace[++k];
                    N.x -= config2D.traceK * (N.x - T.x);
                    N.y -= config2D.traceK * (N.y - T.y);
                }
                ctx.fillStyle = u.f;
                for (k = 0; k < u.trace.length; k++) {
                    ctx.fillRect(u.trace[k].x, u.trace[k].y, 1, 1);
                }
            }
            window.requestAnimationFrame(loop2D, canvas2D);
        };
        loop2D(); // Start the 2D animation loop
        canvas2D.classList.add('canvas-visible'); // Make 2D canvas visible
        console.log("2D Animation loop started and canvas visible.");
    };
})();


// --- OVERALL INITIALIZATION AND SEQUENCING ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded fired. Scheduling animations...");

    // Timing for text animations (from style.css)
    const lastTextAnimationEndTime = 8.8 * 1000 + 800; // 8.8s (last span delay) + 0.8s (fadeInSlideUp duration) = ~9.6 seconds

    // Delay for 2D heart animation to start after text
    const delay2DHeartStart = lastTextAnimationEndTime + 500; // 0.5 seconds after text finishes

    // Delay for 3D heart globe animation to start after 2D heart has started
    const delay3DHeartStart = delay2DHeartStart + 1000; // 1 second after 2D heart starts

    // 1. Text animations run first (controlled by CSS animations on .sp-container h2)
    // No explicit JS call needed here as CSS handles it.

    // 2. Schedule 2D heart animation to start
    setTimeout(init2DHeart, delay2DHeartStart);
    console.log(`2D heart animation scheduled to start in ${delay2DHeartStart / 1000} seconds.`);

    // 3. Schedule 3D heart globe animation to start
    setTimeout(init3DScene, delay3DHeartStart);
    console.log(`3D heart globe animation scheduled to start in ${delay3DHeartStart / 1000} seconds.`);
});

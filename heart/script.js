// --- GLOBAL SCRIPT START DIAGNOSTIC ---
console.log("Script started executing!"); // This will confirm if the script file itself is loading.

// THREE.JS IMPORTS (for 3D heart globe)
import * as THREE from "three";
import * as BufferGeometryUtils from "three/addons/utils/BufferGeometryUtils.js";
import { SUBTRACTION as CSG_SUBTRACTION, Brush as CSG_Brush, Evaluator as CSG_Evaluator } from "three-bvh-csg";

// --- GLOBAL UTILITY FUNCTIONS ---
// Moved randomFloat to global scope to be accessible by all parts of the script.
function randomFloat(min = 0, max = 1) {
    return Math.random() * (max - min) + min;
}

// Ensure requestAnimationFrame is available (polyfill is in main window scope)
// This standardizes requestAnimationFrame across different browsers.
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
            var timeToCall = Math.max(1, 33 - (currTime - lastTime)); // Target 30fps (1000/33)
            window.setTimeout(callback, timeToCall);
            element.__lastTime = currTime + timeToCall;
        };
    })();

// Detect if the user is on a mobile device (global variable)
// Used to adjust animation parameters for performance/aesthetics on mobile.
window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()));


// --- GLOBAL VARIABLES FOR BOTH ANIMATIONS ---
let animationTimer = 0; // Unified timer for animation synchronization.
                                // This timer is incremented once per frame by the main 3D animation loop,
                                // ensuring both 2D and 3D animations are synchronized.


// --- 3D HEART GLOBE LOGIC ---
let camera3D, scene3D, renderer3D, instancedHeartMesh, mainHeartMesh3D;

// Three.js object used for temporary matrix operations within the instanced mesh loop.
const dummyObject = new THREE.Object3D();
const tempVector3 = new THREE.Vector3();
const tempEuler = new THREE.Euler();
const tempQuaternion = new THREE.Quaternion();
const tempScaleVector = new THREE.Vector3();

// Configuration constants for 3D
const NUM_INSTANCES = 500; // Number of small heart instances forming the globe.
const GLOBE_RADIUS = 60;   // The approximate radius of the sphere on which hearts are distributed.
const INSTANCE_SCALE_CYCLE_DURATION = 10; // Controls the speed of pulsing for small hearts.
const INSTANCE_SCALE_AMPLITUDE = 0.15;   // How much the small hearts scale up/down during pulse.
const MAIN_HEART_PULSE_DURATION = 22;    // Controls the speed of pulsing for the central main heart.
const MAIN_HEART_PULSE_AMPLITUDE = 0.07;  // How much the central main heart scales up/down.
const ROTATION_SPEED_X = 0.0025;         // Auto-rotation speed of the globe around X-axis.
const ROTATION_SPEED_Y = 0.0015;         // Auto-rotation speed of the globe around Y-axis.

// Variables for mouse/touch interaction (global for 3D scene control)
let targetRotationX = 0; // The target rotation for the globe around Y-axis (from user interaction).
let targetRotationY = 0; // The target rotation for the globe around X-axis (from user interaction).
let currentDragX = 0, currentDragY = 0;     // Current accumulated drag rotation.
let startDragX = 0, startDragY = 0;         // Starting point of a drag gesture.
let initialRotationX = 0, initialRotationY = 0; // Rotation at the start of a drag.

// Touch/Mouse event mapping (global for consistency)
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

/**
 * Initializes the Three.js scene, including camera, renderer, lights,
 * the central 3D heart, and the surrounding instanced heart globe.
 */
function init3DScene() {
    console.log("init3DScene() started.");
    const canvas3D = document.getElementById('heart3D');
    if (!canvas3D) {
        console.error("3D Canvas element with ID 'heart3D' not found!");
        return; // Exit if canvas is not found
    }
    console.log("3D Canvas element found.");

    try {
        // Scene setup: The container for all 3D objects, lights, and cameras.
        scene3D = new THREE.Scene();
        scene3D.background = new THREE.Color(0x000000); // Set a solid black background for the 3D scene.
        // scene3D.environment = v; // Removed: This was causing errors as 'v' (environment map) is not loaded or defined in this setup.
        console.log("3D Scene created.");

        // Renderer setup: Handles rendering the 3D scene to the canvas.
        renderer3D = new THREE.WebGLRenderer({
            canvas: canvas3D,  // The HTML canvas element to render to.
            antialias: true,   // Smooths jagged edges.
            alpha: true        // Allows transparency, so 2D canvas can be seen behind if desired.
        });
        renderer3D.setPixelRatio(window.devicePixelRatio); // Sets pixel ratio for high-DPI displays.
        renderer3D.setSize(window.innerWidth, window.innerHeight); // Sets renderer size to fill window.
        renderer3D.useLegacyLights = false; // Uses physically correct lighting models.
        console.log("3D Renderer created and sized.");

        // Camera setup: Defines the viewpoint for the 3D scene.
        camera3D = new THREE.PerspectiveCamera(
            35, // Field of View (FOV) in degrees.
            window.innerWidth / window.innerHeight, // Aspect Ratio.
            0.1, // Near clipping plane. Objects closer than this are not rendered.
            3 * GLOBE_RADIUS // Far clipping plane. Objects farther than this are not rendered.
        );
        camera3D.position.set(0, 0, GLOBE_RADIUS * Math.sqrt(2)); // Position the camera back from the origin.
        camera3D.lookAt(0, 0, 0); // Point the camera at the center of the scene (origin).
        console.log("3D Camera created and positioned.");

        // Lighting: Adds illumination to the scene.
        const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.3); // Soft, uniform light from all directions.
        scene3D.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1); // Light from a specific direction.
        directionalLight.position.set(0, 2 * GLOBE_RADIUS, 0); // Position the directional light above the scene.
        scene3D.add(directionalLight);
        console.log("3D Lights added.");

        // Fog (optional): Adds atmospheric depth to the scene.
        scene3D.fog = new THREE.FogExp2(0xF5E6ED, 0.005); // Exponential fog with a light pink color.
        console.log("3D Fog added.");

        // Material for hearts: Defines the visual properties of the heart meshes.
        const heartMaterial3D = new THREE.MeshStandardMaterial({
            metalness: 1, // Makes the material highly metallic.
            roughness: 0, // Makes the material very smooth (like polished metal).
            color: new THREE.Color(0xFF0000) // Base red color.
        });
        console.log("3D Heart material created.");

        // Create the base heart geometry using CSG (Constructive Solid Geometry) operations.
        // This process starts with a capsule and subtracts a box to form a heart shape.
        let baseCapsuleGeometry = new THREE.CapsuleGeometry(3, 6, 5, 20);
        baseCapsuleGeometry.rotateZ(-Math.PI / 3.78); // Rotate to orient the capsule correctly.
        baseCapsuleGeometry.translate(0, -1, 0); // Translate to position it correctly relative to the cutting box.
        baseCapsuleGeometry.scale(1, 1, 0.85); // Adjust proportions slightly.
        baseCapsuleGeometry.scale(0.23, 0.23, 0.23); // Overall scale down to a small base size.
        
        let evaluator = new CSG_Evaluator(); // CSG evaluator for performing boolean operations.
        let dummyMaterial = new THREE.MeshBasicMaterial({}); // A dummy material needed for CSG_Brush.
        let boxSizeX = 2 * baseCapsuleGeometry.parameters.radius; // Calculate box size based on capsule.
        let boxSizeY = 2 * baseCapsuleGeometry.parameters.height;
        let cutBoxGeometry = new THREE.BoxGeometry(boxSizeX, boxSizeY, boxSizeX); // Create a box to "cut" the capsule.
        cutBoxGeometry.translate(-boxSizeX / 2, 0, 0); // Position the cutting box.
        
        let brush1 = new CSG_Brush(baseCapsuleGeometry, dummyMaterial); // Create brushes from geometries.
        let brush2 = new CSG_Brush(cutBoxGeometry, dummyMaterial);
        evaluator.useGroups = true; // Enable group usage for material handling if needed.
        let finalHeartGeometry = evaluator.evaluate(brush1, brush2, CSG_SUBTRACTION).geometry; // Perform subtraction.
        console.log("CSG operation completed, final heart geometry created.");

        // Clone and merge geometries to create a symmetrical heart shape.
        let mergedInstancedHeartGeometry = BufferGeometryUtils.mergeGeometries([
            finalHeartGeometry,
            finalHeartGeometry.clone().rotateY(Math.PI) // Clone and rotate for symmetry.
        ]);
        mergedInstancedHeartGeometry = BufferGeometryUtils.mergeVertices(mergedInstancedHeartGeometry); // Merge overlapping vertices.
        mergedInstancedHeartGeometry.computeVertexNormals(); // Recalculate normals for correct lighting.
        console.log("Merged geometry for instanced hearts created.");

        // Create InstancedMesh for the "surround" hearts.
        // InstancedMesh is highly efficient for rendering many copies of the same geometry.
        instancedHeartMesh = new THREE.InstancedMesh(mergedInstancedHeartGeometry, heartMaterial3D, NUM_INSTANCES);
        console.log("InstancedMesh created.");

        // Populate InstancedMesh: Set the position, rotation, and color for each instance.
        const instanceColor = new THREE.Color();
        const instanceMatrix = new THREE.Matrix4();
        for (let i = 0; i < NUM_INSTANCES; i++) {
            // Position randomly on a sphere surface (using spherical coordinates).
            let phi = randomFloat() * Math.PI * 2; // Random longitude.
            let theta = randomFloat(-1, 1); // Random latitude (cos-distributed for even spread).
            tempVector3.x = 24 * Math.sqrt(1 - theta * theta) * Math.cos(phi);
            tempVector3.y = 24 * Math.sqrt(1 - theta * theta) * Math.sin(phi);
            tempVector3.z = 24 * theta;

            // Random rotation for each instance.
            tempEuler.z = 2 * randomFloat() * Math.PI;
            tempEuler.y = 2 * randomFloat() * Math.PI;
            tempEuler.x = 2 * randomFloat() * Math.PI;
            tempQuaternion.setFromEuler(tempEuler);

            // Initial scale for each instance.
            tempScaleVector.set(1, 1, 1);

            // Compose the instance's matrix from its position, rotation, and scale.
            instanceMatrix.compose(tempVector3, tempQuaternion, tempScaleVector);
            instancedHeartMesh.setMatrixAt(i, instanceMatrix); // Apply the matrix to the instance.

            // Assign a random vibrant color to each instance.
            instancedHeartMesh.setColorAt(
                i,
                instanceColor.setHSL(
                    Math.abs(randomFloat(0.975, 1)), // Hue: Pinks/Reds (0.975 to 1.0 or 0 to 0.025)
                    1,                               // Saturation: Full
                    randomFloat(0.5, 0.7)            // Lightness: Medium to high
                )
            );
        }
        scene3D.add(instancedHeartMesh); // Add the instanced hearts to the scene.
        console.log("Instanced hearts populated and added to scene.");

        // Create the main central heart (a larger version of the instanced hearts).
        let mainHeartGeometry3D = mergedInstancedHeartGeometry.clone();
        // FIX: Corrected typo from mainHeartGeometry33D to mainHeartGeometry3D
        mainHeartGeometry3D.scale(10, 10, 10); // Scale it up significantly.
        let mainHeartColorMaterial3D = heartMaterial3D.clone(); // Clone material to change its color.
        mainHeartColorMaterial3D.color.set("red"); // Set main heart to bright red.
        mainHeartMesh3D = new THREE.Mesh(mainHeartGeometry3D, mainHeartColorMaterial3D);
        mainHeartMesh3D.name = "heart3D"; // Assign a name for identification.
        
        // Ensure 3D meshes are visible based on user's request
        mainHeartMesh3D.visible = false; // User requested to hide the central 3D heart, keeping 2D as main
        instancedHeartMesh.visible = true; // Make the instanced 3D hearts visible
        

        scene3D.add(mainHeartMesh3D);
        console.log("Main 3D heart created and added to scene.");

        // Add 'canvas-visible' class to 3D canvas to trigger its CSS fade-in animation.
        // This will happen only when the 3D scene is fully initialized.
        canvas3D.classList.add('canvas-visible');
        console.log("3D Canvas visibility class added.");

        // Event listeners for window resize and mouse/touch interaction.
        window.addEventListener("resize", onWindowResize3D);
        document.addEventListener(Event.TOUCH_START, onTouchStart, false);
        console.log("3D Event listeners added.");

        // Start the main 3D animation loop.
        animate3D();
        console.log("3D Animation loop started.");

    } catch (error) {
        console.error("Error during Three.js initialization:", error);
    }
}

/**
 * Handles window resizing for the 3D scene, updating camera aspect ratio and renderer size.
 */
function onWindowResize3D() {
    camera3D.aspect = window.innerWidth / window.innerHeight;
    camera3D.updateProjectionMatrix();
    renderer3D.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Handles the start of a touch or mouse interaction for rotating the 3D globe.
 * Stores initial positions and rotation states.
 */
function onTouchStart(event) {
    event.preventDefault(); // Prevent default browser touch behavior (like scrolling).
    
    let clientX, clientY;
    if (event.touches) { // For touch events
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else { // For mouse events
        clientX = event.clientX;
        clientY = event.clientY;
    }

    startDragX = clientX; // Store starting client X for current drag.
    startDragY = clientY; // Store starting client Y for current drag.
    initialRotationX = targetRotationX; // Store current target rotation as drag starts.
    initialRotationY = targetRotationY;

    // Add event listeners for dragging (move) and ending (release).
    document.addEventListener(Event.TOUCH_MOVE, onTouchMove, false);
    document.addEventListener(Event.TOUCH_END, onTouchEnd, false);
}

/**
 * Handles touch or mouse movement during interaction for rotating the 3D globe.
 * Calculates new target rotation based on drag distance.
 */
function onTouchMove(event) {
    event.preventDefault(); // Prevent default browser touch behavior.
    
    let clientX, clientY;
    if (event.touches) { // For touch events
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else { // For mouse events
        clientX = event.clientX;
        clientY = event.clientY;
    }

    // Calculate the new target rotation based on the drag distance and initial rotation.
    targetRotationX = initialRotationX + 0.01 * (clientX - startDragX);
    targetRotationY = initialRotationY + 0.01 * (clientY - startDragY);
}

/**
 * Handles the end of a touch or mouse interaction, removing the move and end listeners.
 */
function onTouchEnd() {
    document.removeEventListener(Event.TOUCH_MOVE, onTouchMove, false);
    document.removeEventListener(Event.TOUCH_END, onTouchEnd, false);
}

/**
 * The main 3D animation loop. This function is called repeatedly via requestAnimationFrame.
 * Updates rotations, scales, and renders the 3D scene.
 */
function animate3D() {
    requestAnimationFrame(animate3D); // Request the next animation frame.

    // Basic safeguard: Ensure renderer, scene, and camera are initialized before attempting to render.
    if (!renderer3D || !scene3D || !camera3D) {
        console.error("3D Renderer, scene, or camera not initialized. Stopping animation.");
        return; // Stop the loop if initialization failed.
    }

    // Smoothly apply mouse/touch-based rotation to the instanced heart globe.
    if (instancedHeartMesh) {
        instancedHeartMesh.rotation.y += (targetRotationX - instancedHeartMesh.rotation.y) * 0.05;
        instancedHeartMesh.rotation.x += (targetRotationY - instancedHeartMesh.rotation.x) * 0.05;
    }

    // Apply continuous auto-rotation to the instanced heart globe.
    if (instancedHeartMesh) {
        instancedHeartMesh.rotation.x += ROTATION_SPEED_Y; // Rotate around X-axis.
        instancedHeartMesh.rotation.z -= ROTATION_SPEED_X; // Rotate around Z-axis.
    }

    // Update instance scales for the pulsing effect of the small hearts.
    if (instancedHeartMesh) {
        const time = animationTimer * 0.1; // Use the global unified timer for consistent pulsing.
        const tempScale = new THREE.Vector3();
        for (let i = 0; i < NUM_INSTANCES; i++) {
            // Calculate scale offset based on sine wave for pulsing effect.
            const scaleOffset = Math.sin((time + i * 0.05) * (Math.PI * 2 / INSTANCE_SCALE_CYCLE_DURATION)) * INSTANCE_SCALE_AMPLITUDE;
            tempScale.setScalar(1 + scaleOffset); // Set uniform scale for x, y, z.
            
            const instanceMatrix = new THREE.Matrix4();
            instancedHeartMesh.getMatrixAt(i, instanceMatrix); // Get current matrix of the instance.
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3(); // Dummy variable for decomposition.
            instanceMatrix.decompose(position, quaternion, scale); // Decompose matrix to get position and rotation.
            instanceMatrix.compose(position, quaternion, tempScale); // Recompose matrix with updated scale.
            instancedHeartMesh.setMatrixAt(i, instanceMatrix); // Apply the new matrix to the instance.
        }
        instancedHeartMesh.instanceMatrix.needsUpdate = true; // Inform Three.js that instance matrices have changed.
    }

    // Animate the main central heart's pulse.
    if (mainHeartMesh3D) { // Check if mainHeartMesh3D is initialized.
        const time = animationTimer * 0.1; // Use the global unified timer.
        const scale = 1 + Math.sin(time * (Math.PI * 2 / MAIN_HEART_PULSE_DURATION)) * MAIN_HEART_PULSE_AMPLITUDE;
        mainHeartMesh3D.scale.setScalar(scale); // Apply uniform scale to the main heart.
    }

    renderer3D.render(scene3D, camera3D); // Render the 3D scene.

    animationTimer++; // Increment the unified animation timer for the next frame.
}


// --- 2D HEART ANIMATION LOGIC ---
let canvas2D, ctx2D; // Make 2D canvas and its context globally accessible for 2D functions.
let heartPointsOrigin = []; // Stores the base points for the 2D heart shape.
let hearts2DParticles = []; // Stores individual particles that trace the 2D heart.
let heartPointsCount2D;    // Total count of points defining the 2D heart shape.
let config2D;               // Configuration object for 2D animation parameters.

/**
 * Initializes the 2D canvas heart animation.
 * Sets up canvas, defines heart shape, initializes particles, and starts the 2D loop.
 */
function init2DHeart() {
    console.log("init2DHeart() started.");

    var mobile = window.isDevice;
    var koef = mobile ? 0.5 : 1; // Coefficient to adjust canvas size for mobile vs. desktop.

    canvas2D = document.getElementById('heart2D'); // Get the 2D canvas element.
    if (!canvas2D) {
        console.error("2D Canvas element with ID 'heart2D' not found!");
        return; // Exit if canvas not found.
    }
    ctx2D = canvas2D.getContext('2d'); // Get the 2D rendering context.
    console.log("2D Canvas element found and context obtained.");

    var width = canvas2D.width = koef * window.innerWidth;   // Set canvas width.
    var height = canvas2D.height = koef * window.innerHeight; // Set canvas height.

    var rand = Math.random; // Local alias for Math.random for convenience.

    ctx2D.fillStyle = "rgba(0,0,0,1)"; // Initial fill for the 2D canvas background.
    ctx2D.fillRect(0, 0, width, height); // Clear the canvas with black.

    // Function to calculate the position of a point on a heart shape using parametric equations.
    var heartPosition = function (rad) {
        return [
            Math.pow(Math.sin(rad), 3),
            -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad))
        ];
    };
    // Function to scale and translate points from heartPosition output to canvas coordinates.
    var scaleAndTranslate = function (pos, sx, sy, dx, dy) {
        return [dx + pos[0] * sx, dy + pos[1] * sy];
    };

    // Resize listener for 2D canvas.
    window.addEventListener('resize', function () {
        width = canvas2D.width = koef * window.innerWidth;
        height = canvas2D.height = koef * window.innerHeight;
        ctx2D.fillStyle = "rgba(0,0,0,1)";
        ctx2D.fillRect(0, 0, width, height);
        // Re-pulse the heart points to adjust their target positions for the new size.
        // Uses the global animationTimer for its pulse state.
        pulse2D((1 + -Math.cos(animationTimer)) * .5, (1 + -Math.cos(animationTimer)) * .5);
    });

    var traceCount = mobile ? 20 : 50; // Number of particles forming the trace.
    var dr = mobile ? 0.3 : 0.1; // Delta radius: controls the density of points forming the heart shape.

    // Generate points for three nested heart shapes with different scales, creating a layered effect.
    heartPointsOrigin = []; // Clear and re-populate the global heartPointsOrigin array.
    // Applying the specific scales as per your original 2D heart CodePen
    for (let j = 0; j < Math.PI * 2; j += dr) heartPointsOrigin.push(scaleAndTranslate(heartPosition(j), 210, 13, 0, 0));
    for (let j = 0; j < Math.PI * 2; j += dr) heartPointsOrigin.push(scaleAndTranslate(heartPosition(j), 150, 9, 0, 0));
    for (let j = 0; j < Math.PI * 2; j += dr) heartPointsOrigin.push(scaleAndTranslate(heartPosition(j), 90, 5, 0, 0));
    heartPointsCount2D = heartPointsOrigin.length; // Update the global count.

    var targetPoints2D = []; // Stores the current target positions for 2D particles.
    // Function to "pulse" the 2D heart by scaling and translating the original points.
    var pulse2D = function (kx, ky) {
        var pulseAmplitude = 0.1; // Amount of size variation during pulse.
        var pulseSpeed = 5;       // How fast the pulse cycle is.
        var currentPulseFactor = 1 + (Math.sin(animationTimer * pulseSpeed) * pulseAmplitude); // Use global timer.

        for (let j = 0; j < heartPointsCount2D; j++) {
            targetPoints2D[j] = [];
            targetPoints2D[j][0] = kx * heartPointsOrigin[j][0] * currentPulseFactor + width / 2;
            targetPoints2D[j][1] = ky * heartPointsOrigin[j][1] * currentPulseFactor + height / 2;
        }
    };

    // Initialize 2D heart particles.
    hearts2DParticles = []; // Clear and re-populate the global hearts2DParticles array.
    for (let j = 0; j < heartPointsCount2D; j++) {
        var x = rand() * width;
        var y = rand() * height;
        hearts2DParticles[j] = {
            vx: 0, // Velocity X
            vy: 0, // Velocity Y
            R: 2,  // Radius (not directly used for drawing)
            speed: rand() + 5, // Speed of movement towards target
            q: ~~(rand() * heartPointsCount2D), // Index of target point
            D: 2 * (j % 2) - 1, // Direction for cycling targets (+1 or -1)
            force: 0.2 * rand() + 0.7, // Damping/friction factor
            f: "hsla(0," + ~~(40 * rand() + 60) + "%," + ~~(60 * rand() + 20) + "%,.3)", // Particle color
            trace: [] // Array to store trace history
        };
        for (var k = 0; k < traceCount; k++) hearts2DParticles[j].trace[k] = { x: x, y: y };
    }

    config2D = { // Assign to global config2D.
        traceK: 0.4, // How tightly the trace points follow the head particle.
        timeDelta: 0.01 // Controls the speed of the 2D pulse effect (though now linked to global timer).
    };

    /**
     * The main 2D animation loop. Updates particle positions and draws their traces.
     */
    var loop2D = function () {
        var n = -Math.cos(animationTimer); // Use global animationTimer for pulse state.
        pulse2D((1 + n) * .5, (1 + n) * .5);

        // NOTE: animationTimer is now incremented in animate3D to keep unified timing for both 2D and 3D.
        // This loop only reads animationTimer's state.

        ctx2D.fillStyle = "rgba(0,0,0,.1)"; // Semi-transparent black overlay for trails.
        ctx2D.fillRect(0, 0, width, height); // Redraw background to create fading effect.

        for (let j = hearts2DParticles.length; j--;) { // Loop through each particle.
            var u = hearts2DParticles[j];
            var q = targetPoints2D[u.q]; // Current target point for the particle.
            var dx = u.trace[0].x - q[0]; // Distance X to target.
            var dy = u.trace[0].y - q[1]; // Distance Y to target.
            var length = Math.sqrt(dx * dx + dy * dy); // Euclidean distance to target.

            // If particle is close to target, assign a new target.
            if (10 > length) {
                if (0.95 < rand()) {
                    u.q = ~~(rand() * heartPointsCount2D); // Randomly jump to any target point.
                }
                else {
                    if (0.99 < rand()) {
                        u.D *= -1; // Randomly reverse direction.
                    }
                    u.q += u.D; // Move to next target in sequence.
                    u.q %= heartPointsCount2D; // Wrap around if end is reached.
                    if (0 > u.q) {
                        u.q += heartPointsCount2D; // Handle negative indices.
                    }
                }
            }
            u.vx += -dx / length * u.speed; // Apply force towards target.
            u.vy += -dy / length * u.speed;
            u.trace[0].x += u.vx; // Update head of the trace.
            u.trace[0].y += u.vy;
            u.vx *= u.force; // Apply damping.
            u.vy *= u.force;
            // Update the rest of the particle's trace, making them follow the head.
            for (let k = 0; k < u.trace.length - 1;) {
                var T = u.trace[k];
                var N = u.trace[++k];
                N.x -= config2D.traceK * (N.x - T.x);
                N.y -= config2D.traceK * (N.y - T.y);
            }
            ctx2D.fillStyle = u.f; // Set particle color.
            // Draw each segment of the particle's trace as a small filled rectangle.
            for (let k = 0; k < u.trace.length; k++) {
                ctx2D.fillRect(u.trace[k].x, u.trace[k].y, 1, 1);
            }
        }
        window.requestAnimationFrame(loop2D, canvas2D); // Request next frame for 2D.
    };
    loop2D(); // Start the 2D animation loop.
    canvas2D.classList.add('canvas-visible'); // Make 2D canvas visible.
    console.log("2D Animation loop started and canvas visible.");
}


// --- OVERALL INITIALIZATION AND SEQUENCING ---
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOMContentLoaded fired. Scheduling animations...");

    // Timing for text animations (based on CSS animation delays)
    // The last span animation in frame-5 has a delay of 8.8s and duration of 0.8s.
    const lastTextAnimationEndTime = 8.8 * 1000 + 800; // ~9.6 seconds

    // Delay for 2D heart animation to start after text is fully displayed.
    const delay2DHeartStart = lastTextAnimationEndTime + 500; // 0.5 seconds buffer after text finishes.

    // Delay for 3D heart globe animation to start after 2D heart has started.
    const delay3DHeartStart = delay2DHeartStart + 1000; // 1 second after 2D heart starts.

    // 1. Text animations run first (controlled by CSS animations on .sp-container h2).
    // No explicit JS call needed here as CSS handles it.

    // 2. Schedule 2D heart animation to start.
    setTimeout(init2DHeart, delay2DHeartStart);
    console.log(`2D heart animation scheduled to start in ${delay2DHeartStart / 1000} seconds.`);

    // 3. Schedule 3D heart globe animation to start.
    setTimeout(init3DScene, delay3DHeartStart);
    console.log(`3D heart globe animation scheduled to start in ${delay3DHeartStart / 1000} seconds.`);
});

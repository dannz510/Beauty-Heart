// --- Global Variables & Constants (Shared/Orchestration) ---
const TEXT_APPEAR_DELAY = 1500; // Delay before text starts appearing (ms)
const TEXT_FRAME_INTERVAL = 2000; // Interval between each text frame (ms)
const LAST_TEXT_FRAME_DURATION = 3000; // Duration for the last text frame, including word by word (ms)

let heart2DCanvas;
let textContainer;
let textFrames;

// --- 2D Heart Animation Variables ---
let ctx2D;
let width2D, height2D;
let pointsOrigin2D = [];
let targetPoints2D = [];
let particles2D = [];
const traceCount2D = window.isDevice ? 20 : 50;
const config2D = {
    traceK: 0.4,
    timeDelta: 0.01
};
let time2D = 0;
let is2DHeartRunning = false;


// --- Helper Functions ---

// Detect if the device is mobile (from original 2D heart code)
// This is used for scaling the 2D heart canvas size.
window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()));


// --- 2D Heart Animation Functions ---

function init2DHeart() {
    if (is2DHeartRunning) return; // Prevent multiple initializations if already running

    heart2DCanvas = document.getElementById('heart2D');
    ctx2D = heart2DCanvas.getContext('2d');

    // Make the 2D heart canvas visible by fading in its opacity
    heart2DCanvas.style.opacity = 1;

    const mobile = window.isDevice;
    const koef = mobile ? 0.5 : 1; // Scaling factor for mobile devices
    
    // Set canvas dimensions based on window size and mobile scaling factor
    width2D = heart2DCanvas.width = koef * innerWidth;
    height2D = heart2DCanvas.height = koef * innerHeight;
    
    // Clear the canvas with an initial semi-transparent black background
    ctx2D.fillStyle = "rgba(0,0,0,1)";
    ctx2D.fillRect(0, 0, width2D, height2D);

    // Function to calculate a point on the heart curve using a polar equation
    const heartPosition = (rad) => {
        return [
            Math.pow(Math.sin(rad), 3), // X-coordinate
            -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad)) // Y-coordinate
        ];
    };

    // Function to scale and translate a given position
    const scaleAndTranslate = (pos, sx, sy, dx, dy) => {
        return [dx + pos[0] * sx, dy + pos[1] * sy];
    };

    // Add event listener to handle canvas resizing when the window is resized
    window.addEventListener('resize', onWindowResize2D);

    const dr = mobile ? 0.3 : 0.1; // Determines the density of points generated along the heart curve
    // Generate points for three different sizes of the heart, creating a layered effect
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 210, 13, 0, 0));
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 150, 9, 0, 0));
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 90, 5, 0, 0));
    
    // Initialize particles for the 2D heart animation
    for (let i = 0; i < pointsOrigin2D.length; i++) {
        let x = Math.random() * width2D; // Random initial X position
        let y = Math.random() * height2D; // Random initial Y position
        particles2D[i] = {
            vx: 0, // Velocity in X direction
            vy: 0, // Velocity in Y direction
            R: 2, // Radius (not explicitly used for drawing, but might be for other calculations)
            speed: Math.random() + 5, // Speed of the particle
            q: ~~(Math.random() * pointsOrigin2D.length), // Random target point index from the heart curve
            D: 2 * (i % 2) - 1, // Direction for changing target point (+1 or -1)
            force: 0.2 * Math.random() + 0.7, // Damping/friction force
            f: `hsla(0, ${~~(40 * Math.random() + 60)}%, ${~~(60 * Math.random() + 20)}%, .3)`, // HSLA color string for the particle
            trace: [] // Array to store particle's past positions for a trail effect
        };
        // Initialize particle's trace with its starting position
        for (let k = 0; k < traceCount2D; k++) particles2D[i].trace[k] = { x: x, y: y };
    }

    // Start the 2D animation loop
    animate2DHeart();
    is2DHeartRunning = true; // Set flag to indicate 2D heart animation is active
}

// Handler for window resize events, updates 2D canvas dimensions
function onWindowResize2D() {
    const mobile = window.isDevice;
    const koef = mobile ? 0.5 : 1;
    width2D = heart2DCanvas.width = koef * innerWidth;
    height2D = heart2DCanvas.height = koef * innerHeight;
    ctx2D.fillStyle = "rgba(0,0,0,1)";
    ctx2D.fillRect(0, 0, width2D, height2D);
}

// Function to calculate the pulsating effect on the heart's target points
function pulse2D(kx, ky) {
    for (let i = 0; i < pointsOrigin2D.length; i++) {
        targetPoints2D[i] = [];
        targetPoints2D[i][0] = kx * pointsOrigin2D[i][0] + width2D / 2; // Apply scaling and center X
        targetPoints2D[i][1] = ky * pointsOrigin2D[i][1] + height2D / 2; // Apply scaling and center Y
    }
}

// The main 2D heart animation loop
function animate2DHeart() {
    if (!is2DHeartRunning) return; // Only run if the animation is intended to be active

    // Calculate pulsation value based on time for a smooth beat effect
    const n = -Math.cos(time2D);
    pulse2D((1 + n) * 0.5, (1 + n) * 0.5); // Apply the pulse to the heart's target points

    // Increment time; speed of time increment changes based on pulsation phase for a more dynamic beat
    time2D += ((Math.sin(time2D)) < 0 ? 9 : (n > 0.8) ? 0.2 : 1) * config2D.timeDelta;

    // Clear canvas with a slight transparent overlay to create particle trails
    ctx2D.fillStyle = "rgba(0,0,0,.1)";
    ctx2D.fillRect(0, 0, width2D, height2D);

    // Update and draw each particle
    for (let i = particles2D.length; i--;) {
        const p = particles2D[i]; // Current particle
        const targetQ = targetPoints2D[p.q]; // Current target point for the particle

        let dx = p.trace[0].x - targetQ[0]; // Difference in X between particle head and target
        let dy = p.trace[0].y - targetQ[1]; // Difference in Y between particle head and target
        const length = Math.sqrt(dx * dx + dy * dy); // Distance to target

        // If particle is close to its target point, decide on a new target or direction
        if (10 > length) {
            if (0.95 < Math.random()) { // 5% chance to pick a completely random new target
                p.q = ~~(Math.random() * pointsOrigin2D.length);
            } else { // Otherwise, move to the next or previous point in the heart curve
                if (0.99 < Math.random()) { // 1% chance to reverse direction
                    p.D *= -1;
                }
                p.q += p.D; // Move to next target in sequence
                p.q %= pointsOrigin2D.length; // Wrap around if end/beginning reached
                if (0 > p.q) { // Handle negative index after modulo
                    p.q += pointsOrigin2D.length;
                }
            }
        }

        // Apply force to move particle towards its target point
        p.vx += -dx / length * p.speed;
        p.vy += -dy / length * p.speed;

        // Update particle's head position
        p.trace[0].x += p.vx;
        p.trace[0].y += p.vy;

        // Apply friction/damping to velocity
        p.vx *= p.force;
        p.vy *= p.force;

        // Update particle's trace (trail) by making each point follow the previous one
        for (let k = 0; k < p.trace.length - 1; k++) {
            const T = p.trace[k];     // Current point in trace
            const N = p.trace[k + 1]; // Next point in trace
            N.x -= config2D.traceK * (N.x - T.x); // Interpolate X
            N.y -= config2D.traceK * (N.y - T.y); // Interpolate Y
        }

        // Set the particle's color and draw each point in its trace
        ctx2D.fillStyle = p.f;
        for (let k = 0; k < p.trace.length; k++) {
            ctx2D.fillRect(p.trace[k].x, p.trace[k].y, 1, 1); // Draw each point as a 1x1 pixel
        }
    }
    window.requestAnimationFrame(animate2DHeart); // Request next animation frame
}


// --- Text Animation Functions ---

function animateText() {
    let currentFrameIndex = 0;
    const textFrames = document.querySelectorAll('.sp-content h2');
    const lastFrameSpans = document.querySelectorAll('.sp-content h2.frame-5 span');

    // Make the entire text container visible with a fade-in effect
    textContainer.style.opacity = 1;

    // Function to show the next text frame in sequence
    const showNextFrame = () => {
        if (currentFrameIndex < textFrames.length) {
            const currentFrame = textFrames[currentFrameIndex];
            currentFrame.classList.add('active'); // Add 'active' class to trigger CSS animation (fade-in, slide-up)

            // Special handling for the last text frame, "Trần Gia Linh", to show words one by one
            if (currentFrame.classList.contains('frame-5')) {
                let spanIndex = 0;
                const showNextSpan = () => {
                    if (spanIndex < lastFrameSpans.length) {
                        lastFrameSpans[spanIndex].classList.add('active'); // Activate individual word animation
                        spanIndex++;
                        // Calculate delay for each word to spread evenly across the total duration
                        setTimeout(showNextSpan, LAST_TEXT_FRAME_DURATION / lastFrameSpans.length);
                    } else {
                        // After all words are shown, initiate the 2D heart animation
                        // A small delay (1000ms) provides a brief pause before the heart appears
                        setTimeout(init2DHeart, 1000);
                    }
                };
                showNextSpan(); // Start showing words for the last frame
            } else {
                currentFrameIndex++;
                // Move to the next text frame after a set interval
                setTimeout(showNextFrame, TEXT_FRAME_INTERVAL);
            }
        }
    };

    // Start the entire text animation sequence after an initial delay
    setTimeout(showNextFrame, TEXT_APPEAR_DELAY);
}

// --- Main Initialization on DOM Content Loaded ---
// This function runs once the HTML document has been completely loaded and parsed.
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements that will be animated
    heart2DCanvas = document.getElementById('heart2D'); // The 2D heart canvas
    textContainer = document.querySelector('.sp-container'); // The container holding all text elements
    textFrames = document.querySelectorAll('.sp-content h2'); // All individual text lines

    // Set initial CSS states for elements to be hidden or in their starting positions.
    // These states are primarily controlled by CSS, but explicit setting here ensures consistency.
    heart2DCanvas.style.opacity = 0; // Make 2D heart canvas initially invisible
    textContainer.style.opacity = 0; // Make the text container initially invisible
    textFrames.forEach(frame => {
        frame.style.opacity = 0; // Each text line invisible
        frame.style.transform = 'translateY(20px)'; // Each text line slightly off-screen (below)
    });
    // Set initial states for individual words in the last text frame
    document.querySelectorAll('.sp-content h2.frame-5 span').forEach(span => {
        span.style.opacity = 0; // Each word invisible
        span.style.transform = 'translateY(20px)'; // Each word slightly off-screen (below)
    });

    // Start the text animation sequence. This is the first animation to play.
    animateText();
});

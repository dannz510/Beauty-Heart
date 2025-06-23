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

// Polyfill for requestAnimationFrame
window.requestAnimationFrame =
    window.__requestAnimationFrame ||
    window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    (function () {
        return function (callback) {
            // Fallback for older browsers
            var lastTime = heart2DCanvas.__lastTime;
            if (lastTime === undefined) {
                lastTime = 0;
            }
            var currTime = Date.now();
            var timeToCall = Math.max(1, 33 - (currTime - lastTime));
            window.setTimeout(callback, timeToCall);
            heart2DCanvas.__lastTime = currTime + timeToCall;
        };
    })();

// Detect if the device is mobile (from original 2D heart code)
window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()));


// --- 2D Heart Animation Functions ---

function init2DHeart() {
    if (is2DHeartRunning) return; // Prevent multiple initializations

    heart2DCanvas = document.getElementById('heart2D');
    ctx2D = heart2DCanvas.getContext('2d');

    // Make the 2D heart canvas visible
    heart2DCanvas.style.opacity = 1;

    const mobile = window.isDevice;
    const koef = mobile ? 0.5 : 1; // Scaling factor for mobile
    
    width2D = heart2DCanvas.width = koef * innerWidth;
    height2D = heart2DCanvas.height = koef * innerHeight;
    
    // Clear the canvas with initial background
    ctx2D.fillStyle = "rgba(0,0,0,1)";
    ctx2D.fillRect(0, 0, width2D, height2D);

    // Function to calculate heart curve position
    const heartPosition = (rad) => {
        return [
            Math.pow(Math.sin(rad), 3),
            -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad))
        ];
    };

    // Function to scale and translate points
    const scaleAndTranslate = (pos, sx, sy, dx, dy) => {
        return [dx + pos[0] * sx, dy + pos[1] * sy];
    };

    // Handle 2D canvas resize
    window.addEventListener('resize', onWindowResize2D);

    const dr = mobile ? 0.3 : 0.1; // Density of points on the heart curve
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 210, 13, 0, 0));
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 150, 9, 0, 0));
    for (let i = 0; i < Math.PI * 2; i += dr) pointsOrigin2D.push(scaleAndTranslate(heartPosition(i), 90, 5, 0, 0));
    
    // Initialize particles for the 2D heart animation
    for (let i = 0; i < pointsOrigin2D.length; i++) {
        let x = Math.random() * width2D;
        let y = Math.random() * height2D;
        particles2D[i] = {
            vx: 0,
            vy: 0,
            R: 2,
            speed: Math.random() + 5,
            q: ~~(Math.random() * pointsOrigin2D.length), // Target point index
            D: 2 * (i % 2) - 1, // Direction for target point change
            force: 0.2 * Math.random() + 0.7,
            f: `hsla(0, ${~~(40 * Math.random() + 60)}%, ${~~(60 * Math.random() + 20)}%, .3)`, // Particle color
            trace: [] // Particle trail
        };
        for (let k = 0; k < traceCount2D; k++) particles2D[i].trace[k] = { x: x, y: y };
    }

    // Start the 2D animation loop
    animate2DHeart();
    is2DHeartRunning = true;
}

function onWindowResize2D() {
    const mobile = window.isDevice;
    const koef = mobile ? 0.5 : 1;
    width2D = heart2DCanvas.width = koef * innerWidth;
    height2D = heart2DCanvas.height = koef * innerHeight;
    ctx2D.fillStyle = "rgba(0,0,0,1)";
    ctx2D.fillRect(0, 0, width2D, height2D);
}

// Function to pulse the target points of the heart
function pulse2D(kx, ky) {
    for (let i = 0; i < pointsOrigin2D.length; i++) {
        targetPoints2D[i] = [];
        targetPoints2D[i][0] = kx * pointsOrigin2D[i][0] + width2D / 2;
        targetPoints2D[i][1] = ky * pointsOrigin2D[i][1] + height2D / 2;
    }
}

function animate2DHeart() {
    if (!is2DHeartRunning) return; // Only run if initiated

    const n = -Math.cos(time2D); // Controls the pulsing effect based on time
    pulse2D((1 + n) * 0.5, (1 + n) * 0.5); // Apply pulse to target points

    time2D += ((Math.sin(time2D)) < 0 ? 9 : (n > 0.8) ? 0.2 : 1) * config2D.timeDelta; // Update time for next frame

    // Clear canvas with a slight transparent overlay for trail effect
    ctx2D.fillStyle = "rgba(0,0,0,.1)";
    ctx2D.fillRect(0, 0, width2D, height2D);

    // Update and draw each particle
    for (let i = particles2D.length; i--;) {
        const p = particles2D[i];
        const targetQ = targetPoints2D[p.q];

        let dx = p.trace[0].x - targetQ[0];
        let dy = p.trace[0].y - targetQ[1];
        const length = Math.sqrt(dx * dx + dy * dy);

        // If particle is close to its target point, change target or direction
        if (10 > length) {
            if (0.95 < Math.random()) {
                p.q = ~~(Math.random() * pointsOrigin2D.length);
            } else {
                if (0.99 < Math.random()) {
                    p.D *= -1;
                }
                p.q += p.D;
                p.q %= pointsOrigin2D.length;
                if (0 > p.q) {
                    p.q += pointsOrigin2D.length;
                }
            }
        }

        // Apply force towards target point
        p.vx += -dx / length * p.speed;
        p.vy += -dy / length * p.speed;

        // Update particle position
        p.trace[0].x += p.vx;
        p.trace[0].y += p.vy;

        // Apply friction/damping
        p.vx *= p.force;
        p.vy *= p.force;

        // Update particle trace
        for (let k = 0; k < p.trace.length - 1; k++) {
            const T = p.trace[k];
            const N = p.trace[k + 1];
            N.x -= config2D.traceK * (N.x - T.x);
            N.y -= config2D.traceK * (N.y - T.y);
        }

        // Draw particle trace
        ctx2D.fillStyle = p.f;
        for (let k = 0; k < p.trace.length; k++) {
            ctx2D.fillRect(p.trace[k].x, p.trace[k].y, 1, 1); // Draw each point in the trace
        }
    }
    window.requestAnimationFrame(animate2DHeart); // Loop the 2D animation
}


// --- Text Animation Functions ---

function animateText() {
    let currentFrameIndex = 0;
    const textFrames = document.querySelectorAll('.sp-content h2');
    const lastFrameSpans = document.querySelectorAll('.sp-content h2.frame-5 span');

    // Show the text container with a fade-in
    textContainer.style.opacity = 1;

    // Function to show the next text frame
    const showNextFrame = () => {
        if (currentFrameIndex < textFrames.length) {
            const currentFrame = textFrames[currentFrameIndex];
            currentFrame.classList.add('active'); // Activate CSS transition

            // Special handling for the last frame (word by word)
            if (currentFrame.classList.contains('frame-5')) {
                let spanIndex = 0;
                const showNextSpan = () => {
                    if (spanIndex < lastFrameSpans.length) {
                        lastFrameSpans[spanIndex].classList.add('active');
                        spanIndex++;
                        setTimeout(showNextSpan, LAST_TEXT_FRAME_DURATION / lastFrameSpans.length); // Divide duration by words
                    } else {
                        // After all words are shown, start the 2D heart animation
                        setTimeout(init2DHeart, 1000); // Small delay before 2D heart appears
                    }
                };
                showNextSpan(); // Start showing words
            } else {
                currentFrameIndex++;
                setTimeout(showNextFrame, TEXT_FRAME_INTERVAL); // Move to next frame after interval
            }
        }
    };

    // Start the text animation sequence
    setTimeout(showNextFrame, TEXT_APPEAR_DELAY);
}

// --- Main Initialization on DOM Content Loaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Get references to elements
    heart2DCanvas = document.getElementById('heart2D');
    textContainer = document.querySelector('.sp-container');
    textFrames = document.querySelectorAll('.sp-content h2');

    // Initial CSS states (handled in style.css, but ensuring here)
    heart2DCanvas.style.opacity = 0;
    textContainer.style.opacity = 0;
    textFrames.forEach(frame => {
        frame.style.opacity = 0;
        frame.style.transform = 'translateY(20px)'; // Reset initial state for transitions
    });
    document.querySelectorAll('.sp-content h2.frame-5 span').forEach(span => {
        span.style.opacity = 0;
        span.style.transform = 'translateY(20px)';
    });

    // Start the text animation
    animateText();
});

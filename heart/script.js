// Polyfill for requestAnimationFrame for broader browser compatibility
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

// Check if the device is mobile
window.isDevice = (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(((navigator.userAgent || navigator.vendor || window.opera)).toLowerCase()));

var loaded = false; // Flag to ensure initialization only happens once

// Initialization function for the canvas animation
var init = function () {
    if (loaded) return; // Prevent multiple initializations
    loaded = true;

    var mobile = window.isDevice;
    var koef = mobile ? 0.5 : 1; // Coefficient to adjust size for mobile devices
    var canvas = document.getElementById('heart'); // Get the canvas element
    var ctx = canvas.getContext('2d'); // Get the 2D rendering context

    // Set canvas dimensions based on window size and mobile coefficient
    var width = canvas.width = koef * innerWidth;
    var height = canvas.height = koef * innerHeight;

    var rand = Math.random; // Shorthand for Math.random

    // Fill the canvas with initial black background
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.fillRect(0, 0, width, height);

    // Function to calculate heart curve position based on an angle (radian)
    var heartPosition = function (rad) {
        // Heart curve parametric equations
        return [Math.pow(Math.sin(rad), 3), -(15 * Math.cos(rad) - 5 * Math.cos(2 * rad) - 2 * Math.cos(3 * rad) - Math.cos(4 * rad))];
    };

    // Function to scale and translate points
    var scaleAndTranslate = function (pos, sx, sy, dx, dy) {
        return [dx + pos[0] * sx, dy + pos[1] * sy];
    };

    // Event listener for window resize to adjust canvas dimensions
    window.addEventListener('resize', function () {
        width = canvas.width = koef * innerWidth;
        height = canvas.height = koef * innerHeight;
        ctx.fillStyle = "rgba(0,0,0,1)";
        ctx.fillRect(0, 0, width, height); // Clear and redraw background on resize
    });

    var traceCount = mobile ? 20 : 50; // Number of trace points for each particle
    var pointsOrigin = []; // Array to store original heart shape points
    var i; // Loop counter
    var dr = mobile ? 0.3 : 0.1; // Delta for radians in heart shape generation

    // Generate points for three different sizes of the heart shape
    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 210, 13, 0, 0));
    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 150, 9, 0, 0));
    for (i = 0; i < Math.PI * 2; i += dr) pointsOrigin.push(scaleAndTranslate(heartPosition(i), 90, 5, 0, 0));

    var heartPointsCount = pointsOrigin.length; // Total number of points defining the heart shape

    var targetPoints = []; // Array to store current target points (pulsing heart)

    // Function to pulse the heart shape, scaling it
    var pulse = function (kx, ky) {
        for (i = 0; i < pointsOrigin.length; i++) {
            targetPoints[i] = [];
            targetPoints[i][0] = kx * pointsOrigin[i][0] + width / 2; // Scale and center X
            targetPoints[i][1] = ky * pointsOrigin[i][1] + height / 2; // Scale and center Y
        }
    };

    var e = []; // Array to store particle (electron-like) objects
    // Initialize particles
    for (i = 0; i < heartPointsCount; i++) {
        var x = rand() * width; // Random initial X position
        var y = rand() * height; // Random initial Y position
        e[i] = {
            vx: 0, // Velocity X
            vy: 0, // Velocity Y
            R: 2, // Radius (not used in drawing, but present)
            speed: rand() + 5, // Speed of the particle
            q: ~~(rand() * heartPointsCount), // Target point index on the heart shape
            D: 2 * (i % 2) - 1, // Direction of movement along the heart points (+1 or -1)
            force: 0.2 * rand() + 0.7, // Force/friction applied to velocity
            f: "hsla(0," + ~~(40 * rand() + 60) + "%," + ~~(60 * rand() + 20) + "%,.3)", // HSL color with alpha
            trace: [] // Array to store trace history for drawing
        };
        // Initialize trace points for each particle
        for (var k = 0; k < traceCount; k++) e[i].trace[k] = {x: x, y: y};
    }

    // Configuration for animation
    var config = {
        traceK: 0.4, // Trace decay factor
        timeDelta: 0.01 // Time step for animation
    };

    var time = 0; // Global time variable for pulsing animation

    // Main animation loop
    var loop = function () {
        // Calculate pulse magnitude based on cosine wave, creating a heartbeat effect
        var n = -Math.cos(time);
        pulse((1 + n) * .5, (1 + n) * .5); // Apply pulse to heart points
        // Update time, making it faster during certain phases of the pulse
        time += ((Math.sin(time)) < 0 ? 9 : (n > 0.8) ? .2 : 1) * config.timeDelta;

        // Gradually clear the canvas with a semi-transparent black to create trailing effect
        ctx.fillStyle = "rgba(0,0,0,.1)";
        ctx.fillRect(0, 0, width, height);

        // Iterate through each particle
        for (i = e.length; i--;) {
            var u = e[i]; // Current particle
            var q = targetPoints[u.q]; // Current target point on the heart

            var dx = u.trace[0].x - q[0]; // Difference in X between particle and target
            var dy = u.trace[0].y - q[1]; // Difference in Y between particle and target
            var length = Math.sqrt(dx * dx + dy * dy); // Distance to target

            // If particle is close to its target point
            if (10 > length) {
                if (0.95 < rand()) {
                    u.q = ~~(rand() * heartPointsCount); // Randomly pick a new target point
                } else {
                    if (0.99 < rand()) {
                        u.D *= -1; // Randomly reverse direction
                    }
                    u.q += u.D; // Move to the next target point in its direction
                    u.q %= heartPointsCount; // Wrap around if index exceeds bounds
                    if (0 > u.q) {
                        u.q += heartPointsCount; // Handle negative wrapped index
                    }
                }
            }

            // Apply force towards the target point
            u.vx += -dx / length * u.speed;
            u.vy += -dy / length * u.speed;

            // Update particle position based on velocity
            u.trace[0].x += u.vx;
            u.trace[0].y += u.vy;

            // Apply friction/decay to velocity
            u.vx *= u.force;
            u.vy *= u.force;

            // Update trace points (particle's trail)
            for (k = 0; k < u.trace.length - 1;) {
                var T = u.trace[k]; // Current trace point
                var N = u.trace[++k]; // Next trace point
                // Smoothly move the next trace point towards the current one
                N.x -= config.traceK * (N.x - T.x);
                N.y -= config.traceK * (N.y - T.y);
            }

            // Set fill style for the particle and its trace
            ctx.fillStyle = u.f;
            // Draw each point of the particle's trace
            for (k = 0; k < u.trace.length; k++) {
                ctx.fillRect(u.trace[k].x, u.trace[k].y, 1, 1); // Draw a 1x1 rectangle for each trace point
            }
        }
        // Request next animation frame, making the loop continuous
        window.requestAnimationFrame(loop, canvas);
    };

    loop(); // Start the animation loop
};

// Check document ready state and initialize the animation
var s = document.readyState;
if (s === 'complete' || s === 'loaded' || s === 'interactive') init();
else document.addEventListener('DOMContentLoaded', init, false);

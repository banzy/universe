// --- Global Variables ---
let scene, camera, renderer;
let particles, geometry, material;
let bgParticles, bgGeometry, bgMaterial; // Background stars
let sunCore; // Internal glowing core for compressed sun
let basePositions; // Store the original shape positions
let spherePositions; // Store the compressed sphere positions
let currentTemplate = 'galaxy';
const particleCount = 35000;

// Mouse controls
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let targetCameraZ = 250;
let targetCameraX = 0, targetCameraY = 0;
let isMouseDown = false;
let previousMouseX = 0, previousMouseY = 0;

// Hand tracking variables
let handDistance = 1.0; // Normalized distance (0 to 1) between two hands (for SCALING)
let handGesture = 'neutral'; // Current gesture: 'open', 'closed', or 'neutral' (for COLOR/PARTICLE SIZE)
let targetHandPosition = new THREE.Vector3(0, 0, 0); // Target position for particles to follow hand
let targetHandRotationZ = 0; // Target Z-rotation based on hand roll
let targetHandRotationY = 0; // Target Y-rotation based on hand yaw
let lastHandPosition = null; // Used to calculate velocity
let time = 0; // Animation time for plasma effect
const positionSmoothing = 0.15; // Smoothing factor for position following
const rotationSmoothing = 0.1; // Smoothing factor for rotation
const positionScale = 200; // Scale factor to convert normalized hand position to 3D space

// Gesture smoothing to prevent flickering
let gestureHistory = [];
const gestureHistorySize = 5; // Number of frames to consider for smoothing

// Template cycling variables
let lastTemplateChangeTime = 0;
const TEMPLATE_CHANGE_COOLDOWN = 1000; // 1 second cooldown
let lockOnExit = false; // If true, universe keeps state when hands are removed

// --- PARTICLE TEMPLATE DATA ---
// Functions to generate initial particle positions based on a shape.
const templates = {
    galaxy: (pos, i) => {
        // Spiral galaxy with central bulge and spiral arms
        const isBulge = Math.random() < 0.15; // 15% in central bulge

        if (isBulge) {
            // Central bulge - dense sphere
            const r = Math.random() * 25;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            pos.setFromSphericalCoords(r, phi, theta);
        } else {
            // Spiral arms - logarithmic spiral
            const armIndex = Math.floor(Math.random() * 2); // 2 main arms
            const t = Math.random() * Math.PI * 4; // Multiple rotations
            const spiralTightness = 0.3;
            const r = 20 + t * 15; // Radius increases with angle
            const angle = t + armIndex * Math.PI + Math.random() * 0.5; // Spiral angle

            // Add some thickness to the disk
            const diskThickness = 8;
            const z = (Math.random() - 0.5) * diskThickness * (1 - r / 100); // Thinner at edges

            const x = r * Math.cos(angle) * (1 + Math.random() * 0.3);
            const y = r * Math.sin(angle) * (1 + Math.random() * 0.3);
            pos.set(x, y, z);
        }
    },
    spiral: (pos, i) => {
        // Tight spiral galaxy
        const t = (i / particleCount) * Math.PI * 6;
        const r = 15 + t * 12;
        const angle = t * 2;
        const z = (Math.random() - 0.5) * 10;
        pos.set(r * Math.cos(angle), r * Math.sin(angle), z);
    },
    barred: (pos, i) => {
        // Barred spiral galaxy
        const isBar = Math.random() < 0.2; // 20% in central bar

        if (isBar) {
            // Central bar
            const barLength = 40;
            const x = (Math.random() - 0.5) * barLength;
            const y = (Math.random() - 0.5) * 8;
            const z = (Math.random() - 0.5) * 5;
            pos.set(x, y, z);
        } else {
            // Spiral arms from bar ends
            const armSide = Math.random() < 0.5 ? -1 : 1;
            const t = Math.random() * Math.PI * 3;
            const r = 25 + t * 10;
            const angle = t + (armSide * 20) * Math.PI / 180;
            const z = (Math.random() - 0.5) * 8;
            pos.set(r * Math.cos(angle), r * Math.sin(angle), z);
        }
    },
    sphere: (pos, i) => {
        pos.setFromSphericalCoords(
            Math.random() * 80 + 20, // Radius
            Math.acos(Math.random() * 2 - 1), // Phi (latitude)
            Math.random() * Math.PI * 2 // Theta (longitude)
        );
    },
    heart: (pos, i) => {
        // Approximate heart shape using polar/parametric equation
        const t = (i / particleCount) * 2 * Math.PI;
        const scale = 35;
        const x = scale * 16 * Math.pow(Math.sin(t), 3);
        const y = -scale * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const z = (Math.random() - 0.5) * 5; // Slight depth
        pos.set(x, y + 20, z);
    },
    flower: (pos, i) => {
        // A 3D Spirograph/Lissajous Curve for a flower-like structure
        const t = (i / particleCount) * 4 * Math.PI;
        const scale = 25;
        const x = scale * Math.sin(t) * Math.cos(t * 5);
        const y = scale * Math.cos(t) * Math.cos(t * 5);
        const z = scale * Math.sin(t * 5);
        pos.set(x, y, z);
    },
    saturn: (pos, i) => {
        const isRing = Math.random() < 0.7; // 70% in rings
        // Saturn Tilt (~27 degrees)
        const tilt = 27 * Math.PI / 180;
        const cosTilt = Math.cos(tilt);
        const sinTilt = Math.sin(tilt);

        if (isRing) {
            // Rings: Inner 1.2 to Outer 2.3 radii roughly
            // Modeled to look nice relative to planet size 30
            // Gaps: Cassini division roughly at 1.95 - 2.05 radius factor
            
            let r;
            let valid = false;
            while (!valid) {
                 r = Math.random() * 50 + 40; // 40 to 90
                 // Cassini division simulation (gap around 70-75)
                 if (r > 68 && r < 72) {
                     valid = Math.random() < 0.1; // Sparse in gap
                 } else {
                     valid = true;
                 }
            }

            const theta = (i / particleCount) * Math.PI * 2 * 20 + Math.random(); // Even distribution
            
            // Initial Flat Ring (XZ)
            let x = r * Math.cos(theta);
            let y = (Math.random() - 0.5) * 0.5; // Very thin
            let z = r * Math.sin(theta);

            // Apply Tilt
            // Rotate around X axis? Or Z? Saturn tilt is usually shown relative to orbital plane.
            // Let's rotate around Z for visual "tilt"
            
            let xp = x * cosTilt - y * sinTilt;
            let yp = x * sinTilt + y * cosTilt;
            let zp = z;
            
            pos.set(xp, yp, zp);

        } else {
            // Planet Surface (Shell)
            const r = 30; 
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            let x = r * Math.sin(phi) * Math.cos(theta);
            let y = r * Math.cos(phi);
            let z = r * Math.sin(phi) * Math.sin(theta);
            
             // Flatten poles slightly (Saturn is oblate)
            y *= 0.9;

            // Apply Tilt
            let xp = x * cosTilt - y * sinTilt;
            let yp = x * sinTilt + y * cosTilt;
            let zp = z;

            pos.set(xp, yp, zp);
        }
    },
    earth: (pos, i) => {
        // Earth sphere (Shell)
        // Tilt ~23.5 degrees
        const tilt = 23.5 * Math.PI / 180;
        const cosTilt = Math.cos(tilt);
        const sinTilt = Math.sin(tilt);
        
        let r = 35;
        
        // Atmosphere layer (faint halo) 
        if (i % 20 === 0) r = 37; 

        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        
        let x = r * Math.sin(phi) * Math.cos(theta);
        let y = r * Math.cos(phi);
        let z = r * Math.sin(phi) * Math.sin(theta);
        
         // Apply Tilt
        let xp = x * cosTilt - y * sinTilt;
        let yp = x * sinTilt + y * cosTilt;
        let zp = z;

        pos.set(xp, yp, zp);
    },
    buddha: (pos, i) => {
        // Abstract upward flowing, seated shape
        const r = Math.random() * 20;
        const t = Math.random() * Math.PI * 2;
        const y_base = Math.random() * 80;
        const x = r * Math.cos(t) * (1 - y_base / 80);
        const z = r * Math.sin(t) * (1 - y_base / 80);
        pos.set(x, y_base - 40, z);
    },
    fireworks: (pos, i) => {
        // Explosive outward burst from center
        pos.setFromSphericalCoords(
            Math.random() * 100,
            Math.acos(Math.random() * 2 - 1),
            Math.random() * Math.PI * 2
        );
    }
};
const templateKeys = Object.keys(templates);

// --- THREE.JS INITIALIZATION ---
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1a1a, 0.002);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = targetCameraZ;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Mouse event listeners
    setupMouseControls();

    // Create initial particle system
    createParticles();
    
    // Create background stars
    createBackgroundStars();

    // Create Sun Core (hidden initially)
    const coreGeo = new THREE.SphereGeometry(25, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: 0xff4500, // OrangeRed
        transparent: true,
        opacity: 0.4, // Reduced opacity
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    sunCore = new THREE.Mesh(coreGeo, coreMat);
    sunCore.scale.set(0, 0, 0);
    scene.add(sunCore);

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    document.getElementById('template-selector').addEventListener('change', changeTemplate);
    document.getElementById('color-selector').addEventListener('input', changeColor);
    document.getElementById('lock-toggle').addEventListener('change', (e) => lockOnExit = e.target.checked);

    // Start the animation loop
    animate();
}

// --- MOUSE CONTROLS ---
function setupMouseControls() {
    // Mouse movement for rotation
    document.addEventListener('mousemove', onMouseMove);

    // Mouse down/up for drag control
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Scroll wheel for zoom
    renderer.domElement.addEventListener('wheel', onMouseWheel);
}

function onMouseMove(event) {
    mouseX = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
    mouseY = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);

    if (isMouseDown) {
        // Drag to rotate the particle system AND move camera
        const deltaX = event.clientX - previousMouseX;
        const deltaY = event.clientY - previousMouseY;

        // Rotate particles
        targetRotationY += deltaX * 0.01;
        targetRotationX += deltaY * 0.01;

        // Move camera orbit around particles
        const moveSpeed = 2;
        targetCameraX += deltaX * moveSpeed;
        targetCameraY -= deltaY * moveSpeed; // Invert for natural movement

        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    }
}

function onMouseDown(event) {
    isMouseDown = true;
    previousMouseX = event.clientX;
    previousMouseY = event.clientY;
}

function onMouseUp(event) {
    isMouseDown = false;
}

function onMouseWheel(event) {
    event.preventDefault();

    // Zoom in/out with scroll wheel
    const zoomSpeed = 10;
    if (event.deltaY > 0) {
        // Scroll down - zoom out
        targetCameraZ = Math.min(targetCameraZ + zoomSpeed, 500);
    } else {
        // Scroll up - zoom in
        targetCameraZ = Math.max(targetCameraZ - zoomSpeed, 50);
    }
}

/**
 * Generates galaxy-like colors based on position
 * Center: Warm yellow/white (old stars)
 * Spiral arms: Blue-white, cyan (young stars, star-forming regions)
 * Outer regions: Darker blues and purples
 * @param {THREE.Vector3} position - Particle position for color variation
 * @returns {THREE.Color} A galaxy-like color
 */
function getGalaxyColor(position) {
    // Calculate distance from center
    const distance = Math.sqrt(position.x * position.x + position.y * position.y + position.z * position.z);
    const maxDistance = 100; // Approximate max distance
    const normalizedDist = Math.min(distance / maxDistance, 1.0);

    // Galaxy color palette - more realistic
    const centerColors = [
        new THREE.Color(1.0, 0.95, 0.85),    // Warm white (old stars in bulge)
        new THREE.Color(1.0, 0.9, 0.75),     // Yellow-white
        new THREE.Color(0.95, 0.85, 0.7),   // Golden
    ];

    const armColors = [
        new THREE.Color(0.9, 0.95, 1.0),     // Blue-white (young stars)
        new THREE.Color(0.7, 0.85, 1.0),    // Light blue
        new THREE.Color(0.5, 0.7, 1.0),      // Blue
        new THREE.Color(0.6, 0.8, 1.0),      // Cyan-blue
    ];

    const outerColors = [
        new THREE.Color(0.4, 0.5, 0.8),      // Deep blue
        new THREE.Color(0.5, 0.4, 0.7),     // Purple-blue
        new THREE.Color(0.6, 0.5, 0.8),     // Lavender
    ];

    let finalColor;

    // Center region (bulge) - warm colors
    if (normalizedDist < 0.25) {
        const colorIndex = Math.floor(Math.random() * centerColors.length);
        finalColor = centerColors[colorIndex].clone();
        // Make center brighter
        finalColor.multiplyScalar(1.1 + Math.random() * 0.2);
    }
    // Spiral arms - blue-white, cyan
    else if (normalizedDist < 0.7) {
        const colorIndex = Math.floor(Math.random() * armColors.length);
        finalColor = armColors[colorIndex].clone();
        // Vary brightness for star clusters
        finalColor.multiplyScalar(0.9 + Math.random() * 0.3);
    }
    // Outer regions - darker blues and purples
    else {
        const colorIndex = Math.floor(Math.random() * outerColors.length);
        finalColor = outerColors[colorIndex].clone();
        // Outer regions are dimmer
        finalColor.multiplyScalar(0.7 + Math.random() * 0.2);
    }

    // Add some random variation for individual stars
    const starVariation = 0.1;
    finalColor.r += (Math.random() - 0.5) * starVariation;
    finalColor.g += (Math.random() - 0.5) * starVariation;
    finalColor.b += (Math.random() - 0.5) * starVariation;

    // Clamp to valid range
    finalColor.r = Math.max(0.0, Math.min(1.0, finalColor.r));
    finalColor.g = Math.max(0.0, Math.min(1.0, finalColor.g));
    finalColor.b = Math.max(0.0, Math.min(1.0, finalColor.b));

    return finalColor;
}

function getSaturnColor(position) {
    // Reverse tilt to get local latitude
    // Tilt was ~27 deg around Z. (Or we can just rely on distance/bands relative to rotated center)
    // Simpler: Just check distance from center (rings) vs sphere.
    
    // Check if particle is part of the rings or body based on geometry
    // Ring radius > 40. Planet < 30 (ish).
    const distSq = position.x * position.x + position.y * position.y + position.z * position.z;
    const dist = Math.sqrt(distSq);
    
    if (dist > 35) { // Rings
       // Ring Colors based on radius
       // Use distance from center to determine band
       const band = dist;
       let c;
       if (band > 68 && band < 72) {
           // Cassini gap - Darker
           c = new THREE.Color(0.1, 0.1, 0.1);
       } else if ((band > 45 && band < 55) || (band > 75 && band < 85)) {
           // Brighter bands
           c = new THREE.Color(0.85, 0.8, 0.7);
       } else {
           // Standard ring color
           c = new THREE.Color(0.75, 0.65, 0.5);
       }
       // Add noise
       c.multiplyScalar(0.8 + Math.random() * 0.4);
       return c;
    } 
    
    // Planet body
    // We need "latitude" relative to the tilt.
    // Tilt was rotation around Z by 27 deg.
    // We can rotate point back to axis-aligned to get latitude.
    const tilt = -27 * Math.PI / 180; // Invert tilt
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    
    // Rotating around Z
    // x' = x cos - y sin
    // y' = x sin + y cos
    const localY = position.x * sinT + position.y * cosT;
    const absY = Math.abs(localY);
    
    let color;
    if (absY > 25) { // Hexagon/Pole
        color = new THREE.Color(0.35, 0.35, 0.3); // Gray-ish
    } else if (absY > 18) {
         color = new THREE.Color(0.7, 0.65, 0.5);
    } else if (absY > 10) {
         color = new THREE.Color(0.8, 0.7, 0.5);
    } else if (absY > 3) {
         color = new THREE.Color(0.85, 0.75, 0.55);
    } else {
         color = new THREE.Color(0.9, 0.8, 0.6); // Equator
    }
    
    color.multiplyScalar(0.9 + Math.random() * 0.2);
    return color;
}

function getEarthColor(position) {
    // Reverse tilt to get texture coordinates
    const tilt = -23.5 * Math.PI / 180;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    
    const localX = position.x * cosT - position.y * sinT;
    const localY = position.x * sinT + position.y * cosT;
    const localZ = position.z;
    
    const dist = Math.sqrt(localX*localX + localY*localY + localZ*localZ);
    
    // Atmosphere/Clouds for outer shell (radius > 36)
    if (dist > 36) {
        return new THREE.Color(1.0, 1.0, 1.0); // White clouds
    }

    const lat = localY; // -35 to 35 roughly
    const absLat = Math.abs(lat);
    
    // Poles
    if (absLat > 28) {
        return new THREE.Color(0.95, 0.98, 1.0); // Ice
    }
    
    // Noise for continents
    // Scale inputs to get decent islands/continents
    const nX = localX * 0.12;
    const nY = localY * 0.12;
    const nZ = localZ * 0.12;
    
    // Simple 3D noise approximation using sin waves
    const noise = Math.sin(nX) * Math.cos(nY) + 
                  Math.sin(nY*2.1 + nZ) * 0.5 + 
                  Math.cos(nZ*1.5 + nX) * 0.3;
                  
    // Add Clouds randomly
    if (Math.random() > 0.95) {
         return new THREE.Color(1.0, 1.0, 1.0);
    }

    if (noise > 0.2) {
        // Land
        if (noise > 0.6 && absLat < 20) {
            return new THREE.Color(0.05, 0.35, 0.05); // Jungle
        } else if (absLat < 22) {
             return new THREE.Color(0.2, 0.5, 0.2); // Green
        } else if (absLat > 25) {
             return new THREE.Color(0.6, 0.6, 0.6); // Tundra/Mountain
        } else {
             return new THREE.Color(0.5, 0.4, 0.25); // Dirt/Plains
        }
    } else {
        // Ocean
        // Depth based on noise?
        if (noise < -0.5) {
             return new THREE.Color(0.0, 0.1, 0.4); // Deep
        }
        return new THREE.Color(0.0, 0.3, 0.7); // Shallow
    }
}

// --- PARTICLE SPRITE TEXTURE ---
function createStarTexture() {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const center = size / 2;
    const radius = size / 2;

    const gradient = ctx.createRadialGradient(
        center,
        center,
        0,
        center,
        center,
        radius
    );

    gradient.addColorStop(0.0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.9)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
    gradient.addColorStop(1.0, 'rgba(255,255,255,0)');

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    return texture;
}

// --- PARTICLE SYSTEM CREATION ---
function createParticles() {
    if (particles) {
        scene.remove(particles);
        geometry.dispose();
        material.dispose();
    }

    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const position = new THREE.Vector3();

    // Populate initial positions and colors based on the current template
    for (let i = 0; i < particleCount; i++) {
        templates[currentTemplate](position, i);

        positions[i * 3] = position.x;
        positions[i * 3 + 1] = position.y;
        positions[i * 3 + 2] = position.z;

        // Assign color based on template
        let color;
        if (currentTemplate === 'saturn') {
            color = getSaturnColor(position);
        } else if (currentTemplate === 'earth') {
            color = getEarthColor(position);
        } else {
            color = getGalaxyColor(position);
        }
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    // Save base positions for morphing back
    basePositions = new Float32Array(positions);
    
    // Pre-calculate compressed sphere positions
    spherePositions = new Float32Array(particleCount * 3);
    const tempVec = new THREE.Vector3();
    for (let i = 0; i < particleCount; i++) {
        tempVec.setFromSphericalCoords(
            Math.random() * 30, // Small dense sphere
            Math.acos(Math.random() * 2 - 1),
            Math.random() * Math.PI * 2
        );
        spherePositions[i * 3] = tempVec.x;
        spherePositions[i * 3 + 1] = tempVec.y;
        spherePositions[i * 3 + 2] = tempVec.z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Material with vertex colors enabled for galaxy gradients
    material = new THREE.PointsMaterial({
        color: 0xffffff, // White base (multiplies with vertex colors)
        size: 1.9, // Slightly larger for textured stars
        map: createStarTexture(), // Soft radial sprite
        alphaTest: 0.01,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        transparent: true,
        sizeAttenuation: true,
        vertexColors: true, // Enable vertex colors for galaxy gradients
        opacity: 1.0
    });

    // Points
    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

// --- CONTROL FUNCTIONS ---

function changeTemplate(event) {
    currentTemplate = event.target.value;
    createParticles(); // Recreate particles with new shape
}

function changeColor(event) {
    // Apply color selector as a tint over the universe gradient colors
    const selectedColor = new THREE.Color(event.target.value);
    material.color.lerp(selectedColor, 0.3); // Smooth transition
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


/**
 * Explodes the particles outward without changing the underlying template state.
 */
function explodeUniverse() {
    const positions = particles.geometry.attributes.position.array;
    const count = positions.length / 3;
    const tempPos = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
        // Random spherical explosion
        tempPos.setFromSphericalCoords(
            Math.random() * 300 + 50, // Huge radius for explosion
            Math.acos(Math.random() * 2 - 1),
            Math.random() * Math.PI * 2
        );
        
        positions[i * 3] = tempPos.x;
        positions[i * 3 + 1] = tempPos.y;
        positions[i * 3 + 2] = tempPos.z;
    }
    
    particles.geometry.attributes.position.needsUpdate = true;
}

function createBackgroundStars() {
    const bgCount = 10000;
    bgGeometry = new THREE.BufferGeometry();
    const bgPositions = new Float32Array(bgCount * 3);

    const tempPos = new THREE.Vector3();
    for (let i = 0; i < bgCount; i++) {
        // Random spherical distribution far away
        tempPos.setFromSphericalCoords(
            Math.random() * 400 + 400, // Radius 400-800
            Math.acos(Math.random() * 2 - 1),
            Math.random() * Math.PI * 2
        );
        bgPositions[i * 3] = tempPos.x;
        bgPositions[i * 3 + 1] = tempPos.y;
        bgPositions[i * 3 + 2] = tempPos.z;
    }

    bgGeometry.setAttribute('position', new THREE.BufferAttribute(bgPositions, 3));

    bgMaterial = new THREE.PointsMaterial({
        color: 0x888888, // Dim white/gray
        size: 2.0, // Slightly larger to compensate for soft texture
        map: createStarTexture(), // Use texture to make them round
        transparent: true,
        opacity: 0.6,
        alphaTest: 0.05, // Helps with sorting/visuals
        sizeAttenuation: true
    });

    bgParticles = new THREE.Points(bgGeometry, bgMaterial);
    scene.add(bgParticles);
}

// --- GESTURE DETECTION FUNCTIONS ---

/**
 * Checks if fingers are extended by comparing fingertip to middle joint position.
 * MediaPipe hand landmarks: https://google.github.io/mediapipe/solutions/hands.html
 * @param {Array<Object>} handLandmarks - The 21 hand landmarks from MediaPipe.
 * @param {number} tipIndex - Index of fingertip landmark
 * @param {number} pipIndex - Index of middle joint (PIP) landmark
 * @returns {boolean} true if finger is extended
 */
function isFingerExtended(handLandmarks, tipIndex, pipIndex) {
    const tip = handLandmarks[tipIndex];
    const pip = handLandmarks[pipIndex];
    // Finger is extended if tip is above (higher Y value = lower on screen) the middle joint
    return tip.y < pip.y;
}

/**
 * Improved gesture detection using multiple fingers.
 * Checks if hand is open, closed, or making specific signs.
 * @param {Array<Object>} handLandmarks - The 21 hand landmarks from MediaPipe.
 * @returns {string} 'open', 'closed', 'peace', or 'neutral'
 */
function detectGesture(handLandmarks) {
    // MediaPipe hand landmark indices:
    // Thumb: 4 (tip), 3 (PIP)
    // Index: 8 (tip), 6 (PIP)
    // Middle: 12 (tip), 10 (PIP)
    // Ring: 16 (tip), 14 (PIP)
    // Pinky: 20 (tip), 18 (PIP)

    const thumbExtended = isFingerExtended(handLandmarks, 4, 3);
    const indexExtended = isFingerExtended(handLandmarks, 8, 6);
    const middleExtended = isFingerExtended(handLandmarks, 12, 10);
    const ringExtended = isFingerExtended(handLandmarks, 16, 14);
    const pinkyExtended = isFingerExtended(handLandmarks, 20, 18);

    // Count extended fingers (excluding thumb for more reliable detection)
    const extendedFingers = [indexExtended, middleExtended, ringExtended, pinkyExtended].filter(Boolean).length;

    // Peace Sign: Index & Middle extended, Ring curled.
    // (We ignore pinky state to be more forgiving, as it's hard to curl independently for some)
    if (indexExtended && middleExtended && !ringExtended) {
        return 'peace';
    }

    // Open hand: 3-4 fingers extended (allowing for some flexibility)
    if (extendedFingers >= 3) {
        return 'open';
    }
    // Closed fist: 0-1 fingers extended (allows for thumb or one stray finger)
    else if (extendedFingers <= 1) {
        return 'closed';
    }
    // Neutral: 2 fingers extended (partial gesture)
    else {
        return 'neutral';
    }
}

/**
 * Smooths gesture detection by using history to prevent flickering.
 * @param {string} newGesture - The newly detected gesture
 * @returns {string} The smoothed gesture result
 */
function smoothGesture(newGesture) {
    gestureHistory.push(newGesture);
    if (gestureHistory.length > gestureHistorySize) {
        gestureHistory.shift();
    }

    // Count occurrences of each gesture
    const counts = { 'open': 0, 'closed': 0, 'neutral': 0, 'peace': 0 };
    gestureHistory.forEach(g => {
        if (counts[g] !== undefined) counts[g]++;
    });

    // Return the most common gesture in recent history
    let maxCount = 0;
    let result = 'neutral';
    for (const [gesture, count] of Object.entries(counts)) {
        if (count > maxCount) {
            maxCount = count;
            result = gesture;
        }
    }

    return result;
}

/**
 * Updates the target position for particles to follow hand movement.
 * @param {Array<Object>} handLandmarks - The 21 hand landmarks from MediaPipe.
 */
function updateHandPosition(handLandmarks) {
    // Use the wrist (landmark 0) for tracking movement
    // Convert normalized coordinates (0-1) to 3D space coordinates
    // X: -1 to 1 (left to right), Y: 1 to -1 (top to bottom, inverted), Z: depth
    targetHandPosition.set(
        (handLandmarks[0].x - 0.5) * positionScale, // Center at 0, scale to world space
        (0.5 - handLandmarks[0].y) * positionScale, // Invert Y and center at 0
        handLandmarks[0].z * positionScale * 0.5 // Use Z depth for forward/backward
    );
}

/**
 * Calculates the roll angle of the hand to control Z-axis rotation.
 * Uses the angle between the Wrist (0) and the Middle Finger Knuckle (MCP, 9).
 * @param {Array<Object>} handLandmarks - The 21 hand landmarks.
 * @returns {number} The angle in radians.
 */
function getHandRoll(handLandmarks) {
    // Landmark 0: Wrist
    // Landmark 9: Middle Finger MCP (knuckle)
    const p1 = handLandmarks[0];
    const p2 = handLandmarks[9];

    // Calculate angle. 
    // In screen coordinates: X is right, Y is down.
    // We want 0 radians to be "up" (vertical hand), so we offset or swap x/y.
    // Standard atan2(y, x) gives angle from positive X axis.
    // vector p1->p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // We want the angle relative to "UP" (-Y in screen coords).
    // Math.atan2(dy, dx) + Math.PI / 2 usually works to orient "up" as 0.
    // Because screen Y is inverted (down is positive), "UP" is negative Y.
    // Let's just use raw atan2 and calibrate.
    // A vertical hand (fingers up): dx=0, dy < 0. atan2(-1, 0) = -PI/2.
    // To make this 0, add PI/2.
    return Math.atan2(dy, dx) + Math.PI / 2;
}

/**
 * Calculates the yaw angle (left/right turn) of the hand to control Y-axis rotation.
 * Uses the Z-depth difference between Index MCP (5) and Pinky MCP (17).
 * @param {Array<Object>} handLandmarks - The 21 hand landmarks.
 * @returns {number} The estimated yaw angle in radians.
 */
function getHandYaw(handLandmarks) {
    // Landmark 5: Index Finger MCP
    // Landmark 17: Pinky Finger MCP
    const indexMCP = handLandmarks[5];
    const pinkyMCP = handLandmarks[17];

    // Determine direction. 
    // If Index (5) is deeper (more negative Z usually, but check MediaPipe coords) 
    // MediaPipe Z: "origin at wrist, smaller value is closer to camera". 
    // Wait, documentation says: "Z represents depth... keeping the origin at the wrist."
    // Actually, usually in MP: negative Z is closer to camera? or positive?
    // Let's test: if index is 'behind' pinky, hand is turned one way.
    
    // Using simple difference scaled up.
    // Sensitivity might need tuning.
    const sensitivity = 8.0; 
    return (indexMCP.z - pinkyMCP.z) * sensitivity;
}

// --- ANIMATION LOOP ---
function animate() {
    requestAnimationFrame(animate);
    time += 0.05; // Increment time for animation

    // 1. Apply mouse controls
    // Smooth camera zoom and position
    camera.position.z += (targetCameraZ - camera.position.z) * 0.1;
    camera.position.x += (targetCameraX - camera.position.x) * 0.05;
    camera.position.y += (targetCameraY - camera.position.y) * 0.05;

    // Apply mouse rotation when dragging
    if (isMouseDown) {
        particles.rotation.x += (targetRotationX - particles.rotation.x) * 0.05;
        particles.rotation.y += (targetRotationY - particles.rotation.y) * 0.05;
    } else {
        // Auto-rotation when not dragging
        // Auto-rotation when not dragging
        // If a hand is present and operating, we override this with hand rotation
        if (gestureHistory.length > 0) {
             // Hand control active
             
             // Smoothly rotate Z to match hand Roll
             particles.rotation.z += (targetHandRotationZ - particles.rotation.z) * rotationSmoothing;
             
             // Smoothly rotate Y to match hand Yaw
             // We add to Y rotation continuously like a steering input, OR map absolutely?
             // User asked "rotate the hand on Z and Y axis and the universe must match".
             // "Match" implies absolute mapping (1:1ish). 
             // If I turn my hand 45 deg, universe should be 45 deg? 
             // OR does turning hand add velocity? 
             // "Match" likely means orientation mapping.
             particles.rotation.y += (targetHandRotationY - particles.rotation.y) * rotationSmoothing;

        } else {
             // Default ambient rotation
             // Always apply subtle rotation, even if locked (user request)
             particles.rotation.y += 0.0008; 
             particles.rotation.z += 0.0001; 
        }
    }

    // 2. Real-time Gesture Response (Scaling/Expansion)
    let targetScale = 1.0;

    // Two hands: scale based on distance between hands
    if (handGesture === 'neutral' && handDistance !== 0.5) {
        const minScale = 0.5;
        const maxScale = 2.0;
        targetScale = minScale + (maxScale - minScale) * handDistance;
    }
    // One hand: expand when hand is open
    else if (handGesture === 'open') {
        targetScale = 2.5; // Expand when hand is extended/open
    } else if (handGesture === 'closed') {
        targetScale = 0.7; // Shrink when hand is closed
    }

    particles.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);

    // 3. Open/Close Hand Response (Color Tint - uses one hand)
    // Use material color as a tint/multiplier over vertex colors for gradient effect
    let targetTintColor;
    if (handGesture === 'closed') {
        // Closed Fist: Yellow-Orange tint (COMPRESSING)
        // High Red, medium Green, low Blue -> warm glow
        targetTintColor = new THREE.Color(1.5, 0.9, 0.2); 
        material.size = 1.0;
    } else if (handGesture === 'open') {
        // Open Palm: Cyan tint (EXPANDING)
        targetTintColor = new THREE.Color(0.5, 1.0, 1.3);
        material.size = 3.0;
    } else {
        // Neutral/Default state: Use white tint to preserve galaxy gradient
        targetTintColor = new THREE.Color(1.0, 1.0, 1.0);
        material.size = 1.8;
    }
    // Smoothly transition to target tint color
    material.color.lerp(targetTintColor, 0.15);

    // Ensure material color never goes too low (minimum 0.3 to keep particles visible)
    material.color.r = Math.max(0.3, material.color.r);
    material.color.g = Math.max(0.3, material.color.g);
    material.color.b = Math.max(0.3, material.color.b);

    // 4. Peace Sign Response (Explode Universe)
    if (handGesture === 'peace') {
        explodeUniverse();
    }
    
    // 5. Gesture Responses (Morphing) & Core Animation
    const currentPositions = particles.geometry.attributes.position.array;
    const count = particleCount; // Optimization
    const morphSpeed = 0.08; // Slightly slower for dramatic effect
    
    // Core animation logic
    let targetCoreScale = 0;
    
    if (handGesture === 'closed') {
        targetCoreScale = 0.8 + Math.sin(time * 0.5) * 0.1; // Pulse, smaller base scale
        
        // ✊ CLOSED FIST: Morph into Living Sun (Plasma Sphere)
        // We calculate the target position dynamically based on time
        
        // Re-use the pre-calculated sphere coordinates but add noise
        // Note: spherePositions array is just raw XYZ. We need spherical coords for clean noise.
        // To save perf, we can just use the index `i` as a pseudo-coordinate or re-calculate.
        // Re-calculating spherical coords for 20k particles per frame is heavy? 
        // JS is fast enough. Let's try or use a cheat.
        // Cheat: Use the stored XYZ and add noise based on position.
        
        for(let i = 0; i < count; i++) {
            const ix = i * 3;
            const iy = i * 3 + 1;
            const iz = i * 3 + 2;
            
            const bx = spherePositions[ix];
            const by = spherePositions[iy];
            const bz = spherePositions[iz];

            // Simple vertex displacement noise
            // Pulse radius
            const dist = Math.sqrt(bx*bx + by*by + bz*bz);
            // Normalized direction
            const nx = bx / dist;
            const ny = by / dist;
            const nz = bz / dist;

            // Perlin-ish noise using sine waves
            // Frequencies and speeds
            const noise = Math.sin(nx * 4 + time) * Math.cos(ny * 4 + time) * Math.sin(nz * 4 + time * 1.5) +
                          Math.sin(nx * 10 - time * 2) * 0.5;
            
            const scaleVar = 1.0 + noise * 0.05; // 5% surface variation (subtle pulse)

            // Target is the sphere position * dynamic scale
            // We lerp current position towards this dynamic target
            currentPositions[ix] += (bx * scaleVar - currentPositions[ix]) * morphSpeed;
            currentPositions[iy] += (by * scaleVar - currentPositions[iy]) * morphSpeed;
            currentPositions[iz] += (bz * scaleVar - currentPositions[iz]) * morphSpeed;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    } 
    else if (handGesture === 'open') { 
        targetCoreScale = 0;
        // ✋ OPEN HAND: Reform the Galaxy (Return to original shape)
        for(let i = 0; i < count * 3; i++) {
            currentPositions[i] += (basePositions[i] - currentPositions[i]) * morphSpeed;
        }
        particles.geometry.attributes.position.needsUpdate = true;
    }
    // NEUTRAL: targetScale 0
    else {
        targetCoreScale = 0;
    }

    // Animate Core Scale & Position
    sunCore.scale.lerp(new THREE.Vector3(targetCoreScale, targetCoreScale, targetCoreScale), 0.1);
    sunCore.position.copy(particles.position); // Core follows the main system center
    sunCore.rotation.copy(particles.rotation); // Rotate with system

    // 6. Direct Hand Position Control - particles follow hand movement
    particles.position.lerp(targetHandPosition, positionSmoothing);
    
    // Update core position to allow it to move with hand logic if needed
    // Actually particles.position matches hand, so sunCore following particles is correct.

    // 6. Render
    renderer.render(scene, camera);
}

// --- MEDIAPIPE HAND TRACKING INTEGRATION ---

const video = document.getElementById('webcam-video');
const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
});

hands.setOptions({
    maxNumHands: 2, // Crucial for detecting two hands
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
});

hands.onResults(onResults);

const camera_mp = new Camera(video, {
    onFrame: async () => {
        await hands.send({ image: video });
    },
    width: 640,
    height: 480
});
camera_mp.start();

function onResults(results) {
    const landmarks = results.multiHandLandmarks;

    // --- TWO HAND LOGIC (Scaling/Expansion) ---
    if (landmarks && landmarks.length === 2) {
        const hand1 = landmarks[0];
        const hand2 = landmarks[1];
        const wrist1 = hand1[0];
        const wrist2 = hand2[0];

        const dx = wrist1.x - wrist2.x;
        const dy = wrist1.y - wrist2.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        const MIN_DIST = 0.05;
        const MAX_DIST = 0.7;
        handDistance = Math.max(0, Math.min(1, (distance - MIN_DIST) / (MAX_DIST - MIN_DIST)));

        // Use average position of both hands for movement
        const avgX = (wrist1.x + wrist2.x) / 2;
        const avgY = (wrist1.y + wrist2.y) / 2;
        const avgZ = (wrist1.z + wrist2.z) / 2;
        targetHandPosition.set(
            (avgX - 0.5) * positionScale,
            (0.5 - avgY) * positionScale,
            avgZ * positionScale * 0.5
        );

        // Reset single-hand gesture
        handGesture = 'neutral';
        gestureHistory = []; // Clear gesture history when two hands detected

        // --- ONE HAND LOGIC (Open/Closed and Movement) ---
    } else if (landmarks && landmarks.length === 1) {
        const hand = landmarks[0];

        // A. Detect Open/Close/Peace with smoothing
        const detectedGesture = detectGesture(hand);
        handGesture = smoothGesture(detectedGesture);

        // B. Update hand position for particle movement
        updateHandPosition(hand);
        
        // C. Calculate Hand Rotation (Roll & Yaw)
        targetHandRotationZ = -getHandRoll(hand); // Invert Roll for natural feel
        targetHandRotationY = getHandYaw(hand) * 2.0; // Scale Yaw effect

        // Reset two-hand distance to neutral scale
        handDistance = 0.5;

    } else {
        // No hands detected
        if (!lockOnExit) {
            // Smoothly return to center/neutral if NOT locked
            handDistance = 0.5;
            handGesture = smoothGesture('neutral');
            targetHandPosition.lerp(new THREE.Vector3(0, 0, 0), 0.1);
        }
        
        lastHandPosition = null;
        gestureHistory = []; // Clear gesture history when no hands detected
    }
}

// --- START THE APPLICATION ---
init();

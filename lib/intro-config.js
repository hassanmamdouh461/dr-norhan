// Configuration file for the Transition Scribble Intro animation

export const INTRO_COLORS = [
    { name: 'gravityBlue', value: '#101EC5', isLight: false },
    { name: 'deepSpace', value: '#0A1128', isLight: false },
    { name: 'surfaceNavy', value: '#141D3D', isLight: false },
    { name: 'cosmicIndigo', value: '#1E1B4B', isLight: false },
    { name: 'darkNebula', value: '#0B1E48', isLight: false },
    { name: 'midnightVoid', value: '#060A1A', isLight: false }
];

export const DEFAULT_INTRO_CONFIG = {
    // Animation timing (in seconds)
    durationIn: 2.0,       // Duration to completely paint over the screen
    durationOut: 2.5,      // Duration to wipe/undraw away
    delayBeforeOut: 0.2,   // Pause at peak coverage before undrawing

    // SVG stroke thickness relative to viewport
    strokeWidthStart: '8%',
    strokeWidthMax: '32%',
    scale: 0.7,

    // Center logo wiggle settings
    wiggleIntensity: 6,    // Rotation degrees
    wiggleSpeed: 0.14,     // Seconds per wiggle swing

    // Auto run when component mounts
    autoPlay: true,
    autoPlayDelay: 100,    // Delay in ms

    // When true, skip the draw-in and start the timeline with the screen
    // already fully covered (path fully drawn, logo at full opacity, body has
    // `is-transitioning`). The visitor sees the covered state for
    // `startCoveredHold` seconds, then the scribble wipes away as normal.
    // Total length drops from ~4.5s to ~startCoveredHold + durationOut.
    startCovered: true,
    startCoveredHold: 0.9,
};

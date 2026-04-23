/**
 * SECTION 3 (THE PROBLEM) ANIMATION CONFIGURATION
 * 
 * This file controls the timing and "In/Out" points for the typewriter 
 * animations and the scroll-linked transitions of Section 3.
 * 
 * All 'PROGRESS' values are between 0.0 and 1.0, representing the 
 * scroll journey from the start to the end of Section 3.
 */

export const PROBLEM_CONFIG = {
    // 1. SCROLL WINDOW (Measured in 'vh' - Viewport Height)
    SCROLL: {
        START_VH: 600,       // When Section 3 starts pinning/revealing (default 600vh)
        DURATION_VH: 400,    // How long the section stays fixed (default 400vh)
        TIMELINE_OFFSET_VH: 350, // How much the Timeline content is pushed down (default 350vh)
    },

    // 2. TEXT ANIMATION PHASES (Scroll Progress from 0.0 to 1.0)
    PHASES: {
        HEADLINE_IN: 0.10,    // When first line starts typing
        SUBHEADLINE_IN: 0.35, // When second line / subheadline starts typing
        HOLD_START: 0.60,      // When all text is visible and "waits"
        ERASE_START: 0.85,     // When text starts reversing/erasing
        CLEARED_START: 0.94,   // When text is completely gone (timeline arrives)
    },

    // 3. TEXT SETTINGS
    TEXT: {
        HEADLINE_1: "MOST BUSINESSES ARE",
        HEADLINE_2: "STILL DOING IT MANUALLY.",
        SUBHEADLINE: "Every hour your team repeats a task, that's revenue you're losing.",

        // Font Sizes
        HEADLINE_SIZE_MOBILE: "48px",
        HEADLINE_SIZE_DESKTOP: "54px",
        SUBHEADLINE_SIZE: "24px",

        // Animation Speeds
        TYPE_SPEED: 0.03,      // Lower = Faster
        ERASE_SPEED: 0.015,    // Speed during reverse animation
    },

    // 4. LAYERING
    Z_INDEX: {
        SECTION: 10,
        TIMELINE: 20,
    }
};

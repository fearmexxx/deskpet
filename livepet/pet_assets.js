// Dynamic SVG Pet Assets and Animations
// Designed to keep the extension ultra-lightweight, customizable, and scalable.

function getSkinGradientStops(skin, defaultStop1, defaultStop2) {
  let stop1 = defaultStop1;
  let stop2 = defaultStop2;
  let customDefs = "";

  if (skin === "neon-cyan") {
    stop1 = "#00e5ff";
    stop2 = "#0088ff";
  } else if (skin === "neon-pink") {
    stop1 = "#ff007f";
    stop2 = "#e60067";
  } else if (skin === "neon-green") {
    stop1 = "#39ff14";
    stop2 = "#00ff87";
  } else if (skin === "neon-gold") {
    stop1 = "#ffd700";
    stop2 = "#ffa500";
  } else if (skin === "neon-purple") {
    stop1 = "#9945ff";
    stop2 = "#d600ff";
  } else if (skin === "neon-matrix") {
    stop1 = "#0d0d0d";
    stop2 = "#39ff14";
  } else if (skin === "neon-rainbow") {
    customDefs = `
      <linearGradient id="catGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff007f" />
        <stop offset="20%" stop-color="#ff9100" />
        <stop offset="40%" stop-color="#ffd600" />
        <stop offset="60%" stop-color="#39ff14" />
        <stop offset="80%" stop-color="#00e5ff" />
        <stop offset="100%" stop-color="#9945ff" />
      </linearGradient>
      <linearGradient id="dogGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff007f" />
        <stop offset="20%" stop-color="#ff9100" />
        <stop offset="40%" stop-color="#ffd600" />
        <stop offset="60%" stop-color="#39ff14" />
        <stop offset="80%" stop-color="#00e5ff" />
        <stop offset="100%" stop-color="#9945ff" />
      </linearGradient>
      <linearGradient id="bunnyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ff007f" />
        <stop offset="20%" stop-color="#ff9100" />
        <stop offset="40%" stop-color="#ffd600" />
        <stop offset="60%" stop-color="#39ff14" />
        <stop offset="80%" stop-color="#00e5ff" />
        <stop offset="100%" stop-color="#9945ff" />
      </linearGradient>
    `;
  }
  return { stop1, stop2, customDefs };
}

const PET_ASSETS = {
  "sol-cat": {
    name: "Sol-Cat",
    theme: {
      primary: "#14F195", // Solana Green
      secondary: "#9945FF", // Solana Purple
      accent: "#00E5FF", // Cyan
      background: "linear-gradient(135deg, #14F195, #9945FF)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.75 : stage === "Teen" ? 0.95 : 1.15;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";
      
      const skinGradient = getSkinGradientStops(skin, "#9945FF", "#14F195");
      const eyeColor = isHappy ? "#00E5FF" : skinGradient.stop2;

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="transform: scale(${scale}); width: 100px; height: 100px; overflow: visible;">
          <defs>
            ${skinGradient.customDefs ? skinGradient.customDefs : `
              <linearGradient id="catGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${skinGradient.stop1}" />
                <stop offset="100%" stop-color="${skinGradient.stop2}" />
              </linearGradient>
            `}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="20" ry="4" fill="rgba(0,0,0,0.2)" class="shadow-anim"/>
          
          <!-- Tail -->
          <path d="M 68 65 Q 85 55 80 40 Q 75 30 82 25" fill="none" stroke="url(#catGrad)" stroke-width="6" stroke-linecap="round" class="tail-anim" />

          <!-- Body -->
          <ellipse cx="50" cy="62" rx="22" ry="18" fill="url(#catGrad)" class="body-anim" />
          
          <!-- Ears -->
          <polygon points="32,45 22,20 40,38" fill="url(#catGrad)" class="ear-left-anim" />
          <polygon points="68,45 78,20 60,38" fill="url(#catGrad)" class="ear-right-anim" />
          <polygon points="34,42 26,24 40,36" fill="${skinGradient.stop2}" opacity="0.7" />
          <polygon points="66,42 74,24 60,36" fill="${skinGradient.stop2}" opacity="0.7" />

          <!-- Head -->
          <circle cx="50" cy="48" r="20" fill="url(#catGrad)" class="head-anim" />

          <!-- Eyes -->
          ${isSleeping ? `
            <!-- Sleeping eyes -->
            <path d="M 36 46 Q 40 50 44 46" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 56 46 Q 60 50 64 46" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
          ` : isHappy ? `
            <!-- Happy star/winking eyes -->
            <path d="M 35 46 L 43 46 M 39 42 L 39 50" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
            <path d="M 57 46 L 65 46 M 61 42 L 61 50" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
          ` : `
            <!-- Normal eyes -->
            <circle cx="40" cy="46" r="3.5" fill="${eyeColor}" filter="url(#neonGlow)" />
            <circle cx="60" cy="46" r="3.5" fill="${eyeColor}" filter="url(#neonGlow)" />
            <!-- Pupil highlights -->
            <circle cx="39" cy="45" r="1" fill="#fff" />
            <circle cx="59" cy="45" r="1" fill="#fff" />
          `}

          <!-- Nose & Mouth -->
          <polygon points="50,51 48,49 52,49" fill="${skinGradient.stop2}" />
          ${isEating ? `
            <circle cx="50" cy="55" r="3" fill="#333" class="mouth-eating" />
          ` : `
            <path d="M 47 53 Q 50 56 50 53 Q 50 56 53 53" fill="none" stroke="${skinGradient.stop2}" stroke-width="1.5" stroke-linecap="round" />
          `}

          <!-- Cheeks -->
          <circle cx="34" cy="52" r="2.5" fill="#FF4081" opacity="0.6" />
          <circle cx="66" cy="52" r="2.5" fill="#FF4081" opacity="0.6" />

          <!-- Whiskers -->
          <path d="M 28 50 L 18 48 M 28 52 L 16 52" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" />
          <path d="M 72 50 L 82 48 M 72 52 L 84 52" stroke="rgba(255,255,255,0.5)" stroke-width="1.5" stroke-linecap="round" />

          <!-- Dynamic accessories based on state -->
          ${isSleeping ? `
            <!-- Sleep Zs -->
            <text x="75" y="25" fill="${skinGradient.stop2}" font-size="8" font-family="monospace" class="z-anim">z</text>
            <text x="82" y="15" fill="${skinGradient.stop1}" font-size="10" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <!-- Floating Fish snack -->
            <path d="M 20 65 Q 12 60 12 70 M 12 65 L 8 60 L 8 70 Z" fill="#FFD700" class="food-anim" />
          ` : ""}
        </svg>
      `;
    }
  },

  "astro-dog": {
    name: "Astro-Dog",
    theme: {
      primary: "#FF9100", // Astro Orange
      secondary: "#00E5FF", // Tech Cyan
      accent: "#FFD600", // Yellow
      background: "linear-gradient(135deg, #FF9100, #00E5FF)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.75 : stage === "Teen" ? 0.95 : 1.15;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";

      const skinGradient = getSkinGradientStops(skin, "#FF9100", "#FF3D00");
      const eyeColor = isHappy ? "#FFD600" : "#FFFFFF";

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="transform: scale(${scale}); width: 100px; height: 100px; overflow: visible;">
          <defs>
            ${skinGradient.customDefs ? skinGradient.customDefs : `
              <linearGradient id="dogGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${skinGradient.stop1}" />
                <stop offset="100%" stop-color="${skinGradient.stop2}" />
              </linearGradient>
            `}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="22" ry="4" fill="rgba(0,0,0,0.2)" class="shadow-anim"/>

          <!-- Body -->
          <ellipse cx="50" cy="65" rx="20" ry="16" fill="url(#dogGrad)" class="body-anim" />
          
          <!-- Space Suit Collar / Pack -->
          <rect x="35" y="68" width="30" height="8" rx="4" fill="#00E5FF" filter="url(#glow)" />
          <circle cx="50" cy="72" r="2.5" fill="#FFF" />

          <!-- Ears -->
          <path d="M 28 32 C 22 25 15 35 22 45 C 25 50 30 45 30 40 Z" fill="url(#dogGrad)" class="ear-left-anim" />
          <path d="M 72 32 C 78 25 85 35 78 45 C 75 50 70 45 70 40 Z" fill="url(#dogGrad)" class="ear-right-anim" />

          <!-- Head -->
          <circle cx="50" cy="46" r="18" fill="url(#dogGrad)" class="head-anim" />

          <!-- Astronaut Helmet Visor -->
          <circle cx="50" cy="46" r="15" fill="rgba(0, 229, 255, 0.25)" stroke="#00E5FF" stroke-width="1.5" class="head-anim" />
          <path d="M 38 38 Q 50 34 62 38" stroke="rgba(255,255,255,0.6)" stroke-width="1.5" fill="none" class="head-anim" />

          <!-- Eyes -->
          ${isSleeping ? `
            <path d="M 38 46 Q 42 49 46 46" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 54 46 Q 58 49 62 46" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
          ` : isHappy ? `
            <path d="M 38 43 Q 42 39 46 43" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
            <path d="M 54 43 Q 58 39 62 43" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
          ` : `
            <circle cx="42" cy="45" r="3" fill="${eyeColor}" />
            <circle cx="58" cy="45" r="3" fill="${eyeColor}" />
            <circle cx="41" cy="44" r="0.8" fill="#000" />
            <circle cx="57" cy="44" r="0.8" fill="#000" />
          `}

          <!-- Snout & Nose -->
          <ellipse cx="50" cy="51" rx="5" ry="3.5" fill="#FFD600" opacity="0.9" />
          <circle cx="50" cy="49" r="2.2" fill="#263238" />

          <!-- Mouth -->
          ${isEating ? `
            <circle cx="50" cy="54" r="2.5" fill="#333" class="mouth-eating" />
          ` : `
            <path d="M 47 52 Q 50 55 53 52" fill="none" stroke="#263238" stroke-width="1.2" />
          `}

          <!-- Space sparks/bubble -->
          ${isSleeping ? `
            <text x="76" y="24" fill="#00E5FF" font-size="8" font-family="monospace" class="z-anim">z</text>
            <text x="83" y="14" fill="#FFD600" font-size="10" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <!-- Space cookie -->
            <circle cx="18" cy="65" r="5" fill="#8B4513" class="food-anim" />
            <circle cx="16" cy="63" r="0.8" fill="#3e2723" />
            <circle cx="19" cy="66" r="0.8" fill="#3e2723" />
          ` : ""}
        </svg>
      `;
    }
  },

  "cyber-bunny": {
    name: "Cyber-Bunny",
    theme: {
      primary: "#FF2A7A", // Cyber Pink
      secondary: "#1A1A2E", // Dark Blue
      accent: "#E2E2E2", // Silver
      background: "linear-gradient(135deg, #FF2A7A, #00FFCC)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.75 : stage === "Teen" ? 0.95 : 1.15;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";

      const skinGradient = getSkinGradientStops(skin, "#FF2A7A", "#8A2BE2");
      const eyeColor = isHappy ? "#00FFCC" : "#FF2A7A";

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="transform: scale(${scale}); width: 100px; height: 100px; overflow: visible;">
          <defs>
            ${skinGradient.customDefs ? skinGradient.customDefs : `
              <linearGradient id="bunnyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${skinGradient.stop1}" />
                <stop offset="100%" stop-color="${skinGradient.stop2}" />
              </linearGradient>
            `}
            <filter id="neonPink" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="18" ry="4" fill="rgba(0,0,0,0.2)" class="shadow-anim"/>

          <!-- Body -->
          <ellipse cx="50" cy="64" rx="18" ry="15" fill="url(#bunnyGrad)" class="body-anim" />
          
          <!-- Tech plate on chest -->
          <polygon points="44,60 56,60 52,68 48,68" fill="#E2E2E2" />
          <circle cx="50" cy="63" r="1.5" fill="#00FFCC" />

          <!-- Long Ears -->
          <g class="ear-left-anim" style="transform-origin: 35px 40px;">
            <path d="M 30 38 Q 20 8 32 8 Q 40 8 38 38 Z" fill="url(#bunnyGrad)" />
            <path d="M 31 34 Q 25 14 31 14 Q 36 14 35 34 Z" fill="#00FFCC" opacity="0.8" />
          </g>
          <g class="ear-right-anim" style="transform-origin: 65px 40px;">
            <path d="M 70 38 Q 80 8 68 8 Q 60 8 62 38 Z" fill="url(#bunnyGrad)" />
            <path d="M 69 34 Q 75 14 69 14 Q 64 14 65 34 Z" fill="#00FFCC" opacity="0.8" />
          </g>

          <!-- Head -->
          <circle cx="50" cy="46" r="17" fill="url(#bunnyGrad)" class="head-anim" />

          <!-- Eyes -->
          ${isSleeping ? `
            <path d="M 37 46 L 45 48" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 55 48 L 63 46" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
          ` : isHappy ? `
            <path d="M 37 48 Q 41 42 45 48" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 55 48 Q 59 42 63 48" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
          ` : `
            <circle cx="41" cy="45" r="3.2" fill="${eyeColor}" filter="url(#neonPink)" />
            <circle cx="59" cy="45" r="3.2" fill="${eyeColor}" filter="url(#neonPink)" />
            <!-- Cyber Eye Crosshairs -->
            <line x1="37" y1="45" x2="45" y2="45" stroke="#FFFFFF" stroke-width="0.5" />
            <line x1="41" y1="41" x2="41" y2="49" stroke="#FFFFFF" stroke-width="0.5" />
          `}

          <!-- Cheeks -->
          <circle cx="33" cy="50" r="2" fill="#E2E2E2" />
          <circle cx="67" cy="50" r="2" fill="#E2E2E2" />

          <!-- Nose -->
          <polygon points="50,49 48,47 52,47" fill="#00FFCC" />

          <!-- Mouth -->
          ${isEating ? `
            <circle cx="50" cy="53" r="2" fill="#333" class="mouth-eating" />
          ` : `
            <path d="M 48 51 Q 50 53 52 51" fill="none" stroke="#E2E2E2" stroke-width="1.5" />
          `}

          <!-- zZz or Food -->
          ${isSleeping ? `
            <text x="74" y="24" fill="#FF2A7A" font-size="8" font-family="monospace" class="z-anim">z</text>
            <text x="81" y="14" fill="#00FFCC" font-size="10" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <!-- Hologram carrot -->
            <polygon points="16,60 22,64 12,74" fill="#FF6B08" class="food-anim" />
            <line x1="12" y1="74" x2="10" y2="78" stroke="#00FFCC" stroke-width="1.5" class="food-anim" />
          ` : ""}
        </svg>
      `;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PET_ASSETS;
}

// Dynamic SVG Pet Assets and Animations
// Optimized for sharp, high-contrast rendering, and fluid, lively keyframe animations (waving hands, blinking, twitching, floating stars/hearts/warning signs).

function getSkinColors(skin, defaultBody, defaultAccent) {
  let bodyColor = defaultBody;
  let accentColor = defaultAccent;
  let defs = "";

  if (skin === "neon-cyan") {
    bodyColor = "#00e5ff";
    accentColor = "#0088ff";
  } else if (skin === "neon-pink") {
    bodyColor = "#ff007f";
    accentColor = "#e60067";
  } else if (skin === "neon-green") {
    bodyColor = "#39ff14";
    accentColor = "#00ff87";
  } else if (skin === "neon-gold") {
    bodyColor = "#ffd700";
    accentColor = "#ffa500";
  } else if (skin === "neon-purple") {
    bodyColor = "#9945ff";
    accentColor = "#d600ff";
  } else if (skin === "neon-matrix") {
    bodyColor = "#0d0d0d";
    accentColor = "#39ff14";
  } else if (skin === "neon-rainbow") {
    bodyColor = "url(#rainbow-grad)";
    accentColor = "url(#rainbow-grad-accent)";
    defs = `
      <defs>
        <linearGradient id="rainbow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ff007f" />
          <stop offset="20%" stop-color="#ff9100" />
          <stop offset="40%" stop-color="#ffd600" />
          <stop offset="60%" stop-color="#39ff14" />
          <stop offset="80%" stop-color="#00e5ff" />
          <stop offset="100%" stop-color="#9945ff" />
        </linearGradient>
        <linearGradient id="rainbow-grad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#9945ff" />
          <stop offset="50%" stop-color="#ff007f" />
          <stop offset="100%" stop-color="#ffd600" />
        </linearGradient>
      </defs>
    `;
  }
  return { bodyColor, accentColor, defs };
}

const PET_ASSETS = {
  "sol-cat": {
    name: "Sol-Cat",
    theme: {
      primary: "#14F195",
      secondary: "#9945FF",
      accent: "#00E5FF",
      background: "linear-gradient(135deg, #14F195, #9945FF)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.7 : stage === "Teen" ? 0.9 : 1.1;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";
      const isDistracted = state === "distracted";

      const skinColors = getSkinColors(skin, "#9945FF", "#14F195");
      const bodyColor = skinColors.bodyColor;
      const accentColor = skinColors.accentColor;
      const eyeColor = isDistracted ? "#FF453A" : (isHappy ? "#00E5FF" : accentColor);
      const outlineColor = "#050308";

      // Stage accessories
      let accessories = "";
      if (stage === "Teen") {
        accessories = `
          <!-- Teen Collar & Bell -->
          <rect x="42" y="68" width="16" height="4" rx="2" fill="${accentColor}" stroke="${outlineColor}" stroke-width="1.5" />
          <circle cx="50" cy="71" r="3" fill="#FFD700" stroke="${outlineColor}" stroke-width="1" class="bell-shake" />
        `;
      } else if (stage === "Adult") {
        accessories = `
          <!-- Cyber Wings -->
          <g class="wing-flap">
            <path d="M 24 55 Q 2 35 12 22 Q 22 25 26 46 Z" fill="rgba(0, 229, 255, 0.85)" stroke="${outlineColor}" stroke-width="1.5" />
            <path d="M 76 55 Q 98 35 88 22 Q 78 25 74 46 Z" fill="rgba(0, 229, 255, 0.85)" stroke="${outlineColor}" stroke-width="1.5" />
          </g>
          <!-- Forehead Crest -->
          <polygon points="50,30 46,36 54,36" fill="${accentColor}" stroke="${outlineColor}" stroke-width="1" />
          <circle cx="50" cy="33" r="1.5" fill="#FFF" />
          <!-- Heavy Collar -->
          <rect x="40" y="67" width="20" height="5" rx="2.5" fill="${accentColor}" stroke="${outlineColor}" stroke-width="1.5" />
          <polygon points="50,69 46,75 54,75" fill="#FFD700" stroke="${outlineColor}" stroke-width="1" class="bell-shake" />
        `;
      }

      // Tails
      let tailSection = "";
      if (stage === "Baby") {
        tailSection = `<path d="M 68 65 Q 82 58 78 45" fill="none" stroke="${bodyColor}" stroke-width="5" stroke-linecap="round" class="tail-wag-fast" />`;
      } else if (stage === "Teen") {
        tailSection = `<path d="M 68 65 Q 85 55 80 40 Q 75 30 82 25" fill="none" stroke="${bodyColor}" stroke-width="6" stroke-linecap="round" class="tail-wag" />`;
      } else {
        tailSection = `
          <g class="tail-wag">
            <path d="M 68 65 Q 85 50 82 32 Q 78 20 86 15" fill="none" stroke="${bodyColor}" stroke-width="6" stroke-linecap="round" />
            <path d="M 67 67 Q 90 60 88 45 Q 85 35 94 30" fill="none" stroke="${accentColor}" stroke-width="4.5" stroke-linecap="round" />
          </g>
        `;
      }

      // Float items
      let floatItems = "";
      if (isHappy) {
        floatItems = `
          <g class="star-group">
            <path d="M 30,22 L 31.5,24.5 L 34,25 L 32,27 L 32.5,29.5 L 30,28 L 27.5,29.5 L 28,27 L 26,25 L 28.5,24.5 Z" fill="#00E5FF" class="float-star-1" />
            <path d="M 70,20 L 71,22 L 73,22.5 L 71.5,24 L 72,26 L 70,25 L 68,26 L 68.5,24 L 67,22.5 L 69,22 Z" fill="#FFD700" class="float-star-2" />
            <path d="M 50,15 L 51,17 L 53,17.5 L 51.5,19 L 52,21 L 50,20 L 48,21 L 48.5,19 L 47,17.5 L 49,17 Z" fill="#14F195" class="float-star-3" />
          </g>
        `;
      } else if (isDistracted) {
        floatItems = `
          <g class="warning-alert">
            <text x="76" y="26" fill="#FF453A" font-size="16" font-weight="900" font-family="system-ui" class="warning-shake">!</text>
            <text x="12" y="24" fill="#FF453A" font-size="14" font-weight="900" font-family="system-ui" class="warning-shake-delayed">?</text>
          </g>
        `;
      }

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="width: 100px; height: 100px; overflow: visible;">
          ${skinColors.defs}
          <style>
            .tail-wag { transform-origin: 68px 65px; animation: tailWag 1.2s infinite ease-in-out; }
            .tail-wag-fast { transform-origin: 68px 65px; animation: tailWag 0.6s infinite ease-in-out; }
            .ear-left { transform-origin: 32px 45px; animation: twitchLeft 4s infinite ease-in-out; }
            .ear-right { transform-origin: 68px 45px; animation: twitchRight 4.2s infinite ease-in-out; }
            .eye-blink { transform-origin: 50px 48px; animation: blink 5s infinite ease-in-out; }
            .waving-paw { transform-origin: 64px 74px; animation: pawWave ${isHappy || isDistracted ? '0.35s' : '1.5s'} infinite ease-in-out; }
            .bell-shake { transform-origin: 50px 71px; animation: bellShake 1.8s infinite ease-in-out; }
            .wing-flap { transform-origin: 50px 55px; animation: wingFlap 0.8s infinite ease-in-out; }
            
            .float-star-1 { transform-origin: 30px 25px; animation: floatUpStar 1.8s infinite linear; }
            .float-star-2 { transform-origin: 70px 23px; animation: floatUpStar 2.2s infinite linear 0.4s; }
            .float-star-3 { transform-origin: 50px 18px; animation: floatUpStar 2s infinite linear 0.2s; }
            .warning-shake { transform-origin: 80px 20px; animation: warningShake 0.4s infinite ease-in-out; }
            .warning-shake-delayed { transform-origin: 16px 20px; animation: warningShake 0.4s infinite ease-in-out 0.2s; }

            @keyframes tailWag { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(18deg); } }
            @keyframes twitchLeft { 0%, 90%, 100% { transform: rotate(0deg); } 95% { transform: rotate(-8deg); } }
            @keyframes twitchRight { 0%, 92%, 100% { transform: rotate(0deg); } 96% { transform: rotate(8deg); } }
            @keyframes blink { 0%, 96%, 100% { transform: scaleY(1); } 98% { transform: scaleY(0.1); } }
            @keyframes wingFlap { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.8) scaleY(1.1); } }
            @keyframes bellShake { 0%, 100% { transform: rotate(0deg); } 20%, 60% { transform: rotate(-15deg); } 40%, 80% { transform: rotate(15deg); } }
            @keyframes pawWave { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-2px, -8px) rotate(-40deg); } }
            @keyframes warningShake { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(1px, -2px) scale(1.15) rotate(10deg); } }
            @keyframes floatUpStar {
              0% { transform: translate(0, 6px) scale(0); opacity: 0; }
              20% { opacity: 1; }
              100% { transform: translate(-6px, -24px) scale(1.2) rotate(180deg); opacity: 0; }
            }
          </style>

          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="20" ry="4" fill="rgba(0,0,0,0.25)" class="shadow-anim"/>
          
          <!-- Wrapper for stage scaling -->
          <g transform="scale(${scale})" style="transform-origin: 50px 65px;">
            ${tailSection}
            
            <!-- Body -->
            <ellipse cx="50" cy="62" rx="22" ry="18" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="body-anim" />
            
            ${accessories}
            
            <!-- Ears -->
            <g class="ear-left">
              <polygon points="32,45 22,20 40,38" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
              ${stage !== "Baby" ? `<polygon points="34,42 26,24 40,36" fill="${accentColor}" />` : ""}
            </g>
            <g class="ear-right">
              <polygon points="68,45 78,20 60,38" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
              ${stage !== "Baby" ? `<polygon points="66,42 74,24 60,36" fill="${accentColor}" />` : ""}
            </g>

            <!-- Head -->
            <circle cx="50" cy="48" r="20" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="head-anim" />

            <!-- Eyes -->
            <g class="eye-blink head-anim">
              ${isSleeping ? `
                <path d="M 36 46 Q 40 50 44 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
                <path d="M 56 46 Q 60 50 64 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
              ` : isHappy ? `
                <path d="M 35 46 L 43 46 M 39 42 L 39 50" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
                <path d="M 57 46 L 65 46 M 61 42 L 61 50" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
              ` : isDistracted ? `
                <!-- Angry / distracted slanted eyes -->
                <path d="M 34 42 L 44 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
                <path d="M 66 42 L 56 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
                <circle cx="39" cy="47" r="2.5" fill="${eyeColor}" />
                <circle cx="61" cy="47" r="2.5" fill="${eyeColor}" />
              ` : `
                <circle cx="40" cy="46" r="4.5" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1" />
                <circle cx="60" cy="46" r="4.5" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1" />
                <circle cx="38.5" cy="44.5" r="1.5" fill="#FFF" />
                <circle cx="58.5" cy="44.5" r="1.5" fill="#FFF" />
              `}
            </g>

            <!-- Nose & Mouth -->
            <polygon points="50,51 47,48 53,48" fill="${accentColor}" class="head-anim" />
            ${isEating ? `
              <circle cx="50" cy="55" r="3.5" fill="#222" stroke="${outlineColor}" stroke-width="1" class="mouth-eating" />
            ` : isDistracted ? `
              <!-- Yelling open mouth -->
              <ellipse cx="50" cy="55" rx="3" ry="5.5" fill="#222" stroke="${outlineColor}" stroke-width="1.2" class="mouth-eating" />
            ` : `
              <path d="M 46 53 Q 50 56 50 53 Q 50 56 54 53" fill="none" stroke="${outlineColor}" stroke-width="2.1" stroke-linecap="round" class="head-anim" />
            `}

            <!-- Cheeks -->
            <circle cx="34" cy="53" r="2.5" fill="#FF4081" class="head-anim" />
            <circle cx="66" cy="53" r="2.5" fill="#FF4081" class="head-anim" />

            <!-- Whiskers -->
            <path d="M 28 50 L 17 48 M 28 52 L 15 52" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" class="head-anim" />
            <path d="M 72 50 L 83 48 M 72 52 L 85 52" stroke="#FFF" stroke-width="1.8" stroke-linecap="round" class="head-anim" />

            <!-- Front Paws -->
            <circle cx="36" cy="74" r="4.5" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
            <g class="waving-paw">
              <circle cx="64" cy="74" r="4.5" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
              <circle cx="64" cy="74" r="2" fill="#FF4081" />
            </g>
          </g>

          ${floatItems}

          <!-- Floating state markers -->
          ${isSleeping ? `
            <text x="76" y="24" fill="${accentColor}" font-size="9" font-weight="bold" font-family="monospace" class="z-anim">z</text>
            <text x="83" y="14" fill="${bodyColor}" font-size="11" font-weight="bold" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <path d="M 20 65 Q 12 60 12 70 M 12 65 L 8 60 L 8 70 Z" fill="#FFD700" stroke="${outlineColor}" stroke-width="1" class="food-anim" />
          ` : ""}
        </svg>
      `;
    }
  },

  "astro-dog": {
    name: "Astro-Dog",
    theme: {
      primary: "#FF9100",
      secondary: "#00E5FF",
      accent: "#FFD600",
      background: "linear-gradient(135deg, #FF9100, #00E5FF)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.7 : stage === "Teen" ? 0.9 : 1.1;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";
      const isDistracted = state === "distracted";

      const skinColors = getSkinColors(skin, "#FF9100", "#00E5FF");
      const bodyColor = skinColors.bodyColor;
      const accentColor = skinColors.accentColor;
      const eyeColor = isDistracted ? "#FF453A" : (isHappy ? "#FFD600" : "#FFF");
      const outlineColor = "#050308";

      // Space Suit modules
      let suitOverlays = "";
      if (stage === "Baby") {
        suitOverlays = `
          <rect x="37" y="69" width="26" height="6" rx="3" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="1.5" />
          <circle cx="50" cy="72" r="2" fill="${accentColor}" />
        `;
      } else if (stage === "Teen") {
        suitOverlays = `
          <rect x="25" y="60" width="8" height="16" rx="2" fill="#B0BEC5" stroke="${outlineColor}" stroke-width="1.5" class="thruster-fire" />
          <rect x="35" y="67" width="30" height="9" rx="4" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="1.5" />
          <circle cx="43" cy="71" r="2.5" fill="${accentColor}" />
          <rect x="51" y="69" width="8" height="3" rx="1" fill="#FF5252" />
        `;
      } else {
        suitOverlays = `
          <g class="thruster-fire">
            <rect x="21" y="58" width="10" height="22" rx="3" fill="#90A4AE" stroke="${outlineColor}" stroke-width="1.5" />
            <path d="M 22 80 L 26 91 L 30 80 Z" fill="#FF5252" class="flame-flicker" />
            
            <rect x="69" y="58" width="10" height="22" rx="3" fill="#90A4AE" stroke="${outlineColor}" stroke-width="1.5" />
            <path d="M 70 80 L 74 91 L 78 80 Z" fill="#FF5252" class="flame-flicker" />
          </g>
          <rect x="32" y="66" width="36" height="11" rx="4.5" fill="#E0E0E0" stroke="${outlineColor}" stroke-width="2" />
          <circle cx="40" cy="71.5" r="3" fill="${isDistracted ? '#FF453A' : accentColor}" class="indicator-blink" />
          <circle cx="48" cy="71.5" r="3" fill="${isDistracted ? '#FF453A' : '#30D158'}" class="indicator-blink-delay" />
          <circle cx="56" cy="71.5" r="3" fill="#FF9500" />
        `;
      }

      // Helmet features
      let helmetDecoration = "";
      if (stage === "Teen") {
        helmetDecoration = `
          <g class="antenna-twitch">
            <line x1="50" y1="28" x2="50" y2="16" stroke="${accentColor}" stroke-width="2.5" />
            <circle cx="50" cy="15" r="3" fill="${isDistracted ? '#FF453A' : '#FFCA28'}" stroke="${outlineColor}" stroke-width="1" class="indicator-blink" />
          </g>
        `;
      } else if (stage === "Adult") {
        helmetDecoration = `
          <g class="antenna-twitch">
            <line x1="38" y1="29" x2="30" y2="14" stroke="${accentColor}" stroke-width="2.5" />
            <circle cx="28" cy="12" r="4.5" fill="${isDistracted ? '#FF453A' : '#FFCA28'}" stroke="${outlineColor}" stroke-width="1" class="indicator-blink" />
          </g>
          <line x1="37" y1="42" x2="63" y2="42" stroke="${isDistracted ? '#FF453A' : 'rgba(0, 229, 255, 0.4)'}" stroke-width="1.2" class="hud-scan" />
        `;
      }

      // Float bubbles
      let floatItems = "";
      if (isHappy) {
        floatItems = `
          <g class="bubble-group">
            <circle cx="34" cy="20" r="3" fill="none" stroke="${accentColor}" stroke-width="1" class="float-bubble-1" />
            <circle cx="66" cy="18" r="4" fill="none" stroke="${accentColor}" stroke-width="1.2" class="float-bubble-2" />
            <circle cx="50" cy="14" r="2.5" fill="none" stroke="#FFD600" stroke-width="1" class="float-bubble-3" />
          </g>
        `;
      } else if (isDistracted) {
        floatItems = `
          <g class="warning-alert">
            <text x="76" y="26" fill="#FF453A" font-size="16" font-weight="900" font-family="system-ui" class="warning-shake">!</text>
            <text x="12" y="24" fill="#FF453A" font-size="14" font-weight="900" font-family="system-ui" class="warning-shake-delayed">?</text>
          </g>
        `;
      }

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="width: 100px; height: 100px; overflow: visible;">
          ${skinColors.defs}
          <style>
            .ear-left { transform-origin: 28px 38px; animation: flopLeft 3.5s infinite ease-in-out; }
            .ear-right { transform-origin: 72px 38px; animation: flopRight 3.7s infinite ease-in-out; }
            .waving-paw { transform-origin: 64px 76px; animation: pawWave ${isHappy || isDistracted ? '0.35s' : '1.8s'} infinite ease-in-out; }
            .flame-flicker { transform-origin: center top; animation: flamePulse 0.2s infinite ease-in-out; }
            .indicator-blink { animation: eyePulse 1s infinite alternate; }
            .indicator-blink-delay { animation: eyePulse 1s infinite alternate 0.5s; }
            .antenna-twitch { transform-origin: 50px 28px; animation: antennaTwitch 6s infinite ease-in-out; }
            .hud-scan { animation: hudScan 1.5s infinite ease-in-out; }
            
            .float-bubble-1 { transform-origin: 34px 20px; animation: floatBubble 2s infinite linear; }
            .float-bubble-2 { transform-origin: 66px 18px; animation: floatBubble 2.4s infinite linear 0.4s; }
            .float-bubble-3 { transform-origin: 50px 14px; animation: floatBubble 2.2s infinite linear 0.8s; }
            .warning-shake { transform-origin: 80px 20px; animation: warningShake 0.4s infinite ease-in-out; }
            .warning-shake-delayed { transform-origin: 16px 20px; animation: warningShake 0.4s infinite ease-in-out 0.2s; }

            @keyframes flopLeft { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-10deg); } }
            @keyframes flopRight { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(10deg); } }
            @keyframes flamePulse { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scaleY(1.3) scaleX(0.9); opacity: 1; } }
            @keyframes eyePulse { 0% { opacity: 0.3; } 100% { opacity: 1; } }
            @keyframes antennaTwitch { 0%, 94%, 100% { transform: rotate(0deg); } 97% { transform: rotate(-12deg); } }
            @keyframes hudScan { 0%, 100% { transform: translateY(-3px); } 50% { transform: translateY(6px); } }
            @keyframes pawWave { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-2px, -6px) rotate(-35deg); } }
            @keyframes warningShake { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(1px, -2px) scale(1.15) rotate(10deg); } }
            @keyframes floatBubble {
              0% { transform: translateY(8px) scale(0.5); opacity: 0; }
              30% { opacity: 0.8; }
              100% { transform: translateY(-20px) scale(1.3); opacity: 0; }
            }
          </style>

          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="22" ry="4" fill="rgba(0,0,0,0.25)" class="shadow-anim"/>

          <!-- Wrapper for stage scaling -->
          <g transform="scale(${scale})" style="transform-origin: 50px 65px;">
            <!-- Body -->
            <ellipse cx="50" cy="65" rx="20" ry="16" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="body-anim" />
            
            ${suitOverlays}

            <!-- Ears -->
            <g class="ear-left">
              <path d="M 28 32 C 22 25 14 36 21 46 C 24 50 30 45 30 40 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
            </g>
            <g class="ear-right">
              <path d="M 72 32 C 78 25 86 36 79 46 C 76 50 70 45 70 40 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
            </g>

            <!-- Head -->
            <circle cx="50" cy="46" r="18" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="head-anim" />

            <!-- Helmet Visor -->
            <circle cx="50" cy="46" r="15.5" fill="rgba(0, 229, 255, 0.2)" stroke="${isDistracted ? '#FF453A' : accentColor}" stroke-width="2" class="head-anim" />
            
            ${helmetDecoration}

            <!-- Eyes -->
            <g class="head-anim">
              ${isSleeping ? `
                <path d="M 38 46 Q 42 49 46 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
                <path d="M 54 46 Q 58 49 62 46" fill="none" stroke="${eyeColor}" stroke-width="3" stroke-linecap="round" />
              ` : isHappy ? `
                <path d="M 37 45 Q 42 40 46 45" fill="none" stroke="${eyeColor}" stroke-width="3.2" stroke-linecap="round" />
                <path d="M 54 45 Q 58 40 62 45" fill="none" stroke="${eyeColor}" stroke-width="3.2" stroke-linecap="round" />
              ` : isDistracted ? `
                <!-- Distracted warning HUD markers -->
                <path d="M 38 43 L 44 47 M 44 43 L 38 47" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 54 43 L 60 47 M 60 43 L 54 47" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
              ` : `
                <circle cx="41.5" cy="45.5" r="4" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1" />
                <circle cx="58.5" cy="45.5" r="4" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1" />
                <circle cx="40.5" cy="44.5" r="1.2" fill="#000" />
                <circle cx="57.5" cy="44.5" r="1.2" fill="#000" />
              `}
            </g>

            <!-- Snout & Nose -->
            <ellipse cx="50" cy="51.5" rx="5" ry="3.5" fill="#FFD600" stroke="${outlineColor}" stroke-width="1" class="head-anim" />
            <circle cx="50" cy="49.5" r="2.2" fill="#222" class="head-anim" />

            <!-- Mouth -->
            <g class="head-anim">
              ${isEating ? `
                <circle cx="50" cy="54" r="2.5" fill="#222" class="mouth-eating" />
              ` : isDistracted ? `
                <!-- Yelling dog mouth -->
                <circle cx="50" cy="55.5" r="3.2" fill="#222" stroke="${outlineColor}" stroke-width="1" />
              ` : `
                <path d="M 47 52.5 Q 50 55.5 53 52.5" fill="none" stroke="${outlineColor}" stroke-width="1.8" />
              `}
            </g>

            <!-- Front Paws -->
            <circle cx="36" cy="76" r="4" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="1.8" />
            <g class="waving-paw">
              <circle cx="64" cy="76" r="4" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="1.8" />
            </g>
          </g>

          ${floatItems}

          <!-- Space particles/bubble -->
          ${isSleeping ? `
            <text x="76" y="24" fill="${accentColor}" font-size="9" font-weight="bold" font-family="monospace" class="z-anim">z</text>
            <text x="83" y="14" fill="#FF3D00" font-size="11" font-weight="bold" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <circle cx="18" cy="65" r="5" fill="#8B4513" stroke="${outlineColor}" stroke-width="1" class="food-anim" />
            <circle cx="16" cy="63" r="1" fill="#3e2723" />
            <circle cx="19" cy="66" r="1" fill="#3e2723" />
          ` : ""}
        </svg>
      `;
    }
  },

  "cyber-bunny": {
    name: "Cyber-Bunny",
    theme: {
      primary: "#FF2A7A",
      secondary: "#1A1A2E",
      accent: "#00FFCC",
      background: "linear-gradient(135deg, #FF2A7A, #00FFCC)"
    },
    render: (state, stage, skin) => {
      const scale = stage === "Baby" ? 0.7 : stage === "Teen" ? 0.9 : 1.1;
      const isSleeping = state === "sleep";
      const isEating = state === "eat";
      const isHappy = state === "happy" || state === "pet";
      const isDistracted = state === "distracted";

      const skinColors = getSkinColors(skin, "#FF2A7A", "#00FFCC");
      const bodyColor = skinColors.bodyColor;
      const accentColor = skinColors.accentColor;
      const eyeColor = isDistracted ? "#FF453A" : (isHappy ? accentColor : bodyColor);
      const outlineColor = "#050308";

      // Armor components
      let armorSpec = "";
      if (stage === "Teen") {
        armorSpec = `
          <polygon points="44,61 56,61 52,67 48,67" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="1.5" />
          <circle cx="50" cy="63" r="2.2" fill="${isDistracted ? '#FF453A' : accentColor}" class="core-pulse" />
        `;
      } else if (stage === "Adult") {
        armorSpec = `
          <g class="wing-flap">
            <path d="M 28 62 L 10 54 L 18 69 Z" fill="none" stroke="${isDistracted ? '#FF453A' : accentColor}" stroke-width="2.5" stroke-linecap="round" />
            <path d="M 72 62 L 90 54 L 82 69 Z" fill="none" stroke="${isDistracted ? '#FF453A' : accentColor}" stroke-width="2.5" stroke-linecap="round" />
          </g>
          <polygon points="42,59 58,59 54,71 46,71" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="2" />
          <polygon points="45,61 55,61 52,68 48,68" fill="#1A1A2E" />
          <circle cx="50" cy="64" r="3" fill="${isDistracted ? '#FF453A' : accentColor}" class="core-pulse" />
        `;
      }

      // Ears
      let earTracks = "";
      if (stage === "Baby") {
        earTracks = `
          <g class="ear-left">
            <path d="M 30 38 Q 23 18 31 18 Q 37 18 36 38 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
          </g>
          <g class="ear-right">
            <path d="M 70 38 Q 77 18 69 18 Q 63 18 64 38 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
          </g>
        `;
      } else if (stage === "Teen") {
        earTracks = `
          <g class="ear-left">
            <path d="M 30 38 Q 20 8 32 8 Q 40 8 38 38 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
            <path d="M 31 34 Q 25 14 31 14 Q 36 14 35 34 Z" fill="${accentColor}" />
          </g>
          <g class="ear-right">
            <path d="M 70 38 Q 80 8 68 8 Q 60 8 62 38 Z" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2" />
            <path d="M 69 34 Q 75 14 69 14 Q 64 14 65 34 Z" fill="${accentColor}" />
          </g>
        `;
      } else {
        earTracks = `
          <g class="ear-left">
            <path d="M 29 38 Q 16 2 31 2 Q 39 2 37 38 Z" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="2" />
            <path d="M 30 35 Q 21 8 29 8 Q 35 8 34 35 Z" fill="${bodyColor}" />
            <line x1="30" y1="30" x2="26" y2="12" stroke="${isDistracted ? '#FF453A' : accentColor}" stroke-width="2" />
          </g>
          <g class="ear-right">
            <path d="M 71 38 Q 84 2 69 2 Q 61 2 63 38 Z" fill="#E2E2E2" stroke="${outlineColor}" stroke-width="2" />
            <path d="M 70 35 Q 79 8 71 8 Q 65 8 66 35 Z" fill="${bodyColor}" />
            <line x1="70" y1="30" x2="74" y2="12" stroke="${isDistracted ? '#FF453A' : accentColor}" stroke-width="2" />
          </g>
        `;
      }

      // Float Hearts
      let floatItems = "";
      if (isHappy) {
        floatItems = `
          <g class="heart-group">
            <path d="M 32,20 C 30,17 26,17 26,20 C 26,23 32,26 32,26 C 32,26 38,23 38,20 C 38,17 34,17 32,20 Z" fill="#FF2A7A" class="float-heart-1" />
            <path d="M 68,18 C 66,15 62,15 62,18 C 62,21 68,24 68,24 C 68,24 74,21 74,18 C 74,15 70,15 68,18 Z" fill="#00FFCC" class="float-heart-2" />
          </g>
        `;
      } else if (isDistracted) {
        floatItems = `
          <g class="warning-alert">
            <text x="76" y="26" fill="#FF453A" font-size="16" font-weight="900" font-family="system-ui" class="warning-shake">!</text>
            <text x="12" y="24" fill="#FF453A" font-size="14" font-weight="900" font-family="system-ui" class="warning-shake-delayed">?</text>
          </g>
        `;
      }

      return `
        <svg viewBox="0 0 100 100" class="pet-svg ${state}" style="width: 100px; height: 100px; overflow: visible;">
          ${skinColors.defs}
          <style>
            .ear-left { transform-origin: 30px 38px; animation: earTwitchMech 2.8s infinite ease-in-out; }
            .ear-right { transform-origin: 70px 38px; animation: earTwitchMech 3s infinite ease-in-out; }
            .waving-paw { transform-origin: 36px 74px; animation: pawWaveLeft ${isHappy || isDistracted ? '0.3s' : '1.6s'} infinite ease-in-out; }
            .core-pulse { animation: corePulse 1s infinite alternate; }
            .wing-flap { transform-origin: 50px 60px; animation: wingFlap 0.7s infinite ease-in-out; }
            
            .float-heart-1 { transform-origin: 32px 21px; animation: floatUpHeart 2s infinite linear; }
            .float-heart-2 { transform-origin: 68px 19px; animation: floatUpHeart 2.3s infinite linear 0.5s; }
            .warning-shake { transform-origin: 80px 20px; animation: warningShake 0.4s infinite ease-in-out; }
            .warning-shake-delayed { transform-origin: 16px 20px; animation: warningShake 0.4s infinite ease-in-out 0.2s; }

            @keyframes earTwitchMech { 0%, 85%, 100% { transform: rotate(0deg); } 90% { transform: rotate(-10deg); } 95% { transform: rotate(10deg); } }
            @keyframes pawWaveLeft { 0%, 100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(2px, -6px) rotate(35deg); } }
            @keyframes corePulse { 0% { fill: rgba(255, 42, 122, 0.4); filter: drop-shadow(0 0 1px #FF2A7A); } 100% { fill: rgba(255, 42, 122, 1); filter: drop-shadow(0 0 4px #FF2A7A); } }
            @keyframes wingFlap { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.7) scaleY(1.1); } }
            @keyframes warningShake { 0%, 100% { transform: translate(0,0) scale(1); } 50% { transform: translate(1px, -2px) scale(1.15) rotate(10deg); } }
            @keyframes floatUpHeart {
              0% { transform: translate(0, 8px) scale(0.4); opacity: 0; }
              30% { opacity: 0.9; }
              100% { transform: translate(4px, -22px) scale(1.2); opacity: 0; }
            }
          </style>

          <!-- Shadow -->
          <ellipse cx="50" cy="85" rx="18" ry="4" fill="rgba(0,0,0,0.25)" class="shadow-anim"/>

          <!-- Wrapper for stage scaling -->
          <g transform="scale(${scale})" style="transform-origin: 50px 65px;">
            <!-- Body -->
            <ellipse cx="50" cy="64" rx="18" ry="15" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="body-anim" />
            
            ${armorSpec}
            ${earTracks}

            <!-- Head -->
            <circle cx="50" cy="46" r="17" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="2.1" class="head-anim" />

            <!-- Eyes -->
            <g class="head-anim">
              ${isSleeping ? `
                <path d="M 37 46 L 45 48" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
                <path d="M 55 48 L 63 46" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
              ` : isHappy ? `
                <path d="M 37 47 Q 41 42 45 47" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
                <path d="M 55 47 Q 59 42 63 47" fill="none" stroke="${eyeColor}" stroke-width="3.5" stroke-linecap="round" />
              ` : isDistracted ? `
                <!-- Alert Matrix visors showing blinking alert blocks -->
                <rect x="32" y="39" width="36" height="12" rx="3" fill="#1A1A2E" stroke="${outlineColor}" stroke-width="1.5" />
                <path d="M 38 42 L 44 48 M 44 42 L 38 48" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
                <path d="M 54 42 L 60 48 M 60 42 L 54 48" fill="none" stroke="${eyeColor}" stroke-width="2.5" stroke-linecap="round" />
              ` : `
                ${stage !== "Baby" ? `
                  <rect x="32" y="39" width="36" height="12" rx="3" fill="#1A1A2E" stroke="${outlineColor}" stroke-width="1.5" />
                  <circle cx="41" cy="45" r="3.5" fill="${eyeColor}" />
                  <circle cx="59" cy="45" r="3.5" fill="${eyeColor}" />
                  <line x1="45" y1="45" x2="55" y2="45" stroke="${accentColor}" stroke-width="1" />
                ` : `
                  <circle cx="41.5" cy="45.5" r="4.2" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1.5" />
                  <circle cx="58.5" cy="45.5" r="4.2" fill="${eyeColor}" stroke="${outlineColor}" stroke-width="1.5" />
                  <circle cx="39.5" cy="44.5" r="1.2" fill="#FFF" />
                  <circle cx="56.5" cy="44.5" r="1.2" fill="#FFF" />
                `}
              `}
            </g>

            <!-- Cheeks -->
            <circle cx="33" cy="51" r="2.2" fill="#E2E2E2" class="head-anim" />
            <circle cx="67" cy="51" r="2.2" fill="#E2E2E2" class="head-anim" />

            <!-- Nose -->
            <polygon points="50,49 48,47 52,47" fill="${accentColor}" class="head-anim" />

            <!-- Mouth -->
            ${isEating ? `
              <circle cx="50" cy="53" r="2.5" fill="#222" class="mouth-eating" />
            ` : isDistracted ? `
              <!-- Yelling rabbit mouth -->
              <ellipse cx="50" cy="53.5" rx="2.5" ry="4.5" fill="#222" stroke="${outlineColor}" stroke-width="1" />
            ` : `
              <path d="M 48 51.5 Q 50 53.5 52 51.5" fill="none" stroke="${outlineColor}" stroke-width="1.8" class="head-anim" />
            `}

            <!-- Front Paws -->
            <g class="waving-paw">
              <circle cx="36" cy="74" r="4" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="1.8" />
              <circle cx="36" cy="74" r="1.8" fill="#FFF" />
            </g>
            <circle cx="64" cy="74" r="4" fill="${bodyColor}" stroke="${outlineColor}" stroke-width="1.8" />
          </g>

          ${floatItems}

          <!-- zZz or Food -->
          ${isSleeping ? `
            <text x="74" y="24" fill="${bodyColor}" font-size="9" font-weight="bold" font-family="monospace" class="z-anim">z</text>
            <text x="81" y="14" fill="${accentColor}" font-size="11" font-weight="bold" font-family="monospace" class="z-anim-delayed">Z</text>
          ` : ""}
          ${isEating ? `
            <polygon points="16,60 22,64 12,74" fill="#FF6B08" stroke="${outlineColor}" stroke-width="1" class="food-anim" />
            <line x1="12" y1="74" x2="10" y2="78" stroke="${accentColor}" stroke-width="1.5" class="food-anim" />
          ` : ""}
        </svg>
      `;
    }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PET_ASSETS;
}

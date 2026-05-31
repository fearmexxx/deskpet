// DeskPet - Canvas Pet Animation Engine

const PetEngine = {
  // Theme styling configurations
  themes: {
    "neon-cyan": {
      body: "#00d2ff",
      accent: "#00a8ff",
      glow: "#00f0ff",
      eye: "#ffffff",
      trail: "rgba(0, 240, 255, 0.4)"
    },
    "neon-pink": {
      body: "#ff007f",
      accent: "#e60067",
      glow: "#ff00bf",
      eye: "#ffffff",
      trail: "rgba(255, 0, 191, 0.4)"
    },
    "neon-green": {
      body: "#39ff14",
      accent: "#00ff87",
      glow: "#39ff14",
      eye: "#ffffff",
      trail: "rgba(57, 255, 20, 0.4)"
    },
    "neon-gold": {
      body: "#ffd700",
      accent: "#ffa500",
      glow: "#ffaa00",
      eye: "#ff3c00",
      trail: "rgba(255, 170, 0, 0.4)"
    }
  },

  // Sprite coordinate definitions
  // Symbols: '.' = empty, '#' = outline (body color), 'x' = secondary accent, 'e' = eye, 'g' = glow accent
  sprites: {
    egg: {
      idle: [
        [
          "....####....",
          "..##xxxx##..",
          ".##xxxxxx##.",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          ".##xxxxxx##.",
          "..########.."
        ],
        [
          "....####....",
          "..##xxxx##..",
          ".##xxxxxx##.",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          ".#xxxxxxxx#.",
          ".##xxxxxx##.",
          "..########.."
        ]
      ],
      sleep: [
        [
          "....####....",
          "..##xxxx##..",
          ".##xxxxxx##.",
          "#xxxxxxxxxx#",
          "#xxxxxxxxxx#",
          ".##########.",
          "............"
        ]
      ]
    },
    baby: {
      idle: [
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxxxxxxx#..",
          ".#xxxxxxxxxx#.",
          "#xxexxxxxexx#",
          "#xxxxxxxxxxx#",
          "#xxxxxxxxxxx#",
          ".#xxxxxxxxx#.",
          "..#########.."
        ],
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxxxxxxx#..",
          ".#xxxxxxxxxx#.",
          "#xxexxxxxexx#",
          "#xxxxxxxxxxx#",
          ".#xxxxxxxxx#.",
          "..#########..",
          "............."
        ]
      ],
      walk: [
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxxxxxxx#..",
          ".#xxxxxxxxxx#.",
          "#xxexxxxxexx#",
          "#xxxxxxxxxxx#",
          "#xxxxxxxxxxx#",
          ".##xxxxxxx##.",
          "..##.###.##.."
        ],
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxxxxxxx#..",
          ".#xxxxxxxxxx#.",
          "#xxexxxxxexx#",
          "#xxxxxxxxxxx#",
          "#xxxxxxxxxxx#",
          ".##xxxxxxx##.",
          "...##...##..."
        ]
      ],
      excited: [
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxgxxgxx#..",
          ".#xxxxxxxxxx#.",
          "#xxexxxxxexx#",
          "#xxxxxxxxxxx#",
          "#xxxxxxxxxxx#",
          ".#xxxxxxxxx#.",
          "..#########.."
        ],
        [
          "......####....",
          "....##xxxx##..",
          "...#xxxxxxxx#.",
          "..#xxxxxxxxxx#",
          ".#xxexxxxxexx#",
          ".#xxxxxxxxxxx#",
          "..#xxxxxxxxx#.",
          "...#########..",
          ".............."
        ]
      ],
      sleep: [
        [
          ".....####.....",
          "...##xxxx##...",
          "..#xxxxxxxx#..",
          ".#xxxxxxxxxx#.",
          "#xx######xx#",
          ".##########.",
          "............"
        ]
      ]
    },
    juvenile: {
      idle: [
        [
          "......#####......",
          "....##xxxxx##....",
          "..##xxxxxxxxx##..",
          ".#xxxxxxxxxxxxx#.",
          "#x#xxexxxxxexx#x#",
          "#x#xxxxxxxxxxx#x#",
          ".#xxxxxxxxxxxxx#.",
          "..#xxxxxxxxxxx#..",
          "...##..###..##..."
        ],
        [
          "......#####......",
          "....##xxxxx##....",
          "..##xxxxxxxxx##..",
          ".#xxxxxxxxxxxxx#.",
          "##xxexxxxxexxx##",
          "#xxxxxxxxxxxxx#.",
          ".#xxxxxxxxxxx#..",
          "..###########...",
          ".....##..##......"
        ]
      ],
      walk: [
        [
          "......#####......",
          "....##xxxxx##....",
          "..##xxxxxxxxx##..",
          ".#xxxxxxxxxxxxx#.",
          "##xxexxxxxexxx##",
          "#xxxxxxxxxxxxx#.",
          ".#xxxxxxxxxxx#..",
          "..###########...",
          "....###..###....."
        ],
        [
          "......#####......",
          "....##xxxxx##....",
          "..##xxxxxxxxx##..",
          ".#xxxxxxxxxxxxx#.",
          "##xxexxxxxexxx##",
          "#xxxxxxxxxxxxx#.",
          ".#xxxxxxxxxxx#..",
          "..###########...",
          ".....##..##......"
        ]
      ],
      excited: [
        [
          "......#####......",
          "....##gxxxxg##...",
          "..##xxxxxxxxx##..",
          ".#xxxxxxxxxxxxx#.",
          "##xexxxxxexxxx##",
          "##xxxxxxxxxxxx##",
          ".#xxxxxxxxxxxx#.",
          "..############..",
          "....###..###...."
        ]
      ],
      sleep: [
        [
          "......#####......",
          "....##xxxxx##....",
          "..##xxxxxxxxx##..",
          ".#xx#######xx#.",
          "..###########...",
          "................"
        ]
      ]
    },
    adult: {
      idle: [
        [
          ".......######.......",
          ".....##xxxxxx##.....",
          "....#xxxxxxxxxx#....",
          "...#xxxxxxxxxxxx#...",
          "..#ggxexxxxxexgg#..",
          "..#xxxxxxxxxxxxxx#..",
          "...#xxxxxxxxxxxx#...",
          "....##xxxxxxxx##....",
          ".....#xxxxxxxx#.....",
          "....##..####..##....",
          "...###........###..."
        ],
        [
          ".......######.......",
          ".....##xxxxxx##.....",
          "....#xxxxxxxxxx#....",
          "...#xxxxxxxxxxxx#...",
          "..#gGxexxxxxexgG#..",
          "..#xxxxxxxxxxxxxx#..",
          "...#xxxxxxxxxxxx#...",
          "....##xxxxxxxx##....",
          ".....#xxxxxxxx#.....",
          "....##........##....",
          "....##........##...."
        ]
      ],
      walk: [
        [
          ".......######.......",
          ".....##xxxxxx##.....",
          "....#xxxxxxxxxx#....",
          "...#xxxxxxxxxxxx#...",
          "..#ggxexxxxxexgg#..",
          "..#xxxxxxxxxxxxxx#..",
          "...#xxxxxxxxxxxx#...",
          "....##xxxxxxxx##....",
          ".....#xxxxxxxx#.....",
          "....###......###....",
          "....#..........#...."
        ],
        [
          ".......######.......",
          ".....##xxxxxx##.....",
          "....#xxxxxxxxxx#....",
          "...#xxxxxxxxxxxx#...",
          "..#ggxexxxxxexgg#..",
          "..#xxxxxxxxxxxxxx#..",
          "...#xxxxxxxxxxxx#...",
          "....##xxxxxxxx##....",
          ".....#xxxxxxxx#.....",
          ".....##......##.....",
          ".....##......##....."
        ]
      ],
      excited: [
        [
          ".......######.......",
          "....###xxxxxx###....",
          "...#xxxxxxxxxxxx#...",
          "..#xxxxxxxxxxxxxx#..",
          ".#gggxexxxxxexggg#.",
          ".#xxxxxxxxxxxxxxxx#.",
          "..#xxxxxxxxxxxxxx#..",
          "...##xxxxxxxxxx##...",
          "....##xxxxxxxx##....",
          ".....##########.....",
          "....####....####...."
        ]
      ],
      sleep: [
        [
          ".......######.......",
          ".....##xxxxxx##.....",
          "....#xxxxxxxxxx#....",
          "...#############...",
          "....###########....",
          "..................."
        ]
      ]
    },
    legendary: {
      idle: [
        [
          "........######........",
          ".....###gggggg###.....",
          "....#xxxxxxxxxxxx#....",
          "...#xxxxxxxxxxxxxx#...",
          "..#gGxexxxxxxxexgG#..",
          "..#xxxxxxxxxxxxxxxx#..",
          "..#xxxggggggggxxxx#..",
          "...#xxxxxxxxxxxxxx#...",
          "....##xxxxxxxxxx##....",
          ".....##xxxxxxxx##.....",
          ".....###..##..###....."
        ],
        [
          "........######........",
          ".....###gggggg###.....",
          "....#xxxxxxxxxxxx#....",
          "...#xxxxxxxxxxxxxx#...",
          "..#gGxexxxxxxxexgG#..",
          "..#xxxxxxxxxxxxxxxx#..",
          "..#xxxggggggggxxxx#..",
          "...#xxxxxxxxxxxxxx#...",
          "....##xxxxxxxxxx##....",
          ".....##xxxxxxxx##.....",
          "......##......##......"
        ]
      ],
      walk: [
        [
          "........######........",
          ".....###gggggg###.....",
          "....#xxxxxxxxxxxx#....",
          "...#xxxxxxxxxxxxxx#...",
          "..#gGxexxxxxxxexgG#..",
          "..#xxxxxxxxxxxxxxxx#..",
          "..#xxxggggggggxxxx#..",
          "...#xxxxxxxxxxxxxx#...",
          "....##xxxxxxxxxx##....",
          ".....##xxxxxxxx##.....",
          ".....####....####....."
        ],
        [
          "........######........",
          ".....###gggggg###.....",
          "....#xxxxxxxxxxxx#....",
          "...#xxxxxxxxxxxxxx#...",
          "..#gGxexxxxxxxexgG#..",
          "..#xxxxxxxxxxxxxxxx#..",
          "..#xxxggggggggxxxx#..",
          "...#xxxxxxxxxxxxxx#...",
          "....##xxxxxxxxxx##....",
          ".....##xxxxxxxx##.....",
          "......##......##......"
        ]
      ],
      excited: [
        [
          "......##########......",
          "....###gggggggg###....",
          "...#xxxxxxxxxxxxxx#...",
          "..#xxxxxxxxxxxxxxxx#..",
          ".#gGgxexxxxxxxexgGg#.",
          ".#xxxxxxxxxxxxxxxxxx#.",
          ".#xxxxggggggggxxxxxx#.",
          "..#xxxxxxxxxxxxxxxx#..",
          "...##xxxxxxxxxxxx##...",
          ".....############.....",
          "....#####....#####...."
        ]
      ],
      sleep: [
        [
          "........######........",
          ".....###gggggg###.....",
          "....#xxxxxxxxxxxx#....",
          "...##############...",
          "....############....",
          "...................."
        ]
      ]
    }
  },

  // Map levels to stage strings
  getStage(level) {
    if (level <= 10) return "egg";
    if (level <= 30) return "baby";
    if (level <= 60) return "juvenile";
    if (level <= 90) return "adult";
    return "legendary";
  },

  // Particles system manager
  particles: [],

  spawnParticle(x, y, type, color) {
    let vx = (Math.random() - 0.5) * 1.5;
    let vy = (Math.random() - 0.5) * 1.5 - 0.8;
    let life = 30 + Math.random() * 20;
    
    if (type === "sleep") {
      vx = Math.random() * 0.4 + 0.2;
      vy = -Math.random() * 0.5 - 0.3;
      life = 60;
    } else if (type === "excited") {
      vx = (Math.random() - 0.5) * 3;
      vy = -Math.random() * 2 - 1;
      life = 40;
    } else if (type === "rain") {
      vx = -0.2;
      vy = Math.random() * 2 + 2;
      x = x + (Math.random() - 0.5) * 60;
      y = y - 30;
      life = 30;
    }

    this.particles.push({
      x, y, vx, vy, type, color, life, maxLife: life
    });
  },

  updateParticles(ctx) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;

      if (p.type === "sleep") {
        ctx.fillStyle = p.color;
        ctx.font = "bold 12px monospace";
        ctx.fillText("Z", p.x, p.y);
      } else if (p.type === "excited") {
        ctx.fillStyle = p.color;
        // Draw small diamond/star
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x + 4, p.y);
        ctx.lineTo(p.x, p.y + 4);
        ctx.lineTo(p.x - 4, p.y);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === "rain") {
        ctx.strokeStyle = "rgba(0, 160, 255, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 1, p.y + 6);
        ctx.stroke();
      } else if (p.type === "sparkle") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      ctx.restore();
    }
  },

  // Main draw loop
  draw(canvas, stateName, animFrame, themeName, level, isSleeping, sadnessRatio = 0) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const stage = this.getStage(level);
    const theme = this.themes[themeName] || this.themes["neon-cyan"];
    
    // Choose correct state sprite list
    let stateList = this.sprites[stage][stateName];
    if (isSleeping) {
      stateList = this.sprites[stage]["sleep"] || this.sprites[stage]["idle"];
    }
    if (!stateList) {
      stateList = this.sprites[stage]["idle"];
    }

    const frameIdx = animFrame % stateList.length;
    const spriteRows = stateList[frameIdx];

    // Compute pixel scaling
    const rows = spriteRows.length;
    const cols = spriteRows[0].length;
    const pixelSize = Math.floor(Math.min(canvas.width / cols, canvas.height / rows) * 0.8);
    
    const xOffset = Math.floor((canvas.width - cols * pixelSize) / 2);
    const yOffset = Math.floor((canvas.height - rows * pixelSize) / 2);

    // Dynamic particles spawn based on state
    if (Math.random() < 0.1) {
      const petCenterX = canvas.width / 2;
      const petCenterY = canvas.height / 2;

      if (isSleeping) {
        this.spawnParticle(petCenterX + 10, petCenterY - 10, "sleep", theme.glow);
      } else if (stateName === "excited") {
        this.spawnParticle(petCenterX, petCenterY, "excited", "#ff007f");
        this.spawnParticle(petCenterX, petCenterY, "excited", "#ffd700");
      } else if (sadnessRatio > 0.5) {
        this.spawnParticle(petCenterX, petCenterY, "rain", "#00a8ff");
      } else {
        // Normal sparkles
        this.spawnParticle(
          petCenterX + (Math.random() - 0.5) * 30,
          petCenterY + (Math.random() - 0.5) * 30,
          "sparkle",
          theme.glow
        );
      }
    }

    // Update & draw background particles
    this.updateParticles(ctx);

    // Draw the procedural pixel art
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = theme.glow;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = spriteRows[r][c];
        if (char === ".") continue;

        let color = theme.body;
        if (char === "#") {
          color = theme.accent;
        } else if (char === "x") {
          color = theme.accent;
        } else if (char === "e") {
          color = theme.eye;
        } else if (char === "g") {
          color = theme.glow;
        } else if (char === "G") {
          color = "#ffffff";
        }

        ctx.fillStyle = color;
        // Pixel-perfect grid drawing
        ctx.fillRect(
          xOffset + c * pixelSize,
          yOffset + r * pixelSize,
          pixelSize - 0.5,
          pixelSize - 0.5
        );
      }
    }
    ctx.restore();
  }
};

// Make accessible in both node/worker and browser global context
if (typeof module !== "undefined" && module.exports) {
  module.exports = PetEngine;
} else {
  window.PetEngine = PetEngine;
}

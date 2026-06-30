/**
 * Chronos Toolbox — Bouncing Balls Background Animation
 * Lightweight, battery-friendly HTML5 Canvas particle system.
 */

(function () {
  // Config
  const BALL_COUNT_RATIO = 0.02; // Number of balls per pixel width
  const MIN_BALLS = 15;
  const MAX_BALLS = 40;
  
  // Neon translucent color palette
  const COLORS = [
    'rgba(0, 240, 255, 0.35)',   // Electric Cyan
    'rgba(255, 126, 159, 0.35)', // Rose / Pink
    'rgba(162, 123, 255, 0.35)', // Violet / Purple
    'rgba(255, 159, 67, 0.35)',  // Neon Orange
    'rgba(52, 211, 153, 0.35)'   // Mint Green
  ];

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'bouncing-balls-bg';
  
  // Style canvas to stay fixed in background
  Object.assign(canvas.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    zIndex: '-1',
    pointerEvents: 'none',
    opacity: '0.7',
    background: 'transparent'
  });
  
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  
  let balls = [];
  let animationFrameId = null;
  let isPaused = false;

  class Ball {
    constructor() {
      this.radius = Math.random() * 4 + 3; // 3px to 7px
      this.reset(true);
    }

    reset(initPhase = false) {
      this.x = Math.random() * canvas.width;
      // Start near top if resizing, otherwise randomize
      this.y = initPhase ? Math.random() * canvas.height : -this.radius;
      
      // Random velocities
      const speed = Math.random() * 0.6 + 0.3; // Gentle floating speed
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      
      // Select random color
      this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Bounce off horizontal walls
      if (this.x - this.radius <= 0) {
        this.x = this.radius;
        this.vx *= -1;
      } else if (this.x + this.radius >= canvas.width) {
        this.x = canvas.width - this.radius;
        this.vx *= -1;
      }

      // Bounce off vertical walls
      if (this.y - this.radius <= 0) {
        this.y = this.radius;
        this.vy *= -1;
      } else if (this.y + this.radius >= canvas.height) {
        this.y = canvas.height - this.radius;
        this.vy *= -1;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      
      // Apply beautiful subtle neon glow
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      
      ctx.fill();
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Adjust number of balls based on width
    const targetCount = Math.max(MIN_BALLS, Math.min(MAX_BALLS, Math.floor(canvas.width * BALL_COUNT_RATIO)));
    
    if (balls.length < targetCount) {
      while (balls.length < targetCount) {
        balls.push(new Ball());
      }
    } else if (balls.length > targetCount) {
      balls.splice(targetCount);
    }
  }

  function animate() {
    if (isPaused) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Disable shadow blur for clear canvas clearing, then enable per ball
    ctx.shadowBlur = 0;
    
    for (let i = 0; i < balls.length; i++) {
      balls[i].update();
      balls[i].draw();
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  // Lifecycle & Performance listeners
  window.addEventListener('resize', resizeCanvas);
  
  // Pause animation when page is hidden to save CPU/Battery
  document.addEventListener('visibilitychange', () => {
    isPaused = document.hidden;
    if (!isPaused) {
      animate();
    } else if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  });

  // Initialise
  resizeCanvas();
  animate();
})();

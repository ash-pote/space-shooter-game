let stars = [];
let numStars = 1000;
let speed = 2;

const socket = io();
let gamestate = {};
let bullets = []; // Store bullets
let globalBullets = []; // Store bullets from all players

let moveData = { dx: 0, dy: 0, movingUp: false }; // Movement state
let movementInterval = 50; // Send updates every 50ms
let lastMovementSent = 0;

let enemyFleet;
let enemySpawnInterval = 2000; // Time in milliseconds between spawns
let lastEnemySpawnTime = 0;

// Synchronize gamestate with the server
socket.on("state: ", function (newGamestate) {
  gamestate = newGamestate;
});

socket.on("bullets: ", function (serverBullets) {
  globalBullets = serverBullets; // Update global bullets array
});

function setup() {
  createCanvas(windowWidth, windowHeight);

  let enter = createInput("Enter name").changed(function (e) {
    socket.emit("name", e.target.value);
  });
  enter.position(windowWidth - 170, 10);

  for (let i = 0; i < numStars; i++) {
    stars.push(new Star());
  }

  enemyFleet = [
    { x: random(0, width), y: 90, radius: 25, speed: 6 },
    { x: random(0, width), y: 180, radius: 30, speed: 4 },
    { x: random(0, width), y: 250, radius: 20, speed: 3 },
  ];
}

function draw() {
  background(0);

  // Update and display stars
  for (let star of stars) {
    star.update();
    star.show();
  }

  // Continuous movement handling
  moveData.dx = 0;
  moveData.dy = 0;
  moveData.movingUp = false;

  if (keyIsDown(LEFT_ARROW)) moveData.dx = -5;
  if (keyIsDown(RIGHT_ARROW)) moveData.dx = 5;
  if (keyIsDown(UP_ARROW)) {
    moveData.dy = -5;
    moveData.movingUp = true;
  }
  if (keyIsDown(DOWN_ARROW)) moveData.dy = 5;

  let now = millis();
  if (now - lastMovementSent > movementInterval) {
    socket.emit("move", moveData); // Send movement data to the server
    lastMovementSent = now;
  }

  // Spawn new enemies over time
  if (now - lastEnemySpawnTime > enemySpawnInterval) {
    spawnEnemy();
    lastEnemySpawnTime = now;
  }

  // Render all spaceships based on gamestate
  for (let id in gamestate) {
    let player = gamestate[id];
    renderSpaceship(player.x, player.y, id === socket.id, player.movingUp);

    // Draw player name and score
    fill("white");
    textSize(12);
    text(
      `${player.name}: ${player.score}`,
      10,
      10 + 20 * Object.keys(gamestate).indexOf(id)
    );
  }

  // Update and display bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].update();
    bullets[i].display();

    // Check for collision with any enemy ship in the enemyFleet
    for (let j = enemyFleet.length - 1; j >= 0; j--) {
      if (checkCollision(bullets[i], enemyFleet[j])) {
        bullets.splice(i, 1); // Remove the bullet
        enemyFleet.splice(j, 1); // Remove the enemy ship
        socket.emit("point"); // Award a point
        break; // Exit loop after collision
      }
    }

    if (bullets[i] && bullets[i].isOffScreen()) {
      bullets.splice(i, 1); // Remove bullets that are offscreen
    }
  }

  // Update and display enemy ships
  for (let i = enemyFleet.length - 1; i >= 0; i--) {
    let enemyShip = enemyFleet[i];

    // Draw the enemy ship
    noStroke();
    fill(0, 200, 45);
    rect(enemyShip.x, enemyShip.y, enemyShip.radius * 1.5, 20);

    // Move the enemy ship down
    enemyShip.y += 2;

    // Remove enemy ship if it moves off the bottom of the screen
    if (enemyShip.y > height + enemyShip.radius) {
      enemyFleet.splice(i, 1);
    }
  }

  // Render global bullets
  for (let bullet of globalBullets) {
    fill(255, 0, 0);
    noStroke();
    rect(bullet.x - 2, bullet.y, 4, -20); // Draw global bullets
  }

  // Instructions
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Use arrow keys to move. Press SPACE to shoot!", 10, windowHeight - 30);
}

let lastSent = 0;

// Collision detection function
function checkCollision(bullet, enemyShip) {
  let distance = dist(bullet.x, bullet.y, enemyShip.x, enemyShip.y);
  return distance < enemyShip.radius + bullet.width / 2;
}

function spawnEnemy() {
  let newEnemy = {
    x: random(0, width),
    y: -50, // Start slightly above the top of the screen
    radius: random(15, 30), // Random radius
    speed: random(3, 6), // Random speed
  };

  enemyFleet.push(newEnemy);
}

function keyPressed() {
  let moveData = { dx: 0, dy: 0, movingUp: false, shoot: false };

  let speed = 5;

  // Movement keys
  if (keyIsDown(LEFT_ARROW)) moveData.dx = -10;
  if (keyIsDown(RIGHT_ARROW)) moveData.dx = 10;
  if (keyIsDown(UP_ARROW)) {
    moveData.dy = -10;
    moveData.movingUp = true;
  }
  if (keyIsDown(DOWN_ARROW)) moveData.dy = 10;

  let now = millis();
  if (now - lastMovementSent > movementInterval) {
    socket.emit("move", moveData); // Send movement data to the server
    lastMovementSent = now;
  }

  // Shooting
  if (key === " ") {
    let x = gamestate[socket.id]?.x || width / 2;
    let y = gamestate[socket.id]?.y || height - 50;

    let bullet = new Bullet(x, y - 40); // Create a new bullet locally
    bullets.push(bullet);
    socket.emit("shoot", { x: x, y: y - 40 }); // Send to server

    moveData.shoot = true; // Indicate a shooting action
  }
}

// Render a spaceship
function renderSpaceship(x, y, isSelf, movingUp) {
  push();
  translate(x, y);

  // Spaceship body
  fill(isSelf ? "green" : "blue"); // Highlight your spaceship
  noStroke();
  triangle(-20, 20, 20, 20, 0, -40);

  // Cockpit
  fill(0, 255, 255);
  ellipse(0, -20, 20, 20);

  // Flames if moving up
  if (moveData.movingUp) {
    fill(255, random(100, 200), 0, random(150, 255)); // Flickering flame
    triangle(-10, 25, 10, 25, 0, 40 + random(5, 15));
  }

  pop();
}

// Bullet class
class Bullet {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 4; // Laser width
    this.height = 20; // Laser height (streak length)
    this.speed = 12;
  }

  update() {
    this.y -= this.speed; // Move laser upwards
  }

  display() {
    fill(255, 0, 0);
    noStroke();
    rect(this.x - this.width / 2, this.y, this.width, -this.height); // Vertical rectangle
  }

  isOffScreen() {
    return this.y + this.height < 0; // Check if the laser is off the top of the screen
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // Optional: Re-initialize stars for new canvas size
  stars = [];
  for (let i = 0; i < numStars; i++) {
    stars.push(new Star());
  }
}

// Star class
class Star {
  constructor() {
    this.reset();
  }
  reset() {
    this.x = random(-width, width); // Random horizontal position
    this.y = random(-height, height); // Random vertical position
    this.z = random(width); // Depth value
    this.pz = this.z; // Previous depth
  }
  update() {
    this.z -= speed;
    if (this.z < 1) {
      this.reset();
    }
  }
  show() {
    fill(255);
    noStroke();
    // Adjust the origin to the center of the canvas
    let originX = width / 2; // Center horizontally
    let originY = height / 2; // Center vertically
    // Map the star's position relative to the new origin
    let sx = map(this.x / this.z, 0, 1, originX, width);
    let sy = map(this.y / this.z, 0, 1, originY, height);
    // Map the size of the star
    let r = map(this.z, 0, width, 8, 0);
    ellipse(sx, sy, r, r);
    // Previous position for the trailing line
    let px = map(this.x / this.pz, 0, 1, originX, width);
    let py = map(this.y / this.pz, 0, 1, originY, height);
    this.pz = this.z;
    // Draw the trailing line
    stroke(255);
    line(px, py, sx, sy);
  }
}

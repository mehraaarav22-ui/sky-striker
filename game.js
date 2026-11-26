const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

const ui = {
  status: document.getElementById("statusText"),
  stage: document.getElementById("stageValue"),
  score: document.getElementById("scoreValue"),
  lives: document.getElementById("livesValue"),
  progress: document.getElementById("progressBar"),
  hint: document.getElementById("stageHint"),
  start: document.getElementById("startOverlay"),
  over: document.getElementById("gameOverOverlay"),
  name: document.getElementById("playerName")
};

let game, keys = {}, lastTime = 0, animationId = null;

// Mobile input state: touch steering works without motion permission.
// Gyroscope support is optional because some browsers require a user gesture.
let touchActive = false;
let touchTarget = null;
let gyroEnabled = false;
let gyroNeutral = null;
let gyroTilt = 0;
const gyroButton = document.getElementById("gyroButton");
const fireButton = document.getElementById("fireButton");
const gyroStatus = document.getElementById("gyroStatus");
const canvasWrap = document.querySelector(".canvas-wrap");

function resetGame() {
  game = {
    running: true, score: 0, lives: 3, stage: 1, time: 0,
    player: {x: W/2, y: H-75, w: 34, h: 42, speed: 310, cooldown: 0},
    bullets: [], enemies: [], obstacles: [], particles: [],
    enemyTimer: 0, obstacleTimer: 0, boss: null, bossSpawned: false,
    name: (ui.name.value.trim() || "Pilot").slice(0,20)
  };
  ui.start.classList.add("hidden");
  ui.over.classList.add("hidden");
  ui.status.textContent = "MISSION IN PROGRESS";
  updateHUD();
  lastTime = performance.now();
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function stageConfig() {
  return {
    1: {enemySpeed: 95, enemyRate: 1.15, obstacleRate: 2.8, target: 100},
    2: {enemySpeed: 145, enemyRate: .78, obstacleRate: 1.8, target: 260},
    3: {enemySpeed: 195, enemyRate: .52, obstacleRate: 1.2, target: 500}
  }[game.stage];
}

function updateHUD() {
  ui.stage.textContent = `0${game.stage} / 03`;
  ui.score.textContent = String(game.score).padStart(5,"0");
  ui.lives.textContent = "♥ ".repeat(game.lives).trim() || "—";
  const previous = [0,100,260][game.stage-1];
  const target = [100,260,500][game.stage-1];
  ui.progress.style.width = `${Math.min(100, Math.max(0,(game.score-previous)/(target-previous)*100))}%`;
  ui.hint.textContent = ["Stage 1: Learn the flight path.","Stage 2: Watch out for the asteroid field.","Stage 3: Final sector. Prepare for the boss!"][game.stage-1];
  for (let i=1;i<=3;i++) {
    const el = document.getElementById(`stageCard${i}`);
    el.classList.toggle("active", i===game.stage);
    el.classList.toggle("done", i<game.stage);
  }
}

function changeStage(stage) {
  game.stage = stage;
  game.enemies = [];
  game.obstacles = [];
  game.enemyTimer = 0;
  game.obstacleTimer = 0;
  if (stage === 3) game.bossSpawned = false;
  updateHUD();
  flashText(`STAGE ${stage} // ${["BEGINNER","ADVANCED","EXPERT"][stage-1]}`);
}

let announcement = "", announcementTime = 0;
function flashText(text) { announcement = text; announcementTime = 1.8; }

function spawnEnemy() {
  const cfg = stageConfig();
  const x = 35 + Math.random()*(W-70);
  game.enemies.push({x, y:-35, w:30, h:32, speed:cfg.enemySpeed*(.8+Math.random()*.5), sway:Math.random()*6.28, hp:1});
}

function spawnObstacle() {
  const size = 13 + Math.random()*15;
  game.obstacles.push({x:size+Math.random()*(W-size*2),y:-30,r:size,speed:stageConfig().enemySpeed*.72+45,spin:Math.random()*6});
}

function spawnBoss() {
  game.boss = {x:W/2,y:78,w:100,h:62,hp:18,maxHp:18,dir:1,fireTimer:1.2,bullets:[]};
  flashText("WARNING // COMMANDER APPROACHING");
}

function addParticles(x,y,color,count=8) {
  for(let i=0;i<count;i++) game.particles.push({x,y,vx:(Math.random()-.5)*170,vy:(Math.random()-.5)*170,life:.45+Math.random()*.35,color});
}

function hitPlayer() {
  if (game.player.invincible > 0) return;
  game.lives--;
  game.player.invincible = 1.2;
  addParticles(game.player.x,game.player.y,"#ff7185",18);
  updateHUD();
  if (game.lives <= 0) endGame(false);
}

function endGame(won) {
  game.running = false;
  ui.status.textContent = won ? "MISSION COMPLETE" : "SIGNAL LOST";
  document.getElementById("endTitle").textContent = won ? "GALAXY SAVED!" : "MISSION OVER";
  document.getElementById("endMessage").textContent = won ? "Outstanding flying, pilot. All sectors cleared." : "Your flight has ended. Ready for another run?";
  document.getElementById("finalScore").textContent = game.score;
  ui.over.classList.remove("hidden");
  fetch("/save-score", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({name:game.name,score:game.score,stage:game.stage})
  }).then(loadLeaderboard).catch(()=>{});
  if (animationId) cancelAnimationFrame(animationId);
}

function update(dt) {
  game.time += dt;
  const p = game.player, cfg = stageConfig();
  let dx = (keys.ArrowRight||keys.d ? 1:0) - (keys.ArrowLeft||keys.a ? 1:0);
  let dy = (keys.ArrowDown||keys.s ? 1:0) - (keys.ArrowUp||keys.w ? 1:0);

  // Touch dragging moves the ship toward the finger position.
  if (touchActive && touchTarget) {
    p.x += (touchTarget.x - p.x) * Math.min(1, 13 * dt);
    p.y += (touchTarget.y - p.y) * Math.min(1, 13 * dt);
  } else {
    // Tilt the phone left/right to steer. Re-centre the phone to stop.
    if (gyroEnabled) dx += Math.max(-1, Math.min(1, gyroTilt / 22));
    p.x = Math.max(22,Math.min(W-22,p.x+dx*p.speed*dt));
    p.y = Math.max(35,Math.min(H-25,p.y+dy*p.speed*dt));
  }
  p.x = Math.max(22,Math.min(W-22,p.x));
  p.y = Math.max(35,Math.min(H-25,p.y));
  p.cooldown -= dt;
  p.invincible = Math.max(0,(p.invincible||0)-dt);
  if ((keys.Space || keys[" "]) && p.cooldown<=0) {
    game.bullets.push({x:p.x,y:p.y-22,speed:470});
    p.cooldown=.19;
  }

  game.enemyTimer += dt;
  if(game.enemyTimer>=cfg.enemyRate){game.enemyTimer=0;spawnEnemy();}
  game.obstacleTimer += dt;
  if(game.obstacleTimer>=cfg.obstacleRate){game.obstacleTimer=0;spawnObstacle();}

  game.bullets.forEach(b=>b.y-=b.speed*dt);
  game.bullets=game.bullets.filter(b=>b.y>-15);

  game.enemies.forEach(e=>{e.y+=e.speed*dt;e.x+=Math.sin(game.time*2+e.sway)*25*dt;});
  game.obstacles.forEach(o=>{o.y+=o.speed*dt;o.spin+=dt;});
  game.enemies=game.enemies.filter(e=>e.y<H+40);
  game.obstacles=game.obstacles.filter(o=>o.y<H+40);

  // Player shots can remove enemy ships.
  for(let i=game.enemies.length-1;i>=0;i--){
    const e=game.enemies[i];
    for(let j=game.bullets.length-1;j>=0;j--){
      const b=game.bullets[j];
      if(Math.abs(e.x-b.x)<19 && Math.abs(e.y-b.y)<21){
        game.enemies.splice(i,1);game.bullets.splice(j,1);
        game.score+=10;addParticles(e.x,e.y,"#ff9d61");break;
      }
    }
  }

  // Boss appears after reaching the final-stage score target.
  if(game.stage===3 && game.score>=500 && !game.bossSpawned){game.bossSpawned=true;spawnBoss();}
  if(game.boss){
    const boss=game.boss;
    boss.x+=boss.dir*95*dt;
    if(boss.x>W-75||boss.x<75)boss.dir*=-1;
    boss.fireTimer-=dt;
    if(boss.fireTimer<=0){boss.bullets.push({x:boss.x,y:boss.y+24,speed:210});boss.fireTimer=.85;}
    boss.bullets.forEach(b=>b.y+=b.speed*dt);
    boss.bullets=boss.bullets.filter(b=>b.y<H+10);
    for(let j=game.bullets.length-1;j>=0;j--){
      const b=game.bullets[j];
      if(Math.abs(b.x-boss.x)<boss.w/2 && Math.abs(b.y-boss.y)<boss.h/2){
        game.bullets.splice(j,1);boss.hp--;addParticles(b.x,b.y,"#ffb46b",3);
        if(boss.hp<=0){addParticles(boss.x,boss.y,"#57e5ef",35);game.boss=null;game.score+=150;endGame(true);return;}
      }
    }
    boss.bullets.forEach(b=>{if(Math.abs(b.x-p.x)<14&&Math.abs(b.y-p.y)<18)hitPlayer();});
  }

  // Collision checks: enemy ships and asteroids are game obstacles.
  game.enemies.forEach(e=>{if(Math.abs(e.x-p.x)<23&&Math.abs(e.y-p.y)<25)hitPlayer();});
  game.obstacles.forEach(o=>{if(Math.hypot(o.x-p.x,o.y-p.y)<o.r+13)hitPlayer();});

  game.particles.forEach(pt=>{pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.life-=dt;});
  game.particles=game.particles.filter(pt=>pt.life>0);

  if(game.stage===1 && game.score>=100) changeStage(2);
  else if(game.stage===2 && game.score>=260) changeStage(3);
  updateHUD();
}

function drawBackground() {
  ctx.fillStyle="#07101e";ctx.fillRect(0,0,W,H);
  // Scrolling stars create the feeling of continuous flight.
  for(let i=0;i<85;i++){
    const x=(i*97)%W, base=(i*53)%H;
    const y=(base+game.time*(18+(i%4)*12))%H;
    ctx.fillStyle=i%7===0?"#57e5ef":"#7187a8";
    ctx.globalAlpha=.25+(i%5)*.12;
    ctx.fillRect(x,y,i%7===0?2:1,i%7===0?2:1);
  }
  ctx.globalAlpha=1;
  ctx.strokeStyle="#152944";ctx.lineWidth=1;
  for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
}

function drawShip(x,y,scale=1,color="#57e5ef") {
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
  ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=13;
  ctx.beginPath();ctx.moveTo(0,-23);ctx.lineTo(17,17);ctx.lineTo(5,12);ctx.lineTo(0,17);ctx.lineTo(-5,12);ctx.lineTo(-17,17);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle="#eafcff";ctx.fillRect(-2,0,4,9);
  ctx.fillStyle="#ffad70";ctx.beginPath();ctx.moveTo(-5,15);ctx.lineTo(0,27+Math.random()*5);ctx.lineTo(5,15);ctx.fill();
  ctx.restore();
}

function drawEnemy(e) {
  ctx.save();ctx.translate(e.x,e.y);ctx.fillStyle="#ff8c75";ctx.shadowColor="#ff705e";ctx.shadowBlur=10;
  ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(19,-13);ctx.lineTo(5,-8);ctx.lineTo(0,-18);ctx.lineTo(-5,-8);ctx.lineTo(-19,-13);ctx.closePath();ctx.fill();ctx.restore();
}

function drawObstacle(o) {
  ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.spin);ctx.strokeStyle="#ff9d61";ctx.fillStyle="#503d43";ctx.lineWidth=2;ctx.shadowColor="#ff805d";ctx.shadowBlur=8;
  ctx.beginPath();for(let i=0;i<8;i++){let a=i*Math.PI/4,r=o.r*(.75+(i%2)*.3);let x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}

function draw() {
  drawBackground();
  game.obstacles.forEach(drawObstacle);
  game.enemies.forEach(drawEnemy);
  game.bullets.forEach(b=>{ctx.fillStyle="#b9fbff";ctx.shadowColor="#57e5ef";ctx.shadowBlur=10;ctx.fillRect(b.x-2,b.y-9,4,14);ctx.shadowBlur=0;});
  if(game.boss){
    const b=game.boss;ctx.fillStyle="#a94d70";ctx.shadowColor="#ff6f9a";ctx.shadowBlur=18;
    ctx.beginPath();ctx.moveTo(b.x,b.y+35);ctx.lineTo(b.x+55,b.y-20);ctx.lineTo(b.x+25,b.y-14);ctx.lineTo(b.x,b.y-32);ctx.lineTo(b.x-25,b.y-14);ctx.lineTo(b.x-55,b.y-20);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle="#25364d";ctx.fillRect(b.x-55,b.y-48,110,5);ctx.fillStyle="#ff7d9b";ctx.fillRect(b.x-55,b.y-48,110*(b.hp/b.maxHp),5);
    b.bullets.forEach(bullet=>{ctx.fillStyle="#ff718e";ctx.fillRect(bullet.x-3,bullet.y,6,13);});
  }
  const p=game.player;
  if(!p.invincible || Math.floor(game.time*12)%2===0)drawShip(p.x,p.y);
  game.particles.forEach(pt=>{ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle=pt.color;ctx.fillRect(pt.x,pt.y,3,3);});
  ctx.globalAlpha=1;
  if(announcementTime>0){announcementTime-=1/60;ctx.fillStyle="#57e5ef";ctx.font="bold 17px monospace";ctx.textAlign="center";ctx.shadowColor="#57e5ef";ctx.shadowBlur=15;ctx.fillText(announcement,W/2,58);ctx.shadowBlur=0;}
}

function loop(now) {
  if(!game.running)return;
  const dt=Math.min((now-lastTime)/1000,.035);lastTime=now;
  update(dt);draw();
  if(game.running)animationId=requestAnimationFrame(loop);
}

document.addEventListener("keydown",e=>{
  if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(e.code))e.preventDefault();
  keys[e.code==="Space"?"Space":e.key]=true;
});
document.addEventListener("keyup",e=>{keys[e.code==="Space"?"Space":e.key]=false;});

document.getElementById("startButton").addEventListener("click",resetGame);
document.getElementById("restartButton").addEventListener("click",resetGame);
document.getElementById("refreshBoard").addEventListener("click",loadLeaderboard);

// Convert screen coordinates to the game's 800 x 520 coordinate system.
function setTouchTarget(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width, scaleY = H / rect.height;
  touchTarget = {
    x: Math.max(22, Math.min(W-22, (event.clientX-rect.left)*scaleX)),
    y: Math.max(35, Math.min(H-25, (event.clientY-rect.top)*scaleY))
  };
}
canvas.addEventListener("pointerdown", event => {
  if (!game || !game.running || event.pointerType === "mouse") return;
  touchActive = true;
  setTouchTarget(event);
  try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
});
canvas.addEventListener("pointermove", event => {
  if (touchActive && event.pointerType !== "mouse") setTouchTarget(event);
});
function stopTouch() { touchActive = false; touchTarget = null; }
canvas.addEventListener("pointerup", stopTouch);
canvas.addEventListener("pointercancel", stopTouch);
canvas.addEventListener("lostpointercapture", stopTouch);

// Holding the on-screen fire button shoots continuously.
if (fireButton) {
  const startFire = event => { event.preventDefault(); keys.Space = true; fireButton.classList.add("pressed"); };
  const stopFire = event => { event.preventDefault(); keys.Space = false; fireButton.classList.remove("pressed"); };
  fireButton.addEventListener("pointerdown", startFire);
  fireButton.addEventListener("pointerup", stopFire);
  fireButton.addEventListener("pointercancel", stopFire);
  fireButton.addEventListener("pointerleave", stopFire);
}

// Device orientation permission is required by iOS Safari and some browsers.
// The button click is the user gesture needed to request it.
function handleOrientation(event) {
  if (!gyroEnabled || event.gamma === null || event.gamma === undefined) return;
  gyroTilt = event.gamma - (gyroNeutral ?? event.gamma);
}
async function enableGyro() {
  if (!("DeviceOrientationEvent" in window)) {
    gyroStatus.textContent = "This browser/device does not provide gyro controls.";
    return;
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        gyroStatus.textContent = "Motion permission was not granted. Touch steering still works.";
        return;
      }
    }
    window.addEventListener("deviceorientation", handleOrientation, true);
    gyroEnabled = true;
    gyroNeutral = null;
    gyroTilt = 0;
    // Capture the phone's current angle as neutral after the first sensor event.
    const calibrate = event => {
      if (event.gamma !== null && event.gamma !== undefined && gyroNeutral === null) {
        gyroNeutral = event.gamma;
        window.removeEventListener("deviceorientation", calibrate, true);
      }
    };
    window.addEventListener("deviceorientation", calibrate, true);
    gyroButton.classList.add("enabled");
    gyroButton.textContent = "◎ GYRO ON";
    gyroStatus.textContent = "Gyro enabled · Tilt left/right to steer · Tap again to turn off";
  } catch (error) {
    gyroStatus.textContent = "Could not enable gyro. Use touch steering instead.";
  }
}
function disableGyro() {
  gyroEnabled = false;
  gyroTilt = 0;
  window.removeEventListener("deviceorientation", handleOrientation, true);
  gyroButton.classList.remove("enabled");
  gyroButton.textContent = "◎ ENABLE GYRO";
  gyroStatus.textContent = "Touch steering is ready · Gyroscope is off";
}
if (gyroButton) {
  gyroButton.addEventListener("click", () => {
    if (gyroEnabled) disableGyro();
    else enableGyro();
  });
}

async function loadLeaderboard(){
  const list=document.getElementById("leaderboard");
  try{
    const response=await fetch("/leaderboard");
    const rows=await response.json();
    list.innerHTML="";
    if(!rows.length){list.innerHTML='<li class="empty-board">No scores yet. Be first!</li>';return;}
    rows.forEach((row,index)=>{
      const li=document.createElement("li");
      const name=document.createElement("span");name.textContent=`${index+1}. ${row.player_name}`;
      const score=document.createElement("em");score.textContent=row.score;
      li.append(name,score);list.appendChild(li);
    });
  }catch(error){list.innerHTML='<li class="empty-board">Leaderboard unavailable.</li>';}
}
loadLeaderboard();

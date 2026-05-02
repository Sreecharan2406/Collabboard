const socket = io();

let username = '';
let room = '';
let tool = 'pen';
let drawing = false;
let startX = 0, startY = 0, lastX = 0, lastY = 0;
let color = '#e2e8f0';
let size = 4;
let canvas, ctx, container;
let idleTimer = null;
let zoom = 1;
let undoStack = [];
let redoStack = [];
let snapshot = null;

// Cursor effects
let laserMode = false;
let myColor = null;
let confettiParticles = [];
let trailPoints = {};
let effectsCanvas = null;
let effectsCtx = null;
let animLoop = null;

// ── INIT ──────────────────────────────────────────────────
function getRoomFromURL() {
  var parts = window.location.pathname.split('/');
  if (parts[1] === 'room' && parts[2]) return decodeURIComponent(parts[2]);
  return '';
}

window.addEventListener('DOMContentLoaded', function() {
  var r = getRoomFromURL();
  if (r) document.getElementById('room-input').value = r;
});

function joinBoard() {
  var u = document.getElementById('username-input').value.trim();
  var r = document.getElementById('room-input').value.trim();
  if (!u || !r) { alert('Please enter your name and a room code!'); return; }
  username = u; room = r;

  document.getElementById('join-screen').classList.add('hidden');
  document.getElementById('board-screen').classList.remove('hidden');
  document.getElementById('room-label').textContent = '# ' + room;
  document.getElementById('user-label').textContent = username;

  container = document.getElementById('canvas-container');
  canvas = document.getElementById('whiteboard');
  ctx = canvas.getContext('2d');

  // Effects canvas on top
  effectsCanvas = document.createElement('canvas');
  effectsCanvas.style.position = 'absolute';
  effectsCanvas.style.top = '0';
  effectsCanvas.style.left = '0';
  effectsCanvas.style.pointerEvents = 'none';
  effectsCanvas.style.zIndex = '20';
  container.appendChild(effectsCanvas);
  effectsCtx = effectsCanvas.getContext('2d');

  // Pick a personal trail color
  var colors = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#fbbf24','#f87171'];
  myColor = colors[Math.floor(Math.random() * colors.length)];

  resizeCanvas();
  setupCanvas();
  setupKeyboard();
  startEffectsLoop();
  socket.emit('join-room', room);
  window.history.pushState({}, '', '/room/' + encodeURIComponent(room));
}

function resizeCanvas() {
  var w = container.offsetWidth;
  var h = container.offsetHeight;
  var img = canvas.width > 0 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width = w; canvas.height = h;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  if (img) ctx.putImageData(img, 0, 0);
  if (effectsCanvas) {
    effectsCanvas.width = w; effectsCanvas.height = h;
    effectsCanvas.style.width = w + 'px'; effectsCanvas.style.height = h + 'px';
  }
}
window.addEventListener('resize', function() { if (canvas) resizeCanvas(); });

// ── UNDO / REDO ───────────────────────────────────────────
function saveState() {
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
}
function undo() { if (!undoStack.length) return; redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); ctx.putImageData(undoStack.pop(), 0, 0); }
function redo() { if (!redoStack.length) return; undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); ctx.putImageData(redoStack.pop(), 0, 0); }

// ── KEYBOARD ─────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    if (e.key === ' ') { e.preventDefault(); enableLaser(); }
    if (e.key === 'p') setTool('pen');
    if (e.key === 'e') setTool('eraser');
    if (e.key === 't') setTool('text');
    if (e.key === 'f') setTool('fill');
    if (e.key === 'r') setTool('rect');
    if (e.key === 'c') setTool('circle');
    if (e.key === 'l') setTool('line');
    if (e.key === 'a') setTool('arrow');
  });
  document.addEventListener('keyup', function(e) {
    if (e.key === ' ') disableLaser();
  });
}

// ── TOOLS ────────────────────────────────────────────────
function setTool(t) {
  tool = t;
  document.querySelectorAll('.tool-btn').forEach(function(b) { b.classList.remove('active-tool'); });
  var btn = document.getElementById('btn-' + t);
  if (btn) btn.classList.add('active-tool');
  canvas.style.cursor = t === 'text' ? 'text' : t === 'fill' ? 'cell' : 'crosshair';
  if (t !== 'text') hideTextInput();
}

document.getElementById('color-picker').addEventListener('input', function(e) { color = e.target.value; });
document.getElementById('size-picker').addEventListener('input', function(e) {
  size = e.target.value;
  document.getElementById('size-label').textContent = size + 'px';
});
document.getElementById('room-input').addEventListener('keydown', function(e) { if (e.key === 'Enter') joinBoard(); });

// ── CANVAS EVENTS ─────────────────────────────────────────
function setupCanvas() {
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', function() { drawing = false; });
  canvas.addEventListener('dblclick', onDblClick);
}

function getPos(e) {
  var rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
}

function onMouseDown(e) {
  var pos = getPos(e);
  if (laserMode) return;
  if (tool === 'text') { showTextInput(e.clientX, e.clientY, pos.x, pos.y); return; }
  if (tool === 'fill') { saveState(); floodFill(Math.round(pos.x), Math.round(pos.y), color); return; }
  drawing = true;
  startX = pos.x; startY = pos.y; lastX = pos.x; lastY = pos.y;
  if (tool === 'pen' || tool === 'eraser') {
    saveState(); ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
  } else {
    snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

function onMouseMove(e) {
  var pos = getPos(e);

  // Send cursor with laser flag
  socket.emit('cursor-move', {
    room: room, username: username,
    x: e.clientX, y: e.clientY,
    color: myColor, laser: laserMode
  });

  // My own trail
  addTrailPoint('me', e.clientX, e.clientY, myColor, laserMode);

  clearTimeout(idleTimer);
  idleTimer = setTimeout(function() { socket.emit('cursor-idle', { room: room, username: username }); }, 3000);

  if (laserMode || !drawing) return;

  if (tool === 'pen' || tool === 'eraser') {
    ctx.strokeStyle = tool === 'eraser' ? '#0d0d0d' : color;
    ctx.lineWidth = tool === 'eraser' ? size * 3 : size;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineTo(pos.x, pos.y); ctx.stroke();
    socket.emit('draw', { room: room, type: 'pen', x1: lastX, y1: lastY, x2: pos.x, y2: pos.y, color: color, size: size, tool: tool });
    lastX = pos.x; lastY = pos.y;
  } else {
    ctx.putImageData(snapshot, 0, 0);
    drawShape(tool, startX, startY, pos.x, pos.y, color, size);
  }
}

function onMouseUp(e) {
  if (laserMode || !drawing) return;
  drawing = false;
  var pos = getPos(e);
  if (tool !== 'pen' && tool !== 'eraser') {
    saveState();
    drawShape(tool, startX, startY, pos.x, pos.y, color, size);
    socket.emit('draw', { room: room, type: 'shape', shape: tool, x1: startX, y1: startY, x2: pos.x, y2: pos.y, color: color, size: size });
  }
}

function onDblClick(e) {
  // Confetti burst on double click!
  spawnConfetti(e.clientX, e.clientY);
  socket.emit('confetti', { room: room, x: e.clientX, y: e.clientY, color: myColor });
}

// ── LASER POINTER ─────────────────────────────────────────
function enableLaser() {
  if (laserMode) return;
  laserMode = true;
  canvas.style.cursor = 'none';
  document.getElementById('btn-laser').classList.add('active-tool');
  showToast('🔴 Laser ON — hold Space');
}

function disableLaser() {
  laserMode = false;
  canvas.style.cursor = 'crosshair';
  document.getElementById('btn-laser').classList.remove('active-tool');
}

function toggleLaser() {
  if (laserMode) disableLaser();
  else enableLaser();
}

// ── CURSOR TRAILS ─────────────────────────────────────────
function addTrailPoint(id, x, y, col, isLaser) {
  if (!trailPoints[id]) trailPoints[id] = [];
  trailPoints[id].push({ x: x, y: y, color: col, laser: isLaser, age: 0, maxAge: isLaser ? 8 : 18 });
  if (trailPoints[id].length > 25) trailPoints[id].shift();
}

// ── CONFETTI ─────────────────────────────────────────────
function spawnConfetti(x, y) {
  var confettiColors = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#fbbf24','#f87171','#34d399'];
  for (var i = 0; i < 60; i++) {
    confettiParticles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.8) * 14,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      life: 1.0,
      shape: Math.random() > 0.5 ? 'rect' : 'circle'
    });
  }
}

// ── CLICK RIPPLE ─────────────────────────────────────────
var ripples = [];
function spawnRipple(x, y, col) {
  ripples.push({ x: x, y: y, r: 0, maxR: 60, color: col, life: 1.0 });
}

// ── EFFECTS ANIMATION LOOP ────────────────────────────────
function startEffectsLoop() {
  function loop() {
    animLoop = requestAnimationFrame(loop);
    if (!effectsCtx) return;
    effectsCtx.clearRect(0, 0, effectsCanvas.width, effectsCanvas.height);

    // Draw trails
    Object.keys(trailPoints).forEach(function(id) {
      var pts = trailPoints[id];
      for (var i = pts.length - 1; i >= 0; i--) {
        var p = pts[i];
        p.age++;
        var alpha = 1 - (p.age / p.maxAge);
        if (alpha <= 0) { pts.splice(i, 1); continue; }

        if (p.laser) {
          // Laser: bright red glow dot
          effectsCtx.beginPath();
          effectsCtx.arc(p.x, p.y, 6 * alpha, 0, Math.PI * 2);
          effectsCtx.fillStyle = 'rgba(255,50,50,' + alpha + ')';
          effectsCtx.fill();
          // Glow
          var grad = effectsCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20 * alpha);
          grad.addColorStop(0, 'rgba(255,80,80,' + (alpha * 0.6) + ')');
          grad.addColorStop(1, 'rgba(255,0,0,0)');
          effectsCtx.beginPath();
          effectsCtx.arc(p.x, p.y, 20 * alpha, 0, Math.PI * 2);
          effectsCtx.fillStyle = grad;
          effectsCtx.fill();
        } else {
          // Normal trail dot
          var radius = (3 * alpha);
          effectsCtx.beginPath();
          effectsCtx.arc(p.x, p.y, Math.max(0.5, radius), 0, Math.PI * 2);
          effectsCtx.fillStyle = p.color.replace(')', ',' + (alpha * 0.7) + ')').replace('rgb', 'rgba').replace('#', '');
          // Use hex color with alpha differently
          effectsCtx.globalAlpha = alpha * 0.7;
          effectsCtx.fillStyle = p.color;
          effectsCtx.fill();
          effectsCtx.globalAlpha = 1;
        }
      }
    });

    // Draw ripples
    for (var i = ripples.length - 1; i >= 0; i--) {
      var rip = ripples[i];
      rip.r += 3;
      rip.life -= 0.04;
      if (rip.life <= 0) { ripples.splice(i, 1); continue; }
      effectsCtx.beginPath();
      effectsCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      effectsCtx.strokeStyle = rip.color;
      effectsCtx.globalAlpha = rip.life * 0.6;
      effectsCtx.lineWidth = 2;
      effectsCtx.stroke();
      effectsCtx.globalAlpha = 1;
    }

    // Draw confetti
    for (var i = confettiParticles.length - 1; i >= 0; i--) {
      var p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.4; // gravity
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= 0.018;
      if (p.life <= 0) { confettiParticles.splice(i, 1); continue; }

      effectsCtx.save();
      effectsCtx.globalAlpha = p.life;
      effectsCtx.translate(p.x, p.y);
      effectsCtx.rotate(p.rotation * Math.PI / 180);
      effectsCtx.fillStyle = p.color;
      if (p.shape === 'rect') {
        effectsCtx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      } else {
        effectsCtx.beginPath();
        effectsCtx.arc(0, 0, p.size/2, 0, Math.PI * 2);
        effectsCtx.fill();
      }
      effectsCtx.restore();
    }
  }
  loop();
}

// ── SHAPES ───────────────────────────────────────────────
function drawShape(shape, x1, y1, x2, y2, col, sz) {
  ctx.strokeStyle = col; ctx.fillStyle = col;
  ctx.lineWidth = sz; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (shape === 'rect') {
    ctx.beginPath(); ctx.strokeRect(x1, y1, x2-x1, y2-y1);
  } else if (shape === 'circle') {
    var rx=(x2-x1)/2, ry=(y2-y1)/2;
    ctx.beginPath(); ctx.ellipse(x1+rx, y1+ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI*2); ctx.stroke();
  } else if (shape === 'line') {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  } else if (shape === 'arrow') {
    drawArrow(x1,y1,x2,y2,col,sz);
  } else if (shape === 'triangle') {
    ctx.beginPath(); ctx.moveTo((x1+x2)/2,y1); ctx.lineTo(x2,y2); ctx.lineTo(x1,y2); ctx.closePath(); ctx.stroke();
  }
}

function drawArrow(x1,y1,x2,y2,col,sz) {
  var headLen=Math.max(15,sz*4), angle=Math.atan2(y2-y1,x2-x1);
  ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=sz;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2,y2);
  ctx.lineTo(x2-headLen*Math.cos(angle-Math.PI/6), y2-headLen*Math.sin(angle-Math.PI/6));
  ctx.lineTo(x2-headLen*Math.cos(angle+Math.PI/6), y2-headLen*Math.sin(angle+Math.PI/6));
  ctx.closePath(); ctx.fill();
}

// ── FLOOD FILL ────────────────────────────────────────────
function floodFill(sx,sy,fillColorHex) {
  var imageData=ctx.getImageData(0,0,canvas.width,canvas.height), data=imageData.data;
  var idx=(sy*canvas.width+sx)*4;
  var tR=data[idx],tG=data[idx+1],tB=data[idx+2],tA=data[idx+3];
  var fR=parseInt(fillColorHex.slice(1,3),16),fG=parseInt(fillColorHex.slice(3,5),16),fB=parseInt(fillColorHex.slice(5,7),16);
  if(tR===fR&&tG===fG&&tB===fB) return;
  var stack=[[sx,sy]],w=canvas.width,h=canvas.height;
  while(stack.length){
    var p=stack.pop(),x=p[0],y=p[1];
    if(x<0||x>=w||y<0||y>=h) continue;
    var i=(y*w+x)*4;
    if(data[i]!==tR||data[i+1]!==tG||data[i+2]!==tB||data[i+3]!==tA) continue;
    data[i]=fR;data[i+1]=fG;data[i+2]=fB;data[i+3]=255;
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  ctx.putImageData(imageData,0,0);
}

// ── TEXT TOOL ─────────────────────────────────────────────
var textInput=document.getElementById('text-input');
var textCanvasX=0,textCanvasY=0;

function showTextInput(clientX,clientY,cx,cy) {
  textCanvasX=cx; textCanvasY=cy;
  textInput.style.left=clientX+'px';
  textInput.style.top=(clientY-56)+'px';
  textInput.value='';
  textInput.classList.remove('hidden');
  textInput.style.color=color;
  textInput.style.fontSize=Math.max(14,size*3)+'px';
  textInput.focus();
}

function hideTextInput() {
  if(!textInput.classList.contains('hidden')&&textInput.value.trim()){
    saveState();
    ctx.fillStyle=color;
    ctx.font=Math.max(14,size*3)+'px Inter, sans-serif';
    textInput.value.split('\n').forEach(function(line,i){
      ctx.fillText(line,textCanvasX,textCanvasY+(i*Math.max(18,size*3.5)));
    });
    socket.emit('draw',{room:room,type:'text',text:textInput.value,x:textCanvasX,y:textCanvasY,color:color,size:size});
  }
  textInput.classList.add('hidden'); textInput.value='';
}

textInput.addEventListener('blur',hideTextInput);
textInput.addEventListener('keydown',function(e){if(e.key==='Escape'){textInput.value='';hideTextInput();}});

// ── STICKY NOTES ─────────────────────────────────────────
var stickyColors=['#fef08a','#86efac','#93c5fd','#f9a8d4','#fdba74','#c4b5fd'];
var stickyCount=0;

function addStickyNote(){
  var col=stickyColors[stickyCount++%stickyColors.length];
  var sticky=document.createElement('div');
  sticky.className='sticky';
  sticky.style.background=col;
  sticky.style.left=(Math.random()*300+100)+'px';
  sticky.style.top=(Math.random()*200+80)+'px';
  sticky.innerHTML='<div class="sticky-header"><button class="sticky-delete" onclick="this.closest(\'.sticky\').remove()">✕</button></div><textarea placeholder="Type your note..."></textarea>';
  document.getElementById('sticky-layer').appendChild(sticky);
  makeDraggable(sticky);
  sticky.querySelector('textarea').focus();
}

function makeDraggable(el){
  var ox=0,oy=0,mx=0,my=0;
  el.addEventListener('mousedown',function(e){
    if(e.target.tagName==='TEXTAREA'||e.target.tagName==='BUTTON') return;
    e.preventDefault();mx=e.clientX;my=e.clientY;
    document.addEventListener('mousemove',drag);
    document.addEventListener('mouseup',stopDrag);
  });
  function drag(e){ox=mx-e.clientX;oy=my-e.clientY;mx=e.clientX;my=e.clientY;el.style.top=(el.offsetTop-oy)+'px';el.style.left=(el.offsetLeft-ox)+'px';}
  function stopDrag(){document.removeEventListener('mousemove',drag);document.removeEventListener('mouseup',stopDrag);}
}

// ── ZOOM ─────────────────────────────────────────────────
function zoomIn(){zoom=Math.min(3,zoom+0.1);applyZoom();}
function zoomOut(){zoom=Math.max(0.3,zoom-0.1);applyZoom();}
function applyZoom(){
  canvas.style.transform='scale('+zoom+')';
  document.getElementById('zoom-label').textContent=Math.round(zoom*100)+'%';
}

// ── SOCKET RECEIVE ────────────────────────────────────────
socket.on('draw',function(data){
  if(!ctx) return;
  if(data.type==='pen'){
    ctx.beginPath();ctx.moveTo(data.x1,data.y1);ctx.lineTo(data.x2,data.y2);
    ctx.strokeStyle=data.tool==='eraser'?'#0d0d0d':data.color;
    ctx.lineWidth=data.tool==='eraser'?data.size*3:data.size;
    ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  } else if(data.type==='shape'){
    drawShape(data.shape,data.x1,data.y1,data.x2,data.y2,data.color,data.size);
  } else if(data.type==='text'){
    ctx.fillStyle=data.color;
    ctx.font=Math.max(14,data.size*3)+'px Inter, sans-serif';
    data.text.split('\n').forEach(function(line,i){ctx.fillText(line,data.x,data.y+(i*Math.max(18,data.size*3.5)));});
  }
});

socket.on('confetti',function(data){
  spawnConfetti(data.x, data.y);
  spawnRipple(data.x, data.y, data.color || '#a78bfa');
});

// ── CURSORS ──────────────────────────────────────────────
var cursorElements={},cursorTimers={};
var cursorColorList=['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399'];
var colorIdx=0;

socket.on('cursor-move',function(data){
  // Add trail for remote user
  addTrailPoint(data.username, data.x, data.y, data.color || cursorColorList[0], data.laser);

  if(!cursorElements[data.username]){
    var col=data.color||cursorColorList[colorIdx++%cursorColorList.length];
    var el=document.createElement('div');
    el.className='remote-cursor';
    el.setAttribute('data-laser','false');
    el.innerHTML='<div class="cursor-dot" style="background:'+col+'"></div><div class="cursor-name" style="background:'+col+'">'+data.username+'</div>';
    document.getElementById('cursors').appendChild(el);
    cursorElements[data.username]={el:el,col:col};
  }

  var entry=cursorElements[data.username];
  var el=entry.el;
  el.classList.remove('idle');
  el.style.left=data.x+'px';
  el.style.top=data.y+'px';

  // Laser mode styling
  if(data.laser){
    el.querySelector('.cursor-dot').style.background='#ff3232';
    el.querySelector('.cursor-dot').style.width='14px';
    el.querySelector('.cursor-dot').style.height='14px';
    el.querySelector('.cursor-dot').style.boxShadow='0 0 10px #ff0000, 0 0 20px #ff0000';
  } else {
    el.querySelector('.cursor-dot').style.background=entry.col;
    el.querySelector('.cursor-dot').style.width='8px';
    el.querySelector('.cursor-dot').style.height='8px';
    el.querySelector('.cursor-dot').style.boxShadow='none';
  }

  clearTimeout(cursorTimers[data.username]);
  cursorTimers[data.username]=setTimeout(function(){el.classList.add('idle');},3000);
});

socket.on('cursor-idle',function(data){
  if(cursorElements[data.username]) cursorElements[data.username].el.classList.add('idle');
});

// ── UTILS ────────────────────────────────────────────────
function copyRoomLink(){
  var link=window.location.origin+'/room/'+encodeURIComponent(room);
  navigator.clipboard.writeText(link).then(function(){
    var btn=document.getElementById('copy-btn');
    btn.textContent='✓ Copied!';btn.classList.add('copied');
    showToast('Room link copied!');
    setTimeout(function(){btn.textContent='🔗 Link';btn.classList.remove('copied');},2000);
  });
}

function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  setTimeout(function(){t.classList.remove('show');},3000);
}

function clearCanvas(){saveState();ctx.clearRect(0,0,canvas.width,canvas.height);}

function exportPNG(){
  var link=document.createElement('a');
  link.download='collabboard.png';
  link.href=canvas.toDataURL();
  link.click();
}

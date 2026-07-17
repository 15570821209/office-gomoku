"use strict";

const SIZE = 15;
const state = {
  board: emptyBoard(), moves: [], turn: 1, winner: 0, winningCells: [],
  mode: "local", room: "", playerId: "", myColor: 0, version: 0,
  players: [], scores: [0, 0, 0], games: 1, sound: true,
  startedAt: Date.now(), turnStartedAt: Date.now(), resultShown: false,
  lastSignalId: "", polling: null,
};

const $ = (id) => document.getElementById(id);
const canvas = $("board");
const ctx = canvas.getContext("2d");
const welcome = $("welcomeDialog");
const resultDialog = $("resultDialog");
let selectedMode = "local";
let toastTimer;

function emptyBoard() { return Array.from({length: SIZE}, () => Array(SIZE).fill(0)); }

function drawBoard() {
  const scale = window.devicePixelRatio || 1;
  const cssSize = canvas.clientWidth || 720;
  const pixels = Math.round(cssSize * scale);
  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels; canvas.height = pixels;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pad = cssSize * .055;
  const gap = (cssSize - pad * 2) / (SIZE - 1);
  ctx.clearRect(0, 0, cssSize, cssSize);
  const gradient = ctx.createLinearGradient(0, 0, cssSize, cssSize);
  gradient.addColorStop(0, "#e3cc9b"); gradient.addColorStop(1, "#cfad6c");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, cssSize, cssSize);
  ctx.strokeStyle = "rgba(77,61,32,.7)"; ctx.lineWidth = Math.max(1, cssSize / 720);
  for (let i = 0; i < SIZE; i++) {
    const p = pad + i * gap;
    ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(cssSize - pad, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, cssSize - pad); ctx.stroke();
  }
  ctx.fillStyle = "rgba(71,55,26,.8)";
  [[3,3],[3,11],[7,7],[11,3],[11,11]].forEach(([r,c]) => {
    ctx.beginPath(); ctx.arc(pad + c*gap, pad + r*gap, Math.max(2.6, gap*.09), 0, Math.PI*2); ctx.fill();
  });
  state.moves.forEach((move, index) => drawStone(move.row, move.col, move.color, pad, gap, cssSize, index === state.moves.length - 1));
  if (state.winningCells.length) {
    ctx.strokeStyle = "#c45142"; ctx.lineWidth = Math.max(3, gap*.09); ctx.lineCap = "round";
    const sorted = [...state.winningCells].sort((a,b) => a[0]-b[0] || a[1]-b[1]);
    ctx.beginPath(); ctx.moveTo(pad+sorted[0][1]*gap, pad+sorted[0][0]*gap);
    const last = sorted[sorted.length-1]; ctx.lineTo(pad+last[1]*gap, pad+last[0]*gap); ctx.stroke();
  }
  canvas.dataset.pad = pad; canvas.dataset.gap = gap; canvas.dataset.cssSize = cssSize;
}

function drawStone(row, col, color, pad, gap, size, latest) {
  const x = pad + col*gap, y = pad + row*gap, radius = gap*.41;
  ctx.save(); ctx.shadowColor = "rgba(35,29,19,.28)"; ctx.shadowBlur = gap*.13; ctx.shadowOffsetY = gap*.08;
  const grad = ctx.createRadialGradient(x-radius*.35, y-radius*.4, radius*.08, x, y, radius);
  if (color === 1) { grad.addColorStop(0, "#686b68"); grad.addColorStop(.45, "#252725"); grad.addColorStop(1, "#080908"); }
  else { grad.addColorStop(0, "#fff"); grad.addColorStop(.62, "#f2f1ed"); grad.addColorStop(1, "#c5c5bf"); }
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x,y,radius,0,Math.PI*2); ctx.fill(); ctx.restore();
  if (latest) {
    ctx.fillStyle = color === 1 ? "#d7b76f" : "#55755e";
    ctx.beginPath(); ctx.arc(x,y,Math.max(2.4, radius*.16),0,Math.PI*2); ctx.fill();
  }
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left, y = event.clientY - rect.top;
  const pad = Number(canvas.dataset.pad), gap = Number(canvas.dataset.gap);
  const col = Math.round((x-pad)/gap), row = Math.round((y-pad)/gap);
  if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return null;
  if (Math.hypot(x-(pad+col*gap), y-(pad+row*gap)) > gap*.47) return null;
  return {row, col};
}

async function place(row, col) {
  if (state.winner || state.board[row][col]) return;
  if (state.mode === "online") {
    if (state.myColor !== state.turn) { showToast("还没轮到你，先假装忙一下"); return; }
    try { await api(`/api/rooms/${state.room}/move`, {row, col, playerId: state.playerId}); } catch (_) { /* 提示已由 api 显示 */ }
    return;
  }
  const color = state.turn;
  state.board[row][col] = color; state.moves.push({row, col, color});
  const winning = findWin(row, col, color);
  if (winning.length) { state.winner = color; state.winningCells = winning; finishGame(); }
  else state.turn = 3-color;
  state.turnStartedAt = Date.now(); playTone(color); render();
}

function findWin(row, col, color) {
  for (const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]) {
    const cells = [[row,col]];
    for (const sign of [1,-1]) {
      let r=row+dr*sign, c=col+dc*sign;
      while (r>=0&&r<SIZE&&c>=0&&c<SIZE&&state.board[r][c]===color) { cells.push([r,c]); r+=dr*sign; c+=dc*sign; }
    }
    if (cells.length >= 5) return cells;
  }
  return [];
}

function render() {
  drawBoard();
  const waiting = state.mode === "online" && state.players.length < 2;
  const myTurn = state.mode !== "online" || state.myColor === state.turn;
  $("statusText").textContent = state.winner ? `${state.winner===1?"黑":"白"}方完成连线` : waiting ? "等待搭子加入" : `${state.turn===1?"黑":"白"}方回合${state.mode==="online" ? (myTurn ? " · 该你了" : " · 等待搭子") : ""}`;
  $("statusDot").classList.toggle("white-turn", state.turn === 2);
  $("blackPlayer").classList.toggle("active", !state.winner && state.turn===1);
  $("whitePlayer").classList.toggle("active", !state.winner && state.turn===2);
  $("moveCount").textContent = `${state.moves.length} / 225`;
  $("moveMetric").textContent = state.moves.length;
  $("progressBar").style.width = `${state.moves.length/225*100}%`;
  $("blackScore").textContent = state.scores[1]; $("whiteScore").textContent = state.scores[2];
  $("gameCount").textContent = `第 ${state.games} 局`;
  const totalWins = state.scores[1]+state.scores[2];
  $("winRate").textContent = totalWins ? `${Math.round(state.scores[1]/totalWins*100)}%` : "--";
  updateNames();
}

function updateNames() {
  if (state.mode === "online") {
    const black = state.players.find(p=>p.color===1), white = state.players.find(p=>p.color===2);
    $("blackName").textContent = black ? `${black.name}${state.myColor===1?"（我）":""}` : "等待加入";
    $("whiteName").textContent = white ? `${white.name}${state.myColor===2?"（我）":""}` : "等待加入";
  }
}

function syncRemote(data, fromAction=false) {
  const previousWinner = state.winner, previousMoves = state.moves.length;
  state.board=data.board; state.moves=data.moves; state.turn=data.turn; state.winner=data.winner;
  state.winningCells=data.winningCells||[]; state.version=data.version; state.players=data.players||[];
  if (data.yourColor) state.myColor=data.yourColor;
  if (data.signal && data.signal.id !== state.lastSignalId) {
    state.lastSignalId=data.signal.id;
    $("signalMessage").textContent=`${data.signal.from}：${data.signal.text}`;
    if (!fromAction) showToast(`${data.signal.from}：${data.signal.text}`);
  }
  if (state.moves.length !== previousMoves) { state.turnStartedAt=Date.now(); if (state.moves.length>previousMoves) playTone(state.moves.at(-1).color); }
  render();
  if (!previousWinner && state.winner && !state.resultShown) finishGame();
}

async function api(path, body) {
  try {
    const response = await fetch(path, {method: body ? "POST":"GET", headers:{"Content-Type":"application/json","X-Player-Id":state.playerId}, body:body?JSON.stringify(body):undefined});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error||"网络开小差了");
    if (data.board) syncRemote(data, true);
    return data;
  } catch (error) { showToast(error.message); throw error; }
}

async function beginOnline(mode, name, code) {
  const data = mode === "create" ? await api("/api/rooms", {name}) : await api(`/api/rooms/${code}/join`, {name});
  state.mode="online"; state.room=data.code; state.playerId=data.playerId; state.myColor=data.yourColor;
  state.startedAt=Date.now(); state.turnStartedAt=Date.now(); syncRemote(data, true);
  localStorage.setItem("gomokuName", name); localStorage.setItem("gomokuSession", JSON.stringify({room:state.room,playerId:state.playerId}));
  $("roomLabel").textContent=`联机房间 ${state.room} · ${state.myColor===1?"执黑先手":"执白后手"}`;
  $("copyButton").hidden=false; $("signalPanel").hidden=false;
  history.replaceState(null,"",`?room=${state.room}`);
  state.polling=setInterval(pollRoom, 850);
}

async function pollRoom() {
  if (document.hidden || !state.room) return;
  try {
    const response=await fetch(`/api/rooms/${state.room}`,{headers:{"X-Player-Id":state.playerId}});
    if (!response.ok) return;
    const data=await response.json(); if(data.version!==state.version) syncRemote(data);
  } catch (_) { /* 下一轮自动重试 */ }
}

async function undo() {
  if (!state.moves.length) { showToast("还没有可以撤回的棋子"); return; }
  if (state.mode === "online") { try { await api(`/api/rooms/${state.room}/undo`, {playerId:state.playerId}); } catch (_) {} return; }
  const move=state.moves.pop(); state.board[move.row][move.col]=0; state.turn=move.color; state.winner=0; state.winningCells=[]; state.resultShown=false; render();
}

async function restart() {
  if (state.mode === "online") { try { await api(`/api/rooms/${state.room}/reset`,{playerId:state.playerId}); } catch (_) { return; } }
  else { state.board=emptyBoard(); state.moves=[]; state.turn=1; state.winner=0; state.winningCells=[]; render(); }
  state.games++; state.startedAt=Date.now(); state.turnStartedAt=Date.now(); state.resultShown=false;
  if (resultDialog.open) resultDialog.close(); render(); showToast("新一轮排期已开始");
}

function finishGame() {
  state.resultShown=true; state.scores[state.winner]++;
  const duration=formatTime((Date.now()-state.startedAt)/1000);
  $("winnerStone").className=`winner-stone stone ${state.winner===1?"black":"white"}`;
  $("resultTitle").textContent=`漂亮！${state.winner===1?"黑":"白"}方连成五子`;
  $("resultDetail").textContent=`本局共落下 ${state.moves.length} 子，用时 ${duration}`;
  render(); setTimeout(()=>resultDialog.showModal(), 500); playWin();
}

function toggleCover(force) {
  const active=typeof force==="boolean"?force:!$("coverScreen").classList.contains("active");
  $("coverScreen").classList.toggle("active",active); $("coverScreen").setAttribute("aria-hidden",String(!active));
  document.title=active?"Q3 重点项目交付进度跟踪":"协作排期表";
  $("coverTime").textContent=new Date().toLocaleString("zh-CN",{hour12:false});
}

function showToast(text) { clearTimeout(toastTimer); $("toast").textContent=text; $("toast").classList.add("show"); toastTimer=setTimeout(()=>$("toast").classList.remove("show"),2200); }
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return; }
  const area=document.createElement("textarea"); area.value=text; area.style.cssText="position:fixed;left:-9999px";
  document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
}
async function buildInviteUrl() {
  const url=new URL(location.href);
  if (["127.0.0.1","localhost","::1"].includes(url.hostname)) {
    try {
      const response=await fetch("/api/info");
      const info=await response.json();
      if (info.lanIp && info.lanIp!=="127.0.0.1") { url.hostname=info.lanIp; url.port=String(info.port||location.port); }
    } catch (_) { /* 获取不到时仍保留当前地址和房间码 */ }
  }
  url.search=new URLSearchParams({room:state.room}).toString(); url.hash="";
  return url.toString();
}
function formatTime(seconds) { const s=Math.max(0,Math.floor(seconds)); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; }
function playTone(color) { if(!state.sound)return; const ac=new(window.AudioContext||window.webkitAudioContext)(),o=ac.createOscillator(),g=ac.createGain(); o.frequency.value=color===1?240:320; g.gain.setValueAtTime(.045,ac.currentTime); g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.09); o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.1); }
function playWin() { if(!state.sound)return; [0,120,240].forEach((delay,i)=>setTimeout(()=>playTone(i%2+1),delay)); }

function initFakeTable() {
  const rows=[
    ["需求范围确认","李明","P0","07-16","85%","进行中","待业务方确认"],
    ["接口联调测试","王洁","P0","07-18","60%","进行中","核心链路已通"],
    ["数据口径复核","陈安","P1","07-19","100%","已完成","已归档"],
    ["灰度发布方案","周舟","P1","07-22","35%","进行中","周五评审"],
    ["权限矩阵梳理","刘晨","P2","07-23","20%","未开始","依赖组织架构"],
    ["监控指标配置","赵青","P1","07-24","45%","进行中","补充告警阈值"],
    ["用户手册更新","林一","P2","07-25","10%","未开始","等待界面冻结"],
    ["上线检查清单","孙可","P0","07-26","70%","进行中","剩余 6 项"],
    ["验收材料准备","何平","P1","07-28","0%","未开始","模板已同步"],
    ["阶段复盘会议","吴桐","P2","07-30","0%","未开始","会议室待定"],
  ];
  $("fakeTable").innerHTML=rows.map((r,i)=>`<tr><td>${i+1}</td>${r.map(x=>`<td>${x}</td>`).join("")}</tr>`).join("");
}

canvas.addEventListener("click",e=>{const p=pointFromEvent(e);if(p)place(p.row,p.col);});
window.addEventListener("resize",drawBoard);
document.addEventListener("keydown",e=>{
  if(document.body.classList.contains("arcade-open")) return;
  if(e.key==="Escape"){e.preventDefault();if(welcome.open||resultDialog.open)return;toggleCover();}
  if(!$("coverScreen").classList.contains("active")&&!welcome.open&&!resultDialog.open){if(e.key.toLowerCase()==="r")restart();if(e.key.toLowerCase()==="u")undo();}
});
$("panicButton").onclick=()=>toggleCover(true); $("backToGame").onclick=()=>toggleCover(false);
$("undoButton").onclick=undo; $("restartButton").onclick=restart; $("nextRound").onclick=restart; $("closeResult").onclick=()=>resultDialog.close();
$("soundButton").onclick=()=>{state.sound=!state.sound;$("soundButton").classList.toggle("muted",!state.sound);showToast(state.sound?"落子音效已开启":"已静音，放心摸鱼");};
$("copyButton").onclick=async()=>{const url=await buildInviteUrl();try{await copyText(`来下盘五子棋，房间码 ${state.room}\n${url}`);showToast("局域网邀请链接已复制");}catch(_){showToast(`房间码：${state.room}`);}};
document.querySelectorAll("[data-signal]").forEach(btn=>btn.onclick=async()=>{if(state.mode==="online"){try{await api(`/api/rooms/${state.room}/signal`,{playerId:state.playerId,text:btn.dataset.signal});}catch(_){}}else{$("signalMessage").textContent=`你：${btn.dataset.signal}`;showToast(btn.dataset.signal);}});
document.querySelectorAll("[data-mode]").forEach(btn=>btn.onclick=()=>{selectedMode=btn.dataset.mode;document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("selected",b===btn));$("roomCodeRow").hidden=selectedMode!=="join";});

$("welcomeForm").addEventListener("submit",async e=>{
  e.preventDefault(); $("formError").textContent="";
  const name=$("nickname").value.trim()||"摸鱼同事", code=$("roomCode").value.trim().toUpperCase();
  if(selectedMode==="join"&&code.length!==6){$("formError").textContent="请输入六位房间码";return;}
  $("startButton").disabled=true; $("startButton").textContent="正在接头…";
  try { if(selectedMode==="local"){$("blackName").textContent=name;localStorage.setItem("gomokuName",name);} else await beginOnline(selectedMode,name,code); welcome.close(); }
  catch(error){$("formError").textContent=error.message;}
  finally{$("startButton").disabled=false;$("startButton").textContent="开始摸鱼";}
});
$("laterButton").onclick=()=>welcome.close();

function tick(){const now=new Date();$("clock").textContent=now.toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit",hour12:false});$("turnTimer").textContent=formatTime((Date.now()-state.turnStartedAt)/1000);$("durationMetric").textContent=formatTime((Date.now()-state.startedAt)/1000);}

function init(){initFakeTable();$("nickname").value=localStorage.getItem("gomokuName")||"";const queryRoom=new URLSearchParams(location.search).get("room");if(queryRoom){selectedMode="join";$("roomCode").value=queryRoom.toUpperCase().slice(0,6);document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("selected",b.dataset.mode==="join"));$("roomCodeRow").hidden=false;}state.signalPanel=false;render();tick();setInterval(tick,1000);setTimeout(()=>welcome.showModal(),180);}
init();

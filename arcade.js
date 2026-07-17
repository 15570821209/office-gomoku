(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const layer = $("arcadeLayer");
  if (!layer) return;
  const appShell = document.querySelector(".app-shell");

  let activeGame = "home";
  let touchStart = null;
  const views = [...layer.querySelectorAll("[data-arcade-view]")];

  function showView(name) {
    activeGame = name;
    views.forEach((view) => { view.hidden = view.dataset.arcadeView !== name; });
    layer.scrollTop = 0;
    if (name === "2048" && !game2048.board.length) init2048();
    if (name === "mines" && !mines.cells.length) initMines();
    if (name === "tictactoe" && !ttt.board.length) initTtt();
  }

  function openArcade() {
    document.body.classList.add("arcade-open");
    if (appShell) appShell.inert = true;
    layer.classList.add("active");
    layer.setAttribute("aria-hidden", "false");
    showView("home");
    $("arcadeClose").focus();
  }

  function closeArcade() {
    document.body.classList.remove("arcade-open");
    if (appShell) appShell.inert = false;
    layer.classList.remove("active");
    layer.setAttribute("aria-hidden", "true");
    activeGame = "home";
    $("arcadeButton").focus();
  }

  $("arcadeButton").addEventListener("click", openArcade);
  $("arcadeClose").addEventListener("click", closeArcade);
  $("arcadePanic").addEventListener("click", () => { closeArcade(); $("panicButton").click(); });
  layer.querySelectorAll("[data-back-arcade]").forEach((button) => button.addEventListener("click", () => showView("home")));
  layer.querySelectorAll("[data-open-game]").forEach((button) => button.addEventListener("click", () => {
    const game = button.dataset.openGame;
    if (game === "gomoku") closeArcade(); else showView(game);
  }));

  document.addEventListener("keydown", (event) => {
    if (!document.body.classList.contains("arcade-open")) return;
    if (event.key === "Escape") {
      event.preventDefault(); event.stopImmediatePropagation();
      if (activeGame === "home") closeArcade(); else showView("home");
      return;
    }
    if (activeGame === "2048") {
      const keys = {ArrowLeft:"left",a:"left",ArrowRight:"right",d:"right",ArrowUp:"up",w:"up",ArrowDown:"down",s:"down"};
      const direction = keys[event.key];
      if (direction) { event.preventDefault(); move2048(direction); }
    }
  });

  // 2048
  const game2048 = { board: [], score: 0, best: Number(localStorage.getItem("office2048Best") || 0), won: false };
  function init2048() {
    game2048.board = Array(16).fill(0); game2048.score = 0; game2048.won = false;
    add2048(); add2048(); render2048();
    $("status2048").textContent = "把两个相同数字推到一起";
  }
  function add2048() {
    const empty = game2048.board.map((value,index)=>value?null:index).filter((value)=>value!==null);
    if (!empty.length) return;
    game2048.board[empty[Math.floor(Math.random()*empty.length)]] = Math.random() < .9 ? 2 : 4;
  }
  function mergeLine(line) {
    const compact = line.filter(Boolean), result=[];
    for (let i=0;i<compact.length;i++) {
      if (compact[i] === compact[i+1]) { const value=compact[i]*2; result.push(value); game2048.score+=value; i++; }
      else result.push(compact[i]);
    }
    while(result.length<4) result.push(0);
    return result;
  }
  function move2048(direction) {
    const before = game2048.board.join(","), next = Array(16).fill(0);
    for(let line=0;line<4;line++) {
      let values=[];
      for(let p=0;p<4;p++) {
        const row = (direction==="left"||direction==="right") ? line : p;
        const col = (direction==="left"||direction==="right") ? p : line;
        values.push(game2048.board[row*4+col]);
      }
      if(direction==="right"||direction==="down") values.reverse();
      values=mergeLine(values);
      if(direction==="right"||direction==="down") values.reverse();
      for(let p=0;p<4;p++) {
        const row=(direction==="left"||direction==="right")?line:p;
        const col=(direction==="left"||direction==="right")?p:line;
        next[row*4+col]=values[p];
      }
    }
    if (next.join(",") === before) return;
    game2048.board=next; add2048();
    if(game2048.score>game2048.best){game2048.best=game2048.score;localStorage.setItem("office2048Best",String(game2048.best));}
    if(!game2048.won&&game2048.board.some(v=>v>=2048)){game2048.won=true;$("status2048").textContent="🎉 完成 2048！还可以继续挑战";}
    else if(!canMove2048()) $("status2048").textContent="本轮已无可合并数字，点“重新开始”再来";
    render2048();
  }
  function canMove2048(){
    if(game2048.board.includes(0))return true;
    return game2048.board.some((v,i)=>(i%4<3&&v===game2048.board[i+1])||(i<12&&v===game2048.board[i+4]));
  }
  function render2048(){
    $("board2048").innerHTML=game2048.board.map((value,index)=>`<div class="tile-2048 ${value?`t${value>2048?"-super":value}`:"empty"}" role="gridcell" aria-label="第 ${Math.floor(index/4)+1} 行第 ${index%4+1} 列${value?`，数字 ${value}`:"，空"}">${value||""}</div>`).join("");
    $("score2048").textContent=game2048.score;$("best2048").textContent=game2048.best;
  }
  $("new2048").addEventListener("click",init2048);
  $("board2048").addEventListener("pointerdown",(e)=>{touchStart={x:e.clientX,y:e.clientY};});
  $("board2048").addEventListener("pointerup",(e)=>{if(!touchStart)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.max(Math.abs(dx),Math.abs(dy))<25)return;move2048(Math.abs(dx)>Math.abs(dy)?(dx>0?"right":"left"):(dy>0?"down":"up"));});

  // 扫雷
  const mines = { cells: [], started:false, over:false, flags:0, revealed:0, start:0, flagMode:false };
  const MINE_TOTAL=10, MINE_SIZE=9;
  function initMines(){
    mines.cells=Array.from({length:MINE_SIZE*MINE_SIZE},()=>({mine:false,revealed:false,flagged:false,count:0}));
    Object.assign(mines,{started:false,over:false,flags:0,revealed:0,start:0,flagMode:false});
    $("mineFace").textContent="🙂";$("mineStatus").textContent="点击格子开始排查 · 右键可插旗";$("mineTime").textContent="000";
    $("flagMode").classList.remove("active");$("flagMode").setAttribute("aria-pressed","false");$("flagMode").textContent="⚑ 插旗模式：关";renderMines();
  }
  function neighbors(index){const r=Math.floor(index/MINE_SIZE),c=index%MINE_SIZE,out=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if((dr||dc)&&nr>=0&&nr<MINE_SIZE&&nc>=0&&nc<MINE_SIZE)out.push(nr*MINE_SIZE+nc);}return out;}
  function placeMines(first){
    const banned=new Set([first,...neighbors(first)]),choices=mines.cells.map((_,i)=>i).filter(i=>!banned.has(i));
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    choices.slice(0,MINE_TOTAL).forEach(i=>mines.cells[i].mine=true);
    mines.cells.forEach((cell,i)=>cell.count=neighbors(i).filter(n=>mines.cells[n].mine).length);
  }
  function revealMine(index){
    const first=mines.cells[index]; if(mines.over||first.flagged||first.revealed)return;
    if(!mines.started){placeMines(index);mines.started=true;mines.start=Date.now();}
    if(first.mine){first.revealed=true;mines.over=true;mines.cells.forEach(c=>{if(c.mine)c.revealed=true;});$("mineFace").textContent="😵";$("mineStatus").textContent="踩到需求雷区了，重新排查吧";renderMines();return;}
    const queue=[index],seen=new Set();
    while(queue.length){const i=queue.shift();if(seen.has(i))continue;seen.add(i);const cell=mines.cells[i];if(cell.flagged||cell.revealed||cell.mine)continue;cell.revealed=true;mines.revealed++;if(cell.count===0)queue.push(...neighbors(i));}
    if(mines.revealed===MINE_SIZE*MINE_SIZE-MINE_TOTAL){mines.over=true;$("mineFace").textContent="😎";$("mineStatus").textContent=`排查完成！用时 ${Math.floor((Date.now()-mines.start)/1000)} 秒`;mines.cells.forEach(c=>{if(c.mine)c.flagged=true;});}
    renderMines();
  }
  function flagMine(index){const cell=mines.cells[index];if(mines.over||cell.revealed)return;if(!cell.flagged&&mines.flags>=MINE_TOTAL)return;cell.flagged=!cell.flagged;mines.flags+=cell.flagged?1:-1;renderMines();}
  function renderMines(){
    $("mineBoard").innerHTML=mines.cells.map((cell,index)=>{let text="",cls="mine-cell";if(cell.revealed){cls+=" revealed";if(cell.mine){cls+=" mine";text="✦";}else if(cell.count){cls+=` n${cell.count}`;text=cell.count;}}else if(cell.flagged){cls+=" flagged";text="⚑";}return `<button class="${cls}" role="gridcell" data-mine-index="${index}" aria-label="第 ${Math.floor(index/9)+1} 行第 ${index%9+1} 列${cell.flagged?"，已插旗":cell.revealed?(cell.mine?"，雷区":`，周围 ${cell.count} 个雷区`):"，未排查"}">${text}</button>`;}).join("");
    $("mineRemain").textContent=MINE_TOTAL-mines.flags;
  }
  $("mineBoard").addEventListener("click",e=>{const cell=e.target.closest("[data-mine-index]");if(!cell)return;const index=Number(cell.dataset.mineIndex);mines.flagMode?flagMine(index):revealMine(index);});
  $("mineBoard").addEventListener("contextmenu",e=>{const cell=e.target.closest("[data-mine-index]");if(!cell)return;e.preventDefault();flagMine(Number(cell.dataset.mineIndex));});
  $("mineBoard").addEventListener("keydown",e=>{const cell=e.target.closest("[data-mine-index]");if(cell&&e.key.toLowerCase()==="f"){e.preventDefault();flagMine(Number(cell.dataset.mineIndex));}});
  $("newMines").addEventListener("click",initMines);$("mineFace").addEventListener("click",initMines);
  $("flagMode").addEventListener("click",()=>{mines.flagMode=!mines.flagMode;$("flagMode").classList.toggle("active",mines.flagMode);$("flagMode").setAttribute("aria-pressed",String(mines.flagMode));$("flagMode").textContent=`⚑ 插旗模式：${mines.flagMode?"开":"关"}`;});
  setInterval(()=>{if(mines.started&&!mines.over&&activeGame==="mines")$("mineTime").textContent=String(Math.min(999,Math.floor((Date.now()-mines.start)/1000))).padStart(3,"0");},500);

  // 井字棋
  const ttt={board:[],turn:"X",over:false,scores:{X:0,O:0,D:0}};
  const WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  function initTtt(){ttt.board=Array(9).fill("");ttt.turn="X";ttt.over=false;renderTtt();$("tttStatus").textContent="项目经理先手";}
  function playTtt(index){
    if(ttt.over||ttt.board[index])return;ttt.board[index]=ttt.turn;
    const win=WINS.find(combo=>combo.every(i=>ttt.board[i]===ttt.turn));
    if(win){ttt.over=true;ttt.scores[ttt.turn]++;$("tttStatus").textContent=`${ttt.turn==="X"?"项目经理":"需求方"}连成一线，拿下本局`;renderTtt(win);return;}
    if(ttt.board.every(Boolean)){ttt.over=true;ttt.scores.D++;$("tttStatus").textContent="双方握手言和，再开一局";renderTtt();return;}
    ttt.turn=ttt.turn==="X"?"O":"X";$("tttStatus").textContent=`轮到${ttt.turn==="X"?"项目经理":"需求方"}落子`;renderTtt();
  }
  function renderTtt(win=[]){
    $("tttBoard").innerHTML=ttt.board.map((value,index)=>`<button class="ttt-cell ${value==="O"?"o":""} ${win.includes(index)?"win":""}" role="gridcell" data-ttt-index="${index}" aria-label="第 ${Math.floor(index/3)+1} 行第 ${index%3+1} 列${value?`，${value} 方`:"，空"}">${value==="X"?"×":value==="O"?"○":""}</button>`).join("");
    $("tttXPlayer").classList.toggle("active",!ttt.over&&ttt.turn==="X");$("tttOPlayer").classList.toggle("active",!ttt.over&&ttt.turn==="O");
    $("tttXScore").textContent=ttt.scores.X;$("tttOScore").textContent=ttt.scores.O;$("tttDrawScore").textContent=ttt.scores.D;
  }
  $("tttBoard").addEventListener("click",e=>{const cell=e.target.closest("[data-ttt-index]");if(cell)playTtt(Number(cell.dataset.tttIndex));});
  $("tttBoard").addEventListener("keydown",e=>{const cell=e.target.closest("[data-ttt-index]");if(!cell)return;const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3};if(!(e.key in moves))return;e.preventDefault();const next=Math.max(0,Math.min(8,Number(cell.dataset.tttIndex)+moves[e.key]));$("tttBoard").querySelector(`[data-ttt-index="${next}"]`).focus();});
  $("newTtt").addEventListener("click",initTtt);
  $("resetTttScore").addEventListener("click",()=>{ttt.scores={X:0,O:0,D:0};initTtt();});
})();

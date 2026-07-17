(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const visible=id=>{const el=document.querySelector(`[data-arcade-view="${id}"]`);return el&&!el.hidden;};

  // 贪吃蛇
  const snake={body:[],dir:{x:1,y:0},next:{x:1,y:0},food:{x:14,y:10},score:0,best:Number(localStorage.getItem("officeSnakeBest")||0),running:false,over:false,timer:null};
  const snakeCanvas=$("snakeCanvas"),snakeCtx=snakeCanvas.getContext("2d"),GRID=20,CELL=24;
  function initSnake(){snake.body=[{x:7,y:10},{x:6,y:10},{x:5,y:10}];snake.dir={x:1,y:0};snake.next={x:1,y:0};snake.score=0;snake.running=false;snake.over=false;placeFood();$("snakeToggle").textContent="开始移动";$("snakeStatus").textContent="点击“开始移动”进入工位巡游";renderSnake();}
  function placeFood(){const free=[];for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++)if(!snake.body.some(p=>p.x===x&&p.y===y))free.push({x,y});snake.food=free[Math.floor(Math.random()*free.length)]||{x:0,y:0};}
  function setSnakeDir(x,y){if(x===-snake.dir.x&&y===-snake.dir.y)return;snake.next={x,y};if(!snake.running&&!snake.over)toggleSnake();}
  function tickSnake(){if(!snake.running||!visible("snake"))return;snake.dir=snake.next;const head={x:snake.body[0].x+snake.dir.x,y:snake.body[0].y+snake.dir.y};if(head.x<0||head.x>=GRID||head.y<0||head.y>=GRID||snake.body.some(p=>p.x===head.x&&p.y===head.y)){snake.running=false;snake.over=true;$("snakeToggle").textContent="再来一局";$("snakeStatus").textContent=`巡游结束，共吃到 ${snake.score} 份下午茶`;renderSnake();return;}snake.body.unshift(head);if(head.x===snake.food.x&&head.y===snake.food.y){snake.score++;if(snake.score>snake.best){snake.best=snake.score;localStorage.setItem("officeSnakeBest",String(snake.best));}placeFood();}else snake.body.pop();renderSnake();}
  function renderSnake(){snakeCtx.clearRect(0,0,480,480);snakeCtx.fillStyle="#e7eee8";snakeCtx.fillRect(0,0,480,480);snakeCtx.strokeStyle="rgba(70,101,79,.07)";for(let i=0;i<=GRID;i++){snakeCtx.beginPath();snakeCtx.moveTo(i*CELL,0);snakeCtx.lineTo(i*CELL,480);snakeCtx.stroke();snakeCtx.beginPath();snakeCtx.moveTo(0,i*CELL);snakeCtx.lineTo(480,i*CELL);snakeCtx.stroke();}snake.body.forEach((p,i)=>{snakeCtx.fillStyle=i===0?"#355a41":"#5e8068";snakeCtx.beginPath();snakeCtx.roundRect(p.x*CELL+2,p.y*CELL+2,CELL-4,CELL-4,6);snakeCtx.fill();});snakeCtx.fillStyle="#d68150";snakeCtx.beginPath();snakeCtx.arc(snake.food.x*CELL+12,snake.food.y*CELL+12,8,0,Math.PI*2);snakeCtx.fill();$("snakeScore").textContent=snake.score;$("snakeBest").textContent=snake.best;}
  function toggleSnake(){if(snake.over){initSnake();snake.running=true;}else snake.running=!snake.running;$("snakeToggle").textContent=snake.running?"暂停一下":"继续移动";$("snakeStatus").textContent=snake.running?"巡游中 · 注意别撞到边界":"已暂停";}
  snake.timer=setInterval(tickSnake,135);$("snakeToggle").onclick=toggleSnake;$("newSnake").onclick=initSnake;document.querySelectorAll("[data-snake-dir]").forEach(b=>b.onclick=()=>{const d={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}[b.dataset.snakeDir];setSnakeDir(...d);});

  // 记忆翻牌
  const memory={cards:[],first:null,second:null,locked:false,moves:0,pairs:0,started:0,finished:false};
  const memoryIcons=["☕","⌨","📎","✉","☎","✎","⌚","▦"];
  function initMemory(){memory.cards=[...memoryIcons,...memoryIcons].map((icon,id)=>({icon,id,flipped:false,matched:false}));for(let i=memory.cards.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[memory.cards[i],memory.cards[j]]=[memory.cards[j],memory.cards[i]];}Object.assign(memory,{first:null,second:null,locked:false,moves:0,pairs:0,started:0,finished:false});$("memoryTime").textContent="00:00";$("memoryStatus").textContent="选择两张卡片开始";renderMemory();}
  function flipMemory(index){const card=memory.cards[index];if(memory.locked||card.flipped||card.matched)return;if(!memory.started)memory.started=Date.now();card.flipped=true;if(memory.first===null){memory.first=index;renderMemory();return;}memory.second=index;memory.moves++;memory.locked=true;renderMemory();const first=memory.cards[memory.first];if(first.icon===card.icon){first.matched=card.matched=true;memory.pairs++;memory.first=memory.second=null;memory.locked=false;if(memory.pairs===8){memory.finished=true;$("memoryStatus").textContent=`全部配对完成！共 ${memory.moves} 步`;}else $("memoryStatus").textContent="配对成功，继续寻找";renderMemory();}else{setTimeout(()=>{first.flipped=card.flipped=false;memory.first=memory.second=null;memory.locked=false;$("memoryStatus").textContent="不是同一对，再试一次";renderMemory();},650);}}
  function renderMemory(){$("memoryBoard").innerHTML=memory.cards.map((c,i)=>`<button class="memory-card ${c.flipped?"flipped":""} ${c.matched?"matched":""}" data-memory-index="${i}" aria-label="第 ${i+1} 张卡片${c.flipped||c.matched?`，${c.icon}`:"，未翻开"}">${c.flipped||c.matched?c.icon:""}</button>`).join("");$("memoryPairs").textContent=`${memory.pairs} / 8`;$("memoryMoves").textContent=memory.moves;}
  $("memoryBoard").onclick=e=>{const c=e.target.closest("[data-memory-index]");if(c)flipMemory(Number(c.dataset.memoryIndex));};$("newMemory").onclick=initMemory;setInterval(()=>{if(memory.started&&!memory.finished&&visible("memory"))$("memoryTime").textContent=`${String(Math.floor((Date.now()-memory.started)/60000)).padStart(2,"0")}:${String(Math.floor((Date.now()-memory.started)/1000)%60).padStart(2,"0")}`;},500);

  // 四子棋（同屏 + 在线）
  const c4={board:[],turn:1,winner:0,winning:[],mode:"local",room:"",playerId:"",myColor:0,players:[],version:0,poll:null};
  function blankC4(){return Array.from({length:6},()=>Array(7).fill(0));}
  function initC4(){c4.board=blankC4();c4.turn=1;c4.winner=0;c4.winning=[];renderC4();}
  function c4Win(row,col,color){for(const[dr,dc]of[[1,0],[0,1],[1,1],[1,-1]]){const cells=[[row,col]];for(const sign of[1,-1]){let r=row+dr*sign,c=col+dc*sign;while(r>=0&&r<6&&c>=0&&c<7&&c4.board[r][c]===color){cells.push([r,c]);r+=dr*sign;c+=dc*sign;}}if(cells.length>=4)return cells;}return[];}
  async function dropC4(col){if(c4.winner)return;if(c4.mode==="online"){if(c4.myColor!==c4.turn){setC4Status("还没轮到你");return;}try{const data=await c4Api(`/api/rooms/${c4.room}/move`,{playerId:c4.playerId,col});syncC4(data);}catch(e){setC4Error(e.message);}return;}let row=5;while(row>=0&&c4.board[row][col])row--;if(row<0)return;const color=c4.turn;c4.board[row][col]=color;c4.winning=c4Win(row,col,color);if(c4.winning.length)c4.winner=color;else c4.turn=3-color;renderC4();}
  function renderC4(){$("connectBoard").innerHTML=c4.board.flatMap((row,r)=>row.map((v,col)=>`<button class="connect-cell ${v===1?"red":v===2?"yellow":""} ${c4.winning.some(([wr,wc])=>wr===r&&wc===col)?"win":""}" data-connect-col="${col}" data-open="${!c4.board[0][col]}" aria-label="第 ${r+1} 行第 ${col+1} 列${v===1?"，红子":v===2?"，黄子":"，空"}"></button>`)).join("");$("connectRed").classList.toggle("active",!c4.winner&&c4.turn===1);$("connectYellow").classList.toggle("active",!c4.winner&&c4.turn===2);if(c4.mode==="online"){const red=c4.players.find(p=>p.color===1),yellow=c4.players.find(p=>p.color===2);$("connectRedName").textContent=red?`${red.name}${c4.myColor===1?"（我）":""}`:"等待加入";$("connectYellowName").textContent=yellow?`${yellow.name}${c4.myColor===2?"（我）":""}`:"等待加入";$("connectRoom").textContent=`房间 ${c4.room}`;}else{$("connectRedName").textContent="红方";$("connectYellowName").textContent="黄方";$("connectRoom").textContent="同屏对战";}const full=c4.board[0].every(Boolean);setC4Status(c4.winner?`${c4.winner===1?"红":"黄"}方连成四子！`:full?"棋盘已满，本局平手":c4.mode==="online"&&c4.players.length<2?"等待搭子加入":`${c4.turn===1?"红":"黄"}方回合`);}
  function setC4Status(text){$("connectStatus").textContent=text;}function setC4Error(text=""){$("connectError").textContent=text;}
  async function c4Api(path,body){const response=await fetch(path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","X-Player-Id":c4.playerId},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||"网络开小差了");return data;}
  function syncC4(data){c4.board=data.board;c4.turn=data.turn;c4.winner=data.winner;c4.winning=data.winningCells||[];c4.players=data.players||[];c4.version=data.version;if(data.yourColor)c4.myColor=data.yourColor;renderC4();}
  async function startC4Online(action){setC4Error();const name=$("connectName").value.trim()||"摸鱼同事",code=$("connectCode").value.trim().toUpperCase();if(action==="join"&&code.length!==6){setC4Error("请输入六位房间码");return;}try{const data=action==="create"?await c4Api("/api/rooms",{name,type:"connect4"}):await c4Api(`/api/rooms/${code}/join`,{name,type:"connect4"});c4.mode="online";c4.room=data.code;c4.playerId=data.playerId;c4.myColor=data.yourColor;localStorage.setItem("gomokuName",name);syncC4(data);$("connectShare").hidden=false;$("connectExit").hidden=false;history.replaceState(null,"",`?game=connect4&room=${c4.room}`);clearInterval(c4.poll);c4.poll=setInterval(pollC4,850);}catch(e){setC4Error(e.message);}}
  async function pollC4(){if(!c4.room||document.hidden)return;try{const data=await c4Api(`/api/rooms/${c4.room}`);if(data.version!==c4.version)syncC4(data);}catch(_){}}
  async function restartC4(){if(c4.mode==="online"){try{syncC4(await c4Api(`/api/rooms/${c4.room}/reset`,{playerId:c4.playerId}));}catch(e){setC4Error(e.message);}}else initC4();}
  function leaveC4(){clearInterval(c4.poll);Object.assign(c4,{mode:"local",room:"",playerId:"",myColor:0,players:[],version:0});$("connectShare").hidden=true;$("connectExit").hidden=true;history.replaceState(null,"",location.pathname);initC4();}
  $("connectBoard").onclick=e=>{const cell=e.target.closest("[data-connect-col]");if(cell)dropC4(Number(cell.dataset.connectCol));};$("connectLocal").onclick=leaveC4;$("connectCreate").onclick=()=>startC4Online("create");$("connectJoin").onclick=()=>startC4Online("join");$("newConnect4").onclick=restartC4;$("connectExit").onclick=leaveC4;$("connectShare").onclick=async()=>{const url=new URL(location.href);url.search=new URLSearchParams({game:"connect4",room:c4.room});try{await navigator.clipboard.writeText(`来玩四子棋，房间码 ${c4.room}\n${url}`);setC4Status("邀请链接已复制");}catch(_){setC4Status(`房间码：${c4.room}`);}};

  // 反应力对决（同屏 + 在线，在线结果由服务端裁决）
  const reaction={scores:{A:0,L:0},phase:"idle",timer:null,readyAt:0,mode:"local",room:"",playerId:"",myColor:0,players:[],version:0,winner:0,pressed:0,early:false,timeMs:0,matchWinner:0,poll:null,busy:false};
  function reactionSide(color){return color===1?"A 方":"L 方";}
  async function startReaction(){
    clearTimeout(reaction.timer);setReactionError();
    if(reaction.mode==="online"){
      if(reaction.players.length<2){setReactionError("等搭子加入后再开始");return;}
      reaction.busy=true;renderReaction();
      try{syncReaction(await reactionApi(`/api/rooms/${reaction.room}/reaction-start`,{playerId:reaction.playerId}));}
      catch(error){setReactionError(error.message);}finally{reaction.busy=false;renderReaction();}
      return;
    }
    if(reaction.matchWinner)reaction.scores={A:0,L:0};
    Object.assign(reaction,{phase:"waiting",winner:0,pressed:0,early:false,timeMs:0,matchWinner:0});renderReaction();
    reaction.timer=setTimeout(()=>{reaction.phase="ready";reaction.readyAt=performance.now();renderReaction();},1500+Math.random()*2600);
  }
  async function pressReaction(player){
    if(reaction.busy||(reaction.phase!=="waiting"&&reaction.phase!=="ready"))return;
    clearTimeout(reaction.timer);
    if(reaction.mode==="online"){
      const color=player==="A"?1:2;if(reaction.myColor!==color)return;
      reaction.busy=true;renderReaction();
      try{syncReaction(await reactionApi(`/api/rooms/${reaction.room}/reaction-press`,{playerId:reaction.playerId}));}
      catch(error){await pollReaction(true);if(reaction.phase!=="done")setReactionError(error.message);}finally{reaction.busy=false;renderReaction();}
      return;
    }
    const winner=reaction.phase==="waiting"?(player==="A"?"L":"A"):player;
    reaction.scores[winner]++;Object.assign(reaction,{phase:"done",winner:winner==="A"?1:2,pressed:player==="A"?1:2,early:reaction.phase==="waiting",timeMs:reaction.phase==="ready"?Math.round(performance.now()-reaction.readyAt):0,matchWinner:reaction.scores[winner]>=5?(winner==="A"?1:2):0});renderReaction();
  }
  function renderReaction(){
    $("reactionAScore").textContent=reaction.scores.A;$("reactionLScore").textContent=reaction.scores.L;
    if(reaction.mode==="online"){
      const a=reaction.players.find(p=>p.color===1),l=reaction.players.find(p=>p.color===2);
      $("reactionAName").textContent=a?`${a.name}${reaction.myColor===1?"（我）":""}`:"等待加入";$("reactionLName").textContent=l?`${l.name}${reaction.myColor===2?"（我）":""}`:"等待加入";
      $("reactionAButtonLabel").textContent=a?`${a.name} 抢按`:"A 方抢按";$("reactionLButtonLabel").textContent=l?`${l.name} 抢按`:"L 方抢按";$("reactionRoom").textContent=`房间 ${reaction.room}`;
    }else{$("reactionAName").textContent="A 方";$("reactionLName").textContent="L 方";$("reactionAButtonLabel").textContent="A 方抢按";$("reactionLButtonLabel").textContent="L 方抢按";$("reactionRoom").textContent="先得 5 分获胜";}
    $("reactionSignal").className=`reaction-signal ${reaction.phase==="waiting"?"waiting":reaction.phase==="ready"?"ready":reaction.phase==="done"?"result":""}`;
    if(reaction.phase==="waiting"){$("reactionText").textContent="保持专注，别抢跑…";$("reactionTime").textContent="等待绿色信号";}
    else if(reaction.phase==="ready"){$("reactionText").textContent="现在！";$("reactionTime").textContent="快按下你的键";}
    else if(reaction.phase==="done"){$("reactionText").textContent=reaction.matchWinner?`${reactionSide(reaction.matchWinner)}先得 5 分，赢下对决`:`${reactionSide(reaction.winner)}得分`;$("reactionTime").textContent=reaction.early?`${reactionSide(reaction.pressed)}抢跑犯规`:`${reaction.timeMs} ms`;}
    else{$("reactionText").textContent=reaction.mode==="online"&&reaction.players.length<2?"等待搭子加入":"点击开始本轮";$("reactionTime").textContent=reaction.mode==="online"?`${reactionSide(reaction.myColor||1)}使用 ${reaction.myColor===2?"L":"A"} 键`:"A 键 / L 键";}
    $("startReaction").disabled=reaction.busy||reaction.phase==="waiting"||reaction.phase==="ready"||(reaction.mode==="online"&&reaction.players.length<2);$("startReaction").textContent=reaction.phase==="done"?(reaction.matchWinner?"重新比赛":"下一轮"):"开始本轮";
    document.querySelectorAll("[data-reaction-player]").forEach(button=>{const color=button.dataset.reactionPlayer==="A"?1:2;button.disabled=reaction.busy||(reaction.phase!=="waiting"&&reaction.phase!=="ready")||(reaction.mode==="online"&&reaction.myColor!==color);});
  }
  function setReactionError(text=""){$("reactionError").textContent=text;}
  async function reactionApi(path,body){const response=await fetch(path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json","X-Player-Id":reaction.playerId},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw new Error(data.error||"网络开小差了");return data;}
  function syncReaction(data){const state=data.reaction||{};reaction.scores={A:(state.scores||[])[1]||0,L:(state.scores||[])[2]||0};reaction.phase=state.phase||"idle";reaction.winner=state.winner||0;reaction.pressed=state.pressed||0;reaction.early=Boolean(state.early);reaction.timeMs=state.timeMs||0;reaction.matchWinner=state.matchWinner||0;reaction.players=data.players||[];reaction.version=data.version;if(data.yourColor)reaction.myColor=data.yourColor;setReactionError();renderReaction();}
  async function startReactionOnline(action){
    setReactionError();
    const name=$("reactionName").value.trim()||"摸鱼同事",code=$("reactionCode").value.trim().toUpperCase();
    if(action==="join"&&code.length!==6){setReactionError("请输入六位房间码");return;}
    try{
      const body={name,type:"reaction"};
      const data=action==="create"?await reactionApi("/api/rooms",body):await reactionApi(`/api/rooms/${code}/join`,body);
      clearInterval(reaction.poll);clearTimeout(reaction.timer);Object.assign(reaction,{mode:"online",room:data.code,playerId:data.playerId,myColor:data.yourColor,busy:false});
      localStorage.setItem("gomokuName",name);syncReaction(data);$("reactionShare").hidden=false;$("reactionLeave").hidden=false;history.replaceState(null,"",`?game=reaction&room=${reaction.room}`);reaction.poll=setInterval(pollReaction,400);
    }catch(error){setReactionError(error.message);}
  }
  async function pollReaction(force=false){if(!reaction.room||document.hidden)return;try{const data=await reactionApi(`/api/rooms/${reaction.room}`);if(force||data.version!==reaction.version)syncReaction(data);}catch(_){}}
  async function resetReaction(){clearTimeout(reaction.timer);if(reaction.mode==="online"){try{syncReaction(await reactionApi(`/api/rooms/${reaction.room}/reset`,{playerId:reaction.playerId}));}catch(error){setReactionError(error.message);}}else{Object.assign(reaction,{scores:{A:0,L:0},phase:"idle",winner:0,pressed:0,early:false,timeMs:0,matchWinner:0,busy:false});renderReaction();}}
  function leaveReaction(){clearInterval(reaction.poll);clearTimeout(reaction.timer);Object.assign(reaction,{scores:{A:0,L:0},phase:"idle",mode:"local",room:"",playerId:"",myColor:0,players:[],version:0,winner:0,pressed:0,early:false,timeMs:0,matchWinner:0,busy:false});$("reactionShare").hidden=true;$("reactionLeave").hidden=true;history.replaceState(null,"",location.pathname);setReactionError();renderReaction();}
  $("startReaction").onclick=startReaction;document.querySelectorAll("[data-reaction-player]").forEach(button=>button.onclick=()=>pressReaction(button.dataset.reactionPlayer));$("newReaction").onclick=resetReaction;$("reactionLocal").onclick=leaveReaction;$("reactionCreate").onclick=()=>startReactionOnline("create");$("reactionJoin").onclick=()=>startReactionOnline("join");$("reactionLeave").onclick=leaveReaction;$("reactionShare").onclick=async()=>{const url=new URL(location.href);url.search=new URLSearchParams({game:"reaction",room:reaction.room});try{await navigator.clipboard.writeText(`来玩反应力对决，房间码 ${reaction.room}\n${url}`);$("reactionTime").textContent="邀请链接已复制";}catch(_){$("reactionTime").textContent=`房间码：${reaction.room}`;}};

  document.addEventListener("keydown",e=>{if(!document.body.classList.contains("arcade-open"))return;const key=e.key.toLowerCase();if(visible("snake")){const dirs={arrowup:[0,-1],w:[0,-1],arrowdown:[0,1],s:[0,1],arrowleft:[-1,0],a:[-1,0],arrowright:[1,0],d:[1,0]};if(dirs[key]){e.preventDefault();setSnakeDir(...dirs[key]);}}else if(visible("reaction")&&(key==="a"||key==="l")){e.preventDefault();pressReaction(key.toUpperCase());}});

  document.querySelector('[data-open-game="snake"]').addEventListener("click",()=>{if(!snake.body.length)initSnake();});document.querySelector('[data-open-game="memory"]').addEventListener("click",()=>{if(!memory.cards.length)initMemory();});document.querySelector('[data-open-game="connect4"]').addEventListener("click",()=>{if(!c4.board.length)initC4();});
  $("connectName").value=localStorage.getItem("gomokuName")||"";$("reactionName").value=localStorage.getItem("gomokuName")||"";renderReaction();
  const params=new URLSearchParams(location.search);if(params.get("game")==="connect4"){setTimeout(()=>{$("arcadeButton").click();document.querySelector('[data-open-game="connect4"]').click();$("connectCode").value=(params.get("room")||"").toUpperCase().slice(0,6);setC4Error("输入代号后点击“加入房间”");},220);}else if(params.get("game")==="reaction"){setTimeout(()=>{$("arcadeButton").click();document.querySelector('[data-open-game="reaction"]').click();$("reactionCode").value=(params.get("room")||"").toUpperCase().slice(0,6);setReactionError("输入代号后点击“加入房间”");},220);}
})();

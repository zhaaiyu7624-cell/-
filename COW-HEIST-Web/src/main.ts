import '@fontsource/barlow-condensed/700.css'
import '@fontsource/barlow-condensed/800-italic.css'
import '@fontsource/space-mono/400.css'
import './style.css'
import {Game,type GameState} from './game'
import {HandController} from './hand'
import {captureSeconds,levels,loadProgress,rule,saveProgress,settings} from './levels'

const icons:Record<string,string>={
  ufo:'<path d="M6 11c0-4 3-7 6-7s6 3 6 7M2 13c0-1.6 4.5-3 10-3s10 1.4 10 3-4.5 4-10 4S2 14.6 2 13ZM7 19l-1 2m6-2v3m5-3 1 2"/><path d="M9 13h.01m3 1h.01m3-1h.01"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
  mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  mouse:'<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 6v4M6 11h12"/>',
  play:'<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M9 5v14m6-14v14" stroke-width="3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4 2.2c-1.3.7-1.5 1.3-1.5 2.4m0 3h.01"/>',
  hand:'<path d="M7 11V7a1.3 1.3 0 0 1 2.6 0v4m0-1V4.8a1.3 1.3 0 0 1 2.6 0v5.4m0-.3V5.8a1.3 1.3 0 0 1 2.6 0v5m0-.3V8a1.3 1.3 0 0 1 2.6 0v6.5a6 6 0 0 1-6 6H10a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.4-1.8L7 14z"/>',
  move:'<path d="M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  pinch:'<path d="M5 19 3 14l5-5 7-1 4 2-1 2-4-1-4 2m-3 3 5-1 3-2 4 1v2l-5 4H8M15 4v2m5 0-2 1m4 3h-2"/>',
  camera:'<rect x="3" y="6" width="12" height="12" rx="2"/><path d="m15 10 6-3v10l-6-3z"/>',
  cross:'<path d="M6 6l12 12M18 6 6 18"/>',
  chevron:'<path d="m6 14 6-6 6 6"/>',
  target:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>'
}
const icon=(name:string)=>`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`

const app=document.querySelector<HTMLElement>('#app')!
app.innerHTML=`
  <div id="scene"></div><div class="shade"></div><div id="flash"></div>
  <header class="topbar">
    <div class="brand" aria-label="Cow Heist">${icon('ufo')}<span>COW<span class="brand-accent">/</span>HEIST</span></div>
    <div class="toolbar">
      <button id="sound" class="icon-button" aria-label="静音" title="静音">${icon('sound')}</button>
      <button id="help" class="icon-button" aria-label="操作说明" title="操作说明">${icon('help')}</button>
      <button id="pause" class="icon-button" hidden aria-label="暂停" title="暂停 (P)">${icon('pause')}</button>
    </div>
  </header>
  <section class="hero" id="hero" aria-labelledby="title">
    <div class="eyebrow"><i></i> MIDNIGHT FARM RAID</div>
    <h1 id="title">COW<br><em>HEIST</em></h1>
    <h2>星际偷牛计划</h2>
    <p class="intro">用一只手驾驶飞碟，在六十秒内把奶牛偷偷带离地球。</p>
    <ol class="tutorial" aria-label="手势教程">
      <li>${icon('hand')}<span>伸出手掌</span></li>
      <li>${icon('move')}<span>移动飞碟</span></li>
      <li>${icon('pinch')}<span>捏合吸牛</span></li>
    </ol>
    <div class="actions">
      <button id="start" class="primary">${icon('play')} 开始偷牛</button>
      <button id="briefing" class="secondary">玩法说明</button>
    </div>
  </section>
  <section id="hud" hidden aria-label="游戏 HUD">
    <div class="score chip"><span id="level-name" class="micro">得分</span><strong id="score">000</strong></div>
    <div class="goal chip"><span class="micro">任务目标 <b id="goal-number"></b></span><div class="meter" id="goal-meter"></div><div id="combo" class="combo" hidden></div></div>
    <div class="time chip"><span class="micro">TIME / 时间</span><strong id="seconds">60<small>s</small></strong></div>
  </section>
  <div id="countdown" hidden aria-live="polite"></div>
  <div id="effects" aria-hidden="true"></div>
  <footer class="statusbar">
    <div class="site"><span class="site-dot"></span><span>地球 · 午夜牧场</span></div>
    <div id="status" class="input-state" hidden></div>
    <button id="switch" class="subtle" hidden>${icon('mouse')} 切换鼠标</button>
    <span id="objective" class="objective"><span>最高纪录</span><b id="record">0 PTS</b><span class="sep"></span><b>60 SEC</b></span>
  </footer>
  <aside id="preview" class="preview" hidden>
    <div class="preview-top">${icon('camera')}<span>摄像头仅在本机处理</span><button id="collapse" aria-label="折叠摄像头预览">${icon('chevron')}</button></div>
    <div id="preview-body" class="preview-body"><video id="video" muted playsinline></video><canvas id="skeleton"></canvas></div>
    <button id="camera-off" class="subtle">关闭摄像头</button>
  </aside>
  <section id="overlay" class="overlay" hidden aria-label="游戏菜单">
    <div class="card"><div class="eyebrow" id="card-label"></div><h2 id="card-title"></h2><p id="card-text"></p><div id="choices" class="choices" hidden></div><div id="card-results" hidden></div><div class="dialog-actions" id="card-actions"></div></div>
  </section>`

const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const hand=new HandController($<HTMLVideoElement>('video'),$<HTMLCanvasElement>('skeleton'))
let game:Game
const progress=loadProgress()
let chosen=0
let cameraNext:'levels'|'round'='levels'
let cameraRequested=false
let savedRound=false
let hintUntil=0
let eventHint=''
let goalAnnounced=false
let mode:'hand'|'mouse'='mouse'
let muted=false, mouseDown=false, spaceDown=false, hasPointer=false
let px=.5,py=.57
let error=''
let calibrationStarted=0
let showingHelp=false
let helpPaused=false
let audio:AudioContext|undefined

function playSound(danger=false){
  if(muted||!audio)return
  const t=audio.currentTime
  for(const [f,offset] of (danger?[[210,0],[113,.09]]:[[490,0],[880,.07],[1190,.122]])){
    const o=audio.createOscillator(),gain=audio.createGain()
    o.type=danger?'triangle':'sine';o.frequency.setValueAtTime(f,t+offset);o.frequency.exponentialRampToValueAtTime(f*.75,t+offset+.14)
    gain.gain.setValueAtTime(.001,t+offset);gain.gain.exponentialRampToValueAtTime(.13,t+offset+.02);gain.gain.exponentialRampToValueAtTime(.001,t+offset+.20)
    o.connect(gain).connect(audio.destination);o.start(t+offset);o.stop(t+offset+.21)
  }
}
function unlockAudio(){
  try{audio??=new AudioContext();void audio.resume().catch(()=>{})}catch{/* Audio is optional. */}
}
function resetInput(){mouseDown=false;spaceDown=false;game.setBeam(false)}
function menu(phase:'title'|'modes'|'levels'){
  showingHelp=false;helpPaused=false;error='';resetInput()
  if(phase!=='levels')hand.close()
  game.phase(phase)
}
function mouseMode(){
  const calibrating=game.state.phase==='calibrating'
  unlockAudio();showingHelp=false;helpPaused=false;mode='mouse';hand.close();resetInput()
  if(calibrating){
    if(cameraNext==='round')startRound(chosen)
    else menu('levels')
  }
  render(game.state)
}
function cameraMode(next:'levels'|'round'='levels',request=true){
  unlockAudio();showingHelp=false;helpPaused=false;mode='hand';error='';calibrationStarted=performance.now();resetInput()
  cameraNext=next;cameraRequested=request
  game.phase('calibrating');if(request)void hand.open()
}
function startRound(index:number){
  chosen=index
  if(mode==='hand'&&!hand.ready){cameraMode('round',false);return}
  resetInput();hasPointer=false;hintUntil=0;goalAnnounced=false;savedRound=false
  $('effects').replaceChildren()
  game.start(index)
}
function choose(title:string,details:string,action:()=>void,disabled=false){
  const el=document.createElement('button')
  el.className='choice';el.disabled=disabled
  const label=document.createElement('strong');label.textContent=title
  const description=document.createElement('span');description.textContent=details
  el.append(label,description);el.onclick=action
  $('choices').append(el)
}
function makeButton(label:string,action:()=>void,primary=false){
  const el=document.createElement('button')
  el.className=primary?'primary':'secondary';el.textContent=label;el.onclick=action
  $('card-actions').append(el)
}
function renderMenu(phase:GameState['phase']){
  const overlay=$('overlay')
  overlay.hidden=!showingHelp&&!['modes','levels','calibrating','paused','ended'].includes(phase)
  if(overlay.hidden)return
  $('card-actions').replaceChildren()
  $('card-results').hidden=true
  $('choices').replaceChildren();$('choices').hidden=true
  if(showingHelp){
    $('card-label').textContent='FLIGHT MANUAL'
    $('card-title').textContent='操作说明'
    $('card-text').textContent='手势：手掌移动，拇指和食指捏合吸取。鼠标：移动光标，按住左键或空格吸取。黑白牛 '+captureSeconds('cow')+' 秒 +100，黄牛 '+captureSeconds('gold')+' 秒 +200。光束需跟住牛；橙色环预警障碍。连续捕获 3 / 5 只触发 COMBO x2 / x3。吸到障碍或 6.5 秒未捕获会清零。P 键暂停。'
    makeButton('返回',closeHelp,true)
    if(mode==='hand'&&['calibrating','paused'].includes(phase))makeButton('改用鼠标',mouseMode)
  }else if(phase==='modes'){
    text('card-label','FLIGHT CONTROLS');text('card-title','选择操作方式')
    text('card-text','两种操作方式共用同一套关卡与得分规则。')
    $('choices').hidden=false
    choose('鼠标模式 · 选择此模式','移动鼠标，按住左键或空格开启牵引光束。',()=>{mode='mouse';unlockAudio();menu('levels')})
    choose('手势模式 · 启用摄像头','移动手掌驾驶飞碟，拇指与食指捏合开启光束。',()=>cameraMode())
    makeButton('返回主菜单',()=>menu('title'))
  }else if(phase==='levels'){
    text('card-label','MISSIONS');text('card-title','选择关卡')
    text('card-text',mode==='hand'?'摄像头手势 · 已校准 · 每关 60 秒':'鼠标模式 · 每关 60 秒')
    $('choices').hidden=false
    levels.forEach((level,index)=>choose(`${index+1}. ${level.name}`,
      `目标 ${level.goal} 分 · ${index>progress.unlocked?'尚未解锁':'最高 '+progress.best[index]+' 分'}`,
      ()=>startRound(index),index>progress.unlocked))
    makeButton('更换操作方式',()=>menu('modes'))
  }else if(phase==='calibrating'){
    $('card-label').textContent='CAMERA CALIBRATION'
    $('card-title').textContent=error?'摄像头暂不可用':cameraRequested?'把手掌放在中央':'准备手势模式'
    $('card-text').textContent=error||(cameraRequested?'张开一只手，放在摄像头画面中央并短暂保持。识别成功后继续。':'本轮开始前请启用摄像头。画面仅在本机处理。')
    if(!cameraRequested)makeButton('启用摄像头并继续',()=>cameraMode(cameraNext),true)
    makeButton('改用鼠标',mouseMode,!!error)
    if(error)makeButton('重试摄像头',()=>cameraMode(cameraNext))
    makeButton('返回操作选择',()=>menu('modes'))
  }else if(phase==='paused'){
    $('card-label').textContent='MISSION PAUSED'
    $('card-title').textContent='任务暂停'
    $('card-text').textContent='准备好后继续，计时会从暂停处恢复。'
    makeButton('继续偷牛',()=>game.resume(),true)
    makeButton('重新开始',()=>startRound(chosen))
    makeButton('返回主菜单',()=>menu('title'))
    if(mode==='hand')makeButton('改用鼠标',mouseMode)
  }else{
    const {score,count,hazards,level}=game.state
    const goal=levels[level].goal, passed=score>=goal
    text('card-label','MISSION REPORT')
    text('card-title',passed?'关卡完成':'挑战失败')
    text('card-text',passed?'太空牧场欢迎新成员！':'留意红色警示物，再试一轮。')
    $('card-results').hidden=false
    text('card-results',`${score} / ${goal} 分 · 奶牛 ${count} · 误吸 ${hazards}`)
    if(passed&&level+1<levels.length)makeButton('下一关',()=>startRound(level+1),true)
    makeButton('重新挑战',()=>startRound(level),!passed||level+1===levels.length)
    makeButton('返回关卡选择',()=>menu('levels'))
    makeButton('返回主菜单',()=>menu('title'))

  }
}
let lastMenu=''
let lastHud=''
let lastPause=''
function text(id:string,value:string){
  const element=$(id)
  if(element.textContent!==value)element.textContent=value
}
function render(state:GameState){
  const {phase}=state
  const inRound=['countdown','playing','paused'].includes(phase)
  if(app.dataset.phase!==phase)app.dataset.phase=phase
  $('hero').hidden=phase!=='title'||showingHelp
  $('hud').hidden=!inRound
  $('pause').hidden=!inRound
  if(lastPause!==phase){
    lastPause=phase
    $('pause').innerHTML=phase==='paused'?icon('play'):icon('pause')
    $('pause').setAttribute('aria-label',phase==='paused'?'继续':'暂停')
  }
  $('countdown').hidden=phase!=='countdown'
  const hudKey=[phase,state.level,state.seconds,state.score,state.combo,state.multiplier].join('/')
  if(lastHud!==hudKey){
    lastHud=hudKey
    if(phase==='countdown')text('countdown',String(state.seconds))
    text('level-name',levels[state.level].name)
    text('goal-number',levels[state.level].goal+' PTS')
    const badge=$('combo')
    badge.hidden=state.combo===0
    badge.classList.toggle('boosted',state.multiplier>1)
    text('combo',state.multiplier>1?`COMBO x${state.multiplier} · ${state.combo} 连捕`:`连续捕获 ${state.combo}`)
    text('score',String(state.score).padStart(3,'0'))
    $('seconds').firstChild!.textContent=String(phase==='countdown'?settings.seconds:state.seconds).padStart(2,'0')
    $('seconds').classList.toggle('urgent',state.seconds<=10&&phase==='playing')
    $('goal-meter').style.setProperty('--fill',Math.min(100,state.score/levels[state.level].goal*100)+'%')
  }
  $('objective').hidden=phase!=='title'
  text('record',Math.max(...progress.best)+' PTS')
  $('switch').hidden=mode!=='hand'||!inRound
  $('status').hidden=!inRound&&phase!=='calibrating'
  $('status').classList.toggle('locked',state.progress>0)
  text('status',performance.now()<hintUntil?eventHint:mode==='mouse'
    ?state.progress>0?'正在吸取 · '+Math.round(state.progress*100)+'%':'鼠标移动 · 左键 / 空格吸取'
    :state.progress>0?'正在吸取 · '+Math.round(state.progress*100)+'%':hand.pinched&&phase==='playing'?'光束开启':hand.tracked?'已识别手部':hand.ready?'请将手放入画面':'正在准备摄像头')
  $('preview').hidden=!hand.hasVideo
  const key=[phase,showingHelp,mode,error,cameraRequested,state.phase==='ended'?state.score:''].join('|')
  if(key!==lastMenu){lastMenu=key;renderMenu(phase)}
  if(phase==='calibrating'&&cameraRequested&&!error&&!showingHelp&&performance.now()-calibrationStarted>5000){
    const hint=hand.ready?'未检测到手。请提高照明，把整只手放进画面，或点击「改用鼠标」。':'摄像头或识别模型仍在准备。可继续等待，或点击「改用鼠标」。'
    text('card-text',hint)
  }
}
function closeHelp(){
  showingHelp=false
  if(helpPaused){helpPaused=false;game.resume()}
  render(game.state)
}
function togglePause(){
  if(showingHelp){closeHelp();return}
  if(game.state.phase==='paused'){game.resume();return}
  resetInput();game.pause()
}
try{
  game=new Game($('scene'))
  hand.onChange=()=>render(game.state)
  hand.onError=(reason)=>{error=reason;if(game.state.phase!=='calibrating'){mouseMode();eventHint=reason;hintUntil=performance.now()+5000}else render(game.state)}
  game.onUpdate=(state)=>{
    if(state.phase==='ended'&&!savedRound){
      savedRound=true
      progress.best[state.level]=Math.max(progress.best[state.level],state.score)
      if(state.score>=levels[state.level].goal)progress.unlocked=Math.max(progress.unlocked,Math.min(levels.length-1,state.level+1))
      saveProgress(progress)
      if(hand.hasVideo||hand.ready)hand.close()
    }
    render(state)
  }
  game.onFrame=(now)=>{
    const phase=game.state.phase
    if(mode==='hand'&&(phase==='calibrating'||phase==='playing'||phase==='countdown')){
      hand.tick(now)
      const state=game.state.phase
      if(state==='calibrating'&&!showingHelp&&hand.tracked&&!hand.pinched&&now-hand.stableSince>=650){
        hand.calibrate();if(cameraNext==='round')startRound(chosen);else menu('levels')
      }
      let position
      if((state==='playing'||state==='countdown')&&hand.tracked){
        const f=game.projectedField
        position={x:f.left+(f.right-f.left)*hand.u,y:f.top+(f.bottom-f.top)*hand.v,ground:false}
      }
      game.input(position,state==='playing'&&hand.tracked&&hand.pinched)
    }else if(mode==='mouse'&&phase==='playing'){
      game.input(hasPointer?{x:px,y:py,ground:true}:undefined,mouseDown||spaceDown)
    }
  }
  game.onCapture=(points,p,kind,bonus)=>{
    playSound(points<0)
    const reached=game.state.score>=game.level.goal&&!goalAnnounced
    if(reached)goalAnnounced=true
    eventHint=reached?'目标已达成 · 计时继续':points<0?`误吸${rule(kind).label} ${points}`:
      `捕获${rule(kind).label} +${rule(kind).points}${bonus?' · 连击 +'+bonus:''}`
    if(bonus)$('combo').animate([{transform:'scale(1.2)',filter:'brightness(1.6)'},{transform:'scale(1)',filter:'brightness(1)'}],{duration:360})
    $('flash').style.background=points<0?'#ff473e':'#8affd0'
    hintUntil=performance.now()+1600
    const floater=document.createElement('div');floater.className=points<0?'points danger':'points';floater.textContent=points<0?String(points):'+'+points
    floater.style.left=p.x+'%';floater.style.top=p.y+'%';$('effects').append(floater)
    floater.addEventListener('animationend',()=>floater.remove(),{once:true})
    $('flash').animate([{opacity:.25},{opacity:0}],{duration:420})
  }
  $('start').onclick=()=>menu('modes')
  $('briefing').onclick=()=>$('help').click()
  $('camera-off').onclick=mouseMode
  $('switch').onclick=mouseMode
  $('pause').onclick=togglePause
  $('sound').onclick=()=>{
    muted=!muted
    const label=muted?'开启音效':'静音'
    $('sound').innerHTML=icon(muted?'mute':'sound');$('sound').setAttribute('aria-label',label);$('sound').title=label
    if(!muted)unlockAudio()
  }
  $('help').onclick=()=>{
    if(showingHelp){closeHelp();return}
    helpPaused=game.state.phase==='playing'||game.state.phase==='countdown'
    showingHelp=true
    if(helpPaused){resetInput();game.pause()}
    render(game.state)
  }
  $('collapse').onclick=()=>{
    const body=$('preview-body');body.hidden=!body.hidden
    $('collapse').setAttribute('aria-label',body.hidden?'展开摄像头预览':'折叠摄像头预览')
    $('collapse').classList.toggle('collapsed',body.hidden)
  }
  const move=(e:PointerEvent)=>{
    const r=$('scene').getBoundingClientRect()
    px=(e.clientX-r.left)/r.width;py=(e.clientY-r.top)/r.height;hasPointer=true
  }
  $('scene').addEventListener('pointermove',move)
  $('scene').addEventListener('pointerdown',e=>{
    if(e.button!==0||mode!=='mouse'||game.state.phase!=='playing')return
    $('scene').setPointerCapture(e.pointerId);move(e);mouseDown=true
  })
  window.addEventListener('pointerup',()=>{mouseDown=false})
  window.addEventListener('pointercancel',()=>{mouseDown=false})
  window.addEventListener('keydown',e=>{
    if(e.code==='KeyP'&&!e.repeat)togglePause()
    if(e.code==='Escape'&&showingHelp)closeHelp()
    if(e.code==='Space'&&mode==='mouse'&&game.state.phase==='playing'){
      e.preventDefault();spaceDown=true
    }
  })
  window.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false})
  const focusLost=()=>{resetInput();game.pause()}
  window.addEventListener('blur',focusLost)
  document.addEventListener('visibilitychange',()=>{if(document.hidden)focusLost()})
  window.addEventListener('pagehide',()=>hand.close())
  game.renderer.domElement.addEventListener('webglcontextlost',e=>{
    e.preventDefault();focusLost()
  })
  render(game.state)
}catch{
  $('hero').hidden=true
  $('overlay').hidden=false
  $('card-label').textContent='WEBGL UNAVAILABLE'
  $('card-title').textContent='无法启动 3D 画面'
  $('card-text').textContent='请在 Chrome 或 Edge 中开启图形加速，更新显卡驱动，再刷新页面。'
  makeButton('刷新页面',()=>location.reload(),true)
}

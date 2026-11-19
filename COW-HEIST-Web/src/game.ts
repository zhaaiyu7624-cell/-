import * as T from 'three'
import {basic,cowModel,groundGlow,hazardModel,ring,shipModel} from './models'
import {buildWorld,field,randomizer} from './world'
import {captureSeconds,isHazard,levels,rule,settings,type TargetKind} from './levels'

export type Phase='title'|'modes'|'levels'|'calibrating'|'countdown'|'playing'|'paused'|'ended'
export interface GameState { phase:Phase; score:number; count:number; hazards:number; level:number; seconds:number; progress:number; combo:number; multiplier:number }
interface Cow {
  model:T.Group; shadow:T.Mesh; kind:TargetKind; ground:T.Vector2; anchor:T.Vector2
  heading:number; course:number; wander:number; speed:number; pace:number; lift:number
  lastHit:number; warningUntil:number; mobile:boolean; marker:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>|undefined
}

const flight=5.65
const {beam:balance,motion,hazard,combo}=settings
// Ground-side obstacles near the pasture edge. The fence lies beyond field.
const scenery=[
  [-12.5,-8.65,1.20],[-10.6,-8.54,1.20],[-9.8,-7.89,1.20],[-8.7,-8.2,1.20],
  [-6.8,-8.8,.90],[12.7,-9,.90],[14.6,7.95,1.2],[-11.9,-10.6,2.7]
]
const safeGround=(x:number,z:number)=> Math.abs(x)<field.x-.42&&Math.abs(z)<field.z-.45
  && scenery.every(([sx,sz,r])=>Math.hypot(x-sx,z-sz)>r)
const turn=(from:number,to:number,step:number)=>from+clamp(Math.atan2(Math.sin(to-from),Math.cos(to-from)),-step,step)

const cowSpawns=[[-10,3],[-8,-3],[-4,5.2],[-3,-5.9],[2.6,2],[6.8,4.9],[7.1,-4.7],[11,-.7],[2,-5.2],[11.4,6.2],[-12.2,-.6],[11.2,-5.9],[-12,-5.9],[.0,7.4],[3.3,-.7],[-6.9,.5]]
const clamp=T.MathUtils.clamp

class Beam {
  readonly group=new T.Group()
  readonly outer:T.Mesh<T.CylinderGeometry,T.ShaderMaterial>
  readonly waves:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>[]=[]
  readonly reticle:T.Mesh<T.TorusGeometry,T.MeshBasicMaterial>
  readonly lock=new T.Group()
  readonly bloom:T.Mesh<T.PlaneGeometry,T.MeshBasicMaterial>
  private readonly dust:T.Points<T.BufferGeometry,T.PointsMaterial>
  private readonly scatter:number[]=[]
  private opacity=0
  constructor(scene:T.Scene){
    scene.add(this.group,this.lock)
    this.outer=new T.Mesh(new T.CylinderGeometry(.43,balance.holdRadius*balance.cowRadiusScale,1,40,1,true),new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
      uniforms:{alpha:{value:0},time:{value:0}},
      vertexShader:'varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 tex; uniform float alpha; uniform float time; void main(){float fold=.57+.43*sin(tex.x*37.699+tex.y*3.);float scan=pow(.5+.5*sin(tex.y*36.+time*5.),9.);float a=alpha*(.115+.08*fold+.065*scan)*(.72+tex.y*.28);gl_FragColor=vec4(.30,1.,.80,a);}'
    }))
    this.group.add(this.outer)
    this.bloom=groundGlow(this.group,0x4dffc5,4.4,.86) as typeof this.bloom
    for(let i=0;i<4;i++){
      const o=ring(this.group,basic(0x9dffe4),1,.019,0) as typeof this.reticle
      o.material.transparent=true;o.material.depthWrite=false;this.waves.push(o)
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array(105*3),3))
    const rnd=randomizer(216)
    for(let i=0;i<105*4;i++) this.scatter.push(rnd())
    this.dust=new T.Points(geo,new T.PointsMaterial({color:0xb5ffef,size:.072,transparent:true,depthWrite:false,blending:T.AdditiveBlending}))
    this.dust.frustumCulled=false
    this.group.add(this.dust)
    ring(this.lock,basic(0x3a857e),.91,.028,.08)
    this.reticle=ring(this.lock,basic(0xb3ffe7),.91,.047,.094) as typeof this.reticle
    this.lock.visible=false
  }
  update(x:number,z:number,height:number,t:number,dt:number,active:boolean,cow:Cow|undefined){
    this.opacity=T.MathUtils.lerp(this.opacity,active?1:0,1-Math.exp(-dt*(active?15:12)))
    const a=this.opacity
    this.group.visible=a>.012
    this.group.position.set(x,0,z)
    this.outer.position.y=height*.5;this.outer.scale.y=height
    this.outer.material.uniforms.alpha.value=a;this.outer.material.uniforms.time.value=t
    this.bloom.material.opacity=a*.86
    for(let i=0;i<this.waves.length;i++){
      const u=(t*.38+i*.25)%1,w=this.waves[i],r=balance.holdRadius*balance.cowRadiusScale*(1-u)+.44*u
      w.position.y=.10+u*(height-.1);w.scale.set(r,r,1);w.material.opacity=a*(.20+.44*Math.sin(u*Math.PI))
    }
    const pos=this.dust.geometry.attributes.position
    for(let i=0;i<pos.count;i++){
      const j=i*4,p=(this.scatter[j]+t*(.22+this.scatter[j+1]*.18))%1
      const r=(balance.holdRadius*balance.cowRadiusScale*(1-p)+.44*p)*Math.sqrt(this.scatter[j+2]), angle=this.scatter[j+3]*Math.PI*2+t*.36
      pos.setXYZ(i,Math.cos(angle)*r,p*height,Math.sin(angle)*r)
    }
    pos.needsUpdate=true;this.dust.material.opacity=a*.76
    this.lock.visible=active&&!!cow
    if(cow){
      this.lock.position.set(cow.ground.x,.018,cow.ground.y)
      this.reticle.material.color.setHex(isHazard(cow.kind)?0xff745c:0xb3ffe7)
      this.reticle.geometry.setDrawRange(0,Math.max(36,Math.floor(cow.lift*48)*36))
    }
  }
}

export class Game {
  readonly state:GameState={phase:'title',score:0,count:0,hazards:0,level:0,seconds:settings.seconds,progress:0,combo:0,multiplier:1}
  readonly scene=new T.Scene()
  readonly camera=new T.PerspectiveCamera(41,1,.1,235)
  readonly renderer:T.WebGLRenderer
  private readonly beam:Beam
  private readonly ship=new T.Group()
  private readonly hull=shipModel()
  private readonly shipShadow:T.Mesh
  private readonly mill:T.Group
  private readonly cows:Cow[]=[]
  private readonly ray=new T.Raycaster()
  private readonly plane=new T.Plane(new T.Vector3(0,1,0),-flight)
  private readonly target=new T.Vector3(3,flight,0)
  private readonly pointer=new T.Vector2()
  private readonly projected=new T.Vector3()
  private readonly rng=randomizer(7843)
  private last=performance.now()
  private elapsed=0
  private deadline=0
  private pauseAt=0
  private beforePause:Phase='playing'
  private firing=false
  private locked:Cow|undefined
  private recoverable:Cow|undefined
  private readonly sparks:T.Points<T.BufferGeometry,T.PointsMaterial>
  private readonly burstOrigin=new T.Vector3()
  private burstAt=-2
  private readonly respawns:{at:number,kind:TargetKind}[]=[]
  private hazardAt=0
  private hazardSequence=0
  private roundTime=0
  private lastCowAt=-Infinity
  get level(){return levels[this.state.level]}
  get beamActive(){return this.firing&&this.state.phase==='playing'}
  onFrame:(now:number)=>void=()=>{}
  onUpdate:(s:GameState)=>void=()=>{}
  onCapture:(points:number,location:{x:number,y:number},kind:TargetKind,bonus:number)=>void=()=>{}
  constructor(private readonly host:HTMLElement){
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
    this.renderer.setClearColor(0x242248)
    this.renderer.toneMapping=T.ACESFilmicToneMapping
    this.renderer.toneMappingExposure=1.04
    this.renderer.domElement.setAttribute('aria-label','实时 3D 夜间农场')
    host.append(this.renderer.domElement)
    this.mill=buildWorld(this.scene)
    this.scene.add(this.ship)
    this.ship.add(this.hull)
    this.shipShadow=groundGlow(this.scene,0x1b1c33,6,.7)
    this.beam=new Beam(this.scene)
    const sparkGeo=new T.BufferGeometry()
    sparkGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(24*3),3))
    this.sparks=new T.Points(sparkGeo,new T.PointsMaterial({
      size:.15,color:0xb4ffe0,transparent:true,depthWrite:false,blending:T.AdditiveBlending
    }))
    this.sparks.frustumCulled=false;this.sparks.visible=false
    this.scene.add(this.sparks)
    this.resetCows()
    new ResizeObserver(()=>this.resize()).observe(host)
    this.resize()
    this.renderer.setAnimationLoop(this.frame)
  }
  private resize(){
    const w=this.host.clientWidth,h=Math.max(1,this.host.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65))
    this.renderer.setSize(w,h)
    this.camera.aspect=w/h
    const narrow=w/h<1.44
    const title=['title','modes','levels','calibrating'].includes(this.state.phase)
    this.camera.position.set(title?9.7:14,title?11.7:17.9,narrow?43:title?31.5:35.5)
    this.camera.fov=narrow?45:40
    this.camera.lookAt(title?-4.75:0,title?4.3:3.5,-2.1)
    this.hull.scale.setScalar(title?1.24:1)
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }
  private resetCows(){
    for(const c of this.cows)this.removeCow(c)
    this.cows.length=0;this.respawns.length=0;this.recoverable=undefined
    const planned:TargetKind[]=this.state.phase==='title'
      ? cowSpawns.slice(0,11).map((_,i)=>i===7?'gold':'cow')
      : [...Array<TargetKind>(this.level.cow).fill('cow'),...Array<TargetKind>(this.level.gold).fill('gold')]
    planned.forEach((kind,i)=>this.addCow(...cowSpawns[i] as [number,number],kind,i))
  }
  private addCow(x:number,z:number,kind:TargetKind,i:number,warning=false){
    const model=kind==='cow'||kind==='gold'?cowModel(kind==='gold'):hazardModel(kind)
    const shadow=groundGlow(this.scene,0x202237,2.32,.78)
    const heading=isHazard(kind)?.18:i*.66+.21
    model.position.set(x,0,z);model.rotation.y=heading
    this.scene.add(model)
    const marker=warning?ring(this.scene,basic(0xff7b4e),1,.06,.10) as Cow['marker']:undefined
    if(marker){
      marker.position.set(x,.105,z)
      marker.material.transparent=true
      marker.material.depthWrite=false
      model.visible=false;shadow.visible=false
    }
    const speed=motion.minSpeed+this.rng()*(motion.maxSpeed-motion.minSpeed)
    this.cows.push({
      model,shadow,kind,ground:new T.Vector2(x,z),anchor:new T.Vector2(x,z),heading,course:heading,
      wander:this.level.turnSeconds*(.55+this.rng()),speed,pace:speed,lift:0,lastHit:-Infinity,
      warningUntil:warning?this.roundTime+hazard.warningSeconds:0,marker,
      mobile:warning&&(this.hazardSequence%this.level.hazards)<this.level.movingHazards
    })
  }
  phase(phase:Phase){
    const returning=phase==='title'&&this.state.phase!=='title'
    this.state.phase=phase
    if(returning){this.state.level=0;this.locked=undefined;this.resetCows()}
    this.resize();this.onUpdate(this.state)
  }
  start(level=this.state.level){
    this.state.level=level
    this.state.phase='countdown'
    this.state.score=0;this.state.count=0;this.state.hazards=0;this.state.seconds=3;this.state.progress=0
    this.state.combo=0;this.state.multiplier=1;this.lastCowAt=-Infinity
    this.firing=false;this.locked=undefined;this.target.set(2,flight,1);this.ship.position.copy(this.target)
    this.burstAt=-2;this.sparks.visible=false
    this.resetCows()
    this.roundTime=0;this.hazardAt=this.level.interval;this.hazardSequence=0
    this.spawnHazard()
    this.deadline=performance.now()+3000;this.phase('countdown')
  }
  pause(){
    if(this.state.phase==='playing'||this.state.phase==='countdown'){
      this.pauseAt=performance.now();this.beforePause=this.state.phase;this.firing=false;this.phase('paused')
    }
  }
  resume(){
    if(this.state.phase!=='paused')return
    this.deadline+=performance.now()-this.pauseAt;this.phase(this.beforePause)
  }
  input(position:{x:number;y:number;ground:boolean}|undefined, beam:boolean){
    if(position)this.aim(position.x,position.y,position.ground)
    this.setBeam(beam)
  }
  setBeam(active:boolean){this.firing=active}
  private spawn(kind:TargetKind){
    const danger=isHazard(kind)
    const i=Math.floor(this.rng()*cowSpawns.length)
    const pool=[...cowSpawns.slice(i),...cowSpawns.slice(0,i)]
    // Bias higher-level hazard locations toward cows, while keeping a warning gap.
    if(danger&&this.state.level>0){
      for(const cow of this.cows){
        if(isHazard(cow.kind))continue
        const angle=this.rng()*Math.PI*2
        const r=hazard.nearCowMin+this.rng()*(hazard.nearCowMax-hazard.nearCowMin)
        pool.unshift([cow.ground.x+Math.cos(angle)*r,cow.ground.y+Math.sin(angle)*r])
      }
    }
    const clearance=danger?hazard.nearCowMin:2.35
    const spawn=pool.find(([x,z])=>safeGround(x,z)&&this.cows.every(c=>Math.hypot(c.ground.x-x,c.ground.y-z)>clearance)
      && Math.hypot(this.ship.position.x-x,this.ship.position.z-z)>hazard.safeDistance)
    if(!spawn)return false
    this.addCow(...spawn as [number,number],kind,i,danger)
    return true
  }
  private spawnHazard(){
    const kind=this.level.kinds[this.hazardSequence%this.level.kinds.length]
    if(this.spawn(kind))this.hazardSequence++
  }
  private resetCombo(){
    this.state.combo=0;this.state.multiplier=1
  }
  private drive(c:Cow,hit:boolean,dt:number){
    if(isHazard(c.kind)&&!c.mobile)return
    const fits=(x:number,z:number)=>safeGround(x,z)&&this.cows.every(other=>other===c
      || Math.hypot(x-other.ground.x,z-other.ground.y)>=motion.separation)
    const normal=c.speed*this.level.speed
    if(hit&&!isHazard(c.kind)){
      // The lock has priority over wandering. Ease body orientation separately
      // so the aiming anchor never jumps with the struggle animation.
      const ship=this.ship.position
      const distance=this.distance(c)
      const fraction=c.lift>=balance.tractionThreshold?this.level.tractionSpeed:this.level.lockSpeed
      c.pace=normal*fraction
      if(distance>0){
        const heading=Math.atan2(c.ground.y-ship.z,ship.x-c.ground.x)
        c.heading=turn(c.heading,heading,dt*motion.lockedTurnRate)
        const step=Math.min(c.pace*dt,distance)
        const x=c.ground.x+(ship.x-c.ground.x)*step/distance
        const z=c.ground.y+(ship.z-c.ground.y)*step/distance
        if(fits(x,z))c.ground.set(x,z)
      }
      return
    }
    c.wander-=dt
    if(c.wander<=0){
      c.course=c.heading+(this.rng()*2-1)*motion.turnJitter
      c.wander=this.level.turnSeconds*(.65+this.rng()*.7)
    }
    const speed=normal*(isHazard(c.kind)?motion.hazardSpeed:1)
    c.pace=T.MathUtils.lerp(c.pace,speed,1-Math.exp(-dt*4))
    if(!fits(c.ground.x+Math.cos(c.heading)*.42,c.ground.y-Math.sin(c.heading)*.42)){
      const chosen=[.75,-.75,1.5,-1.5,2.35,-2.35,Math.PI].map(a=>c.heading+a).find(a=>fits(
        c.ground.x+Math.cos(a)*.72,c.ground.y-Math.sin(a)*.72))
      if(chosen!==undefined){
        c.course=chosen
        c.heading=turn(c.heading,chosen,dt*motion.turnRate)
      }
    }else{
      c.heading=turn(c.heading,c.course,dt*motion.turnRate)
    }
    const x=c.ground.x+Math.cos(c.heading)*c.pace*dt
    const z=c.ground.y-Math.sin(c.heading)*c.pace*dt
    if(fits(x,z))c.ground.set(x,z)
  }
  private radius(c:Cow,sustained:boolean){
    const base=sustained?balance.holdRadius:balance.acquireRadius
    return base*(isHazard(c.kind)?1:balance.cowRadiusScale)
  }
  private findLock(){
    const previous=this.recoverable
    if(previous&&this.roundTime-previous.lastHit<=balance.cowGraceSeconds
      &&this.distance(previous)<=this.radius(previous,true))return previous
    return this.cows.reduce<Cow|undefined>((closest,c)=>{
      const distance=this.distance(c)
      return !c.marker&&distance<=this.radius(c,false)&&(!closest||distance<this.distance(closest))?c:closest
    },undefined)
  }
  private distance(c:Cow){
    return Math.hypot(c.ground.x-this.ship.position.x,c.ground.y-this.ship.position.z)
  }
  private finishWarning(c:Cow,time:number){
    if(!c.marker)return
    c.marker.scale.setScalar(1+.22*Math.sin(time*12))
    c.marker.material.opacity=.69+.25*Math.sin(time*11)
    // A player entering the marked spot cannot activate a hazard underneath the ship.
    if(this.roundTime<c.warningUntil||this.distance(c)<hazard.safeDistance)return
    this.removeWarning(c)
    c.model.visible=true;c.shadow.visible=true
  }
  private removeWarning(c:Cow){
    if(!c.marker)return
    c.marker.removeFromParent();c.marker.geometry.dispose();c.marker.material.dispose()
    c.marker=undefined
  }
  aim(u:number,v:number,ground=false){
    this.plane.constant=ground?0:-flight
    this.pointer.set(u*2-1,1-v*2)
    this.ray.setFromCamera(this.pointer,this.camera)
    if(this.ray.ray.intersectPlane(this.plane,this.projected)){
      this.target.set(clamp(this.projected.x,-field.x,field.x),flight,clamp(this.projected.z,-field.z,field.z))
    }
  }
  get projectedField(){
    const points=[[-field.x,-field.z],[-field.x,field.z],[field.x,-field.z],[field.x,field.z]].map(([x,z])=>new T.Vector3(x,flight,z).project(this.camera))
    return {
      left:clamp((1+Math.min(...points.map(p=>p.x)))*.5,.025,.90),
      right:clamp((1+Math.max(...points.map(p=>p.x)))*.5,.10,.975),
      top:clamp((1-Math.max(...points.map(p=>p.y)))*.5,.11,.80),
      bottom:clamp((1-Math.min(...points.map(p=>p.y)))*.5,.24,.94)
    }
  }
  private capture(c:Cow){
    const index=this.cows.indexOf(c)
    if(index<0 || c.lift<1)return
    // Retire the completed target before notifying the UI or queuing a replacement.
    this.cows.splice(index,1)
    if(this.recoverable===c)this.recoverable=undefined
    this.locked=undefined
    const base=rule(c.kind).points
    let bonus=0
    if(base<0){
      this.state.hazards++
      this.resetCombo()
    }else{
      this.state.count++
      this.state.combo++
      this.lastCowAt=this.roundTime
      const chain=this.state.combo
      this.state.multiplier=chain>=combo.tripleAt?3:chain>=combo.doubleAt?2:1
      if(this.state.multiplier>1)bonus=combo.bonusUnit*this.state.multiplier
    }
    const points=base+bonus
    this.state.score=Math.max(0,this.state.score+points)
    this.sparks.material.color.setHex(points<0?0xff644e:0xb4ffe0)
    this.burstOrigin.copy(c.model.position)
    this.burstAt=this.elapsed
    const p=c.model.position.clone().project(this.camera)
    this.onCapture(points,{x:(1+p.x)*50,y:(1-p.y)*50},c.kind,bonus)
    this.removeCow(c)
    if(base>0)this.respawns.push({at:this.roundTime+settings.respawnSeconds,kind:c.kind})
  }
  private removeCow(c:Cow){
    this.removeWarning(c)
    this.scene.remove(c.model,c.shadow)
    c.shadow.geometry.dispose();(c.shadow.material as T.Material).dispose()
  }
  private updateSparks(){
    const u=(this.elapsed-this.burstAt)/.67
    this.sparks.visible=u<1
    if(u>=1)return
    const pos=this.sparks.geometry.attributes.position
    for(let i=0;i<pos.count;i++){
      const a=i*2.4, r=Math.sqrt(u)*(1.05+i%4*.29)
      pos.setXYZ(i,this.burstOrigin.x+Math.cos(a)*r,this.burstOrigin.y+u*(i%5*.29)-u*u*.45,this.burstOrigin.z+Math.sin(a)*r)
    }
    pos.needsUpdate=true
    this.sparks.material.opacity=1-u
  }
  private frame=(now:number)=>{
    const frameTime=Math.max(0,(now-this.last)/1000)
    const dt=Math.min(.10,frameTime);this.last=now
    this.onFrame(now)
    const phase=this.state.phase,play=phase==='playing',preview=phase==='title'
    if(phase==='countdown'||play){
      this.state.seconds=Math.max(0,Math.ceil((this.deadline-now)/1000))
      if(this.state.seconds===0){
        if(play){this.firing=false;this.state.progress=0;this.phase('ended')}
        else{this.deadline+=settings.seconds*1000;this.state.seconds=settings.seconds;this.phase('playing')}
      }
    }
    const moving=this.state.phase!=='paused'&&this.state.phase!=='ended'
    const live=this.state.phase==='playing'
    const active=preview||(live&&this.firing)
    if(moving){
      this.elapsed+=dt
      if(live){
        this.roundTime=settings.seconds-(this.deadline-now)/1000
        if(this.roundTime-this.lastCowAt>=combo.expireSeconds&&this.state.combo)this.resetCombo()
        for(const c of this.cows)this.finishWarning(c,this.elapsed)
      }
      const time=this.elapsed
      this.mill.rotation.z+=dt*.25
      if(preview) this.target.set(3.75+Math.sin(time*.54)*.37,flight,1.35+Math.cos(time*.51)*.28)
      const ox=this.ship.position.x,oz=this.ship.position.z
      const gap=Math.hypot(this.target.x-ox,this.target.z-oz)
      const rate=balance.aimFollowRate+Math.min(balance.aimMaxExtraRate,gap*1.8)
      const follow=gap>balance.aimDeadZone?(1-Math.exp(-dt*rate))*(1-balance.aimDeadZone/gap):0
      this.ship.position.lerp(this.target,follow)
      this.ship.position.y=flight+Math.sin(time*2.05)*.13
      this.hull.rotation.z=T.MathUtils.lerp(this.hull.rotation.z,clamp((ox-this.ship.position.x)*.65,-.16,.16),.17)
      this.hull.rotation.x=T.MathUtils.lerp(this.hull.rotation.x,clamp((this.ship.position.z-oz)*.52,-.14,.14),.17)
      this.shipShadow.position.set(this.ship.position.x,.054,this.ship.position.z)
      if(!live||!active||!this.locked||this.distance(this.locked)>this.radius(this.locked,true))
        this.locked=live&&active?this.findLock():undefined
      for(const [i,c] of this.cows.entries()){
        if(c.marker)continue
        const showcase=preview&&i===4
        if(!showcase)this.drive(c,c===this.locked,dt)
        // Check range again after movement. Grace freezes progress, never adds it.
        if(c===this.locked&&this.distance(c)>this.radius(c,true))this.locked=undefined
        const danger=isHazard(c.kind)
        if(c===this.locked){
          c.lastHit=this.roundTime
          c.anchor.set(this.ship.position.x,this.ship.position.z)
          c.lift=Math.min(1,c.lift+dt/captureSeconds(c.kind))
          if(!danger)this.recoverable=c
        }else if(live&&c.lift>0){
          const grace=danger?balance.graceSeconds:balance.cowGraceSeconds
          const decay=danger?balance.decayRate:balance.cowDecayFraction/captureSeconds(c.kind)
          const decayTime=clamp(this.roundTime-c.lastHit-grace,0,dt)
          c.lift=Math.max(0,c.lift-decayTime*decay)
        }
        if(showcase)c.lift=.46+Math.sin(time*1.2)*.07
        const traction=clamp((c.lift-balance.tractionThreshold)/(1-balance.tractionThreshold),0,1)
        const height=showcase||danger?c.lift:traction*traction*(3-2*traction)
        const pull=showcase?.92:danger?clamp((c.lift-.72)/.28,0,1)*.87:height*.87
        c.model.position.set(
          T.MathUtils.lerp(c.ground.x,showcase?this.ship.position.x:c.anchor.x,pull),
          height*(this.ship.position.y-.57),
          T.MathUtils.lerp(c.ground.y,showcase?this.ship.position.z:c.anchor.y,pull))
        c.model.rotation.y=turn(c.model.rotation.y,c.heading+c.lift*.45,dt*5)
        c.model.rotation.z=c.lift*.34+Math.sin(time*4+i)*c.lift*.13
        c.model.scale.setScalar(1-c.lift*(showcase?.34:.70))
        c.shadow.position.set(c.ground.x,.045,c.ground.y)
        c.shadow.scale.setScalar(1+c.lift*.45)
      }
      if(this.locked&&this.locked.lift>=1)this.capture(this.locked)
      if(live){
        for(let i=this.respawns.length-1;i>=0;i--){
          const job=this.respawns[i]
          if(job.at<=this.roundTime&&this.spawn(job.kind))this.respawns.splice(i,1)
        }
        if(this.roundTime>=this.hazardAt){
          if(this.cows.filter(c=>isHazard(c.kind)).length<this.level.hazards)this.spawnHazard()
          this.hazardAt=this.roundTime+this.level.interval
        }
      }
    }
    this.updateSparks()
    this.state.progress=live?this.locked?.lift??0:0
    if(moving||this.beam.group.visible) this.beam.update(this.ship.position.x,this.ship.position.z,this.ship.position.y-.51,this.elapsed,dt,active,this.locked)
    this.onUpdate(this.state)
    this.renderer.render(this.scene,this.camera)
  }
}

import * as T from 'three'
import {basic,cowModel,groundGlow,hazardModel,ring,shipModel} from './models'
import {buildWorld,field,randomizer} from './world'
import {captureSeconds,isHazard,levels,rule,settings,type TargetKind} from './levels'

export type Phase='title'|'modes'|'levels'|'calibrating'|'countdown'|'playing'|'paused'|'ended'
export interface GameState { phase:Phase; score:number; count:number; hazards:number; level:number; seconds:number; progress:number }
interface Cow { model:T.Group; shadow:T.Mesh; kind:TargetKind; heading:number; wander:number; speed:number; lift:number }

const flight=5.65
const captureRadius=1.92
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
    this.outer=new T.Mesh(new T.CylinderGeometry(.43,2.04,1,40,1,true),new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,
      uniforms:{alpha:{value:0},time:{value:0}},
      vertexShader:'varying vec2 tex; void main(){tex=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 tex; uniform float alpha; uniform float time; void main(){float fold=.57+.43*sin(tex.x*37.699+tex.y*3.);float scan=pow(.5+.5*sin(tex.y*36.+time*5.),9.);float a=alpha*(.115+.08*fold+.065*scan)*(.72+tex.y*.28);gl_FragColor=vec4(.30,1.,.80,a);}'
    }))
    this.group.add(this.outer)
    this.bloom=groundGlow(this.group,0x4dffc5,5.9,.86) as typeof this.bloom
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
      const u=(t*.38+i*.25)%1,w=this.waves[i],r=2.02-u*1.58
      w.position.y=.10+u*(height-.1);w.scale.set(r,r,1);w.material.opacity=a*(.20+.44*Math.sin(u*Math.PI))
    }
    const pos=this.dust.geometry.attributes.position
    for(let i=0;i<pos.count;i++){
      const j=i*4,p=(this.scatter[j]+t*(.22+this.scatter[j+1]*.18))%1
      const r=(2-p*1.58)*Math.sqrt(this.scatter[j+2]), angle=this.scatter[j+3]*Math.PI*2+t*.36
      pos.setXYZ(i,Math.cos(angle)*r,p*height,Math.sin(angle)*r)
    }
    pos.needsUpdate=true;this.dust.material.opacity=a*.76
    this.lock.visible=active&&!!cow
    if(cow){
      this.lock.position.set(cow.model.position.x,.018,cow.model.position.z)
      this.reticle.material.color.setHex(isHazard(cow.kind)?0xff745c:0xb3ffe7)
      this.reticle.geometry.setDrawRange(0,Math.max(36,Math.floor(cow.lift*48)*36))
    }
  }
}

export class Game {
  readonly state:GameState={phase:'title',score:0,count:0,hazards:0,level:0,seconds:settings.seconds,progress:0}
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
  private readonly sparks:T.Points<T.BufferGeometry,T.PointsMaterial>
  private readonly burstOrigin=new T.Vector3()
  private burstAt=-2
  private readonly respawns:{at:number,kind:TargetKind}[]=[]
  private hazardAt=0
  private hazardSequence=0
  private roundTime=0
  get level(){return levels[this.state.level]}
  onFrame:(now:number)=>void=()=>{}
  onUpdate:(s:GameState)=>void=()=>{}
  onCapture:(points:number,location:{x:number,y:number})=>void=()=>{}
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
    this.cows.length=0;this.respawns.length=0
    const planned:TargetKind[]=this.state.phase==='title'
      ? cowSpawns.slice(0,11).map((_,i)=>i===7?'gold':'cow')
      : [...Array<TargetKind>(this.level.cow).fill('cow'),...Array<TargetKind>(this.level.gold).fill('gold')]
    planned.forEach((kind,i)=>this.addCow(...cowSpawns[i] as [number,number],kind,i))
  }
  private addCow(x:number,z:number,kind:TargetKind,i:number){
    const model=kind==='cow'||kind==='gold'?cowModel(kind==='gold'):hazardModel(kind)
    const shadow=groundGlow(this.scene,0x202237,2.32,.78)
    const heading=isHazard(kind)?.18:i*.66+.21
    model.position.set(x,0,z);model.rotation.y=heading
    this.scene.add(model)
    this.cows.push({model,shadow,kind,heading,wander:1+this.rng()*4,speed:.3+this.rng()*.42,lift:0})
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
    const i=Math.floor(this.rng()*cowSpawns.length)
    const pool=[...cowSpawns.slice(i),...cowSpawns.slice(0,i)]
    const spawn=pool.find(([x,z])=>this.cows.every(c=>Math.hypot(c.model.position.x-x,c.model.position.z-z)>2.35)
      && Math.hypot(this.ship.position.x-x,this.ship.position.z-z)>2.3)
    if(!spawn)return false
    this.addCow(...spawn as [number,number],kind,i)
    return true
  }
  private spawnHazard(){
    const kind=this.level.kinds[this.hazardSequence%this.level.kinds.length]
    if(this.spawn(kind))this.hazardSequence++
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
    const points=rule(c.kind).points
    this.state.score=Math.max(0,this.state.score+points)
    if(points<0)this.state.hazards++
    else this.state.count++
    this.sparks.material.color.setHex(points<0?0xff644e:0xb4ffe0)
    this.burstOrigin.copy(c.model.position)
    this.burstAt=this.elapsed
    const p=c.model.position.clone().project(this.camera)
    this.onCapture(points,{x:(1+p.x)*50,y:(1-p.y)*50})
    this.removeCow(c)
    this.cows.splice(this.cows.indexOf(c),1)
    if(points>0)this.respawns.push({at:this.roundTime+settings.respawnSeconds,kind:c.kind})
    this.locked=undefined
  }
  private removeCow(c:Cow){
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
      if(live)this.roundTime+=dt
      const time=this.elapsed
      this.mill.rotation.z+=dt*.25
      if(preview) this.target.set(3.75+Math.sin(time*.54)*.37,flight,1.35+Math.cos(time*.51)*.28)
      const ox=this.ship.position.x,oz=this.ship.position.z
      this.ship.position.lerp(this.target,1-Math.exp(-dt*9))
      this.ship.position.y=flight+Math.sin(time*2.05)*.13
      this.hull.rotation.z=T.MathUtils.lerp(this.hull.rotation.z,clamp((ox-this.ship.position.x)*.65,-.16,.16),.17)
      this.hull.rotation.x=T.MathUtils.lerp(this.hull.rotation.x,clamp((this.ship.position.z-oz)*.52,-.14,.14),.17)
      this.shipShadow.position.set(this.ship.position.x,.054,this.ship.position.z)
      const distance=(c:Cow)=>Math.hypot(c.model.position.x-this.ship.position.x,c.model.position.z-this.ship.position.z)
      if(!live||!active||!this.locked||distance(this.locked)>captureRadius){
        this.locked=live&&active?[...this.cows].sort((a,b)=>distance(a)-distance(b)).find(c=>distance(c)<captureRadius):undefined
      }
      for(const [i,c] of this.cows.entries()){
        const {position}=c.model
        const hit=c===this.locked
        const showcase=preview&&i===4
        if((!isHazard(c.kind)||this.state.level===3)&&!showcase&&c.lift<.025&&!hit){
          c.wander-=dt
          if(c.wander<0){c.wander=1.4+this.rng()*3.6;c.heading+=this.rng()*2.15-1.075;c.speed=this.rng()<.20?0:.28+this.rng()*.65}
          const vx=Math.cos(c.heading),vz=-Math.sin(c.heading)
          const pace=c.speed*dt*this.level.speed*(isHazard(c.kind)?.28:1)
          const nx=position.x+vx*pace,nz=position.z+vz*pace
          if(Math.abs(nx)>field.x-.55||Math.abs(nz)>field.z-.4){c.heading+=2.1;c.wander=1}
          else if(this.cows.some(other=>other!==c&&other.lift<.2&&Math.hypot(nx-other.model.position.x,nz-other.model.position.z)<1.65)){c.heading+=dt*1.7}
          else{position.x=nx;position.z=nz}
          c.model.rotation.y+=Math.atan2(Math.sin(c.heading-c.model.rotation.y),Math.cos(c.heading-c.model.rotation.y))*Math.min(1,dt*5)
        }
        c.lift=showcase?.46+Math.sin(time*1.2)*.07:clamp(c.lift+Math.min(.22,frameTime)*(hit?1/captureSeconds(c.kind):-.86),0,1)
        if(hit||showcase){
          const gain=1-Math.exp(-dt*(showcase?2:2+c.lift*4))
          position.x=T.MathUtils.lerp(position.x,this.ship.position.x,gain)
          position.z=T.MathUtils.lerp(position.z,this.ship.position.z,gain)
          c.model.rotation.y+=dt*(showcase?.18:.37+c.lift)
        }
        position.y=c.lift*(this.ship.position.y-.57)
        c.model.rotation.z=c.lift*.34+Math.sin(time*4+i)*c.lift*.13
        c.model.scale.setScalar(1-c.lift*(showcase?.34:.70))
        c.shadow.position.set(position.x,.045,position.z)
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

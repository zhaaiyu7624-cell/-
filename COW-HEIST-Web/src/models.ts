import * as T from 'three'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'

export const mat = (color: number) => new T.MeshStandardMaterial({color, flatShading:true, roughness:.78})
export const basic = (color:number) => new T.MeshBasicMaterial({color})
export function shape(parent:T.Object3D, geometry:T.BufferGeometry, material:T.Material, x=0,y=0,z=0) {
  const m=new T.Mesh(geometry,material)
  m.position.set(x,y,z)
  parent.add(m)
  return m
}
export const box=(p:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>shape(p,new T.BoxGeometry(w,h,d),m,x,y,z)
export const ball=(p:T.Object3D,m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number, detail=0)=>{
  const o=shape(p,new T.IcosahedronGeometry(1,detail),m,x,y,z);o.scale.set(w,h,d);return o
}
export const cyl=(p:T.Object3D,m:T.Material,x:number,y:number,z:number,a:number,b:number,h:number,n=12)=>shape(p,new T.CylinderGeometry(a,b,h,n),m,x,y,z)
export const ring=(p:T.Object3D,m:T.Material,r:number,t:number,y:number)=>{
  const o=shape(p,new T.TorusGeometry(r,t,6,48),m,0,y,0);o.rotation.x=-Math.PI/2;return o
}
export function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=64
  const ctx=c.getContext('2d')!
  const g=ctx.createRadialGradient(32,32,0,32,32,32)
  g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.23,'rgba(255,255,255,.38)');g.addColorStop(1,'rgba(255,255,255,0)')
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64)
  return new T.CanvasTexture(c)
}
let glowMap:T.CanvasTexture|undefined
export function glow(p:T.Object3D,color:number,size:number,x:number,y:number,z:number,opacity=.6){
  glowMap??=glowTexture()
  const o=new T.Sprite(new T.SpriteMaterial({map:glowMap,color,opacity,transparent:true,depthWrite:false,blending:T.AdditiveBlending}))
  o.scale.setScalar(size);o.position.set(x,y,z);p.add(o);return o
}
export function groundGlow(p:T.Object3D,color:number,size:number,opacity:number){
  glowMap??=glowTexture()
  const o=shape(p,new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map:glowMap,color,opacity,transparent:true,depthWrite:false}),0,.035,0)
  o.rotation.x=-Math.PI/2;return o
}

const ink=mat(0x272138),cream=mat(0xffeee6),ginger=mat(0xf7b44e),brindle=mat(0x8f553d),pink=mat(0xf4a4a7),horn=mat(0xffcb87)
const cows=new Map<boolean,T.Group>()
export function cowModel(gold:boolean){
  let model=cows.get(gold)
  if(!model){
    model=makeCow(gold)
    batchMeshes(model)
    cows.set(gold,model)
  }
  return model.clone()
}
function makeCow(gold:boolean) {
  const g=new T.Group(), fur=gold?ginger:cream, spots=gold?brindle:ink
  ball(g,fur,-.09,.60,0,.76,.40,.39,1)
  for (const side of [-1,1]) {
    ball(g,spots,-.39,.68,side*.298,.35,.265,.102)
    ball(g,spots,.23,.56,side*.326,.24,.19,.068)
    ball(g,spots,-.03,.81,side*.18,.24,.18,.20)
    for (const x of [-.52,.37]) {
      cyl(g,fur,x,.27,side*.235,.105,.082,.39,6)
      cyl(g,ink,x,.083,side*.235,.084,.093,.13,6)
    }
    const ear=ball(g,spots,.58,1.03,.36*side,.17,.085,.16);ear.rotation.x=side*.2
    const h=cyl(g,horn,.67,1.18,.18*side,.014,.07,.22,6);h.rotation.x=side*.4
  }
  ball(g,fur,.68,.90,0,.37,.34,.30,1)
  ball(g,spots,.75,1,.17,.20,.18,.15)
  ball(g,pink,.959,.767,0,.23,.164,.257,1)
  for (const side of [-1,1]) {
    ball(g,ink,.826,.95,side*.245,.058,.065,.034,1)
    ball(g,basic(0xffffff),.849,.975,side*.271,.016,.016,.010)
    ball(g,spots,1.142,.792,side*.10,.021,.026,.024)
  }
  const tail=cyl(g,spots,-.82,.46,0,.027,.024,.40,5);tail.rotation.z=-.24
  ball(g,spots,-.86,.265,0,.058,.093,.057)
  if(gold) glow(g,0xffbd66,1.8,0,.65,0,.29)
  return g
}

export function shipModel(){
  const g=new T.Group()
  const metal=mat(0x7361b4),dark=mat(0x362958),rim=mat(0xb3a4e1),warm=basic(0xffe4ab),mint=basic(0xa5ffeb)
  const profile=[[0,-.46],[.72,-.46],[1.45,-.33],[2.33,-.11],[2.47,.035],[2.30,.23],[1.55,.57],[1.02,.65],[0,.65]]
  shape(g,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),18),metal)
  ring(g,rim,2.42,.047,.045);ring(g,mint,1.03,.021,.693);ring(g,dark,2.24,.073,-.151);ring(g,rim,1.43,.052,.53)
  cyl(g,dark,0,-.40,0,.91,.84,.18,16)
  cyl(g,mint,0,-.508,0,.70,.61,.052,24)
  glow(g,0x68ffe2,2.5,0,-.50,0,.56)
  cyl(g,dark,0,.61,0,1.15,1.26,.14,18)
  const dome=new T.MeshPhysicalMaterial({color:0x63decf,metalness:.16,roughness:.16,transparent:true,opacity:.66,side:T.FrontSide,depthWrite:false,emissive:0x174d57,emissiveIntensity:.62})
  shape(g,new T.SphereGeometry(1.03,20,10,0,Math.PI*2,0,Math.PI/2),dome,0,.64,0).renderOrder=3
  const shine=new T.MeshBasicMaterial({color:0xccfff1,transparent:true,opacity:.52,depthWrite:false})
  const reflection=ball(g,shine,-.40,1.49,.44,.21,.033,.028,1)
  reflection.rotation.z=.36;reflection.renderOrder=4
  const alien=mat(0x24455c)
  ball(g,alien,0,1.01,.18,.38,.31,.30,1)
  for(const x of [-.16,.16]){
    ball(g,mint,x,1.055,.46,.066,.080,.039,1)
    const stem=cyl(g,alien,x*1.7,1.31,.19,.025,.025,.24,6);stem.rotation.z=-x*2
    ball(g,alien,x*2,1.42,.19,.064,.064,.064,1)
  }
  for(let i=0;i<14;i++){
    const a=i/14*Math.PI*2,x=Math.cos(a),z=Math.sin(a)
    ball(g,dark,x*2.26,-.115,z*2.26,.187,.093,.16,1)
    ball(g,warm,x*2.34,-.101,z*2.34,.105,.074,.097,1)
    if(z>-.30) glow(g,0xffb972,.61,x*2.34,-.101,z*2.34,.73)
  }
  batchMeshes(g)
  return g
}

export function batchMeshes(scene:T.Object3D, moving?:T.Object3D){
  scene.updateMatrixWorld(true)
  const groups=new Map<string,{meshes:T.Mesh[]; material:T.MeshBasicMaterial|T.MeshStandardMaterial}>()
  const visit=(item:T.Object3D)=>{
    if(item===moving)return
    if(item instanceof T.Mesh&&!(item instanceof T.InstancedMesh)&&
      (item.material instanceof T.MeshStandardMaterial||item.material instanceof T.MeshBasicMaterial)&&
      !item.material.transparent&&!item.material.map&&!item.material.vertexColors&&item.geometry.attributes.uv){
      const m=item.material
      const key=[m.type,m.fog,m.toneMapped,m.side].join('/')
      let group=groups.get(key)
      if(!group){
        const material=m.clone()
        material.color.set(0xffffff);material.vertexColors=true
        group={meshes:[],material};groups.set(key,group)
      }
      group.meshes.push(item)
    }
    item.children.forEach(visit)
  }
  visit(scene)
  for(const {meshes,material} of groups.values()){
    const pieces=meshes.map(m=>{
      const geo=(m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone()).applyMatrix4(m.matrixWorld)
      const colors=new Float32Array(geo.attributes.position.count*3)
      for(let i=0;i<colors.length;i+=3)(m.material as T.MeshStandardMaterial).color.toArray(colors,i)
      geo.setAttribute('color',new T.BufferAttribute(colors,3))
      return geo
    })
    const merged=mergeGeometries(pieces)
    pieces.forEach(p=>p.dispose())
    if(!merged){material.dispose();continue}
    for(const mesh of meshes){mesh.removeFromParent();mesh.geometry.dispose()}
    shape(scene,merged,material)
  }
}

const hazards=new Map<string,T.Group>()
export function hazardModel(kind:'pumpkin'|'scarecrow'|'barrel'){
  const cached=hazards.get(kind)
  if(cached)return cached.clone()
  const g=new T.Group()
  const danger=basic(0xff694c), black=mat(0x572e46), straw=mat(0xd8a467)
  if(kind==='pumpkin'){
    const orange=mat(0xe76c38)
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4
      ball(g,orange,Math.cos(a)*.31,.49,Math.sin(a)*.31,.36,.43,.36,1)
    }
    cyl(g,mat(0x64764e),0,.98,0,.085,.12,.22,6)
    for(const x of [-.21,.21]) cyl(g,danger,x,.58,.61,0,.12,.11,3).rotation.x=Math.PI/2
    box(g,black,0,.38,.62,.37,.09,.045)
  }else if(kind==='scarecrow'){
    box(g,straw,0,.81,0,.13,1.62,.14)
    box(g,straw,0,1.13,0,1.43,.16,.18)
    cyl(g,mat(0x93604b),0,.91,0,.24,.34,.60,5)
    ball(g,straw,0,1.52,0,.26,.27,.23,1)
    cyl(g,black,0,1.74,0,.42,.42,.072,8)
    cyl(g,black,0,1.88,0,.12,.24,.27,7)
  }else{
    const blue=mat(0x526879)
    cyl(g,blue,0,.59,0,.43,.46,1.18,12)
    for(const y of [.18,.57,1.02]) cyl(g,black,0,y,0,.47,.47,.06,12)
    cyl(g,danger,0,1.185,0,.15,.15,.035,10)
  }
  // The luminous warning sign distinguishes hazards even without color.
  const signY=kind==='scarecrow'?1.02:.60
  const sign=box(g,black,0,signY,kind==='pumpkin'?.66:.50,.34,.34,.055)
  sign.rotation.z=Math.PI/4
  box(g,danger,0,signY+.038,sign.position.z+.044,.065,.15,.02)
  box(g,danger,0,signY-.082,sign.position.z+.044,.065,.063,.02)
  glow(g,0xff503d,1.45,0,signY,0,.42)
  batchMeshes(g)
  hazards.set(kind,g)
  return g.clone()
}

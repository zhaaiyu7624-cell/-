import * as T from 'three'
import {ball,batchMeshes,basic,box,cyl,glow,groundGlow,mat,shape} from './models'

export const field={x:13.8,z:8.2}
export function randomizer(seed:number){
  return ()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}
}
const rnd=randomizer(751)
const between=(a:number,b:number)=>a+(b-a)*rnd()
const wood=mat(0x73465b), rail=mat(0x9d685d), cedar=mat(0x97505f), trim=mat(0xe3a884)
const roof=mat(0x44416b), roofLight=mat(0x61577d), amber=basic(0xffc878), soil=mat(0x68516b)
const teal=[0x1d444f,0x255158,0x304967,0x34466b].map(mat)

function fence(p:T.Object3D,x:number,z:number,endX:number,endZ:number){
  const len=Math.hypot(x-endX,z-endZ), parts=Math.ceil(len/2.55)
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=-Math.atan2(endZ-z,endX-x);p.add(g)
  const gap=len/parts
  for(let i=0;i<=parts;i++){
    box(g,wood,i*gap,.62,0,.16,1.25,.19)
    box(g,rail,i*gap,1.26,0,.22,.11,.23)
    if(i<parts) for(const y of [.40,.94]) box(g,rail,(i+.5)*gap,y,0,gap,.115,.12)
  }
}
function elevation(x:number,z:number){
  const far=Math.max(0,Math.hypot(x*.76,z)-21)
  return -.13+Math.min(12,far*.22)*(.37+.5*Math.sin(x*.15+z*.09)*Math.sin(z*.19))
}
function fir(p:T.Object3D,x:number,z:number,s:number){
  const g=new T.Group();g.position.set(x,elevation(x,z)-.12,z);g.scale.setScalar(s);p.add(g)
  cyl(g,wood,0,.55,0,.12,.16,1.25,6)
  const a=rnd()*2
  for(let i=0;i<3;i++){
    const m=cyl(g,teal[(Math.floor(rnd()*2)+i)%4],0,1.19+i*.70,0,0,1.05-i*.23,1.65-i*.10,6);m.rotation.y=a+i*.55
  }
}
function lamp(p:T.Object3D,x:number,z:number,s=1){
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(s);p.add(g)
  box(g,wood,0,1.58,0,.15,3.16,.16);box(g,rail,.35,2.91,0,.92,.15,.16)
  box(g,amber,.69,2.56,0,.26,.39,.25)
  for(const q of [-1,1]) for(const r of [-1,1]) box(g,wood,.69+q*.132,2.56,r*.128,.035,.44,.035)
  cyl(g,wood,.69,2.8,0,.11,.24,.14,4).rotation.y=Math.PI/4
  glow(g,0xff974a,1.85,.69,2.56,0,.82)
  const pool=groundGlow(g,0xfcb055,4.5,.67);pool.position.x=.69
}
function pumpkin(p:T.Object3D,x:number,z:number,s:number){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=between(-.5,.6);g.scale.setScalar(s);p.add(g)
  const orange=mat(0xc36b40), shadow=basic(0x512740)
  for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ball(g,orange,.16*Math.cos(a),.31,.16*Math.sin(a),.22,.30,.23,1)}
  cyl(g,teal[0],0,.62,0,.06,.095,.20,5).rotation.z=.22
  for(const q of [-1,1]) cyl(g,amber,q*.12,.36,.329,0,.085,.13,3).rotation.x=Math.PI/2
  box(g,shadow,0,.203,.329,.26,.09,.045);box(g,amber,0,.212,.354,.22,.038,.015)
  glow(g,0xff8f40,1.12,0,.26,.47,.47)
}
function barn(p:T.Object3D,x:number,z:number,s=1,angle=0){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=angle;g.scale.setScalar(s);p.add(g)
  box(g,cedar,0,1.42,0,5.4,2.84,4.65)
  const cap=new T.Shape();cap.moveTo(-2.7,0);cap.lineTo(-1.78,1.32);cap.lineTo(0,2.02);cap.lineTo(1.78,1.32);cap.lineTo(2.7,0);cap.closePath()
  shape(g,new T.ExtrudeGeometry(cap,{depth:4.65,bevelEnabled:false}),cedar,0,2.84,-2.325)
  for(let i=0;i<17;i++) box(g,wood,(i-8)*.316,1.42,2.331,.022,2.84,.035)
  const slopes=[[-2.88,2.74,-1.78,4.20],[-1.78,4.20,0,4.92],[0,4.92,1.78,4.20],[1.78,4.20,2.88,2.74]]
  for(const [a,b,c,d] of slopes){
    const l=Math.hypot(c-a,d-b),an=Math.atan2(d-b,c-a)
    box(g,roof,(a+c)/2,(b+d)/2,0,l+.06,.15,5.15).rotation.z=an
    for(let j=0;j<9;j++) box(g,j%2?roofLight:roof,(a+c)/2,(b+d)/2+.09,(j-4)*.55,l,.066,.52).rotation.z=an
    box(g,trim,(a+c)/2,(b+d)/2,2.59,l+.12,.12,.15).rotation.z=an
    for(let j=0;j<4;j++){
      const u=(j+.35)/4, xx=a+(c-a)*u,yy=b+(d-b)*u
      ball(g,amber,xx,yy-.12,2.69,.047,.047,.042,1)
      glow(g,0xffa655,.29,xx,yy-.12,2.70,.66)
    }
  }
  box(g,trim,0,1.23,2.37,2.69,2.45,.085)
  for(const sign of [-1,1]){
    box(g,wood,sign*.64,1.19,2.435,1.19,2.27,.09)
    for(const slant of [-1,1]) box(g,trim,sign*.64,1.19,2.495,.075,2.49,.045).rotation.z=slant*.47
    box(g,amber,sign*1.33,1.25,2.53,.033,2.26,.03)
  }
  for(const [xx,yy] of [[0,3.64],[-1.99,1.58],[1.99,1.58]]){
    box(g,trim,xx,yy,2.4,.69,.72,.09);box(g,amber,xx,yy,2.449,.55,.58,.04)
    box(g,trim,xx,yy,2.483,.055,.62,.042);box(g,trim,xx,yy,2.483,.57,.055,.042)
    glow(g,0xff9c4d,1.62,xx,yy,2.57,.63)
  }
  const pool=groundGlow(g,0xffa157,8,.73);pool.position.z=3.25
  const light=new T.PointLight(0xffa566,46,10,2);light.position.set(0,1.95,3.40);g.add(light)
  const lampLight=new T.PointLight(0xffbc7d,16,5,2);lampLight.position.set(0,3.72,2.97);g.add(lampLight)
  box(g,wood,-1.5,4.18,-.86,.42,1.34,.47);box(g,trim,-1.5,4.83,-.86,.53,.12,.58)
}
function windmill(p:T.Object3D,x:number,z:number){
  const g=new T.Group();g.position.set(x,0,z);p.add(g)
  for(const a of [-1,1]) for(const b of [-1,1]){
    const beam=box(g,wood,a*.48,2.24,b*.47,.12,4.65,.12)
    beam.rotation.z=a*.145;beam.rotation.x=-b*.145
  }
  for(let i=1;i<=3;i++){
    const y=i*1.13,d=1.62-y*.245
    for(const a of [-1,1]) box(g,rail,0,y,a*d*.5,d,.12,.11)
  }
  const blades=new T.Group();blades.position.set(0,4.6,.35);g.add(blades)
  for(let i=0;i<11;i++){
    const b=new T.Group();b.rotation.z=i/11*Math.PI*2;blades.add(b)
    box(b,rail,0,.76,0,.045,1.44,.045);box(b,roofLight,.095,1.21,0,.27,.56,.065).rotation.z=.1
  }
  ball(blades,amber,0,0,.03,.133,.133,.09,1)
  return blades
}

export function buildWorld(scene:T.Scene){
  scene.background=new T.Color(0x242248)
  scene.fog=new T.FogExp2(0x60507f,.0105)
  const sky=new T.HemisphereLight(0xe0c7ff,0x806c9a,2.05);scene.add(sky)
  const key=new T.DirectionalLight(0xc0c9ff,2.8);key.position.set(-8,12,9);scene.add(key)
  const warm=new T.DirectionalLight(0xffb68a,1.40);warm.position.set(14,6,-7);scene.add(warm)
  box(scene,mat(0x394b59),0,-.33,0,240,.49,210)
  const terrain=new T.PlaneGeometry(165,120,47,37);terrain.rotateX(-Math.PI/2)
  const pos=terrain.attributes.position
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i)-12
    pos.setZ(i,z)
    pos.setY(i,elevation(x,z))
  }
  terrain.computeVertexNormals();shape(scene,terrain,mat(0x3e5365))
  const turf=new T.PlaneGeometry(32.6,19.7,25,17);turf.rotateX(-Math.PI/2)
  const colors=[],color=new T.Color()
  for(let i=0;i<turf.attributes.position.count;i++){
    color.setHex([0x526958,0x52685a,0x4b6a5e,0x496754,0x4e695a][Math.floor(rnd()*5)])
    colors.push(color.r,color.g,color.b)
  }
  turf.setAttribute('color',new T.Float32BufferAttribute(colors,3))
  shape(scene,turf,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),0,.018,0)
  const grassGeo=new T.ConeGeometry(.075,.45,3), grass=new T.InstancedMesh(grassGeo,mat(0xffffff),1800)
  const temp=new T.Object3D()
  for(let i=0;i<grass.count;i++){
    temp.position.set(between(-16,16),between(.09,.20),between(-9.6,9.6))
    temp.rotation.set(between(-.29,.29),between(0,6.3),between(-.27,.27));temp.scale.set(.7,between(.33,1.06),.55)
    temp.updateMatrix();grass.setMatrixAt(i,temp.matrix)
    grass.setColorAt(i,new T.Color([0x687956,0x4d7467,0x526477,0x8a8360][i%4]))
  }
  scene.add(grass)
  const road=new T.CatmullRomCurve3([new T.Vector3(24,.79,27),new T.Vector3(17,.55,12),new T.Vector3(19,.83,1),new T.Vector3(17,.77,-14),new T.Vector3(8,1.7,-25),new T.Vector3(18,3.5,-48),new T.Vector3(7,5,-72)])
  const roadVerts=[],ridx=[],steps=90
  for(let i=0;i<=steps;i++){
    const v=road.getPointAt(i/steps), tangent=road.getTangentAt(i/steps)
    for(const d of [-1.52,1.52]) roadVerts.push(v.x+tangent.z*d,v.y,v.z-tangent.x*d)
    if(i){const j=2*i;ridx.push(j-2,j-1,j,j,j-1,j+1)}
    if(i%3===0&&i<66){const line=box(scene,basic(0xa6a1b3),v.x,v.y+.024,v.z,.07,.015,.83);line.rotation.y=Math.atan2(tangent.x,tangent.z)}
  }
  const path=new T.BufferGeometry();path.setAttribute('position',new T.Float32BufferAttribute(roadVerts,3));path.setIndex(ridx);path.computeVertexNormals()
  shape(scene,path,new T.MeshStandardMaterial({color:0x4f4a68,side:T.DoubleSide}))
  for(let i=0;i<13;i++){
    const v=road.getPointAt(i/16);lamp(scene,v.x+2.15,v.z,.65+(.35*(1-i/13)))
  }
  fence(scene,-15.5,-9.1,15.5,-9.1);fence(scene,15.5,-9.1,15.5,9.25);fence(scene,-15.5,9.25,15.5,9.25);fence(scene,-15.5,-9.1,-15.5,9.25)
  barn(scene,-11.9,-12.1,1.32,.13)
  barn(scene,5.7,-28,.69,-.29)
  const silo=new T.Group();silo.position.set(-17.1,0,-13.4);scene.add(silo)
  cyl(silo,mat(0x7777a0),0,2.76,0,1.13,1.20,5.52,12)
  ball(silo,roofLight,0,5.54,0,1.14,.72,1.14,1)
  for(let i=1;i<6;i++) cyl(silo,roof,0,i*.86,0,1.20,1.20,.07,12)
  const mill=windmill(scene,11.5,-15.3)
  for(const [x,z,s] of [[-15.7,8.4,1.35],[12.2,9.55,1.18],[-7.4,-8.9,1.07],[8.8,-9.25,.97],[14.9,5.8,.78]]){
    pumpkin(scene,x,z,s);pumpkin(scene,x-.7,z+.5,s*.6)
  }
  for(const [x,z] of [[-12.5,-8.65],[-10.6,-8.54],[-9.8,-7.89],[-8.7,-8.2],[14.6,7.95]]){
    const hay=cyl(scene,mat(0xbe935b),x,.42,z,.43,.43,.80,10);hay.rotation.z=Math.PI/2
    for(const q of [-.22,.22]){
      const band=cyl(scene,mat(0x87704f),x+q,.42,z,.441,.441,.037,10);band.rotation.z=Math.PI/2
    }
  }
  for(const [x,z,s] of [[-15.55,8.3,1.12],[14.8,8.25,1.16],[-6.8,-8.8,.98],[12.7,-9,.86],[-16.4,-7.5,.8]]) lamp(scene,x,z,s)
  for(let i=0;i<113;i++){
    const x=between(-70,70),z=between(-65,-11)
    if ((x>-19&&x<-6&&z>-19) || (x>5&&x<23&&z>-34)) continue
    fir(scene,x,z,between(.78,2.62))
  }
  for(const [x,z,s] of [[-21,7,2.9],[-19.6,11.6,2.7],[-17.5,15,2.1],[20.5,9,2.4],[23,4,2.6],[22,-2,1.9],[-22,-4,2.17],[-19,1,1.6]]) fir(scene,x,z,s)
  for(let i=0;i<48;i++){
    const x=between(-25,25),z=between(-15,15)
    if(Math.abs(x)<15.8&&Math.abs(z)<9.6)continue
    const r=between(.2,1.12)
    ball(scene,soil,x,.18,z,r,r*.63,r*.81)
  }
  const skyDome=new T.Mesh(new T.SphereGeometry(185,24,16),new T.ShaderMaterial({
    side:T.BackSide,depthWrite:false,
    vertexShader:'varying vec3 dir; void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 dir;
      void main(){vec3 d=normalize(dir);
      vec3 color=mix(vec3(.32,.23,.49),vec3(.09,.07,.19),smoothstep(-.06,.36,d.y));
      color+=vec3(.15,.08,.21)*exp(-pow((d.y-.10)*7.,2.))*smoothstep(-.58,.37,d.x);
      gl_FragColor=vec4(color,1.);}`
  }))
  skyDome.renderOrder=-1;scene.add(skyDome)
  const moonMat=basic(0xffdbc0);moonMat.fog=false;moonMat.toneMapped=false
  ball(scene,moonMat,2.6,15.2,-68,3.65,3.65,3.65,3)
  glow(scene,0xffaac1,18,2.6,15.2,-73,.88).material.fog=false
  const crater=basic(0xe8b9bc);crater.fog=false;crater.toneMapped=false
  for(const [x,y,r] of [[-.7,1.05,.55],[1.3,-.47,.71],[-1.5,-.95,.72],[.95,1.65,.32],[.18,-1.8,.42]]){
    ball(scene,crater,2.6+x,15.2+y,-68+Math.sqrt(12.7-x*x-y*y),r,r*.76,.33,2)
  }
  const stars=[]
  for(let i=0;i<470;i++) stars.push(between(-145,145),between(5,79),between(-115,-89))
  const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(stars,3))
  scene.add(new T.Points(starGeo,new T.PointsMaterial({color:0xe5c9ff,size:.17,transparent:true,opacity:.91,fog:false})))
  for(const [x,y,z,w] of [[-28,17,-74,31],[40,13,-77,27],[4,11,-73,30],[-10,23,-77,25]]){
    const o=glow(scene,0x9982d9,w,x,y,z,.26);o.scale.y=w*.14;o.material.fog=false
  }
  batchMeshes(scene,mill)
  return mill
}

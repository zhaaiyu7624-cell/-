import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

const palm=[0,5,9,13,17]
const distance=(a:NormalizedLandmark,b:NormalizedLandmark,aspect:number)=>Math.hypot((a.x-b.x)*aspect,a.y-b.y)
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
const paths=[[0,1,2,3,4],[0,5,6,7,8],[5,9,10,11,12],[9,13,14,15,16],[13,17,18,19,20],[0,17]]

export class HandController {
  ready=false
  hasVideo=false
  tracked=false
  pinched=false
  stableSince=0
  u=.5
  v=.5
  private model:HandLandmarker|null=null
  private stream:MediaStream|null=null
  private generation=0
  private inference=0
  private seen=0
  private videoTime=-1
  private pinchSince=0
  private pinchCandidate=false
  private center={x:.5,y:.5}
  private lastPalm={x:.5,y:.5}
  private readonly ctx:CanvasRenderingContext2D|null
  onChange=()=>{}
  onError:(reason:string)=>void=()=>{}
  constructor(readonly video:HTMLVideoElement,readonly overlay:HTMLCanvasElement){
    this.ctx=overlay.getContext('2d')
  }
  async open(){
    this.close()
    const token=this.generation
    try {
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('此浏览器无法访问摄像头，请用 HTTPS 或 localhost。')
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}})
      if(token!==this.generation){stream.getTracks().forEach(t=>t.stop());return}
      this.stream=stream
      for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{
        if(token===this.generation){this.close();this.onError('摄像头已断开。可以继续使用鼠标。')}
      })
      this.video.srcObject=stream
      await this.video.play()
      if(token!==this.generation)return
      this.hasVideo=true;this.onChange()
      const {FilesetResolver,HandLandmarker}=await import('@mediapipe/tasks-vision')
      const root=import.meta.env.BASE_URL+'vision/'
      const files=await FilesetResolver.forVisionTasks(root+'wasm')
      if(token!==this.generation)return
      const make=(delegate:'GPU'|'CPU')=>HandLandmarker.createFromOptions(files,{
        baseOptions:{modelAssetPath:root+'hand_landmarker.task',delegate},runningMode:'VIDEO',
        numHands:1,minHandDetectionConfidence:.60,minHandPresenceConfidence:.60,minTrackingConfidence:.56
      })
      let model
      try{ model=await make('GPU') }catch{
        if(token!==this.generation)return
        model=await make('CPU')
      }
      if(token!==this.generation){model.close();return}
      this.model=model;this.ready=true;this.onChange()
    }catch(error){
      if(token!==this.generation)return
      this.close()
      const name=error instanceof Error?error.name:''
      const messages:Record<string,string>={
        NotAllowedError:'摄像头权限未开启。请在地址栏允许访问，或改用鼠标。',
        NotFoundError:'未找到摄像头。可以改用鼠标完成整局。',
        NotReadableError:'摄像头可能正被占用。可以改用鼠标。'
      }
      this.onError(messages[name]??(error instanceof Error&&error.message.startsWith('此浏览器')?error.message:'手势识别初始化失败。可以改用鼠标。'))
    }
  }
  close(){
    this.generation++
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null
    this.video.srcObject=null
    this.model?.close();this.model=null
    this.ready=false;this.hasVideo=false;this.videoTime=-1;this.inference=0;this.seen=0
    this.center={x:.5,y:.5};this.u=this.v=.5
    this.lose();this.onChange()
  }
  calibrate(){
    this.center={x:Math.max(.34,Math.min(.66,this.lastPalm.x)),y:Math.max(.34,Math.min(.66,this.lastPalm.y))}
    this.u=this.v=.5
  }
  private lose(){
    this.tracked=false;this.pinched=false;this.pinchCandidate=false;this.pinchSince=0;this.stableSince=0
    this.ctx?.clearRect(0,0,this.overlay.width,this.overlay.height)
  }
  tick(now:number){
    if(!this.model||this.video.readyState<2)return
    if(now-this.inference<42||this.video.currentTime===this.videoTime){
      if(this.seen&&now-this.seen>180)this.lose()
      return
    }
    const gap=now-this.inference
    this.inference=now;this.videoTime=this.video.currentTime
    let output
    try{output=this.model.detectForVideo(this.video,now)}catch{
      this.close();this.onError('手势追踪已中断。可以改用鼠标。');return
    }
    const points=output.landmarks[0]
    if(points?.length!==21){this.lose();return}
    const aspect=this.video.videoWidth/this.video.videoHeight||1
    const width=Math.max(distance(points[5],points[17],aspect),distance(points[0],points[9],aspect)*.76)
    const x=1-palm.reduce((sum,i)=>sum+points[i].x,0)/palm.length
    const y=palm.reduce((sum,i)=>sum+points[i].y,0)/palm.length
    if(width<.044||x<.025||x>.975||y<.025||y>.975){this.lose();return}
    this.lastPalm={x,y};this.seen=now
    if(!this.tracked)this.stableSince=now
    this.tracked=true
    const a=1-Math.exp(-Math.min(gap,100)/84)
    this.u+=(clamp(.5+(x-this.center.x)/.56)-this.u)*a
    this.v+=(clamp(.5+(y-this.center.y)/.54)-this.v)*a
    const ratio=distance(points[4],points[8],aspect)/width
    const candidate=ratio<(this.pinched?.37:.25)
    if(candidate!==this.pinchCandidate){this.pinchCandidate=candidate;this.pinchSince=now}
    if(candidate!==this.pinched&&now-this.pinchSince>=125)this.pinched=candidate
    this.draw(points)
  }
  private draw(points:NormalizedLandmark[]){
    const ctx=this.ctx
    if(!ctx)return
    const w=this.video.videoWidth,h=this.video.videoHeight
    if(this.overlay.width!==w||this.overlay.height!==h){this.overlay.width=w;this.overlay.height=h}
    ctx.clearRect(0,0,w,h)
    ctx.lineWidth=3;ctx.strokeStyle='#91ffe2';ctx.fillStyle='#e4fff6'
    for(const path of paths){
      ctx.beginPath()
      for(const i of path)ctx.lineTo(points[i].x*w,points[i].y*h)
      ctx.stroke()
    }
    for(const point of points){
      ctx.beginPath();ctx.arc(point.x*w,point.y*h,3.9,0,Math.PI*2);ctx.fill()
    }
  }
}

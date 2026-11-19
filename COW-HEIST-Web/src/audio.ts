import type {Phase} from './game'
import {assetURL} from './portable-assets'

const sfx=[
  'ufo_start','ufo_beam_loop','cow_suction_loop','cow_capture','golden_cow_capture',
  'obstacle_hit','combo_3','combo_5','countdown','countdown_final','victory','defeat',
  'ui_click','game_pause','game_resume'
] as const
type Effect=typeof sfx[number]
type Loop='ufo_beam_loop'|'cow_suction_loop'
type Music='bgm_menu'|`bgm_level_${number}`
type Volume='master'|'bgm'|'sfx'
export interface AudioSettings {master:number;bgm:number;sfx:number;muted:boolean}
interface Voice {source:AudioBufferSourceNode;gain:GainNode}
const key='cow-heist-audio-v1'
const defaults:AudioSettings={master:.80,bgm:.52,sfx:.76,muted:false}
const bounded=(value:number)=>Math.min(1,Math.max(0,value))

function readSettings():AudioSettings{
  const saved={...defaults}
  try{
    const parsed=JSON.parse(localStorage.getItem(key)??'null')
    if(parsed && typeof parsed==='object'){
      for(const k of ['master','bgm','sfx'] as const)
        if(typeof parsed[k]==='number'&&Number.isFinite(parsed[k]))saved[k]=bounded(parsed[k])
      saved.muted=parsed.muted===true
    }
  }catch{/* Storage may be unavailable in private browsing. */}
  return saved
}

export class AudioManager {
  readonly settings=readSettings()
  private context:AudioContext|undefined
  private master:GainNode|undefined
  private musicBus:GainNode|undefined
  private effectsBus:GainNode|undefined
  private previousPhase:Phase|undefined
  private previousSecond=-1
  private beam=false
  private music:Music='bgm_menu'
  private playingMusic:Music|undefined
  private incoming:Music|undefined
  private foreground:Voice|undefined
  private fading:Voice|undefined
  private musicRequest=0
  private duck=1
  private readonly effects=new Map<Effect,Promise<AudioBuffer|undefined>>()
  private readonly musicCache=new Map<Music,AudioBuffer>()
  private readonly wanted=new Set<Loop>()
  private readonly loopLoading=new Set<Loop>()
  private readonly loops=new Map<Loop,Voice>()
  private preloaded=false

  unlock(){
    try{
      if(!this.context){
        const context=new AudioContext()
        this.context=context
        this.master=context.createGain()
        this.musicBus=context.createGain()
        this.effectsBus=context.createGain()
        const limiter=context.createDynamicsCompressor()
        limiter.threshold.value=-7;limiter.knee.value=9;limiter.ratio.value=9
        limiter.attack.value=.003;limiter.release.value=.16
        this.musicBus.connect(this.master)
        this.effectsBus.connect(this.master)
        this.master.connect(limiter).connect(context.destination)
        this.applySettings()
      }
      const context=this.context
      if(context.state!=='running')void context.resume().catch(()=>{})
      if(!this.preloaded){
        this.preloaded=true
        for(const effect of sfx)void this.loadEffect(effect)
      }
      this.switchMusic(this.music)
    }catch{/* Unsupported audio must not prevent play. */}
  }
  updateVolume(volume:Volume,value:number){
    this.settings[volume]=bounded(value)
    this.persist()
  }
  toggleMute(){
    this.settings.muted=!this.settings.muted
    this.persist()
  }
  private persist(){
    this.applySettings()
    try{localStorage.setItem(key,JSON.stringify(this.settings))}catch{/* Continue in memory. */}
  }
  private applySettings(){
    if(!this.context)return
    const t=this.context.currentTime
    this.master?.gain.setTargetAtTime(this.settings.muted?0:this.settings.master,t,.025)
    this.musicBus?.gain.setTargetAtTime(this.settings.bgm*this.duck,t,.10)
    this.effectsBus?.gain.setTargetAtTime(this.settings.sfx,t,.025)
  }
  private async decode(folder:'bgm'|'sfx',name:string){
    if(!this.context)return
    try{
      const response=await fetch(await assetURL(`audio/${folder}/${name}.wav`))
      if(!response.ok)throw new Error(`HTTP ${response.status}`)
      return await this.context.decodeAudioData(await response.arrayBuffer())
    }catch(error){console.warn('Audio asset unavailable',name,error)}
  }
  private loadEffect(effect:Effect){
    let pending=this.effects.get(effect)
    if(!pending){
      pending=this.decode('sfx',effect)
      this.effects.set(effect,pending)
    }
    return pending
  }
  private voice(buffer:AudioBuffer,bus:GainNode,loop:boolean,volume:number){
    const context=this.context!
    const source=context.createBufferSource(),gain=context.createGain()
    source.buffer=buffer;source.loop=loop
    gain.gain.value=volume
    source.connect(gain).connect(bus)
    source.onended=()=>{source.disconnect();gain.disconnect()}
    source.start()
    return {source,gain}
  }
  play(effect:Effect){
    if(!this.context||this.settings.muted)return
    const requested=performance.now()
    void this.loadEffect(effect).then(buffer=>{
      if(buffer&&this.effectsBus&&!this.settings.muted&&performance.now()-requested<750)
        this.voice(buffer,this.effectsBus,false,1)
    })
  }
  private switchMusic(track:Music){
    this.music=track
    if(!this.context)return
    if(this.playingMusic===track){
      if(this.incoming){this.musicRequest++;this.incoming=undefined}
      return
    }
    if(this.incoming===track)return
    this.incoming=track
    const request=++this.musicRequest
    const cached=this.musicCache.get(track)
    void (cached?Promise.resolve(cached):this.decode('bgm',track)).then(buffer=>{
      if(request!==this.musicRequest||!this.context||!this.musicBus)return
      this.incoming=undefined
      if(!buffer)return
      this.musicCache.delete(track);this.musicCache.set(track,buffer)
      if(this.musicCache.size>2)this.musicCache.delete(this.musicCache.keys().next().value!)
      const now=this.context.currentTime
      // At most one outgoing voice; a rapid third switch retires it first.
      this.fading?.source.stop()
      this.fading=this.foreground
      if(this.fading){
        this.fading.gain.gain.cancelAndHoldAtTime(now)
        this.fading.gain.gain.linearRampToValueAtTime(0,now+1.15)
        this.fading.source.stop(now+1.19)
      }
      this.foreground=this.voice(buffer,this.musicBus,true,0)
      this.foreground.gain.gain.linearRampToValueAtTime(1,now+1.15)
      this.playingMusic=track
    })
  }
  private setLoop(loop:Loop,on:boolean){
    if(this.wanted.has(loop)===on)return
    if(on)this.wanted.add(loop);else this.wanted.delete(loop)
    const voice=this.loops.get(loop)
    const now=this.context?.currentTime??0
    const volume=loop==='ufo_beam_loop'?.42:.49
    if(voice){
      voice.gain.gain.setTargetAtTime(on?volume:0,now,.022)
      if(!on)window.setTimeout(()=>{
        if(!this.wanted.has(loop)&&this.loops.get(loop)===voice){
          this.loops.delete(loop);voice.source.stop()
        }
      },145)
    }else if(on&&this.context&&!this.loopLoading.has(loop)){
      this.loopLoading.add(loop)
      void this.loadEffect(loop).then(buffer=>{
        this.loopLoading.delete(loop)
        if(!buffer||!this.wanted.has(loop)||!this.effectsBus)return
        const voice=this.voice(buffer,this.effectsBus,true,0)
        voice.gain.gain.setTargetAtTime(volume,this.context!.currentTime,.035)
        this.loops.set(loop,voice)
      })
    }
  }
  sync(phase:Phase,level:number,seconds:number,beam:boolean,suction:boolean,passed:boolean){
    const previous=this.previousPhase
    const entered=phase!==previous
    const inLevel=phase==='countdown'||phase==='playing'||phase==='paused'||phase==='ended'
    const music:Music=inLevel?`bgm_level_${level+1}`:'bgm_menu'
    if(music!==this.music)this.switchMusic(music)
    if(entered){
      this.duck=phase==='paused'?.24:phase==='ended'?.29:1
      this.applySettings()
      if(phase==='paused')this.play('game_pause')
      if(previous==='paused'&&(phase==='playing'||phase==='countdown'))this.play('game_resume')
      if(phase==='ended')this.play(passed?'victory':'defeat')
    }
    if(phase==='countdown'&&seconds>0&&previous!=='paused'&&(entered||seconds!==this.previousSecond))
      this.play('countdown')
    if(phase==='playing'&&seconds!==this.previousSecond&&(seconds===10||(seconds>0&&seconds<=5)))
      this.play('countdown_final')
    const fire=phase==='playing'&&beam&&!!this.context
    if(fire&&!this.beam)this.play('ufo_start')
    this.setLoop('ufo_beam_loop',fire)
    this.setLoop('cow_suction_loop',fire&&suction)
    this.beam=fire
    this.previousPhase=phase;this.previousSecond=seconds
  }
  capture(kind:'cow'|'gold'|'hazard',combo:number){
    this.setLoop('cow_suction_loop',false)
    this.play(kind==='hazard'?'obstacle_hit':kind==='gold'?'golden_cow_capture':'cow_capture')
    if(combo===3)this.play('combo_3')
    if(combo===5)this.play('combo_5')
  }
  suspend(){
    this.setLoop('ufo_beam_loop',false)
    this.setLoop('cow_suction_loop',false)
    this.beam=false
    if(this.context?.state==='running')void this.context.suspend().catch(()=>{})
  }
}

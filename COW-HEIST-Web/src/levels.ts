import settings from './levels.json'
export type TargetKind=keyof typeof settings.targets
export type Hazard=Exclude<TargetKind,'cow'|'gold'>
export {settings}
export const levels=settings.levels.map(level=>({...level,kinds:level.kinds as Hazard[]}))
export const rule=(kind:TargetKind)=>settings.targets[kind]
export const captureSeconds=(kind:TargetKind)=>settings.baseCapture*rule(kind).durationFactor
export const isHazard=(kind:TargetKind)=>rule(kind).points<0
const key='cow-heist-progress-v2'
export function loadProgress(){
  const defaults={unlocked:0,best:levels.map(()=>0)}
  try{
    const saved=JSON.parse(localStorage.getItem(key)??'null')
    if(!saved||!Array.isArray(saved.best))return defaults
    return {
      unlocked:Number.isInteger(saved.unlocked)?Math.max(0,Math.min(levels.length-1,saved.unlocked)):0,
      best:defaults.best.map((_,i)=>Number.isFinite(saved.best[i])?Math.max(0,Math.floor(saved.best[i])):0)
    }
  }catch{return defaults}
}
export function saveProgress(progress:ReturnType<typeof loadProgress>){
  try{localStorage.setItem(key,JSON.stringify(progress))}catch{/* Continue with in-memory progress. */}
}

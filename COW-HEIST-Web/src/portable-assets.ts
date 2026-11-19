type EmbeddedAsset={data:string;type:string;gzip?:boolean}
const node=document.getElementById('cow-offline-assets')
export const isStandalone=!!node
let assets:Record<string,EmbeddedAsset>|undefined
const urls=new Map<string,Promise<string>>()

export function assetURL(path:string):Promise<string>{
  if(!node)return Promise.resolve(import.meta.env.BASE_URL+path)
  const previous=urls.get(path)
  if(previous)return previous
  const pending=(async()=>{
    assets??=JSON.parse(node.textContent||'{}')
    const item=assets?.[path]
    if(!item)throw new Error('Missing embedded asset '+path)
    const bytes=Uint8Array.from(atob(item.data),ch=>ch.charCodeAt(0))
    if(!item.gzip)return URL.createObjectURL(new Blob([bytes],{type:item.type}))
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
    return URL.createObjectURL(new Blob([await new Response(stream).arrayBuffer()],{type:item.type}))
  })()
  urls.set(path,pending)
  return pending
}

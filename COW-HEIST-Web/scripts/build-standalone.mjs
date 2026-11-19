/** Create the no-install classroom edition. Requires Node and FFmpeg at build time. */
import {build} from 'vite'
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {gzipSync} from 'node:zlib'
import {execFileSync} from 'node:child_process'

const scratch=await mkdtemp(join(tmpdir(),'cow-heist-html-'))
const target=resolve(process.argv[2]??'COW-HEIST-2.4.html')
try {
  await build({
    publicDir:false,
    build:{outDir:scratch,emptyOutDir:true,modulePreload:false,assetsInlineLimit:100000,
      rollupOptions:{output:{inlineDynamicImports:true}}}
  })
  let html=await readFile(join(scratch,'index.html'),'utf8')
  const match=html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)
  if(!match)throw new Error('Missing bundled script')
  let css=''
  const link=html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/)
  if(link){
    css=await readFile(join(scratch,link[1].replace(/^\//,'')),'utf8')
    html=html.replace(link[0],()=>'<style>'+css+'</style>')
  }
  const embedded={}
  for(const folder of ['bgm','sfx']){
    for(const file of await readdir(join('public/audio',folder))){
      if(!file.endsWith('.wav'))continue
      const path=join('public/audio',folder,file)
      const ogg=execFileSync('ffmpeg',['-v','error','-i',path,'-c:a','libvorbis','-q:a','4','-f','ogg','pipe:1'],{maxBuffer:24e6})
      embedded['audio/'+folder+'/'+file]={type:'audio/ogg',data:ogg.toString('base64')}
    }
  }
  for(const path of ['vision/hand_landmarker.task',...(await readdir('public/vision/wasm')).map(file=>'vision/wasm/'+file)]){
    embedded[path]={
      type:path.endsWith('.js')?'text/javascript':path.endsWith('.wasm')?'application/wasm':'application/octet-stream',
      data:gzipSync(await readFile(join('public',path)),{level:6}).toString('base64'),gzip:true
    }
  }
  const script=(await readFile(join(scratch,match[1].replace(/^\//,'')),'utf8')).replace(/<\/script/gi,'<\\/script')
  html=html.replace(match[0],'').replace('</body>',()=>
    '<script type="application/json" id="cow-offline-assets">'+JSON.stringify(embedded)+'</script>\n'+
    '<script type="module">'+script+'</script>\n</body>')
  await writeFile(target,html)
  console.log('Standalone game:',target)
} finally {
  await rm(scratch,{recursive:true,force:true})
}

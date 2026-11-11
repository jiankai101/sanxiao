import io
p=r'.qa-verify/g7-decode-durations.mjs'
s=io.open(p,encoding='utf-8').read().splitlines()
s[39]="  console.log(name.padEnd(20), 'nom='+(nom*1000).toFixed(0)+'ms | ogg='+o.duration.toFixed(4)+'s err='+(errO>=0?'+':'')+errO.toFixed(1)+'ms | mp3='+m.duration.toFixed(4)+'s err='+(errM>=0?'+':'')+errM.toFixed(1)+'ms | diff='+(Math.abs(o.duration-m.duration)*1000).toFixed(1)+'ms | '+o.rate+'Hz/'+o.ch+'ch '+m.rate+'Hz/'+m.ch+'ch');"
io.open(p,'w',encoding='utf-8').write('\n'.join(s)+'\n')

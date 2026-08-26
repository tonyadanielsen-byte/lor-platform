self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.all(keys.filter(name=>/^lor-/i.test(name)).map(name=>caches.delete(name)));
      await self.registration.unregister();
      const clients=await self.clients.matchAll({type:'window'});
      for(const client of clients){
        if('navigate' in client){
          const u=new URL(client.url);
          u.searchParams.set('_lorBuild','371');
          client.navigate(u.toString());
        }
      }
    }catch(err){}
  })());
});
self.addEventListener('fetch',()=>{});

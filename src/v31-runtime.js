import { themeDialog } from './v3-core.js';

let importedThemes=[];
fetch('./data/seed/themes-v1.json',{cache:'no-store'}).then(r=>r.ok?r.json():{}).then(bank=>{
  importedThemes=[...(bank.sharedThemes||[]),...(bank.departmentThemes||[])].map(t=>({...t,questions:(t.questions||Object.values(t.variants||{})[0]||[]).map((q,i)=>typeof q==='string'?{id:`${t.id||'theme'}-q${i+1}`,text:q}:q)}));
}).catch(()=>{});

document.addEventListener('click',event=>{
  const edit=event.target.closest('[data-theme-edit][data-theme-name]');
  if(edit){
    const t=importedThemes.find(x=>x.name===edit.dataset.themeName||x.id===edit.dataset.themeEdit);
    if(t){
      event.preventDefault();
      event.stopImmediatePropagation();
      document.body.insertAdjacentHTML('beforeend',themeDialog(t));
      return;
    }
  }
},true);

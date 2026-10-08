/* Fuzz: thao tác chuẩn bị ngẫu nhiên → gói → mở gói phải ra đúng trạng thái (Vàng, Đời, Lõi). node tests/fuzz.js */
global.window=global; const R=__dirname+'/../js/core/';
['data.js','maps.js','prep.js','battle.js','match.js','bot.js'].forEach(f=>require(R+f));
const P=TT.Prep, MT=TT.Match; let fails={};
for(let g=0; g<300; g++){
  const rng=TT.mulberry(g*77+1);
  const races=TT.FACTION_ORDER;
  const M=MT.create({seed:1000+g,mode:2,players:[{seat:1,name:'A',race:races[g%4],start:'gold'},{seat:2,name:'B',race:races[(g+1)%4],start:'food',bot:'medium'}]});
  for(let d=1; d<=10; d++){
    MT.beginDay(M);
    const p0=MT.player(M,'1'); const ctx=MT.ctx(M,p0); ctx.weather=M.weather;
    let S=P.clone(p0), log=[];
    const z=ctx.zone;
    for(let k=0;k<40;k++){
      const r=rng()%14; let c;
      const sq=S.squads.length? S.squads[rng()%S.squads.length]:null;
      const rx=z.x0+rng()%(z.x1-z.x0+1), ry=z.y0+rng()%(z.y1-z.y0+1);
      switch(r){
        case 0: c={c:'buyGen',t:TT.ROLE_ORDER[rng()%11],x:rx,y:ry}; break;
        case 1: if(sq) c={c:'buySol',sq:sq.id,k:1+rng()%3}; break;
        case 2: if(sq) c=rng()%3?{c:'sell',sq:sq.id,k:1}:{c:'sell',sq:sq.id}; break;
        case 3: if(sq) c={c:'move',sq:sq.id,x:rx,y:ry}; break;
        case 4: if(sq&&sq.it.length) c=rng()%2?{c:'unequip',sq:sq.id,slot:0}:{c:'sellItem',sq:sq.id,slot:0}; else if(S.inv.length) c={c:'sellItem',idx:rng()%S.inv.length}; break;
        case 5: c={c:'xp'}; break;
        case 6: c={c:'core',slot:rng()%5}; break;
        case 7: c={c:'reroll'}; break;
        case 8: c={c:'buyItem',it:TT.ITEM_ORDER[rng()%22],sq:sq?sq.id:null}; break;
        case 9: if(S.inv.length&&sq) c={c:'equip',idx:rng()%S.inv.length,sq:sq.id}; break;
        case 10: if(S.cores.length) c={c:'sellCore',idx:0}; break;
        case 11: c={c:'lock',slot:rng()%5}; break;
        case 12: if(sq) c={c:'stance',sq:sq.id,s:'giu'}; break;
        case 13: c={c:'auto'}; break;
      }
      if(!c) continue;
      const snap=P.clone(S); const res=P.apply(S,c,ctx);
      if(!res.ok){S=snap;continue;}
      if(res.log) log=log.concat(res.log);
    }
    const pk=JSON.parse(JSON.stringify(P.makePackage(S,log)));
    const ar=P.applyPackage(p0,pk,ctx);
    if(!ar.ok){ const e=ar.errs.join(','); fails[e]=(fails[e]||0)+1; }
    else { if(ar.p.lv!==S.lv||ar.p.gold!==S.gold||JSON.stringify(ar.p.cores)!==JSON.stringify(S.cores)) {fails['mismatch']=(fails['mismatch']||0)+1; if(fails['mismatch']<3) console.log(ar.p.lv,S.lv,ar.p.gold,S.gold);} }
    const i=M.players.indexOf(p0); if(ar.ok) M.players[i]=Object.assign(ar.p,{side:p0.side,team:p0.team,name:p0.name});
    const bp=MT.player(M,'2'); const bpk=TT.Bot.makePackage(M,'2','medium'); const br=P.applyPackage(bp,JSON.parse(JSON.stringify(bpk)),MT.ctx(M,bp)); if(br.ok) M.players[1]=Object.assign(br.p,{side:bp.side,team:bp.team,bot:'medium',name:bp.name}); else fails['bot:'+br.errs]=1;
    const B=TT.Battle.create(MT.battleInput(M)); MT.endDay(M,B.run());
  }
}
console.log(Object.keys(fails).length ? fails : 'fuzz: 0 lỗi'); process.exit(Object.keys(fails).length ? 1 : 0);

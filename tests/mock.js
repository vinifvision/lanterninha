// Supabase falso, só para teste. Guarda tudo no localStorage ('__db') e imita as regras de acesso.
window.supabase={createClient(){
  const db=()=>JSON.parse(localStorage.__db||'{"users":{},"films":[],"friendships":[],"recs":[],"guesses":[],"session":null}'), save=d=>localStorage.__db=JSON.stringify(d);
  let cb=null; const fire=()=>cb&&cb('X',db().session);
  const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
  const profRow=u=>Object.assign({id:u.id,username:u.username,top4:[]},u.prof||{});
  const isFriend=(d,a,b)=>d.friendships.some(f=>f.status==='accepted'&&((f.requester===a&&f.addressee===b)||(f.requester===b&&f.addressee===a)));
  const hasLink=(d,a,b)=>d.friendships.some(f=>(f.requester===a&&f.addressee===b)||(f.requester===b&&f.addressee===a));
  const q=(table)=>{ const st={op:'select',f:[],single:false};
    const run=async()=>{ const d=db(), me=d.session&&d.session.user.id; if(!me) return {data:st.single?null:[],error:{message:'no session'}};
      const match=r=>st.f.every(([t,k,v])=>t==='eq'?r[k]===v:t==='neq'?r[k]!==v:t==='in'?v.includes(r[k]):true);
      if(table==='profiles'){
        if(st.op==='update'){ const u=Object.values(d.users).find(x=>x.id===me); u.prof=Object.assign(u.prof||{},st.patch); save(d); return {error:null}; }
        const rows=Object.values(d.users).filter(u=>u.id===me||hasLink(d,me,u.id)).map(profRow).filter(match); return {data:st.single?(rows[0]||null):rows,error:null}; }
      if(table==='films'){
        if(st.op==='select') return {data:d.films.filter(r=>r.user_id===me||isFriend(d,me,r.user_id)).filter(match).map(r=>({user_id:r.user_id,key:r.key,data:r.data})),error:null};
        if(st.op==='upsert'){ st.rows.forEach(r=>{ if(r.user_id!==me) return; const i=d.films.findIndex(x=>x.user_id===me&&x.key===r.key); if(i>=0) d.films[i]=r; else d.films.push(r); }); save(d); return {error:null}; }
        if(st.op==='delete'){ d.films=d.films.filter(r=>!(r.user_id===me&&match(r))); save(d); return {error:null}; } }
      if(table==='friendships'){
        const mine=r=>r.requester===me||r.addressee===me;
        if(st.op==='select') return {data:d.friendships.filter(mine).filter(match),error:null};
        if(st.op==='insert'){ const r={requester:me,addressee:st.row.addressee,status:'pending'}; if(hasLink(d,me,r.addressee)||r.addressee===me) return {error:{message:'dup'}}; d.friendships.push(r); save(d); return {error:null}; }
        if(st.op==='delete'){ const m=[...st.or.matchAll(/requester\.eq\.([0-9a-f-]+),addressee\.eq\.([0-9a-f-]+)/g)].map(x=>[x[1],x[2]]); d.friendships=d.friendships.filter(r=>!(mine(r)&&m.some(([a,b])=>r.requester===a&&r.addressee===b))); save(d); return {error:null}; } }
      if(table==='recs'){ d.recs=d.recs||[];
        if(st.op==='select') return {data:d.recs.filter(r=>r.from_id===me||r.to_id===me).filter(match),error:null};
        if(st.op==='insert'){ const r=Object.assign({id:d.recs.length+1,from_id:me},st.row); if(!isFriend(d,me,r.to_id)) return {error:{message:'rls'}}; if(d.recs.some(x=>x.from_id===me&&x.to_id===r.to_id&&x.film_key===r.film_key)) return {error:{message:'duplicate key',code:'23505'}}; d.recs.push(r); save(d); return {error:null}; }
        if(st.op==='delete'){ d.recs=d.recs.filter(r=>!((r.from_id===me||r.to_id===me)&&match(r))); save(d); return {error:null}; } }
      if(table==='guesses'){ d.guesses=d.guesses||[];
        if(st.op==='select') return {data:d.guesses.filter(r=>r.guesser===me||r.target===me||isFriend(d,me,r.guesser)).filter(match),error:null};
        if(st.op==='insert'){ const r=Object.assign({guesser:me},st.row); if(!isFriend(d,me,r.target)) return {error:{message:'rls'}}; if(d.guesses.some(x=>x.guesser===me&&x.target===r.target&&x.film_key===r.film_key)) return {error:{message:'duplicate'}};
          const f=d.films.find(x=>x.user_id===r.target&&x.key===r.film_key&&!x.data.st); if(!f) return {error:{message:'nao avaliou'}}; const df=Math.abs(f.data.s-r.guess); r.actual=f.data.s; r.pts=df===0?3:df<=.5?2:df<=1?1:0; d.guesses.push(r); save(d); return {error:null}; } }
      return {error:{message:'unsupported'}}; };
    const b={select(){return b}, range(){return b}, eq(k,v){st.f.push(['eq',k,v]); return b}, neq(k,v){st.f.push(['neq',k,v]); return b}, in(k,v){st.f.push(['in',k,v]); return b}, order(){return b}, limit(){return b}, or(x){st.or=x; return b},
      maybeSingle(){st.single=true; return b}, upsert(rows){st.op='upsert'; st.rows=rows; return b}, insert(row){st.op='insert'; st.row=row; return b}, update(patch){st.op='update'; st.patch=patch; return b}, delete(){st.op='delete'; return b}, then(a,c){return run().then(a,c)}};
    return b; };
  return { from:q,
    rpc:async(n,arg)=>{ const d=db(), me=d.session&&d.session.user.id;
      if(n==='film_stats'){ const m={}; d.films.filter(f=>f.key===arg.film_key&&typeof f.data.s==='number'&&!f.data.st).forEach(f=>{m[f.data.s]=(m[f.data.s]||0)+1}); return {data:Object.entries(m).map(([s,n])=>({s:Number(s),n})),error:null}; }
      if(n==='film_average'){ const rs=d.films.filter(f=>f.key===arg.film_key&&typeof f.data.s==='number'&&!f.data.st); return {data:[{avg:rs.length?Math.round(rs.reduce((a,f)=>a+f.data.s,0)/rs.length*10)/10:null,n:rs.length}],error:null}; }
      if(n==='username_available') return {data:!Object.values(d.users).some(u=>u.username===arg.name),error:null};
      if(n==='find_user'){ const u=Object.values(d.users).find(u=>u.username===arg.name&&u.id!==me); return {data:u?[{id:u.id,username:u.username,display_name:(u.prof||{}).display_name||null,avatar:(u.prof||{}).avatar||null}]:[],error:null}; }
      if(n==='accept_friend'){ const r=d.friendships.find(f=>f.requester===arg.other&&f.addressee===me&&f.status==='pending'); if(r){ r.status='accepted'; save(d); } return {data:null,error:null}; }
      if(n==='friend_count') return {data:d.friendships.filter(f=>f.status==='accepted'&&(f.requester===arg.who||f.addressee===arg.who)).length,error:null};
      return {error:{message:'no rpc'}}; },
    auth:{ onAuthStateChange(f){cb=f; setTimeout(fire,0); return {data:{subscription:{unsubscribe(){}}}}},
      async signUp({email,password,options}){ const d=db(); if(d.users[email]) return {data:{},error:{message:'User already registered'}}; const user={id:uid(Object.keys(d.users).length+1),email}; d.users[email]={...user,password,username:options.data.username}; d.session={user}; save(d); fire(); return {data:{user,session:d.session},error:null}; },
      async signInWithPassword({email,password}){ const d=db(), u=d.users[email]; if(!u||u.password!==password) return {error:{message:'Invalid login credentials'}}; d.session={user:{id:u.id,email}}; save(d); fire(); return {data:{session:d.session},error:null}; },
      async signOut(){ const d=db(); d.session=null; save(d); fire(); return {error:null}; } } };
}};

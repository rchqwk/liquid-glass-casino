const fs=require('node:fs'); const vm=require('node:vm'); const assert=require('node:assert/strict'); const crypto=require('node:crypto').webcrypto;
const root=require('node:path').resolve(__dirname,'..'); const ts=require(root+'/node_modules/typescript');
const source=fs.readFileSync(root+'/app/casino/blackjack/useBlackjackTableContract.ts','utf8');
const storage=new Map(); const requests=[]; const updates=[]; let resolve;
const react={useCallback:fn=>fn,useRef:value=>({current:value}),useEffect:()=>{},useState:initial=>{let value=initial;return [value,next=>{value=typeof next==='function'?next(value):next;updates.push(value)}]}};
let responseMode='delay';
const fakeFetch=async (url,options)=>{requests.push({url,key:options.headers['Idempotency-Key']}); if(responseMode==='delay')return new Promise(r=>resolve=r); if(responseMode==='lost')throw Error('Lost response'); if(responseMode==='invalid')return {ok:true,status:200,json:async()=>({})}; return {ok:true,status:200,json:async()=>({state:{phase:'betting'},meta:{tableId:'fixture'}})}; };
const moduleFixture={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleFixture,exports:moduleFixture.exports,require:n=>{if(n==='react')return react;throw Error(n)},fetch:fakeFetch,crypto,TextEncoder,Uint8Array,sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}});
const tick=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 const guardModule={exports:{}};
 const guardSource=fs.readFileSync(root+'/app/casino/blackjack/useWagerReservationGuard.ts','utf8');
 vm.runInNewContext(ts.transpileModule(guardSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:guardModule,exports:guardModule.exports,require:()=>react});
 let reservationCalls=0,finishReservation;
 const guard=guardModule.exports.useWagerReservationGuard(()=>{reservationCalls++;return new Promise(r=>finishReservation=r)});
 const reservation=guard.reserveBet({game:'fixture',wager:10});
 assert('error' in await guard.reserveBet({game:'fixture',wager:10}));assert.equal(reservationCalls,1);
 finishReservation({nonce:1});assert.equal((await reservation).nonce,1);
 assert('error' in await guard.reserveBet({game:'fixture',wager:10}));assert.equal(reservationCalls,1);
 guard.release();const retryReservation=guard.reserveBet({game:'fixture',wager:10});finishReservation({error:'rejected'});await retryReservation;
 const afterFailure=guard.reserveBet({game:'fixture',wager:10});finishReservation({nonce:2});await afterFailure;assert.equal(reservationCalls,3);guard.release();
 console.log('PASS stake reservations reject repeat clicks until acknowledgement and recover after rejection');
 // Exercise the actual rendered action callbacks, with wallet/transport boundaries stubbed.
 const pageSource=ts.createSourceFile('page.tsx',fs.readFileSync(root+'/app/casino/blackjack/[id]/page.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let turnAttributes;
 function findTurnBar(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(pageSource)==='BlackjackTurnActionBar')turnAttributes=node.attributes;ts.forEachChild(node,findTurnBar)}findTurnBar(pageSource);assert(turnAttributes);
 for(const [attribute,type] of [['onDoubleDown','double_down'],['onSplit','split']]){
   const handler=turnAttributes.properties.find(p=>p.name?.getText(pageSource)===attribute).initializer.expression.getText(pageSource);
   let finishStake,posted=[],canceled=[],errors=[];
   const context={mySeat:{bet:25},reserveServerBet:()=>new Promise(r=>finishStake=r),post:async(path,body)=>{posted.push({path,body});return{ok:false}},cancelServerBet:async input=>canceled.push(input),setErr:error=>errors.push(error)};
   const callback=vm.runInNewContext(ts.transpileModule('('+handler+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
   const pending=callback();assert.equal(posted.length,0);finishStake({nonce:91});await pending;
   assert.equal(posted[0].body.type,type);assert.equal(posted[0].body.betNonce,91);assert.equal(canceled[0].nonce,91);
   posted=[];const rejected=callback();finishStake({error:'insufficient balance'});await rejected;assert.equal(posted.length,0);assert.equal(errors[0],'insufficient balance');
 }
 console.log('PASS main Double and Split await server reservation, use its nonce, and recover on rejection');
 let hook=moduleFixture.exports.useBlackjackTableContract('fixture',undefined,7);
 const first=hook.requestTableRoute('action',{type:'hit'});const second=hook.requestTableRoute('action',{type:'hit'});await tick();assert.equal(requests.length,1);resolve({ok:true,status:200,json:async()=>({state:{phase:'player_turns'},meta:{tableId:'fixture'}})});assert((await first).ok);assert((await second).ok);assert.equal(storage.size,0);console.log('PASS simultaneous identical actions share one HTTP request');
 responseMode='lost';assert.equal((await hook.requestTableRoute('action',{type:'stand'})).ok,false);const lostKey=requests.at(-1).key;assert.equal(storage.size,1);assert(updates.some(x=>typeof x==='string'&&x.includes('not confirmed')));
 hook=moduleFixture.exports.useBlackjackTableContract('fixture',undefined,7);responseMode='success';assert((await hook.requestTableRoute('action',{type:'stand'})).ok);assert.equal(requests.at(-1).key,lostKey);assert.equal(storage.size,0);console.log('PASS lost response retains request ID across a hook remount');
 responseMode='invalid';assert.equal((await hook.requestTableRoute('action',{type:'hit'})).ok,false);const invalidKey=requests.at(-1).key;assert.equal(storage.size,1);responseMode='success';assert((await hook.requestTableRoute('action',{type:'hit'})).ok);assert.equal(requests.at(-1).key,invalidKey);console.log('PASS incomplete acknowledgements are unconfirmed and safely replayed');
 responseMode='lost';await hook.requestTableRoute('join',{password:'private-secret'});assert([...storage.keys()].every(k=>!k.includes('private-secret')));const actorSeven=requests.at(-1).key;responseMode='success';const other=moduleFixture.exports.useBlackjackTableContract('fixture',undefined,8);await other.requestTableRoute('join',{password:'private-secret'});assert.notEqual(requests.at(-1).key,actorSeven);console.log('PASS persisted request IDs are private-payload-free and scoped to the actor');
 if (!process.env.CASINO_TEST_BASE) return; const base=process.env.CASINO_TEST_BASE; assert(["localhost","127.0.0.1","[::1]"].includes(new URL(base).hostname),"HTTP tests require an isolated local server");async function request(route,body,token){const res=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{'x-lgc-session':token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
 assert.equal((await request('/api/blackjack/tables',{})).status,401);assert.equal((await request('/api/blackjack/inventory')).status,401);console.log('PASS anonymous mutations and private inventory remain protected');
 const stamp=Date.now().toString(36); const alpha=await request('/api/auth',{username:'ui_a_'+stamp});const beta=await request('/api/auth',{username:'ui_b_'+stamp});assert.equal(alpha.status,200);assert.equal(beta.status,200);
 const publicRoom=await request('/api/blackjack/tables',{name:'UI public fixture',public:true},alpha.data.session_token);assert.equal(publicRoom.status,200);const id=publicRoom.data.meta.tableId;
 const privateRoom=await request('/api/blackjack/tables',{name:'UI private fixture',public:false},alpha.data.session_token);assert.equal(privateRoom.status,200);
 const joined=await request('/api/blackjack/tables/'+id+'/join',{spectate:false},beta.data.session_token);assert.equal(joined.status,200);assert.equal(joined.data.meta.seatCount,2);
 const lobby=await request('/api/blackjack/tables');assert.equal(lobby.status,200);assert(lobby.data.tables.some(t=>t.id===id&&t.seatsFilled===2));assert(!lobby.data.tables.some(t=>t.id===privateRoom.data.meta.tableId));assert(lobby.data.tables.every(t=>!('state'in t)&&!('meInventory'in t)));console.log('PASS two isolated clients join; public discovery excludes private rooms and inventories');
 const inventory=await request('/api/blackjack/inventory',undefined,alpha.data.session_token);assert.equal(inventory.status,200);assert(Array.isArray(inventory.data.cards));assert(!('userId'in inventory.data));console.log('PASS inventory summary returns only the authenticated player inventory');
 if(process.env.CASINO_TEST_RESULTS) fs.writeFileSync(process.env.CASINO_TEST_RESULTS,JSON.stringify({passed:9,fixtureTable:id,privateRoomNotListed:true,liveDataTouched:false},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});

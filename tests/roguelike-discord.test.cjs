const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = path.resolve(__dirname, '..'), ts = require(root + '/node_modules/typescript');
const state = new Map();
const db = {
  getRoguelikeRoom: async code => state.has(code) ? {state: structuredClone(state.get(code))} : null,
  commitRoguelikeRoom: async (code, next, expected) => {
    const previous = state.has(code) ? JSON.stringify(state.get(code)) : null;
    if (previous !== expected) return false;
    state.set(code, structuredClone(next)); return true;
  },
  addUserXp: async () => {}, upsertRoguelikeRoom: async () => {},
};
function load(file, dependencies) {
  const mod = {exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/'+file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module:mod,exports:mod.exports,require:name=>name in dependencies ? dependencies[name] : require(name),structuredClone,URL,URLSearchParams,console,Date,Math,process});
  return mod.exports;
}
const game = load('app/arcade/blackjack-roguelike/game.ts',{});
const engine = load('app/lib/roguelikeRoom.ts',{'./db':db,'../arcade/blackjack-roguelike/game':game});
const activity = load('app/lib/roguelikeDiscord.ts',{'./roguelikeRoom':engine});
(async()=>{
  const channel = '1066471931542507624';
  const users = [1,2,3,4].map(id=>({id,username:'fixture_'+id}));
  await Promise.all(users.map(user=>activity.joinDiscordRoom(channel,user)));
  const code = activity.discordRoomCode(channel);
  let room = await engine.loadRoom(code);
  assert.equal(room.players.length,4);
  assert.equal(new Set(room.players.map(p=>p.playerId)).size,4);
  console.log('PASS simultaneous call joins atomically create one room with four distinct seats');
  await activity.joinDiscordRoom(channel,users[0]);
  assert.equal((await engine.loadRoom(code)).players.length,4);
  await assert.rejects(activity.joinDiscordRoom(channel,{id:5,username:'fifth'}),/full/);
  console.log('PASS reconnect retains the account seat and the fifth player gets an explicit full-room response');
  const other = await activity.joinDiscordRoom('1066471931542507625',users[0]);
  assert.notEqual(other.code,code); assert.equal(other.players.length,1);
  assert.throws(()=>activity.discordRoomCode('not-a-channel'),/channel/);
  console.log('PASS separate calls stay separate and invalid channel identifiers are rejected');
  await engine.updateRoom(code,async r=>engine.leaveRoom(r,'u4'));
  await engine.updateRoom(code,async r=>engine.dealRoom(r));
  const joined = await activity.joinDiscordRoom(channel,{id:5,username:'late'});
  const late = joined.players.find(p=>p.playerId==='u5');
  assert.equal(late.done,true); assert.equal(late.hands.length,0);
  for(const player of joined.players.filter(p=>p.playerId!=='u5')) {
    await engine.updateRoom(code,async r=>{const result=engine.applyAction(r,player.playerId,'stand');assert(!result.error);return result.room});
  }
  room = await engine.loadRoom(code);assert.equal(room.phase,'reveal');
  room = await engine.updateRoom(code,async r=>engine.dealRoom(engine.nextRound(r)));
  assert.equal(room.players.find(p=>p.playerId==='u5').hands[0].length,2);
  console.log('PASS late joins wait safely, current round resolves, and next deal includes the new player');
  await engine.updateRoom(code,async r=>{for(const p of r.players)p.lastSeenAt=Date.now()-activity.ACTIVITY_SEAT_TTL-1;return r});
  assert.equal(activity.activeDiscordRoom(await engine.loadRoom(code)),false);
  const fresh = await activity.joinDiscordRoom(channel,{id:6,username:'fresh'});
  assert.equal(fresh.players.length,1); assert.equal(fresh.phase,'lobby');assert.equal(fresh.hostId,'u6');
  console.log('PASS abandoned calls expire and relaunch with a fresh lobby');
  const disconnectChannel='1066471931542507626', disconnectCode=activity.discordRoomCode(disconnectChannel);
  await activity.joinDiscordRoom(disconnectChannel,{id:7,username:'waiting'});
  await activity.joinDiscordRoom(disconnectChannel,{id:8,username:'disconnected'});
  await engine.updateRoom(disconnectCode,async r=>engine.dealRoom(r));
  await engine.updateRoom(disconnectCode,async r=>engine.applyAction(r,'u7','stand').room);
  await engine.updateRoom(disconnectCode,async r=>{r.players.find(p=>p.playerId==='u8').lastSeenAt=Date.now()-activity.ACTIVITY_SEAT_TTL-1;return r});
  const settled=await activity.joinDiscordRoom(disconnectChannel,{id:7,username:'waiting'});
  assert.equal(settled.players.length,1);assert.equal(settled.phase,'reveal');
  console.log('PASS expired disconnected seats are reclaimed and cannot stall a completed hand');

  const view = engine.roomView(fresh,'u6');assert(!('userId' in view.players[0]));assert(!('capabilityHash' in view.players[0]));assert(!('deck' in view));
  console.log('PASS shared room projection hides account IDs, seat credentials and shoe');

  if(!process.env.CASINO_TEST_BASE)return;
  const base=process.env.CASINO_TEST_BASE;
  assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'HTTP checks require the isolated local server');
  async function request(route, body, token) {
    const res=await fetch(base+route,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(token?{'x-lgc-session':token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:res.status,data:await res.json()};
  }
  const unauth = await request('/api/roguelike/activity',{channelId:channel});assert.equal(unauth.status,401);
  const stamp=Date.now().toString(36),tokens=[];
  for(let i=0;i<5;i++){const auth=await request('/api/auth',{username:'rogue_'+i+'_'+stamp});assert.equal(auth.status,200);tokens.push(auth.data.session_token)}
  const testChannel='106647193'+String(Date.now()).slice(-10);
  const joins=await Promise.all(tokens.slice(0,4).map(token=>request('/api/roguelike/activity',{channelId:testChannel,playerId:'spoof',username:'spoof'},token)));
  for(const joined of joins)assert.equal(joined.status,200);
  const joinedRoom=joins[0].data.room;
  const snapshot=await request('/api/roguelike/rooms/'+joinedRoom.code+'?playerId='+joinedRoom.youId,undefined,tokens[0]);
  assert.equal(snapshot.data.room.players.length,4);
  assert(!snapshot.data.room.players.some(p=>p.username==='spoof'||p.playerId==='spoof'));
  assert.equal((await request('/api/roguelike/activity',{channelId:testChannel},tokens[4])).status,409);
  console.log('PASS HTTP simultaneous joins preserve all seats, bind server account identity, and enforce capacity/auth');
  const forged=await request('/api/roguelike/rooms/'+joinedRoom.code+'/action',{playerId:joinedRoom.youId,action:'deal'},tokens[1]);
  assert.equal(forged.status,403);
  const hostToken=tokens[joins.findIndex(j=>j.data.room.youId===snapshot.data.room.hostId)];
  const host=await request('/api/roguelike/rooms/'+joinedRoom.code+'/action',{playerId:snapshot.data.room.hostId,action:'deal'},hostToken);assert.equal(host.status,200);
  const reconnect=await request('/api/roguelike/activity',{channelId:testChannel},tokens[0]);assert.equal(reconnect.status,200);assert.equal(reconnect.data.room.players.length,4);
  assert.equal((await request('/api/roguelike/activity?channelId='+testChannel,undefined,tokens[0])).data.active,true);
  console.log('PASS HTTP seat impersonation is denied, host deals, reconnect retains four seats and call discovery reports active');

  // Exercise the real client component's effects against the isolated HTTP API.
  // Discord RPC is mocked; a real Discord call remains a release acceptance check.
  const rpc = [], clientChannel = String(BigInt(testChannel) + 1n);
  const sdk = {commands:{setActivity:async payload=>{rpc.push(payload)},openInviteDialog:async()=>({})}};
  async function mountClient(index) {
    const auth = await request('/api/auth',undefined,tokens[index]);
    let cursor=0;const hooks=[],effects=[],intervals=[];
    const react={
      useMemo:fn=>fn(),useCallback:fn=>fn,
      useState:initial=>{const slot=cursor++;if(!(slot in hooks))hooks[slot]=typeof initial==='function'?initial():initial;return[hooks[slot],next=>{hooks[slot]=typeof next==='function'?next(hooks[slot]):next}]},
      useRef:initial=>{const slot=cursor++;return hooks[slot]??=( {current:initial} )},
      useEffect:(effect,deps)=>{const slot=cursor++;const previous=hooks[slot];if(!previous||deps.some((value,i)=>value!==previous[i])){hooks[slot]=deps;effects.push(effect)}},
    };
    const mod={exports:{}};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(root+'/app/arcade/blackjack-roguelike/multiplayer.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
      module:mod,exports:mod.exports,require:name=>({react,'./game':game,'../../lib/authClient':{useAuth:()=>({user:auth.data.user,loading:false})},'../../lib/discordClient':{getDiscordCall:async()=>({sdk,channelId:clientChannel,instanceId:'fixture-instance'}),withDiscordTimeout:promise=>promise},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null}}[name]),
      window:{setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval:()=>{},setTimeout,clearTimeout},
      localStorage:{getItem:()=>null,setItem:()=>{}},AbortSignal,console,
      fetch:(url,init={})=>fetch(base+url,{...init,headers:{...init.headers,'x-lgc-session':tokens[index]}}),
    });
    const render=()=>{cursor=0;mod.exports.default({discordActivity:true,onBack:()=>{}});for(const effect of effects.splice(0))effect()};
    render();
    for(let attempt=0;attempt<40&&!hooks.some(value=>value?.youId);attempt++)await new Promise(resolve=>setTimeout(resolve,25));
    assert(hooks.some(value=>value?.youId),'automatic client join completes without room-code input');
    render();
    return {hooks,intervals,render};
  }
  const firstClient=await mountClient(0),secondClient=await mountClient(1);
  const firstRoom=firstClient.hooks.find(value=>value?.youId),secondRoom=secondClient.hooks.find(value=>value?.youId);
  assert.equal(firstRoom.code,secondRoom.code);assert.equal(secondRoom.players.length,2);
  assert(rpc.some(payload=>payload.activity?.party?.size[0]===2));
  assert(rpc.every(payload=>payload.activity.details.includes('Roguelike Blackjack')));
  console.log('PASS real multiplayer client effects automatically seat two players together and publish two-player Discord Rich Presence (RPC mocked)');
})().catch(error=>{console.error(error);process.exitCode=1});

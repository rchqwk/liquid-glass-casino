import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { getAuthedUserAsync } from "./authServer";
import { getBlackjackRequestReceipt, commitBlackjackState } from "./db";
import { BlackjackConflict } from "./blackjackStatePersistence";
export const operationContext=new AsyncLocalStorage<{pending?:{meta:any;state:any}}>();
export async function blackjackRequest(req:Request, tableId:string, operation:()=>Promise<Response>):Promise<Response>{
  const user=await getAuthedUserAsync();if(!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401});
  const key=req.headers.get("Idempotency-Key")||"";
  if(key&&!/^[A-Za-z0-9_-]{16,128}$/.test(key))return new Response(JSON.stringify({error:"Invalid request ID"}),{status:400});
  const fingerprint=createHash("sha256").update(new URL(req.url).pathname+":"+await req.clone().text()).digest("hex");
  for(let attempt=0;attempt<5;attempt++){
    if(key){const saved=await getBlackjackRequestReceipt(tableId,user.id,key);if(saved){if(saved.fingerprint!==fingerprint)return new Response(JSON.stringify({error:"Request ID already used"}),{status:409});return new Response(saved.body,{status:saved.status,headers:{"Content-Type":"application/json"}});}}
    const context:{pending?:{meta:any;state:any}}={};
    try{
      const response=await operationContext.run(context,operation);
      if(context.pending){const receipt=key?{userId:user.id,key,fingerprint,status:response.status,body:await response.clone().text()}:undefined;
        if(!await commitBlackjackState(context.pending.meta,context.pending.state,receipt))continue;
      }
      return response;
    }catch(error){if(error instanceof BlackjackConflict || (error as any)?.constraint==="blackjack_request_receipts_pkey")continue;throw error;}
  }
  return new Response(JSON.stringify({error:"Table changed; retry using the same request ID"}),{status:409,headers:{"Content-Type":"application/json"}});
}

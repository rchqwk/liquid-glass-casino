import { NextResponse } from "next/server";
import { getAuthedUserAsync } from "../../../lib/authServer";
import { purchasePrestigeBond } from "../../../lib/db";
import { defaultInventory, ensureInventory } from "../../../lib/blackjackInventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user=await getAuthedUserAsync();if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await req.json().catch(()=>null);
  if(body?.item!=="bond" || !["pp","bp"].includes(body?.currency))return NextResponse.json({error:"Invalid purchase"},{status:400});
  const requestId=String(body?.requestId||req.headers.get("Idempotency-Key")||"");
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(requestId))return NextResponse.json({error:"Purchase request ID required"},{status:400});
  try{const inventory=await purchasePrestigeBond(user.id,body.currency,requestId);return NextResponse.json({ok:true,currency:body.currency,user:await getAuthedUserAsync(),inventory});}
  catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Purchase failed"},{status:409});}
}

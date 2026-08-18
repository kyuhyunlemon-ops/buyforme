const KEY = "buyforme:shared-state:v4";

function env(){
  const url=process.env.KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
  const token=process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;
  if(!url || !token) throw new Error("Redis environment variables are missing");
  return {url,token};
}
async function redis(command){
  const {url,token}=env();
  const r=await fetch(url,{
    method:"POST",
    headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify(command)
  });
  if(!r.ok) throw new Error(`Redis ${r.status}`);
  return r.json();
}
function text(v,n=2500000){return typeof v==="string"?v.slice(0,n):""}
function item(x={}){
  return {
    id:Number.isFinite(Number(x.id))?Number(x.id):Date.now(),
    name:text(x.name,300)||"未命名商品",
    qty:Math.max(1,Math.min(99,Number(x.qty)||1)),
    rule:text(x.rule,2000),
    norule:text(x.norule,2000),
    backup:text(x.backup,2000),
    status:["wait","found","done","no","help"].includes(x.status)?x.status:"wait",
    mustConfirm:Boolean(x.mustConfirm),
    photo:text(x.photo),
    ref:text(x.ref)
  };
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");
  try{
    if(req.method==="GET"){
      const d=await redis(["GET",KEY]);
      return res.status(200).json(d.result?JSON.parse(d.result):{});
    }
    if(req.method==="POST"){
      const b=req.body||{};
      const state={
        trip:text(b.trip,120),
        items:Array.isArray(b.items)?b.items.slice(0,200).map(item):[],
        updatedAt:new Date().toISOString()
      };
      await redis(["SET",KEY,JSON.stringify(state)]);
      return res.status(200).json({ok:true,updatedAt:state.updatedAt,count:state.items.length});
    }
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:"Sync service unavailable"});
  }
}
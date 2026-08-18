const KEY = "buyforme:shared-state:v2";

function env() {
  const url = process.env.KV_REST_API_URL || process.env.STORAGE_KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Redis environment variables are missing");
  return { url, token };
}
async function redis(command) {
  const { url, token } = env();
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Redis error ${response.status}`);
  return response.json();
}
function cleanText(v,n=500){ return typeof v==="string" ? v.slice(0,n) : ""; }
function cleanItem(x){
  return {
    id: Number.isFinite(Number(x.id)) ? Number(x.id) : Date.now(),
    cat:cleanText(x.cat,60), brand:cleanText(x.brand,100), name:cleanText(x.name,200),
    qty:Math.max(1,Math.min(99,Number(x.qty)||1)), model:cleanText(x.model,120),
    priority:cleanText(x.priority,60), note:cleanText(x.note,1000),
    status:["wait","found","done","no","help"].includes(x.status)?x.status:"wait",
    img:cleanText(x.img,1500000),
    shots:Array.isArray(x.shots)?x.shots.filter(v=>typeof v==="string").slice(0,8).map(v=>v.slice(0,1500000)):[]
  };
}
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store");
  try{
    if(req.method==="GET"){
      const data=await redis(["GET",KEY]);
      return res.status(200).json(data.result?JSON.parse(data.result):{});
    }
    if(req.method==="POST"){
      const body=req.body||{};
      const state={
        trip:cleanText(body.trip,120),
        items:Array.isArray(body.items)?body.items.slice(0,100).map(cleanItem):[],
        updatedAt:new Date().toISOString()
      };
      await redis(["SET",KEY,JSON.stringify(state)]);
      return res.status(200).json({ok:true,updatedAt:state.updatedAt});
    }
    res.setHeader("Allow","GET, POST");
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){
    console.error(e);
    return res.status(500).json({error:"Sync service unavailable"});
  }
}

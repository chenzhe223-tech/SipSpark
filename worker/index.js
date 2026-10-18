const SITE_ORIGIN='https://chenzhe223-tech.github.io';
const TEXT_MODEL='@cf/meta/llama-3.2-3b-instruct';
const IMAGE_MODEL='@cf/black-forest-labs/flux-1-schnell';
const counters=new Map();
const aliasGroups=[
['长相思','长相思白葡萄酒','sauvignon blanc','sauvignon'],['白葡萄酒','white wine'],
['红柚金银花果汁','红柚金银花汁','葡萄柚金银花果汁'],
['金银花果汁','honeysuckle juice'],['西柚汁','葡萄柚汁','红柚汁','grapefruit juice','pink grapefruit juice'],
['红柚','西柚','葡萄柚','grapefruit'],['金银花','金银花花材','honeysuckle flower'],
['蔓越莓汁','cranberry juice'],['蔓越莓','cranberry','cranberries'],
['橙汁','orange juice'],['橙子','橙','orange'],
['苹果汁','apple juice'],['苹果','apple'],
['白桃汁','桃汁','桃子汁','peach juice'],['桃子','桃','peach'],
['菠萝汁','凤梨汁','pineapple juice'],['菠萝','凤梨','pineapple'],
['柠檬汁','lemon juice'],['青柠汁','lime juice'],['柠檬','lemon'],['青柠','lime'],
['乌龙茶','冷泡乌龙','oolong tea'],['茉莉花茶','茉莉茶','jasmine tea'],['绿茶','green tea'],['红茶','black tea'],['冷泡茶','cold brew tea'],['茶','tea'],
['冰美式','iced americano'],['美式咖啡','americano'],['冰咖啡','iced coffee'],['咖啡','coffee'],['浓缩咖啡','espresso'],
['牛奶','鲜奶','milk'],['燕麦奶','oat milk'],['椰子水','coconut water'],['椰奶','椰浆','coconut milk'],['酸奶','yogurt'],
['苏打水','气泡水','sparkling water','club soda','soda water'],['汤力水','tonic water'],['可乐','cola'],['雪碧','柠檬汽水','lemon-lime soda'],['姜汁汽水','ginger beer'],
['冰块','冰','ice cubes','ice'],['矿泉水','mineral water'],['纯净水','purified water'],['水','water'],
['伏特加','vodka'],['金酒','gin'],['朗姆酒','rum'],['威士忌','whisky','whiskey'],['龙舌兰','tequila'],
['起泡酒','香槟','prosecco','champagne','sparkling wine'],['红葡萄酒','红酒','red wine'],['桃红葡萄酒','桃红酒','rose wine'],
['清酒','sake'],['烧酒','soju'],['梅酒','plum wine'],['啤酒','beer'],['白酒','baijiu']
];
function normalize(s){return String(s||'').toLowerCase().replace(/\s+/g,'').replace(/[，。；、,.!?！？:：\-_]/g,'')}
function json(data,status,origin,extra){const h=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});if(origin===SITE_ORIGIN)h.set('access-control-allow-origin',SITE_ORIGIN);h.set('vary','Origin');h.set('access-control-allow-methods','GET, POST, OPTIONS');h.set('access-control-allow-headers','Content-Type');h.set('access-control-max-age','86400');if(extra)Object.keys(extra).forEach(k=>h.set(k,extra[k]));return new Response(JSON.stringify(data),{status:status||200,headers:h})}
function matchedMaterials(input){const t=normalize(input),hits=[];aliasGroups.forEach((group,groupId)=>group.forEach(alias=>{const token=normalize(alias);if(!token)return;let from=0,at;while((at=t.indexOf(token,from))!==-1){hits.push({start:at,end:at+token.length,length:token.length,groupId:groupId});from=at+1}}));hits.sort((a,b)=>b.length-a.length||a.start-b.start);const selected=[];for(const hit of hits){if(!selected.some(x=>hit.start<x.end&&hit.end>x.start))selected.push(hit)}selected.sort((a,b)=>a.start-b.start);const groups=new Set(),out=[];for(const hit of selected){if(groups.has(hit.groupId))continue;groups.add(hit.groupId);out.push({groupId:hit.groupId,name:aliasGroups[hit.groupId][0]})}return out}
function mentionedGroups(input){return new Set(matchedMaterials(input).map(x=>x.groupId))}
function ingredientGroup(name){const n=normalize(name);return aliasGroups.findIndex(group=>group.some(alias=>normalize(alias)===n))}
function listed(name,input){const group=ingredientGroup(name);return group>=0&&mentionedGroups(input).has(group)}
function alcoholStrength(name){const n=normalize(name);const data=[{keys:['长相思','白葡萄酒','sauvignonblanc','sauvignon'],abv:.125},{keys:['起泡酒','香槟','prosecco','champagne','sparklingwine'],abv:.12},{keys:['红葡萄酒','红酒','redwine'],abv:.13},{keys:['桃红葡萄酒','桃红酒','rosewine'],abv:.12},{keys:['金酒','gin','伏特加','vodka','朗姆酒','rum','威士忌','whisky','whiskey','龙舌兰','tequila','白酒','baijiu'],abv:.4},{keys:['清酒','sake'],abv:.15},{keys:['烧酒','soju'],abv:.17},{keys:['梅酒','plumwine'],abv:.12},{keys:['啤酒','beer'],abv:.05}];for(const group of data){if(group.keys.some(k=>n===normalize(k)||n.indexOf(normalize(k))>=0))return group.abv}return null}
function isIce(name){const n=normalize(name);return n.indexOf('冰块')>=0||n==='冰'||n.indexOf('ice')>=0}
function rateLimit(req,image){const ip=req.headers.get('CF-Connecting-IP')||'unknown',now=Date.now();let r=counters.get(ip);if(!r||now-r.start>60000)r={start:now,count:0,images:0};r.count++;if(image)r.images++;counters.set(ip,r);if(counters.size>5000){for(const [k,v] of counters){if(now-v.start>120000)counters.delete(k);if(counters.size<=3500)break}}return {ok:r.count<=(image?5:10)&&(!image||r.images<=2),retry:Math.max(1,Math.ceil((60000-(now-r.start))/1000))}}
function extract(r){if(typeof r==='string')return r;if(r&&typeof r.response==='string')return r.response;if(r&&typeof r.output_text==='string')return r.output_text;if(r&&Array.isArray(r.choices)&&r.choices[0]&&r.choices[0].message)return r.choices[0].message.content;return ''}
function parseObject(s){
 let t=String(s||'').trim(),f=String.fromCharCode(96).repeat(3);
 if(t.startsWith(f)){t=t.slice(f.length);if(t.startsWith('json'))t=t.slice(4);t=t.trim();if(t.endsWith(f))t=t.slice(0,-f.length).trim()}
 let fallback=null;
 for(let i=0;i<t.length;i++){
  if(t[i]!=='{')continue;
  let depth=0,inString=false,escape=false;
  for(let j=i;j<t.length;j++){
   const ch=t[j];
   if(inString){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch==='"')inString=false;continue}
   if(ch==='"'){inString=true;continue}
   if(ch==='{')depth++;else if(ch==='}')depth--;
   if(depth===0){try{const obj=JSON.parse(t.slice(i,j+1));if(obj&&Array.isArray(obj.recipes)&&obj.recipes.length>=3)return obj;if(!fallback&&obj&&typeof obj==='object')fallback=obj}catch(e){}break}
  }
 }
 if(fallback)return fallback;
 throw new Error('invalid_json')
}
function validate(payload,input,mood){
 if(!payload||!Array.isArray(payload.recipes)||payload.recipes.length<3)throw new Error('not enough recipes');
 const allowedGroups=mentionedGroups(input);
 const recipes=payload.recipes.slice(0,3).map((r,i)=>{
  const name=String(r.name||r.chineseName||'').trim().slice(0,36);
  const englishName=String(r.englishName||r.en||'').trim().slice(0,48);
  const description=String(r.description||r.flavor||'').trim().slice(0,240);
  const ingredients=Array.isArray(r.ingredients)?r.ingredients.slice(0,8):[];
  const steps=Array.isArray(r.steps)?r.steps.slice(0,6).map(step=>String(step).trim().slice(0,200)):[];
  if(!name||ingredients.length===0||steps.length<2)throw new Error('incomplete recipe');
  const clean=ingredients.map(it=>{
   const iname=String(it.name||'').trim().slice(0,50);
   const raw=it.amountMl!==undefined?it.amountMl:(it.amount_ml!==undefined?it.amount_ml:it.ml);
   const amountMl=raw===null||raw===undefined?null:Number(raw);
   const amount=String(it.amount||'').trim().slice(0,30);
   if(!iname||(!Number.isFinite(amountMl)&&!amount))throw new Error('missing measure');
   const group=ingredientGroup(iname);
   if(group<0||!allowedGroups.has(group))throw new Error('unlisted ingredient: '+iname);
   return {name:iname,amountMl:Number.isFinite(amountMl)?Math.max(0,Math.min(500,amountMl)):null,amount:amount||null,optional:Boolean(it.optional),group:group};
  });
  const usedGroups=new Set(clean.map(it=>it.group));
  for(const step of steps){const stepGroups=mentionedGroups(step);for(const group of stepGroups){if(!usedGroups.has(group))throw new Error('unlisted ingredient in steps')}} 
  const alcoholParts=clean.map(it=>({item:it,strength:alcoholStrength(it.name)})).filter(x=>x.strength!==null);
  if((String(mood||'')+' '+String(input||'')).match(/无酒精|不含酒精|不喝酒|不要酒精|no\s*alcohol|mocktail/i)&&alcoholParts.length)throw new Error('alcohol_not_allowed');
  const liquidParts=clean.filter(it=>!isIce(it.name)&&it.amountMl!==null&&it.amountMl>0);
  const liquidVolume=liquidParts.reduce((sum,it)=>sum+it.amountMl,0);
  const pureAlcohol=alcoholParts.reduce((sum,x)=>sum+(x.item.amountMl===null?0:x.item.amountMl*x.strength),0);
  const canEstimate=alcoholParts.length>0&&alcoholParts.every(x=>x.item.amountMl!==null)&&liquidVolume>0;
  const estimate=alcoholParts.length===0?0:(canEstimate?Math.max(0,Math.min(.96,pureAlcohol/liquidVolume)):null);
  return {name:name,englishName:englishName||'SipSpark Mix '+(i+1),tag:String(r.tag||r.style||'即兴特调').trim().slice(0,24),description:description,ingredients:clean.map(({group,...x})=>x),steps:steps,flavor:String(r.flavor||description).trim().slice(0,240),isAlcoholFree:alcoholParts.length===0,estimatedAbv:estimate,alcoholNote:alcoholParts.length?'酒精度为按常见基酒度数与液体体积估算，实际以瓶身标注为准。':''};
 });
 return {recipes:recipes,safetyNote:String(payload.safetyNote||'含酒精饮品请慢饮，不酒驾；未成年人及需要保持警觉时请选择真正的无酒精饮品。').slice(0,240),engine:'workers-ai'};
}
export default {async fetch(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin')||'';
 if(request.method==='OPTIONS'){if(origin&&origin!==SITE_ORIGIN)return new Response(null,{status:403});return json({ok:true},200,origin)}
 if(origin&&origin!==SITE_ORIGIN)return json({error:'Origin not allowed'},403,'');
 if(url.pathname==='/health'&&request.method==='GET')return json({ok:true,service:'SipSpark AI',textModel:TEXT_MODEL,imageModel:IMAGE_MODEL},200,origin);
 const mix=url.pathname==='/api/mix',image=url.pathname==='/api/image';if(!mix&&!image)return json({error:'Not found'},404,origin);if(request.method!=='POST')return json({error:'Method not allowed'},405,origin,{'allow':'POST, OPTIONS'});
 const limit=rateLimit(request,image);if(!limit.ok)return json({error:'操作有点快，请稍等片刻再试。',retryAfter:limit.retry},429,origin,{'retry-after':String(limit.retry)});
 const length=Number(request.headers.get('content-length')||0);if(length>12000)return json({error:'输入太长了，请精简后再试。'},413,origin);let body;try{body=await request.json()}catch(e){return json({error:'请提交有效的 JSON 内容。'},400,origin)}
 if(mix){
  const input=String(body.ingredients||body.text||'').trim(),mood=String(body.mood||'给我惊喜').slice(0,24);
  if(input.length<2)return json({error:'先写下一两种手边材料吧。'},400,origin);if(input.length>1200)return json({error:'输入太长了，请精简到 1200 字以内。'},413,origin);
  const system='你是随调 SipSpark 的 AI 即兴调饮师。严格只输出 JSON 对象，不要解释文字。只使用下一段“可用材料清单”中的材料名称；不能把复合饮品拆成未提供的原料（例如红柚金银花果汁不能拆成红柚或金银花）。不得默认存在冰块、糖、柠檬、苏打水或任何工具。恰好生成 3 款差异清楚、马上可做的配方；材料少时只改变现有材料比例。每款需要中英文名、风格、风味、材料清单、3至4个简单步骤、isAlcoholFree、estimatedAbv和alcoholNote。材料 name 必须逐字使用可用材料清单中的名称。amountMl 为数字毫升；冰块 amountMl=0、amount=适量。含酒精材料不得标为无酒精，按常见基酒 ABV 与液体体积估算酒精度；无法确认则 estimatedAbv=null。无酒精模式绝不能含酒精材料。JSON 对象格式：{"recipes":[{"name":"中文名","englishName":"English Name","tag":"风格","description":"风味描述","ingredients":[{"name":"与用户输入一致的材料名","amountMl":60,"amount":"60 ml","optional":false}],"steps":["步骤一","步骤二","步骤三"],"flavor":"风味预期","isAlcoholFree":false,"estimatedAbv":0.03,"alcoholNote":"饮用提示"}],"safetyNote":"安全提示"}。';
  try{const available=matchedMaterials(input).map(x=>x.name);if(!available.length)return json({error:'暂未识别到清楚的材料名称，请输入具体饮品或食材。'},400,origin);const prompt=system+'\n\n可用材料清单（唯一允许使用）：'+available.join('、')+'。\n用户原始描述：'+input+'\n风味偏好：'+mood+'\n请生成三款配方。';const result=await env.AI.run(TEXT_MODEL,{prompt:prompt,max_tokens:1100,temperature:.2});return json(validate(parseObject(extract(result)),input,mood),200,origin)}
  catch(e){const message=String(e&&e.message||''),bad=message.indexOf('unlisted ingredient')>=0||message.indexOf('unlisted ingredient in steps')>=0,alc=message.indexOf('alcohol_not_allowed')>=0,parse=message.indexOf('invalid_json')>=0||message.indexOf('not enough recipes')>=0;return json({error:bad?'AI 配方或步骤混入未提及材料，已拦截。请写得更明确，或使用本地建议。':(alc?'检测到含酒精材料，无法把该配方标记为无酒精。请重试。':'AI 暂时没能可靠生成三款完整配方，请稍后重试或使用本地建议。'),detail:bad?'ingredient_validation':(alc?'alcohol_validation':(parse?'invalid_model_output':'model_unavailable'))},(bad||alc)?422:502,origin)}
 }
 const name=String(body.name||'随调作品').trim().slice(0,50),description=String(body.description||'一杯即兴饮品').trim().slice(0,200),ingredients=String(body.ingredients||'').trim().slice(0,300),mood=String(body.mood||'清爽轻盈').trim().slice(0,40);if(!name||!description)return json({error:'缺少作品名称或风味描述。'},400,origin);
 const prompt='Premium editorial beverage photography for lifestyle brand SipSpark (随调). Realistic single cocktail or mocktail in a clear glass with ice ONLY if in the supplied ingredients; natural window light, subtle real-life styling, warm paper cream #F2EEE6, muted pomelo coral #C98778, sage green #8B9582, charcoal accents. No text, letters, logos, watermark, hands, extra drinks, or ingredients not listed. Drink concept: '+name+'. Flavor: '+description+'. Ingredients available: '+ingredients+'. Mood: '+mood+'. Portrait 4:5 product photography, realistic glass refraction and condensation, refined natural shadows.';
 try{const result=await env.AI.run(IMAGE_MODEL,{prompt:prompt,steps:4});const img=result&&(result.image||(result.result&&result.result.image));if(!img||typeof img!=='string')throw new Error('image missing');return json({image:img,mimeType:'image/jpeg',model:IMAGE_MODEL},200,origin)}
 catch(e){return json({error:'图片生成服务暂时不可用，请重试；你仍可下载品牌风格分享卡。',detail:'image_model_unavailable'},502,origin)}
}};
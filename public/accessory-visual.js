// SlimeLounge v0.4.1 accessory coloring: recolor only the primary fill while preserving outline/highlights.
const ACCESSORY_VISUAL_META={
  '/accessories/bow.svg':{color:'#ff7fa2',mask:'/accessories/bow.tint.svg',detail:'/accessories/bow.detail.svg',aspect:48/28},
  '/accessories/leaf.svg':{color:'#6fd477',mask:'/accessories/leaf.tint.svg',detail:'/accessories/leaf.detail.svg',aspect:36/40},
  '/accessories/star.svg':{color:'#ffd75d',mask:'/accessories/star.tint.svg',detail:'/accessories/star.detail.svg',aspect:1},
  '/accessories/glasses.svg':{color:'#1c2944',mask:'/accessories/glasses.tint.svg',detail:'/accessories/glasses.detail.svg',aspect:96/36},
  '/accessories/scarf.svg':{color:'#d96583',mask:'/accessories/scarf.tint.svg',detail:'/accessories/scarf.detail.svg',aspect:96/34},
  '/accessories/flower.svg':{color:'#ff83ad',mask:'/accessories/flower.tint.svg',detail:'/accessories/flower.detail.svg',aspect:1},
  '/accessories/crown.svg':{color:'#f1c84c',mask:'/accessories/crown.tint.svg',detail:'/accessories/crown.detail.svg',aspect:64/42},
  '/accessories/headphones.svg':{color:'#6278a8',mask:'/accessories/headphones.tint.svg',detail:'/accessories/headphones.detail.svg',aspect:112/72}
};
function accessoryVisualMeta(asset=''){return ACCESSORY_VISUAL_META[String(asset||'')]||null}
function accessoryDefaultColor(item){const c=String(item?.color||'');if(/^#[0-9a-f]{6}$/i.test(c))return c;return accessoryVisualMeta(item?.asset)?.color||'#7aa6c2'}
function accessoryVisualMarkup(item,color,className,style,alt=''){
  if(!item?.asset)return'';const asset=String(item.asset),meta=accessoryVisualMeta(asset),c=/^#[0-9a-f]{6}$/i.test(String(color||item.color||''))?String(color||item.color):'';
  if(!meta||!c)return `<img class="${className}" src="${attr(asset)}" alt="${attr(alt)}" style="${attr(style)}" loading="lazy">`;
  return `<img class="${className} accessory-base-layer" src="${attr(asset)}" alt="${attr(alt)}" style="${attr(style)}" loading="lazy"><span class="${className} accessory-primary-layer" aria-hidden="true" style="${attr(style)};--acc:${attr(c)};--acc-mask:url('${attr(meta.mask)}');--acc-aspect:${Number(meta.aspect)||1}"></span><img class="${className} accessory-detail-layer" src="${attr(meta.detail)}" alt="" aria-hidden="true" style="${attr(style)}" loading="lazy">`;
}

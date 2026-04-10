"use client";

import { HTML_IFRAME_MESSAGE_TYPES } from "./iframeProtocol";

export function buildHtmlIframeRuntimeScript(slideIndex: number = 0) {
  const T = HTML_IFRAME_MESSAGE_TYPES;

  return `<script>(function(){
var SLIDE_INDEX=${Number.isFinite(slideIndex) ? slideIndex : 0};
var selectedId=null;
var hoveredId=null;
var editingId=null;
var selectionOverlay=null;
var hoverOverlay=null;
var dragState=null;
var resizeState=null;
var rotateState=null;
var dragPointerId=null;
var suppressNextClick=false;
var dragRafId=null;
var pendingDragEvent=null;
var guidesContainer=null;
var blockStyleObserver=null;
var observedBlockId=null;
var observedBlockLastStyle='';
var lastBlockMutationContext='idle';
var isTouchDevice='ontouchstart' in window||navigator.maxTouchPoints>0;
var DRAG_THRESHOLD=isTouchDevice?10:5;
var SNAP_THRESHOLD=6;

function debugLog(stage,payload){
  return;
}

function summarizeElementPath(el){
  if(!el||!(el instanceof Element))return '';
  var parts=[];
  var current=el;
  var depth=0;
  while(current&&depth<5){
    var part=String(current.tagName||'').toLowerCase();
    var editableId=current.getAttribute&&current.getAttribute('data-editable-id');
    var cls=String(current.className&&typeof current.className==='string'?current.className:'').trim();
    if(editableId)part+='#'+editableId;
    if(cls)part+='.'+cls.split(/\s+/).slice(0,2).join('.');
    parts.unshift(part);
    current=current.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

function logEditableIdMatches(editableId,stage){
  return;
}

function stopObservedBlockLogging(reason){
  if(blockStyleObserver){
    try{blockStyleObserver.disconnect();}catch(_err){}
  }
  blockStyleObserver=null;
  observedBlockId=null;
  observedBlockLastStyle='';
}

function stopObservedBlockLoggingSoon(reason){
  stopObservedBlockLogging(reason);
}

function startObservedBlockLogging(el,reason){
  stopObservedBlockLogging(reason);
}

function getEditable(el){
  if(!(el instanceof Element))return null;
  var target=el.closest('[data-editable-id]');
  if(!target)return null;
  if(String(target.getAttribute('data-editor-selectable')||'true').toLowerCase()==='false'){
    return null;
  }
  return target;
}

function isTransformableElement(el){
  return String(el&&el.getAttribute&&el.getAttribute('data-editor-transformable')||'true').toLowerCase()!=='false';
}

function getScaleRoot(){
  return document.querySelector('[data-scale-root]');
}

function removeOverlay(kind){
  var target=kind==='hover'?hoverOverlay:selectionOverlay;
  if(target&&target.parentNode)target.parentNode.removeChild(target);
  if(kind==='hover'){
    hoverOverlay=null;
  }else{
    selectionOverlay=null;
  }
}

function createOverlay(target,kind){
  removeOverlay(kind);
  if(!target)return null;
  var root=getScaleRoot();
  if(!root)return null;
  var rect=target.getBoundingClientRect();
  var rootRect=root.getBoundingClientRect();
  var overlay=document.createElement('div');
  overlay.setAttribute('data-editor-overlay',kind);
  overlay.style.cssText='position:absolute;pointer-events:none;z-index:2147483001;'
    +'left:'+(rect.left-rootRect.left)+'px;'
    +'top:'+(rect.top-rootRect.top)+'px;'
    +'width:'+rect.width+'px;'
    +'height:'+rect.height+'px;'
    +(kind==='selected'
      ?'outline:2px solid #8b5cf6;outline-offset:2px;'
      :'outline:2px dashed #94a3b8;outline-offset:2px;');
  if(kind==='selected'){
    var corners=['nw','ne','sw','se'];
    var positions=[
      'top:-5px;left:-5px;cursor:nwse-resize;',
      'top:-5px;right:-5px;cursor:nesw-resize;',
      'bottom:-5px;left:-5px;cursor:nesw-resize;',
      'bottom:-5px;right:-5px;cursor:nwse-resize;'
    ];
    for(var i=0;i<4;i++){
      var handle=document.createElement('div');
      handle.setAttribute('data-handle',corners[i]);
      handle.style.cssText='position:absolute;width:10px;height:10px;background:#8b5cf6;border-radius:2px;border:2px solid #fff;box-sizing:border-box;pointer-events:auto;'+positions[i];
      overlay.appendChild(handle);
    }
    var line=document.createElement('div');
    line.style.cssText='position:absolute;left:50%;top:-26px;width:1px;height:18px;background:#8b5cf6;transform:translateX(-50%);';
    overlay.appendChild(line);
    var rotateHandle=document.createElement('div');
    rotateHandle.setAttribute('data-rotate-handle','true');
    rotateHandle.style.cssText='position:absolute;left:50%;top:-34px;width:12px;height:12px;background:#8b5cf6;border:2px solid #fff;border-radius:999px;box-sizing:border-box;transform:translateX(-50%);pointer-events:auto;cursor:grab;';
    overlay.appendChild(rotateHandle);
  }
  root.appendChild(overlay);
  if(kind==='hover'){
    hoverOverlay=overlay;
  }else{
    selectionOverlay=overlay;
  }
  return overlay;
}

function updateSelectionOverlay(target){
  if(!target){
    removeOverlay('selected');
    return;
  }
  createOverlay(target,'selected');
}

function updateHoverOverlay(target){
  if(!target){
    removeOverlay('hover');
    return;
  }
  createOverlay(target,'hover');
}

function clearHoverState(){
  hoveredId=null;
  removeOverlay('hover');
}

function ensureGuidesContainer(){
  if(guidesContainer)return guidesContainer;
  guidesContainer=document.createElement('div');
  guidesContainer.id='html-editor-guides';
  guidesContainer.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:2147483002;';
  document.body.appendChild(guidesContainer);
  return guidesContainer;
}

function clearGuides(){
  if(guidesContainer)guidesContainer.innerHTML='';
}

function drawGuide(type,pos){
  var root=ensureGuidesContainer();
  var line=document.createElement('div');
  if(type==='v'){
    line.style.cssText='position:fixed;top:0;width:1px;height:100%;background:#3b82f6;opacity:.7;';
    line.style.left=String(pos)+'px';
  }else{
    line.style.cssText='position:fixed;left:0;height:1px;width:100%;background:#3b82f6;opacity:.7;';
    line.style.top=String(pos)+'px';
  }
  root.appendChild(line);
}

function getSnapTargets(draggedEl){
  var targets={x:[],y:[]};
  var root=getScaleRoot();
  var rootRect=root?root.getBoundingClientRect():{left:0,top:0,width:window.innerWidth,height:window.innerHeight,right:window.innerWidth,bottom:window.innerHeight};
  targets.x.push(rootRect.left,rootRect.left+(rootRect.width/2),rootRect.right);
  targets.y.push(rootRect.top,rootRect.top+(rootRect.height/2),rootRect.bottom);
  document.querySelectorAll('[data-editable-id]').forEach(function(el){
    if(el===draggedEl)return;
    if(!isTransformableElement(el))return;
    var rect=el.getBoundingClientRect();
    targets.x.push(rect.left,rect.left+(rect.width/2),rect.right);
    targets.y.push(rect.top,rect.top+(rect.height/2),rect.bottom);
  });
  return targets;
}

function computeSnap(elRect,targets){
  var bestDx=SNAP_THRESHOLD+1;
  var bestDy=SNAP_THRESHOLD+1;
  var snapX=null;
  var snapY=null;
  var xEdges=[elRect.left,elRect.left+(elRect.width/2),elRect.right];
  var yEdges=[elRect.top,elRect.top+(elRect.height/2),elRect.bottom];
  for(var i=0;i<xEdges.length;i++){
    for(var j=0;j<targets.x.length;j++){
      var distance=Math.abs(xEdges[i]-targets.x[j]);
      if(distance<bestDx){
        bestDx=distance;
        snapX={delta:targets.x[j]-xEdges[i],guide:targets.x[j]};
      }
    }
  }
  for(var iy=0;iy<yEdges.length;iy++){
    for(var jy=0;jy<targets.y.length;jy++){
      var yDistance=Math.abs(yEdges[iy]-targets.y[jy]);
      if(yDistance<bestDy){
        bestDy=yDistance;
        snapY={delta:targets.y[jy]-yEdges[iy],guide:targets.y[jy]};
      }
    }
  }
  return {
    dx:bestDx<=SNAP_THRESHOLD&&snapX?snapX.delta:0,
    dy:bestDy<=SNAP_THRESHOLD&&snapY?snapY.delta:0,
    guideX:bestDx<=SNAP_THRESHOLD&&snapX?snapX.guide:null,
    guideY:bestDy<=SNAP_THRESHOLD&&snapY?snapY.guide:null
  };
}

function parseTranslate(transform){
  var match=String(transform||'').match(/translate\(\s*([^,]+),\s*([^)]+)\)/i);
  return {
    x: parseFloat(match&&match[1]||'0')||0,
    y: parseFloat(match&&match[2]||'0')||0
  };
}

function readTranslateForInteraction(el){
  var rect=el&&el.getBoundingClientRect?el.getBoundingClientRect():{width:0,height:0};
  function toPixels(value,size){
    var raw=String(value||'').trim();
    if(!raw)return 0;
    if(raw.indexOf('%')!==-1){
      return ((parseFloat(raw)||0)/100)*size;
    }
    return parseFloat(raw)||0;
  }
  try{
    var computed=el&&window.getComputedStyle?window.getComputedStyle(el):null;
    var computedTransform=String(computed&&computed.transform||'').trim();
    if(computedTransform&&computedTransform!=='none'){
      if(typeof DOMMatrixReadOnly!=='undefined'){
        var matrix=new DOMMatrixReadOnly(computedTransform);
        return {x:Number(matrix.m41)||0,y:Number(matrix.m42)||0};
      }
      if(typeof WebKitCSSMatrix!=='undefined'){
        var webkitMatrix=new WebKitCSSMatrix(computedTransform);
        return {x:Number(webkitMatrix.m41)||0,y:Number(webkitMatrix.m42)||0};
      }
    }
  }catch(_err){}
  var match=String(el&&el.style&&el.style.transform||'').match(/translate\(\s*([^,]+),\s*([^)]+)\)/i);
  return {
    x: toPixels(match&&match[1],rect.width),
    y: toPixels(match&&match[2],rect.height)
  };
}

function parseRotate(transform){
  var match=String(transform||'').match(/rotate\(\s*([^)]+)\)/i);
  return parseFloat(match&&match[1]||'0')||0;
}

function applyTransform(el,translateX,translateY,rotate){
  var parts=[];
  if(translateX||translateY){
    parts.push('translate('+String(Math.round(translateX))+'px, '+String(Math.round(translateY))+'px)');
  }
  if(rotate){
    parts.push('rotate('+String(Math.round(rotate))+'deg)');
  }
  el.style.transform=parts.join(' ').trim();
  if(!el.style.transform)el.style.removeProperty('transform');
}

function emitTransform(el,extra){
  lastBlockMutationContext='emit-transform';
  var transform=parseTranslate(el.style.transform||'');
  var rotate=parseRotate(el.style.transform||'');
  var editableId=String(el.getAttribute('data-editable-id')||'');
  if(/^block-/.test(editableId)){
    logEditableIdMatches(editableId,'emit-transform-before-payload');
  }
  var payload={
    type:'${T.elementTransform}',
    editableId:editableId,
    slideIndex:SLIDE_INDEX,
    translateX:String(Math.round(transform.x))+'px',
    translateY:String(Math.round(transform.y))+'px',
    width:String(el.style.width||'').trim(),
    height:String(el.style.height||'').trim(),
    rotate:String(Math.round(rotate))+'deg'
  };
  if(extra){
    for(var key in extra){
      payload[key]=extra[key];
    }
  }
  if(/^block-/.test(editableId)){
    debugLog('block-emit-transform',{
      editableId:editableId,
      payload:payload,
      isConnected:!!el.isConnected,
      elementPath:summarizeElementPath(el),
      inlineWidth:String(el.style.width||''),
      inlineHeight:String(el.style.height||''),
      inlineTransform:String(el.style.transform||''),
      inlineBorderRadius:String(el.style.borderRadius||''),
      activeStates:{
        dragId:dragState&&dragState.id||null,
        resizeId:resizeState&&resizeState.id||null,
        rotateId:rotateState&&rotateState.id||null
      },
      fullStyle:String(el.getAttribute&&el.getAttribute('style')||''),
      rect:el.getBoundingClientRect?{
        width:el.getBoundingClientRect().width,
        height:el.getBoundingClientRect().height,
        left:el.getBoundingClientRect().left,
        top:el.getBoundingClientRect().top
      }:null
    });
  }
  debugLog('emit-transform',payload);
  window.parent.postMessage(payload,'*');
}

function syncFontLinksFromParsedDoc(parsedDoc){
  document.head.querySelectorAll('link[data-html-editor-sync-font="true"]').forEach(function(node){
    if(node&&node.parentNode)node.parentNode.removeChild(node);
  });
  var seen={};
  parsedDoc.querySelectorAll('link[rel="stylesheet"][href]').forEach(function(link){
    var href=String(link.getAttribute('href')||'').trim();
    if(!href||seen[href])return;
    seen[href]=true;
    var clone=document.createElement('link');
    clone.setAttribute('rel','stylesheet');
    clone.setAttribute('href',href);
    clone.setAttribute('data-html-editor-sync-font','true');
    document.head.appendChild(clone);
  });
}

function syncDocumentStructure(srcDoc){
  if(typeof srcDoc!=='string'||!srcDoc.trim())return;
  lastBlockMutationContext='sync-document';
  stopObservedBlockLogging('sync-document');
  var parsed=new DOMParser().parseFromString(srcDoc,'text/html');
  var nextRoot=parsed.querySelector('[data-scale-root]');
  var currentRoot=getScaleRoot();
  if(!nextRoot||!currentRoot)return;
  debugLog('sync-document-start',{
    slideIndex:SLIDE_INDEX,
    currentChildCount:currentRoot.children.length,
    nextChildCount:nextRoot.children.length,
    currentHtmlLength:String(currentRoot.innerHTML||'').length,
    nextHtmlLength:String(nextRoot.innerHTML||'').length,
    selectedId:selectedId
  });
  if(editingId)editingId=null;
  dragState=null;
  resizeState=null;
  rotateState=null;
  currentRoot.innerHTML=nextRoot.innerHTML;
  syncFontLinksFromParsedDoc(parsed);
  if(selectedId){
    var selectedTarget=document.querySelector('[data-editable-id="'+CSS.escape(selectedId)+'"]');
    if(selectedTarget){
      updateSelectionOverlay(selectedTarget);
    }else{
      selectedId=null;
      updateSelectionOverlay(null);
      window.parent.postMessage({type:'${T.elementDeselect}',slideIndex:SLIDE_INDEX},'*');
    }
  }else{
    updateSelectionOverlay(null);
  }
  if(hoveredId&&!selectedId){
    var hoveredTarget=document.querySelector('[data-editable-id="'+CSS.escape(hoveredId)+'"]');
    if(hoveredTarget){
      updateHoverOverlay(hoveredTarget);
    }else{
      clearHoverState();
    }
  }else{
    clearHoverState();
  }
  debugLog('sync-document-complete',{
    slideIndex:SLIDE_INDEX,
    selectedId:selectedId,
    rootRect:currentRoot.getBoundingClientRect?{
      width:currentRoot.getBoundingClientRect().width,
      height:currentRoot.getBoundingClientRect().height
    }:null
  });
}

function isTextEditable(target){
  if(!target)return false;
  var tag=target.tagName.toLowerCase();
  if(['span','p','h1','h2','h3','h4','h5','h6','li','button','a','strong','em','div'].indexOf(tag)===-1)return false;
  if(target.querySelector('.image-slot,img'))return false;
  return true;
}

function getCleanInlineResult(el){
  var clone=el.cloneNode(true);
  clone.querySelectorAll('[data-editable-id]').forEach(function(node){
    node.removeAttribute('data-editable-id');
  });
  clone.querySelectorAll('font').forEach(function(font){
    var span=document.createElement('span');
    if(font.getAttribute('color'))span.style.color=font.getAttribute('color')||'';
    if(font.getAttribute('size')){
      var sizeMap={'1':'8px','2':'10px','3':'12px','4':'14px','5':'18px','6':'24px','7':'36px'};
      span.style.fontSize=sizeMap[font.getAttribute('size')||'']||((font.getAttribute('size')||'')+'px');
    }
    if(font.getAttribute('face'))span.style.fontFamily=font.getAttribute('face')||'';
    span.innerHTML=font.innerHTML;
    if(font.parentNode)font.parentNode.replaceChild(span,font);
  });
  clone.querySelectorAll('[style]').forEach(function(node){
    node.style.removeProperty('cursor');
    if((node.getAttribute('style')||'').trim()==='')node.removeAttribute('style');
  });
  var html=String(clone.innerHTML||'').replace(/\\s*\\n\\s*/g,' ').replace(/\\s+$/g,'');
  return {
    text:el.textContent||'',
    html:html
  };
}

function flushInlineEdit(){
  if(!editingId)return null;
  var el=document.querySelector('[data-editable-id="'+CSS.escape(editingId)+'"]');
  if(!el){
    editingId=null;
    return null;
  }
  var id=editingId;
  var result=getCleanInlineResult(el);
  el.removeAttribute('contenteditable');
  el.style.outline='';
  el.style.outlineOffset='';
  editingId=null;
  selectedId=id;
  updateSelectionOverlay(el);
  window.parent.postMessage({
    type:'${T.elementTextCommit}',
    editableId:id,
    slideIndex:SLIDE_INDEX,
    text:result.text,
    html:result.html
  },'*');
  return { id:id, text:result.text, html:result.html };
}

function setSelected(id,notifyParent){
  if(editingId&&editingId!==id)flushInlineEdit();
  selectedId=id||null;
  clearHoverState();
  if(!selectedId){
    updateSelectionOverlay(null);
    if(notifyParent)window.parent.postMessage({type:'${T.elementDeselect}',slideIndex:SLIDE_INDEX},'*');
    return;
  }
  var target=document.querySelector('[data-editable-id="'+CSS.escape(selectedId)+'"]');
  updateSelectionOverlay(target);
  if(notifyParent)window.parent.postMessage({type:'${T.elementSelect}',editableId:selectedId,slideIndex:SLIDE_INDEX},'*');
}

function startInlineEdit(id){
  var el=document.querySelector('[data-editable-id="'+CSS.escape(id)+'"]');
  if(!isTextEditable(el))return;
  editingId=id;
  updateSelectionOverlay(null);
  clearHoverState();
  el.setAttribute('contenteditable','true');
  el.style.outline='2px solid #8b5cf6';
  el.style.outlineOffset='2px';
  el.focus();
  var sel=window.getSelection();
  if(sel){
    sel.selectAllChildren(el);
    sel.collapseToEnd();
  }
}

function applyElementUpdate(payload){
  if(!payload||!payload.id)return;
  lastBlockMutationContext='apply-element-update';
  if(/^block-/.test(String(payload.id||''))){
    logEditableIdMatches(String(payload.id||''),'apply-element-update-before-query');
  }
  var el=document.querySelector('[data-editable-id="'+CSS.escape(String(payload.id))+'"]');
  if(!el)return;
  var patch=payload.patch||payload;
  debugLog('apply-element-update',{
    id:String(payload.id||''),
    patch:patch,
    beforeTransform:String(el.style.transform||''),
    beforeWidth:String(el.style.width||''),
    beforeHeight:String(el.style.height||'')
  });
  if(/^block-/.test(String(payload.id||''))){
    debugLog('block-apply-before',{
      id:String(payload.id||''),
      patch:patch,
      beforeTransform:String(el.style.transform||''),
      beforeWidth:String(el.style.width||''),
      beforeHeight:String(el.style.height||''),
      beforeBorderRadius:String(el.style.borderRadius||''),
      rect:el.getBoundingClientRect?{
        width:el.getBoundingClientRect().width,
        height:el.getBoundingClientRect().height,
        left:el.getBoundingClientRect().left,
        top:el.getBoundingClientRect().top
      }:null
    });
    logEditableIdMatches(String(payload.id||''),'apply-element-update-after-query');
  }
  if(typeof patch.html==='string'){el.innerHTML=patch.html;}
  else if(typeof patch.text==='string'){el.textContent=patch.text;}
  if(typeof patch.color==='string')el.style.color=patch.color;
  if(typeof patch.backgroundColor==='string')el.style.backgroundColor=patch.backgroundColor;
  if(typeof patch.fontSize==='string')el.style.fontSize=patch.fontSize;
  if(typeof patch.fontFamily==='string')el.style.fontFamily=patch.fontFamily;
  if(typeof patch.fontWeight==='string')el.style.fontWeight=patch.fontWeight;
  if(typeof patch.fontStyle==='string')el.style.fontStyle=patch.fontStyle;
  if(typeof patch.textDecoration==='string')el.style.textDecoration=patch.textDecoration;
  if(typeof patch.letterSpacing==='string')el.style.letterSpacing=patch.letterSpacing;
  if(typeof patch.lineHeight==='string')el.style.lineHeight=patch.lineHeight;
  if(typeof patch.textAlign==='string')el.style.textAlign=patch.textAlign;
  if(typeof patch.textTransform==='string')el.style.textTransform=patch.textTransform;
  if(typeof patch.marginTop==='string')el.style.marginTop=patch.marginTop;
  if(typeof patch.marginRight==='string')el.style.marginRight=patch.marginRight;
  if(typeof patch.marginBottom==='string')el.style.marginBottom=patch.marginBottom;
  if(typeof patch.marginLeft==='string')el.style.marginLeft=patch.marginLeft;
  if(typeof patch.borderRadius==='string')el.style.borderRadius=patch.borderRadius;
  if(typeof patch.opacity==='string')el.style.opacity=patch.opacity;
  if(typeof patch.border==='string')el.style.border=patch.border;
  if(typeof patch.backgroundImage==='string')el.style.backgroundImage=patch.backgroundImage;
  if(typeof patch.backgroundSize==='string')el.style.backgroundSize=patch.backgroundSize;
  if(typeof patch.backgroundPosition==='string')el.style.backgroundPosition=patch.backgroundPosition;
  if(typeof patch.objectFit==='string')el.style.objectFit=patch.objectFit;
  if(typeof patch.src==='string'&&el.tagName.toLowerCase()==='img')el.setAttribute('src',patch.src);
  if(typeof patch.searchQuery==='string')el.setAttribute('data-search-query',patch.searchQuery);
  if(typeof patch.selectable==='boolean')el.setAttribute('data-editor-selectable',String(patch.selectable));
  if(typeof patch.transformable==='boolean')el.setAttribute('data-editor-transformable',String(patch.transformable));
  if(typeof patch.listable==='boolean')el.setAttribute('data-editor-listable',String(patch.listable));
  if(typeof patch.originalTranslateX==='string')el.setAttribute('data-editor-original-translate-x',patch.originalTranslateX);
  if(typeof patch.originalTranslateY==='string')el.setAttribute('data-editor-original-translate-y',patch.originalTranslateY);
  if(typeof patch.originalWidth==='string')el.setAttribute('data-editor-original-width',patch.originalWidth);
  if(typeof patch.originalHeight==='string')el.setAttribute('data-editor-original-height',patch.originalHeight);
  if(typeof patch.originalRotate==='string')el.setAttribute('data-editor-original-rotate',patch.originalRotate);
  if(typeof patch.originalFontFamily==='string')el.setAttribute('data-editor-original-font-family',patch.originalFontFamily);
  if(typeof patch.originalFontSize==='string')el.setAttribute('data-editor-original-font-size',patch.originalFontSize);
  if(typeof patch.originalColor==='string')el.setAttribute('data-editor-original-color',patch.originalColor);
  if(typeof patch.originalBackgroundColor==='string')el.setAttribute('data-editor-original-background-color',patch.originalBackgroundColor);
  if(typeof patch.originalFontStyle==='string')el.setAttribute('data-editor-original-font-style',patch.originalFontStyle);
  if(typeof patch.originalTextDecoration==='string')el.setAttribute('data-editor-original-text-decoration',patch.originalTextDecoration);
  if(typeof patch.originalLetterSpacing==='string')el.setAttribute('data-editor-original-letter-spacing',patch.originalLetterSpacing);
  if(typeof patch.originalLineHeight==='string')el.setAttribute('data-editor-original-line-height',patch.originalLineHeight);
  if(typeof patch.originalTextAlign==='string')el.setAttribute('data-editor-original-text-align',patch.originalTextAlign);
  if(typeof patch.originalMarginTop==='string')el.setAttribute('data-editor-original-margin-top',patch.originalMarginTop);
  if(typeof patch.originalMarginRight==='string')el.setAttribute('data-editor-original-margin-right',patch.originalMarginRight);
  if(typeof patch.originalMarginBottom==='string')el.setAttribute('data-editor-original-margin-bottom',patch.originalMarginBottom);
  if(typeof patch.originalMarginLeft==='string')el.setAttribute('data-editor-original-margin-left',patch.originalMarginLeft);
  if(typeof patch.width==='string'){
    debugLog('block-width-write',{
      source:'apply-element-update',
      id:String(payload.id||''),
      nextWidth:patch.width,
      beforeWidth:String(el.style.width||''),
      context:lastBlockMutationContext
    });
    el.style.width=patch.width;
  }
  if(typeof patch.height==='string'){
    debugLog('block-height-write',{
      source:'apply-element-update',
      id:String(payload.id||''),
      nextHeight:patch.height,
      beforeHeight:String(el.style.height||''),
      context:lastBlockMutationContext
    });
    el.style.height=patch.height;
  }
  if(typeof patch.deleted==='boolean'){
    if(patch.deleted){
      el.setAttribute('data-html-deleted','true');
      el.style.display='none';
    }else{
      el.removeAttribute('data-html-deleted');
      if(el.style.display==='none')el.style.display='';
    }
  }
  if(typeof patch.translateX==='string'||typeof patch.translateY==='string'||typeof patch.rotate==='string'){
    var currentTranslate=parseTranslate(el.style.transform||'');
    var currentRotate=parseRotate(el.style.transform||'');
    var tx=typeof patch.translateX==='string'?(parseFloat(patch.translateX)||0):currentTranslate.x;
    var ty=typeof patch.translateY==='string'?(parseFloat(patch.translateY)||0):currentTranslate.y;
    var rotate=typeof patch.rotate==='string'?(parseFloat(patch.rotate)||0):currentRotate;
    applyTransform(el,tx,ty,rotate);
  }
  debugLog('apply-element-update-complete',{
    id:String(payload.id||''),
    afterTransform:String(el.style.transform||''),
    afterWidth:String(el.style.width||''),
    afterHeight:String(el.style.height||'')
  });
  if(/^block-/.test(String(payload.id||''))){
    debugLog('block-apply-after',{
      id:String(payload.id||''),
      afterTransform:String(el.style.transform||''),
      afterWidth:String(el.style.width||''),
      afterHeight:String(el.style.height||''),
      afterBorderRadius:String(el.style.borderRadius||''),
      rect:el.getBoundingClientRect?{
        width:el.getBoundingClientRect().width,
        height:el.getBoundingClientRect().height,
        left:el.getBoundingClientRect().left,
        top:el.getBoundingClientRect().top
      }:null
    });
  }
  if(selectedId===payload.id)updateSelectionOverlay(el);
  if(hoveredId===payload.id&&selectedId!==payload.id&&!editingId)updateHoverOverlay(el);
}

function beginDrag(target,event){
  if(!target||editingId||!isTransformableElement(target))return;
  lastBlockMutationContext='begin-drag';
  var computed=window.getComputedStyle(target);
  if(computed&&computed.display==='inline'){
    target.style.display='inline-block';
  }
  dragState={
    id:String(target.getAttribute('data-editable-id')||''),
    el:target,
    pointerId:event.pointerId,
    startX:event.clientX,
    startY:event.clientY,
    originTranslate:readTranslateForInteraction(target),
    originRotate:parseRotate(target.style.transform||''),
    lastTranslate:null,
    active:false,
    snapTargets:null
  };
  debugLog('begin-drag',{
    id:String(target.getAttribute('data-editable-id')||''),
    originTranslate:dragState.originTranslate,
    originRotate:dragState.originRotate,
    currentTransform:String(target.style.transform||'')
  });
  if(/^block-/.test(String(target.getAttribute('data-editable-id')||''))){
    logEditableIdMatches(String(target.getAttribute('data-editable-id')||''),'begin-drag');
    startObservedBlockLogging(target,'begin-drag');
    debugLog('block-begin-drag',{
      id:String(target.getAttribute('data-editable-id')||''),
      inlineWidth:String(target.style.width||''),
      inlineHeight:String(target.style.height||''),
      inlineBorderRadius:String(target.style.borderRadius||''),
      rect:target.getBoundingClientRect?{
        width:target.getBoundingClientRect().width,
        height:target.getBoundingClientRect().height,
        left:target.getBoundingClientRect().left,
        top:target.getBoundingClientRect().top
      }:null
    });
  }
  dragPointerId=event.pointerId;
}

function beginResize(handle,event){
  if(!selectedId)return;
  var target=document.querySelector('[data-editable-id="'+CSS.escape(selectedId)+'"]');
  if(!target||!isTransformableElement(target))return;
  var rect=target.getBoundingClientRect();
  resizeState={
    id:selectedId,
    el:target,
    handle:String(handle.getAttribute('data-handle')||'se'),
    pointerId:event.pointerId,
    startX:event.clientX,
    startY:event.clientY,
    startWidth:rect.width,
    startHeight:rect.height,
    originTranslate:readTranslateForInteraction(target),
    originRotate:parseRotate(target.style.transform||''),
    lastTranslate:null,
    lastWidth:rect.width,
    lastHeight:rect.height
  };
  dragPointerId=event.pointerId;
}

function beginRotate(handle,event){
  if(!selectedId)return;
  var target=document.querySelector('[data-editable-id="'+CSS.escape(selectedId)+'"]');
  if(!target||!isTransformableElement(target))return;
  var rect=target.getBoundingClientRect();
  rotateState={
    id:selectedId,
    el:target,
    pointerId:event.pointerId,
    centerX:rect.left+(rect.width/2),
    centerY:rect.top+(rect.height/2),
    startPointerAngle:Math.atan2(event.clientY-(rect.top+rect.height/2),event.clientX-(rect.left+rect.width/2)),
    originTranslate:readTranslateForInteraction(target),
    originRotate:parseRotate(target.style.transform||''),
    lastRotate:parseRotate(target.style.transform||'')
  };
  dragPointerId=event.pointerId;
}

function processDragMove(clientX,clientY,shiftKey){
  if(!dragState)return;
  lastBlockMutationContext='drag-move';
  var dx=clientX-dragState.startX;
  var dy=clientY-dragState.startY;
  if(!dragState.active){
    if(Math.abs(dx)<DRAG_THRESHOLD&&Math.abs(dy)<DRAG_THRESHOLD)return;
    dragState.active=true;
    suppressNextClick=true;
    if(selectedId!==dragState.id)setSelected(dragState.id,false);
    dragState.el.style.cursor='grabbing';
    dragState.el.style.zIndex='9999';
    dragState.el.style.opacity='0.9';
    dragState.snapTargets=getSnapTargets(dragState.el);
  }
  if(shiftKey){
    if(Math.abs(dx)>Math.abs(dy)){
      dy=0;
    }else{
      dx=0;
    }
  }
  var nextX=dragState.originTranslate.x+dx;
  var nextY=dragState.originTranslate.y+dy;
  if(dragState.active){
    debugLog('drag-move',{
      id:dragState.id,
      dx:dx,
      dy:dy,
      nextX:nextX,
      nextY:nextY,
      currentTransform:String(dragState.el&&dragState.el.style&&dragState.el.style.transform||'')
    });
  }
  dragState.lastTranslate={x:nextX,y:nextY};
  applyTransform(dragState.el,nextX,nextY,dragState.originRotate);
  clearGuides();
  if(dragState.snapTargets){
    var elRect=dragState.el.getBoundingClientRect();
    var snap=computeSnap(elRect,dragState.snapTargets);
    if(snap.dx!==0||snap.dy!==0){
      nextX+=snap.dx;
      nextY+=snap.dy;
      dragState.lastTranslate={x:nextX,y:nextY};
      applyTransform(dragState.el,nextX,nextY,dragState.originRotate);
    }
    if(snap.guideX!==null)drawGuide('v',snap.guideX);
    if(snap.guideY!==null)drawGuide('h',snap.guideY);
  }
  updateSelectionOverlay(dragState.el);
}

function handlePointerMove(event){
  if(dragState&&dragState.pointerId===event.pointerId){
    event.preventDefault();
    pendingDragEvent={clientX:event.clientX,clientY:event.clientY,shiftKey:!!event.shiftKey};
    if(!dragRafId){
      dragRafId=requestAnimationFrame(function(){
        dragRafId=null;
        if(pendingDragEvent&&dragState){
          processDragMove(pendingDragEvent.clientX,pendingDragEvent.clientY,pendingDragEvent.shiftKey);
          pendingDragEvent=null;
        }
      });
    }
    return;
  }
  if(resizeState&&resizeState.pointerId===event.pointerId){
    lastBlockMutationContext='resize-move';
    var dx=event.clientX-resizeState.startX;
    var dy=event.clientY-resizeState.startY;
    var width=resizeState.startWidth;
    var height=resizeState.startHeight;
    var tx=resizeState.originTranslate.x;
    var ty=resizeState.originTranslate.y;
    if(resizeState.handle==='se'){
      width=resizeState.startWidth+dx;
      height=resizeState.startHeight+dy;
    }
    if(resizeState.handle==='sw'){
      width=resizeState.startWidth-dx;
      height=resizeState.startHeight+dy;
      tx=resizeState.originTranslate.x+dx;
    }
    if(resizeState.handle==='ne'){
      width=resizeState.startWidth+dx;
      height=resizeState.startHeight-dy;
      ty=resizeState.originTranslate.y+dy;
    }
    if(resizeState.handle==='nw'){
      width=resizeState.startWidth-dx;
      height=resizeState.startHeight-dy;
      tx=resizeState.originTranslate.x+dx;
      ty=resizeState.originTranslate.y+dy;
    }
    width=Math.max(24,width);
    height=Math.max(24,height);
    resizeState.lastTranslate={x:tx,y:ty};
    resizeState.lastWidth=width;
    resizeState.lastHeight=height;
    debugLog('block-width-write',{
      source:'resize-move',
      id:resizeState.id,
      nextWidth:String(Math.round(width))+'px',
      beforeWidth:String(resizeState.el.style.width||''),
      context:lastBlockMutationContext
    });
    debugLog('block-height-write',{
      source:'resize-move',
      id:resizeState.id,
      nextHeight:String(Math.round(height))+'px',
      beforeHeight:String(resizeState.el.style.height||''),
      context:lastBlockMutationContext
    });
    resizeState.el.style.width=String(Math.round(width))+'px';
    resizeState.el.style.height=String(Math.round(height))+'px';
    applyTransform(resizeState.el,tx,ty,resizeState.originRotate);
    updateSelectionOverlay(resizeState.el);
    return;
  }
  if(rotateState&&rotateState.pointerId===event.pointerId){
    lastBlockMutationContext='rotate-move';
    var angle=Math.atan2(event.clientY-rotateState.centerY,event.clientX-rotateState.centerX);
    var degrees=rotateState.originRotate+((angle-rotateState.startPointerAngle)*(180/Math.PI));
    rotateState.lastRotate=degrees;
    applyTransform(rotateState.el,rotateState.originTranslate.x,rotateState.originTranslate.y,degrees);
    updateSelectionOverlay(rotateState.el);
  }
}

function handlePointerUp(event){
  if(dragState&&dragState.pointerId===event.pointerId){
    lastBlockMutationContext='pointer-up-drag';
    if(dragRafId){
      cancelAnimationFrame(dragRafId);
      dragRafId=null;
    }
    if(pendingDragEvent&&dragState){
      processDragMove(pendingDragEvent.clientX,pendingDragEvent.clientY,pendingDragEvent.shiftKey);
      pendingDragEvent=null;
    }
    if(dragState.active){
      clearGuides();
      dragState.el.style.cursor='';
      dragState.el.style.zIndex='';
      dragState.el.style.opacity='';
      debugLog('pointer-up-commit',{
        id:dragState.id,
        finalTransform:String(dragState.el&&dragState.el.style&&dragState.el.style.transform||''),
        finalWidth:String(dragState.el&&dragState.el.style&&dragState.el.style.width||''),
        finalHeight:String(dragState.el&&dragState.el.style&&dragState.el.style.height||'')
      });
      emitTransform(dragState.el,{
        translateX:String(Math.round((dragState.lastTranslate&&dragState.lastTranslate.x)||dragState.originTranslate.x||0))+'px',
        translateY:String(Math.round((dragState.lastTranslate&&dragState.lastTranslate.y)||dragState.originTranslate.y||0))+'px',
        rotate:String(Math.round(dragState.originRotate||0))+'deg'
      });
      if(dragState.id)window.parent.postMessage({type:'${T.elementSelect}',editableId:dragState.id,slideIndex:SLIDE_INDEX},'*');
    }else if(dragState.id){
      setSelected(dragState.id,true);
    }
    stopObservedBlockLoggingSoon('pointer-up-drag');
    dragState=null;
  }
  if(resizeState&&resizeState.pointerId===event.pointerId){
    lastBlockMutationContext='pointer-up-resize';
    emitTransform(resizeState.el,{
      translateX:String(Math.round((resizeState.lastTranslate&&resizeState.lastTranslate.x)||resizeState.originTranslate.x||0))+'px',
      translateY:String(Math.round((resizeState.lastTranslate&&resizeState.lastTranslate.y)||resizeState.originTranslate.y||0))+'px',
      width:String(Math.round(resizeState.lastWidth||0))+'px',
      height:String(Math.round(resizeState.lastHeight||0))+'px',
      rotate:String(Math.round(resizeState.originRotate||0))+'deg'
    });
    stopObservedBlockLoggingSoon('pointer-up-resize');
    resizeState=null;
  }
  if(rotateState&&rotateState.pointerId===event.pointerId){
    lastBlockMutationContext='pointer-up-rotate';
    emitTransform(rotateState.el,{
      translateX:String(Math.round(rotateState.originTranslate.x||0))+'px',
      translateY:String(Math.round(rotateState.originTranslate.y||0))+'px',
      rotate:String(Math.round(rotateState.lastRotate||rotateState.originRotate||0))+'deg'
    });
    stopObservedBlockLoggingSoon('pointer-up-rotate');
    rotateState=null;
  }
  if(dragPointerId===event.pointerId){
    dragPointerId=null;
  }
}

function handlePointerCancel(event){
  lastBlockMutationContext='pointer-cancel';
  if(dragRafId){
    cancelAnimationFrame(dragRafId);
    dragRafId=null;
  }
  pendingDragEvent=null;
  if(dragState&&dragState.pointerId===event.pointerId){
    clearGuides();
    dragState.el.style.cursor='';
    dragState.el.style.zIndex='';
    dragState.el.style.opacity='';
    applyTransform(dragState.el,dragState.originTranslate.x,dragState.originTranslate.y,dragState.originRotate);
    updateSelectionOverlay(dragState.el);
    stopObservedBlockLogging('pointer-cancel-drag');
    dragState=null;
  }
  if(resizeState&&resizeState.pointerId===event.pointerId){
    stopObservedBlockLogging('pointer-cancel-resize');
    resizeState=null;
  }
  if(rotateState&&rotateState.pointerId===event.pointerId){
    stopObservedBlockLogging('pointer-cancel-rotate');
    rotateState=null;
  }
  if(dragPointerId===event.pointerId){
    dragPointerId=null;
  }
}

document.addEventListener('pointerdown',function(event){
  if(event.button!==0)return;
  if(editingId)return;
  var rotateHandle=event.target instanceof Element?event.target.closest('[data-rotate-handle="true"]'):null;
  if(rotateHandle){
    suppressNextClick=true;
    event.preventDefault();
    event.stopPropagation();
    beginRotate(rotateHandle,event);
    return;
  }
  var resizeHandle=event.target instanceof Element?event.target.closest('[data-handle]'):null;
  if(resizeHandle){
    suppressNextClick=true;
    event.preventDefault();
    event.stopPropagation();
    beginResize(resizeHandle,event);
    return;
  }
  var target=getEditable(event.target);
  if(!target)return;
  if(!isTransformableElement(target)){
    var id=target.getAttribute('data-editable-id')||'';
    if(id)setSelected(id,true);
    return;
  }
  beginDrag(target,event);
},true);

document.addEventListener('pointermove',function(event){
  if(dragPointerId==null)return;
  handlePointerMove(event);
},true);

document.addEventListener('pointerup',function(event){
  handlePointerUp(event);
},true);

document.addEventListener('pointercancel',function(event){
  handlePointerCancel(event);
},true);

document.addEventListener('click',function(e){
  if(suppressNextClick){
    suppressNextClick=false;
    e.preventDefault();
    e.stopPropagation();
    return;
  }
  var target=getEditable(e.target);
  if(target){
    return;
  }
  if(!target){
    if(editingId)flushInlineEdit();
    setSelected(null,true);
    return;
  }
},true);

document.addEventListener('dblclick',function(e){
  var target=getEditable(e.target);
  if(!target)return;
  e.preventDefault();
  e.stopPropagation();
  var id=target.getAttribute('data-editable-id')||'';
  if(id!==selectedId)setSelected(id,true);
  startInlineEdit(id);
},true);

document.addEventListener('mouseover',function(e){
  var target=getEditable(e.target);
  if(!target){
    if(hoveredId){
      clearHoverState();
      window.parent.postMessage({type:'${T.elementHover}',editableId:'',slideIndex:SLIDE_INDEX},'*');
    }
    return;
  }
  var id=target.getAttribute('data-editable-id')||'';
  if(!id||id===hoveredId||id===selectedId||id===editingId)return;
  hoveredId=id;
  updateHoverOverlay(target);
  window.parent.postMessage({type:'${T.elementHover}',editableId:id,slideIndex:SLIDE_INDEX},'*');
},true);

document.addEventListener('mouseout',function(e){
  var target=getEditable(e.target);
  if(!target)return;
  var related=getEditable(e.relatedTarget);
  if(related===target)return;
  var id=target.getAttribute('data-editable-id')||'';
  if(id===hoveredId)clearHoverState();
},true);

document.addEventListener('keydown',function(e){
  var isCommand=e.metaKey||e.ctrlKey;
  if(editingId&&e.key==='Escape'){
    e.preventDefault();
    flushInlineEdit();
    return;
  }
  if(selectedId&&!editingId&&e.key==='Escape'){
    e.preventDefault();
    setSelected(null,true);
    return;
  }
  if(editingId)return;
  if(isCommand&&(e.key==='z'||e.key==='Z')&&!e.shiftKey){
    e.preventDefault();
    window.parent.postMessage({type:'${T.requestUndo}',slideIndex:SLIDE_INDEX},'*');
    return;
  }
  if(isCommand&&e.shiftKey&&(e.key==='z'||e.key==='Z')){
    e.preventDefault();
    window.parent.postMessage({type:'${T.requestRedo}',slideIndex:SLIDE_INDEX},'*');
    return;
  }
  if(isCommand&&(e.key==='s'||e.key==='S')){
    e.preventDefault();
    window.parent.postMessage({type:'${T.requestSave}',slideIndex:SLIDE_INDEX},'*');
    return;
  }
  if(selectedId&&(e.key==='Delete'||e.key==='Backspace')){
    e.preventDefault();
    window.parent.postMessage({type:'${T.requestDeleteSelected}',slideIndex:SLIDE_INDEX},'*');
  }
});

document.addEventListener('focusout',function(e){
  if(!editingId)return;
  var target=document.querySelector('[data-editable-id="'+CSS.escape(editingId)+'"]');
  if(target&&!target.contains(e.relatedTarget))flushInlineEdit();
},true);

window.addEventListener('message',function(e){
  if(e.source!==window.parent)return;
  var d=e.data;
  if(!d||typeof d.type!=='string')return;
  if(d.type==='${T.highlight}'){
    if(d.id){
      setSelected(String(d.id),false);
    }else{
      setSelected(null,false);
    }
    return;
  }
  if(d.type==='${T.flushInlineEdit}'){
    flushInlineEdit();
    return;
  }
  if(d.type==='${T.syncDocument}'&&typeof d.srcDoc==='string'){
    syncDocumentStructure(d.srcDoc);
    return;
  }
  if(d.type==='${T.updateElement}'){
    applyElementUpdate(d.element);
    return;
  }
  if(d.type==='${T.updateElements}'&&Array.isArray(d.elements)){
    d.elements.forEach(function(element){applyElementUpdate(element);});
    return;
  }
  if(d.type==='${T.updateFontCss}'&&typeof d.css==='string'){
    var existing=document.getElementById('html-editor-font-css');
    if(existing){
      existing.textContent=d.css.replace(/<\\/?style[^>]*>/gi,'');
    }else{
      var style=document.createElement('style');
      style.id='html-editor-font-css';
      style.textContent=d.css.replace(/<\\/?style[^>]*>/gi,'');
      document.head.appendChild(style);
    }
  }
});

window.addEventListener('resize',function(){
  if(selectedId){
    var target=document.querySelector('[data-editable-id="'+CSS.escape(selectedId)+'"]');
    updateSelectionOverlay(target);
  }
  if(hoveredId&&!selectedId&&!editingId){
    var hovered=document.querySelector('[data-editable-id="'+CSS.escape(hoveredId)+'"]');
    updateHoverOverlay(hovered);
  }
});
})();</script>`;
}

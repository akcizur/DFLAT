// Depth-aware pixel/CRT compositor for Three.js r169.
// The scene is rendered to a WebGLRenderTarget with a DepthTexture, processed by a
// fullscreen ShaderMaterial, then copied to a small Canvas2D presentation buffer.
export function createPixelPostProcess(THREE, renderer) {
  const displayCanvas = document.createElement("canvas");
  displayCanvas.id = "pixelDisplayCanvas";
  displayCanvas.setAttribute("aria-hidden", "true");
  const displayContext = displayCanvas.getContext("2d", { alpha: false, desynchronized: true });
  const fallback = {
    setSize() {}, renderScene(scene, camera) { renderer.render(scene, camera); }, present() {},
    triggerZoom() {}, setProfile() {}, getProfile() { return "off"; },
    setBlur() {}, getBlur() { return { strength: 0, x: 0, y: 0, start: 1.2, end: 3.6 }; },
    profiles: {}, dispose() {}
  };
  if (!displayContext) return fallback;

  const frameCanvas = document.createElement("canvas");
  const frameContext = frameCanvas.getContext("2d", { alpha: false });
  if (!frameContext) return fallback;
  const reducedMotion = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  const lowPower = Boolean(window.matchMedia?.("(pointer: coarse)")?.matches);
  const size = new THREE.Vector2();
  let width = 1, height = 1, hasFrame = false;
  let zoomStart = -1000, zoomAmount = 0;
  let shaderReady = false;
  let shaderDisabled = false;

  const profiles = {
    off: { curvature: 0, chroma: 0, scanline: 0, vignette: 0, noise: 0, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 0 },
    clean: { curvature: .008, chroma: 0, scanline: 0, vignette: .08, noise: .002, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 0 },
    crt: { curvature: .035, chroma: .00035, scanline: .035, vignette: .15, noise: .004, jitter: .00005, interlace: .012, mask: .012, levels: 0, retro: 0 },
    vhs: { curvature: .055, chroma: .0026, scanline: .055, vignette: .18, noise: .035, jitter: .0018, interlace: .075, mask: .015, levels: 0, retro: 0 },
    psx: { curvature: .018, chroma: .0002, scanline: 0, vignette: .09, noise: .002, jitter: 0, interlace: 0, mask: 0, levels: 20, retro: 0 },
    vintage: { curvature: .006, chroma: 0, scanline: 0, vignette: .13, noise: .006, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 1 },
    dos: { curvature: 0, chroma: 0, scanline: 0, vignette: .04, noise: 0, jitter: 0, interlace: 0, mask: 0, levels: 0, retro: 2 }
  };
  let profileName = "dos";

  // WebGLRenderTarget + DepthTexture are intentional: the shader uses real scene depth
  // for a restrained distance blur. This is the same render-target workflow recommended
  // by Three.js for post-processing rather than rendering the scene directly to screen.
  const target = new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, depthBuffer: true, stencilBuffer: false
  });
  target.texture.generateMipmaps = false;
  target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  target.depthTexture.minFilter = THREE.NearestFilter;
  target.depthTexture.magFilter = THREE.NearestFilter;

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture }, tDepth: { value: target.depthTexture },
      resolution: { value: new THREE.Vector2(1, 1) }, cameraNear: { value: .08 }, cameraFar: { value: 70 },
      time: { value: 0 }, curvature: { value: .006 }, chroma: { value: 0 }, scanline: { value: 0 },
      vignette: { value: .04 }, noise: { value: 0 }, jitter: { value: 0 }, interlace: { value: 0 },
      mask: { value: 0 }, levels: { value: 0 }, retro: { value: 2 }, blurStrength: { value: 3.2 },
      blurX: { value: 1 }, blurY: { value: 1 }, blurStart: { value: 1.2 }, blurEnd: { value: 3.6 }
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader: `
      #include <common>
      uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 resolution;
      uniform float cameraNear,cameraFar,time,curvature,chroma,scanline,vignette,noise,jitter,interlace,mask,levels,retro;
      uniform float blurStrength,blurX,blurY,blurStart,blurEnd; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
      float viewDistance(float depth){float z=depth*2.0-1.0;return (2.0*cameraNear*cameraFar)/(cameraFar+cameraNear-z*(cameraFar-cameraNear));}
      vec3 sampleScene(vec2 uv){
        vec2 texel=1.0/resolution; float depth=texture2D(tDepth,uv).x;
        float distanceToCamera=viewDistance(depth);
        float blur=smoothstep(blurStart,blurEnd,distanceToCamera)*blurStrength;
        if(blur<.001||(blurX<.001&&blurY<.001))return texture2D(tDiffuse,uv).rgb;
        vec2 px=texel*blur*vec2(blurX,blurY);
        vec3 color=texture2D(tDiffuse,uv).rgb*.16;
        // Small Gaussian-like kernel: symmetric horizontal, vertical and diagonal taps.
        color+=texture2D(tDiffuse,uv+vec2(px.x,0.0)).rgb*.12+texture2D(tDiffuse,uv-vec2(px.x,0.0)).rgb*.12;
        color+=texture2D(tDiffuse,uv+vec2(px.x*2.0,0.0)).rgb*.06+texture2D(tDiffuse,uv-vec2(px.x*2.0,0.0)).rgb*.06;
        color+=texture2D(tDiffuse,uv+vec2(0.0,px.y)).rgb*.12+texture2D(tDiffuse,uv-vec2(0.0,px.y)).rgb*.12;
        color+=texture2D(tDiffuse,uv+vec2(0.0,px.y*2.0)).rgb*.06+texture2D(tDiffuse,uv-vec2(0.0,px.y*2.0)).rgb*.06;
        color+=texture2D(tDiffuse,uv+vec2(px.x,px.y)).rgb*.025+texture2D(tDiffuse,uv+vec2(-px.x,px.y)).rgb*.025;
        color+=texture2D(tDiffuse,uv+vec2(px.x,-px.y)).rgb*.025+texture2D(tDiffuse,uv+vec2(-px.x,-px.y)).rgb*.025;
        return color;
      }
      void main(){
        vec2 centered=vUv*2.0-1.0; float r2=dot(centered,centered);
        vec2 uv=centered*(1.0+curvature*r2)*.5+.5;
        float lineId=floor(vUv.y*resolution.y); uv.x+=sin(lineId*.37+floor(time*12.0))*jitter;
        float edge=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
        vec2 rgbShift=vec2(chroma*(.35+r2),0.0); vec3 color=sampleScene(clamp(uv,.001,.999));
        if(chroma>0.0){float splitAmount=clamp(chroma*150.0,0.0,.5);color.r=mix(color.r,texture2D(tDiffuse,clamp(uv+rgbShift,.001,.999)).r,splitAmount);color.b=mix(color.b,texture2D(tDiffuse,clamp(uv-rgbShift,.001,.999)).b,splitAmount);}
        float scan=.5+.5*sin(vUv.y*resolution.y*3.14159265); color*=1.0-scanline*scan;
        float field=mod(floor(vUv.y*resolution.y)+floor(time*30.0),2.0); color*=1.0-interlace*field;
        float subpixel=mod(floor(vUv.x*resolution.x),3.0); vec3 maskTint=subpixel<1.0?vec3(1.0,.93,.93):(subpixel<2.0?vec3(.93,1.0,.93):vec3(.93,.93,1.0)); color*=mix(vec3(1.0),maskTint,mask);
        color*=1.0-vignette*smoothstep(.25,1.45,r2); color+=(hash(floor(vUv*resolution)+floor(time*24.0))-.5)*noise;
        if(retro>.5){vec3 faded=mix(color,vec3(.91,.84,.68),.10);faded=(faded-vec3(.025))*.96+vec3(.035,.027,.012);color=mix(color,faded,min(retro,1.0));}
        if(retro>1.5){vec2 cell=mod(floor(vUv*resolution),4.0);float b=mod(cell.x+cell.y*4.0,16.0)/16.0-.5;color.r=floor(clamp(color.r+b/7.0,0.0,1.0)*7.0+.5)/7.0;color.g=floor(clamp(color.g+b/7.0,0.0,1.0)*7.0+.5)/7.0;color.b=floor(clamp(color.b+b/14.0,0.0,1.0)*3.0+.5)/3.0;}
        else if(levels>1.0)color=floor(color*levels+.5)/levels;
        gl_FragColor=vec4(clamp(color,0.0,1.0)*edge,1.0); #include <colorspace_fragment>
      }
    `,
    depthTest: false, depthWrite: false, toneMapped: false
  });
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2,2), postMaterial);
  postScene.add(postQuad);

  displayCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;image-rendering:pixelated;display:block;filter:contrast(1.035) saturate(.84) sepia(.10)";
  const mount = renderer.domElement.parentElement;
  if (mount) mount.appendChild(displayCanvas);
  renderer.domElement.style.position="absolute"; renderer.domElement.style.inset="0"; renderer.domElement.style.zIndex="0"; renderer.domElement.style.opacity="0";
  displayContext.imageSmoothingEnabled=false; frameContext.imageSmoothingEnabled=false;

  function setProfile(name){
    if(!Object.prototype.hasOwnProperty.call(profiles,name))return false;
    profileName=name; const profile={...profiles[name]};
    if(lowPower){profile.noise*=.65;profile.jitter*=.4;profile.mask*=.5;}
    if(reducedMotion){profile.jitter=0;profile.interlace=0;profile.noise*=.45;}
    for(const key of Object.keys(profile))postMaterial.uniforms[key].value=profile[key];
    return true;
  }
  function getProfile(){return profileName;}
  function setBlur(options={}){
    const values={strength:options.strength,x:options.x,y:options.y,start:options.start,end:options.end};
    const limits={strength:[0,5],x:[0,3],y:[0,3],start:[.1,20],end:[.2,30]};
    for(const [key,value] of Object.entries(values)){if(!Number.isFinite(value))continue;const [min,max]=limits[key];const uniform=key==='strength'?'blurStrength':key==='x'?'blurX':key==='y'?'blurY':key==='start'?'blurStart':'blurEnd';postMaterial.uniforms[uniform].value=Math.max(min,Math.min(max,value));}
    if(postMaterial.uniforms.blurEnd.value<=postMaterial.uniforms.blurStart.value)postMaterial.uniforms.blurEnd.value=Math.min(30,postMaterial.uniforms.blurStart.value+.1);
    return getBlur();
  }
  function getBlur(){const u=postMaterial.uniforms;return{strength:u.blurStrength.value,x:u.blurX.value,y:u.blurY.value,start:u.blurStart.value,end:u.blurEnd.value};}
  function setSize(nextWidth,nextHeight){
    width=Math.max(1,Math.floor(nextWidth));height=Math.max(1,Math.floor(nextHeight));
    displayCanvas.width=width;displayCanvas.height=height;frameCanvas.width=width;frameCanvas.height=height;
    target.setSize(width,height);postMaterial.uniforms.resolution.value.set(width,height);
    displayContext.imageSmoothingEnabled=false;frameContext.imageSmoothingEnabled=false;frameContext.fillStyle="#080808";frameContext.fillRect(0,0,width,height);hasFrame=false;
  }

  function copyFrame(){frameContext.clearRect(0,0,width,height);frameContext.drawImage(renderer.domElement,0,0,width,height);hasFrame=true;}
  function renderDirect(scene,camera){renderer.setRenderTarget(null);renderer.clear();renderer.render(scene,camera);copyFrame();}
  function renderScene(scene,camera,timeSeconds=performance.now()/1000){
    postMaterial.uniforms.cameraNear.value=camera.near;postMaterial.uniforms.cameraFar.value=camera.far;postMaterial.uniforms.time.value=timeSeconds;
    if(shaderDisabled||!shaderReady){renderDirect(scene,camera);return;}
    renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.clear();renderer.render(postScene,postCamera);copyFrame();
  }

  // Compile the post-process asynchronously. If a driver rejects the shader, the game
  // remains fully playable using the direct renderer; no black-screen failure is allowed.
  const compile = renderer.compileAsync ? renderer.compileAsync(postScene,postCamera) : Promise.resolve();
  compile.then(()=>{shaderReady=true;}).catch(error=>{shaderDisabled=true;console.warn("The Flat: pixel post-process disabled; using safe direct renderer.",error);});

  function present(timeSeconds=performance.now()/1000){
    if(!hasFrame)return;const elapsed=timeSeconds-zoomStart;const zoom=!reducedMotion&&elapsed>=0&&elapsed<.7?zoomAmount*Math.exp(-elapsed*6)*Math.cos(elapsed*9):0;
    displayContext.setTransform(1,0,0,1,0,0);displayContext.clearRect(0,0,width,height);displayContext.save();
    if(zoom!==0){const scale=1+zoom;displayContext.translate(width/2,height/2);displayContext.scale(scale,scale);displayContext.translate(-width/2,-height/2);}
    displayContext.drawImage(frameCanvas,0,0,width,height);displayContext.restore();
  }
  function triggerZoom(amount=.025){if(reducedMotion)return;zoomAmount=Math.max(-.04,Math.min(.04,amount));zoomStart=performance.now()/1000;}
  function dispose(){displayCanvas.remove();target.dispose();postMaterial.dispose();postQuad.geometry.dispose();renderer.domElement.style.opacity="";renderer.domElement.style.position="";renderer.domElement.style.inset="";renderer.domElement.style.zIndex="";}

  const params=new URLSearchParams(window.location.search);const requestedProfile=params.get("fx");setProfile(requestedProfile&&profiles[requestedProfile]?requestedProfile:"dos");
  const numberParam=name=>{const raw=params.get(name);if(raw===null||raw.trim()==="")return undefined;const value=Number(raw);return Number.isFinite(value)?value:undefined;};
  setBlur({strength:numberParam("blur"),x:numberParam("blurX"),y:numberParam("blurY"),start:numberParam("blurStart"),end:numberParam("blurEnd")});
  renderer.getSize(size);setSize(size.x,size.y);
  return {setSize,renderScene,present,triggerZoom,setProfile,getProfile,profiles,setBlur,getBlur,dispose};
}

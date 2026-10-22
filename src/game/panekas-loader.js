// Minimal GLB 2.0 loader for the supplied Blender export (no external textures are embedded).
function decompressGzip(input) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser does not support gzip stream decompression.");
  return new Response(new Blob([input]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}
function readAccessor(gltf, binary, accessorIndex) {
  const accessor=gltf.accessors[accessorIndex], bufferView=gltf.bufferViews[accessor.bufferView];
  const bytesPerComponent=accessor.componentType===5126||accessor.componentType===5125?4:accessor.componentType===5123?2:accessor.componentType===5121?1:0;
  if(!bytesPerComponent) throw new Error("Unsupported GLB accessor component type: "+accessor.componentType);
  const components=accessor.type==="VEC3"?3:accessor.type==="VEC2"?2:accessor.type==="VEC4"?4:1;
  const start=(bufferView.byteOffset||0)+(accessor.byteOffset||0),end=start+accessor.count*components*bytesPerComponent;
  if(end>binary.byteLength) throw new Error("GLB accessor exceeds its binary buffer.");
  const copy=binary.slice(start,end);
  if(accessor.componentType===5126)return new Float32Array(copy);
  if(accessor.componentType===5125)return new Uint32Array(copy);
  if(accessor.componentType===5123)return new Uint16Array(copy);
  return new Uint8Array(copy);
}
function parseGlb(input) {
  const view=new DataView(input);
  if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67)throw new Error("Invalid GLB header.");
  if(view.getUint32(4,true)!==2)throw new Error("Only GLB version 2 is supported.");
  const totalLength=view.getUint32(8,true);
  if(totalLength>input.byteLength)throw new Error("GLB file is truncated.");
  let offset=12,json=null,binary=null;
  while(offset+8<=totalLength) {
    const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
    if(offset+length>totalLength)throw new Error("GLB chunk is truncated.");
    const chunk=input.slice(offset,offset+length);
    if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(chunk).replace(/[\u0000\u0020]+$/,""));
    else if(type===0x004e4942)binary=chunk;
    offset+=length;
  }
  if(!json||!binary||!json.meshes||!json.nodes)throw new Error("GLB is missing required scene data.");
  if(json.buffers?.[0]?.byteLength>binary.byteLength)throw new Error("GLB binary payload is incomplete.");
  return {json,binary};
}
function materialFromGltf(THREE,definition) {
  const pbr=definition.pbrMetallicRoughness||{},factor=pbr.baseColorFactor||[0.8,0.8,0.8,1];
  const color=new THREE.Color().setRGB(factor[0],factor[1],factor[2],THREE.LinearSRGBColorSpace);
  const transparent=definition.alphaMode==="BLEND"||factor[3]<0.999;
  return new THREE.MeshStandardMaterial({name:definition.name||"Panekas material",color,roughness:pbr.roughnessFactor??0.8,metalness:pbr.metallicFactor??0,opacity:factor[3],transparent,depthWrite:!transparent,side:definition.doubleSided?THREE.DoubleSide:THREE.FrontSide});
}
function buildScene(THREE,gltf,binary) {
  const materials=(gltf.materials||[]).map(m=>materialFromGltf(THREE,m));
  const root=new THREE.Group();root.name="Panekas / Blender export";
  for(const node of gltf.nodes) {
    if(node.mesh===undefined)continue;
    const meshDef=gltf.meshes[node.mesh],nodeGroup=new THREE.Group();nodeGroup.name=node.name||meshDef.name||"Panekas part";
    for(const primitive of meshDef.primitives||[]) {
      const positionIndex=primitive.attributes?.POSITION;if(positionIndex===undefined)continue;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute("position",new THREE.BufferAttribute(readAccessor(gltf,binary,positionIndex),3));
      if(primitive.attributes?.NORMAL!==undefined)geometry.setAttribute("normal",new THREE.BufferAttribute(readAccessor(gltf,binary,primitive.attributes.NORMAL),3));else geometry.computeVertexNormals();
      if(primitive.indices!==undefined)geometry.setIndex(new THREE.BufferAttribute(readAccessor(gltf,binary,primitive.indices),1));
      const material=materials[primitive.material??0]||new THREE.MeshStandardMaterial({color:0x8b8b84,roughness:0.9});
      const part=new THREE.Mesh(geometry,material);part.name=nodeGroup.name+(material.name?" / "+material.name:"");part.castShadow=true;part.receiveShadow=true;nodeGroup.add(part);
    }
    root.add(nodeGroup);
  }
  return root;
}
export async function loadPanekasModel({THREE,url}) {
  const response=await fetch(url);if(!response.ok)throw new Error("Model request failed with HTTP "+response.status);
  const compressed=await response.arrayBuffer(),raw=await decompressGzip(compressed),parsed=parseGlb(raw);
  return buildScene(THREE,parsed.json,parsed.binary);
}

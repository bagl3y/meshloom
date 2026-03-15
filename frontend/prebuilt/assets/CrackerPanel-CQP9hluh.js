import{o as tr,p as yt,q as lr,u as wt,v as nt,w as rr,x as ar,y as hr,r as H,_ as fr,t as dt,z as gr,k as Ct,j as M,l as mr}from"./index-CyRLXsJ_.js";var Se={},Fe={},ie={},St;function ve(){if(St)return ie;St=1,Object.defineProperty(ie,"__esModule",{value:!0}),ie.RequestType=ie.AdvertFlags=ie.DeviceRole=ie.PayloadVersion=ie.ControlSubType=ie.PayloadType=ie.RouteType=void 0;var t;(function(e){e[e.TransportFlood=0]="TransportFlood",e[e.Flood=1]="Flood",e[e.Direct=2]="Direct",e[e.TransportDirect=3]="TransportDirect"})(t||(ie.RouteType=t={}));var o;(function(e){e[e.Request=0]="Request",e[e.Response=1]="Response",e[e.TextMessage=2]="TextMessage",e[e.Ack=3]="Ack",e[e.Advert=4]="Advert",e[e.GroupText=5]="GroupText",e[e.GroupData=6]="GroupData",e[e.AnonRequest=7]="AnonRequest",e[e.Path=8]="Path",e[e.Trace=9]="Trace",e[e.Multipart=10]="Multipart",e[e.Control=11]="Control",e[e.RawCustom=15]="RawCustom"})(o||(ie.PayloadType=o={}));var c;(function(e){e[e.NodeDiscoverReq=128]="NodeDiscoverReq",e[e.NodeDiscoverResp=144]="NodeDiscoverResp"})(c||(ie.ControlSubType=c={}));var l;(function(e){e[e.Version1=0]="Version1",e[e.Version2=1]="Version2",e[e.Version3=2]="Version3",e[e.Version4=3]="Version4"})(l||(ie.PayloadVersion=l={}));var n;(function(e){e[e.Unknown=0]="Unknown",e[e.ChatNode=1]="ChatNode",e[e.Repeater=2]="Repeater",e[e.RoomServer=3]="RoomServer",e[e.Sensor=4]="Sensor"})(n||(ie.DeviceRole=n={}));var r;(function(e){e[e.HasLocation=16]="HasLocation",e[e.HasFeature1=32]="HasFeature1",e[e.HasFeature2=64]="HasFeature2",e[e.HasName=128]="HasName"})(r||(ie.AdvertFlags=r={}));var a;return(function(e){e[e.GetStats=1]="GetStats",e[e.Keepalive=2]="Keepalive",e[e.GetTelemetryData=3]="GetTelemetryData",e[e.GetMinMaxAvgData=4]="GetMinMaxAvgData",e[e.GetAccessList=5]="GetAccessList"})(a||(ie.RequestType=a={})),ie}var Ie={},kt;function oe(){if(kt)return Ie;kt=1,Object.defineProperty(Ie,"__esModule",{value:!0}),Ie.byteToHex=t,Ie.bytesToHex=o,Ie.numberToHex=c,Ie.hexToBytes=l;function t(n){return n.toString(16).padStart(2,"0").toUpperCase()}function o(n){return Array.from(n).map(t).join("")}function c(n,r=8){return(n>>>0).toString(16).padStart(r,"0").toUpperCase()}function l(n){const r=n.replace(/\s/g,"").toUpperCase();if(!/^[0-9A-F]*$/.test(r))throw new Error("Invalid hex string: invalid characters at position 0");if(r.length%2!==0)throw new Error("Invalid hex string: odd length");const a=new Uint8Array(r.length/2);for(let e=0;e<r.length;e+=2)a[e/2]=parseInt(r.substr(e,2),16);return a}return Ie}var ke={},Tt;function $e(){if(Tt)return ke;Tt=1,Object.defineProperty(ke,"__esModule",{value:!0}),ke.getRouteTypeName=o,ke.getPayloadTypeName=c,ke.getPayloadVersionName=l,ke.getDeviceRoleName=n,ke.getRequestTypeName=r,ke.getControlSubTypeName=a;const t=ve();function o(e){switch(e){case t.RouteType.Flood:return"Flood";case t.RouteType.Direct:return"Direct";case t.RouteType.TransportFlood:return"TransportFlood";case t.RouteType.TransportDirect:return"TransportDirect";default:return`Unknown (${e})`}}function c(e){switch(e){case t.PayloadType.RawCustom:return"RawCustom";case t.PayloadType.Trace:return"Trace";case t.PayloadType.Advert:return"Advert";case t.PayloadType.GroupText:return"GroupText";case t.PayloadType.GroupData:return"GroupData";case t.PayloadType.Request:return"Request";case t.PayloadType.Response:return"Response";case t.PayloadType.TextMessage:return"TextMessage";case t.PayloadType.AnonRequest:return"AnonRequest";case t.PayloadType.Ack:return"Ack";case t.PayloadType.Path:return"Path";case t.PayloadType.Multipart:return"Multipart";case t.PayloadType.Control:return"Control";default:return`Unknown (0x${e.toString(16)})`}}function l(e){switch(e){case t.PayloadVersion.Version1:return"Version 1";case t.PayloadVersion.Version2:return"Version 2";case t.PayloadVersion.Version3:return"Version 3";case t.PayloadVersion.Version4:return"Version 4";default:return`Unknown (${e})`}}function n(e){switch(e){case t.DeviceRole.Unknown:return"Unknown";case t.DeviceRole.ChatNode:return"Chat Node";case t.DeviceRole.Repeater:return"Repeater";case t.DeviceRole.RoomServer:return"Room Server";case t.DeviceRole.Sensor:return"Sensor";default:return`Unknown (${e})`}}function r(e){switch(e){case t.RequestType.GetStats:return"Get Stats";case t.RequestType.Keepalive:return"Keepalive (deprecated)";case t.RequestType.GetTelemetryData:return"Get Telemetry Data";case t.RequestType.GetMinMaxAvgData:return"Get Min/Max/Avg Data";case t.RequestType.GetAccessList:return"Get Access List";default:return`Unknown (${e})`}}function a(e){switch(e){case t.ControlSubType.NodeDiscoverReq:return"Node Discover Request";case t.ControlSubType.NodeDiscoverResp:return"Node Discover Response";default:return`Unknown (0x${e.toString(16)})`}}return ke}var Ue={},Ge={},Pt;function xt(){if(Pt)return Ge;Pt=1,Object.defineProperty(Ge,"__esModule",{value:!0}),Ge.ChannelCrypto=void 0;const t=tr(),o=oe();class c{static decryptGroupTextMessage(n,r,a){try{const e=(0,o.hexToBytes)(a),A=(0,o.hexToBytes)(r),s=new Uint8Array(32);s.set(e,0);const i=(0,t.HmacSHA256)(t.enc.Hex.parse(n),t.enc.Hex.parse((0,o.bytesToHex)(s))),f=(0,o.hexToBytes)(i.toString(t.enc.Hex)).slice(0,2);if(f[0]!==A[0]||f[1]!==A[1])return{success:!1,error:"MAC verification failed"};const y=t.enc.Hex.parse(a),b=t.enc.Hex.parse(n),S=t.AES.decrypt(t.lib.CipherParams.create({ciphertext:b}),y,{mode:t.mode.ECB,padding:t.pad.NoPadding}),h=(0,o.hexToBytes)(S.toString(t.enc.Hex));if(!h||h.length<5)return{success:!1,error:"Decrypted content too short"};const d=h[0]|h[1]<<8|h[2]<<16|h[3]<<24,x=h[4],g=h.slice(5);let m=new TextDecoder("utf-8").decode(g);const E=m.indexOf("\0");E>=0&&(m=m.substring(0,E));const T=m.indexOf(": ");let C,I;if(T>0&&T<50){const F=m.substring(0,T);/[:\[\]]/.test(F)?I=m:(C=F,I=m.substring(T+2))}else I=m;return{success:!0,data:{timestamp:d,flags:x,sender:C,message:I}}}catch(e){return{success:!1,error:e instanceof Error?e.message:"Decryption failed"}}}static calculateChannelHash(n){const r=(0,t.SHA256)(t.enc.Hex.parse(n));return(0,o.hexToBytes)(r.toString(t.enc.Hex))[0].toString(16).padStart(2,"0")}}return Ge.ChannelCrypto=c,Ge}var Rt;function Ar(){if(Rt)return Ue;Rt=1,Object.defineProperty(Ue,"__esModule",{value:!0}),Ue.MeshCoreKeyStore=void 0;const t=xt();class o{constructor(l){this.nodeKeys=new Map,this.channelHashToKeys=new Map,l!=null&&l.channelSecrets&&this.addChannelSecrets(l.channelSecrets),l!=null&&l.nodeKeys&&Object.entries(l.nodeKeys).forEach(([n,r])=>{this.addNodeKey(n,r)})}addNodeKey(l,n){const r=l.toUpperCase();this.nodeKeys.set(r,n)}hasChannelKey(l){const n=l.toLowerCase();return this.channelHashToKeys.has(n)}hasNodeKey(l){const n=l.toUpperCase();return this.nodeKeys.has(n)}getChannelKeys(l){const n=l.toLowerCase();return this.channelHashToKeys.get(n)||[]}getNodeKey(l){const n=l.toUpperCase();return this.nodeKeys.get(n)}addChannelSecrets(l){for(const n of l){const r=t.ChannelCrypto.calculateChannelHash(n).toLowerCase();this.channelHashToKeys.has(r)||this.channelHashToKeys.set(r,[]),this.channelHashToKeys.get(r).push(n)}}}return Ue.MeshCoreKeyStore=o,Ue}var Qe={},_e={},De={},lt={exports:{}},Et;function yr(){return Et||(Et=1,(function(t,o){var c=(()=>{var n;var l=typeof document<"u"?(n=document.currentScript)==null?void 0:n.src:void 0;return(async function(r={}){var Bt;var a,e=r,A=typeof window=="object",s=typeof WorkerGlobalScope<"u",i=typeof process=="object"&&((Bt=process.versions)==null?void 0:Bt.node)&&process.type!="renderer";typeof __filename<"u"?l=__filename:s&&(l=self.location.href);var u="";function f(p){return e.locateFile?e.locateFile(p,u):u+p}var y,b;if(i){var S=yt;u=__dirname+"/",b=p=>{p=g(p)?new URL(p):p;var B=S.readFileSync(p);return B},y=async(p,B=!0)=>{p=g(p)?new URL(p):p;var k=S.readFileSync(p,B?void 0:"utf8");return k},process.argv.length>1&&process.argv[1].replace(/\\/g,"/"),process.argv.slice(2)}else if(A||s){try{u=new URL(".",l).href}catch{}s&&(b=p=>{var B=new XMLHttpRequest;return B.open("GET",p,!1),B.responseType="arraybuffer",B.send(null),new Uint8Array(B.response)}),y=async p=>{if(g(p))return new Promise((k,K)=>{var N=new XMLHttpRequest;N.open("GET",p,!0),N.responseType="arraybuffer",N.onload=()=>{if(N.status==200||N.status==0&&N.response){k(N.response);return}K(N.status)},N.onerror=K,N.send(null)});var B=await fetch(p,{credentials:"same-origin"});if(B.ok)return B.arrayBuffer();throw new Error(B.status+" : "+B.url)}}console.log.bind(console);var h=console.error.bind(console),d,x=!1,g=p=>p.startsWith("file://"),w,m,E,T,C,I=!1;function F(){var p=E.buffer;e.HEAP8=T=new Int8Array(p),e.HEAPU8=C=new Uint8Array(p),e.HEAP32=new Int32Array(p),e.HEAPU32=new Uint32Array(p),new BigInt64Array(p),new BigUint64Array(p)}function ce(){if(e.preRun)for(typeof e.preRun=="function"&&(e.preRun=[e.preRun]);e.preRun.length;)re(e.preRun.shift());R(G)}function D(){I=!0,He.b()}function $(){if(e.postRun)for(typeof e.postRun=="function"&&(e.postRun=[e.postRun]);e.postRun.length;)O(e.postRun.shift());R(P)}var J=0,ae=null;function le(p){var B;J++,(B=e.monitorRunDependencies)==null||B.call(e,J)}function Q(p){var k;if(J--,(k=e.monitorRunDependencies)==null||k.call(e,J),J==0&&ae){var B=ae;ae=null,B()}}function he(p){var k;(k=e.onAbort)==null||k.call(e,p),p="Aborted("+p+")",h(p),x=!0,p+=". Build with -sASSERTIONS for more info.";var B=new WebAssembly.RuntimeError(p);throw m==null||m(B),B}var L;function Z(){return f("orlp-ed25519.wasm")}function ye(p){if(p==L&&d)return new Uint8Array(d);if(b)return b(p);throw"both async and sync fetching of the wasm failed"}async function Be(p){if(!d)try{var B=await y(p);return new Uint8Array(B)}catch{}return ye(p)}async function Te(p,B){try{var k=await Be(p),K=await WebAssembly.instantiate(k,B);return K}catch(N){h(`failed to asynchronously prepare wasm: ${N}`),he(N)}}async function v(p,B,k){if(!p&&typeof WebAssembly.instantiateStreaming=="function"&&!g(B)&&!i)try{var K=fetch(B,{credentials:"same-origin"}),N=await WebAssembly.instantiateStreaming(K,k);return N}catch(z){h(`wasm streaming compile failed: ${z}`),h("falling back to ArrayBuffer instantiation")}return Te(B,k)}function ee(){return{a:tt}}async function ge(){function p(z,W){return He=z.exports,E=He.a,F(),et(He),Q(),He}le();function B(z){return p(z.instance)}var k=ee();if(e.instantiateWasm)return new Promise((z,W)=>{e.instantiateWasm(k,(te,Pe)=>{z(p(te))})});L??(L=Z());var K=await v(d,L,k),N=B(K);return N}var R=p=>{for(;p.length>0;)p.shift()(e)},P=[],O=p=>P.push(p),G=[],re=p=>G.push(p),X=p=>q(p),pe=()=>Ce(),ue=p=>{var B=e["_"+p];return B},Ae=(p,B)=>{T.set(p,B)},fe=p=>{for(var B=0,k=0;k<p.length;++k){var K=p.charCodeAt(k);K<=127?B++:K<=2047?B+=2:K>=55296&&K<=57343?(B+=4,++k):B+=3}return B},_=(p,B,k,K)=>{if(!(K>0))return 0;for(var N=k,z=k+K-1,W=0;W<p.length;++W){var te=p.codePointAt(W);if(te<=127){if(k>=z)break;B[k++]=te}else if(te<=2047){if(k+1>=z)break;B[k++]=192|te>>6,B[k++]=128|te&63}else if(te<=65535){if(k+2>=z)break;B[k++]=224|te>>12,B[k++]=128|te>>6&63,B[k++]=128|te&63}else{if(k+3>=z)break;B[k++]=240|te>>18,B[k++]=128|te>>12&63,B[k++]=128|te>>6&63,B[k++]=128|te&63,W++}}return B[k]=0,k-N},V=(p,B,k)=>_(p,C,B,k),U=p=>we(p),me=p=>{var B=fe(p)+1,k=U(B);return V(p,k,B),k},de=typeof TextDecoder<"u"?new TextDecoder:void 0,se=(p,B=0,k=NaN)=>{for(var K=B+k,N=B;p[N]&&!(N>=K);)++N;if(N-B>16&&p.buffer&&de)return de.decode(p.subarray(B,N));for(var z="";B<N;){var W=p[B++];if(!(W&128)){z+=String.fromCharCode(W);continue}var te=p[B++]&63;if((W&224)==192){z+=String.fromCharCode((W&31)<<6|te);continue}var Pe=p[B++]&63;if((W&240)==224?W=(W&15)<<12|te<<6|Pe:W=(W&7)<<18|te<<12|Pe<<6|p[B++]&63,W<65536)z+=String.fromCharCode(W);else{var Re=W-65536;z+=String.fromCharCode(55296|Re>>10,56320|Re&1023)}}return z},Y=(p,B)=>p?se(C,p,B):"",j=(p,B,k,K,N)=>{var z={string:be=>{var Ve=0;return be!=null&&be!==0&&(Ve=me(be)),Ve},array:be=>{var Ve=U(be.length);return Ae(be,Ve),Ve}};function W(be){return B==="string"?Y(be):B==="boolean"?!!be:be}var te=ue(p),Pe=[],Re=0;if(K)for(var Ee=0;Ee<K.length;Ee++){var _t=z[k[Ee]];_t?(Re===0&&(Re=pe()),Pe[Ee]=_t(K[Ee])):Pe[Ee]=K[Ee]}var ut=te(...Pe);function dr(be){return Re!==0&&X(Re),W(be)}return ut=dr(ut),ut},ne=(p,B,k,K)=>{var N=!k||k.every(W=>W==="number"||W==="boolean"),z=B!=="string";return z&&N&&!K?ue(p):(...W)=>j(p,B,k,W)};e.noExitRuntime&&e.noExitRuntime,e.print&&e.print,e.printErr&&(h=e.printErr),e.wasmBinary&&(d=e.wasmBinary),e.arguments&&e.arguments,e.thisProgram&&e.thisProgram,e.ccall=j,e.cwrap=ne;var q,we,Ce;function et(p){e._orlp_derive_public_key=p.c,e._orlp_validate_keypair=p.d,e._orlp_sign=p.e,e._orlp_verify=p.f,q=p.g,we=p.h,Ce=p.i}var tt={},He=await ge();function ct(){if(J>0){ae=ct;return}if(ce(),J>0){ae=ct;return}function p(){var B;e.calledRun=!0,!x&&(D(),w==null||w(e),(B=e.onRuntimeInitialized)==null||B.call(e),$())}e.setStatus?(e.setStatus("Running..."),setTimeout(()=>{setTimeout(()=>e.setStatus(""),1),p()},1)):p()}function ur(){if(e.preInit)for(typeof e.preInit=="function"&&(e.preInit=[e.preInit]);e.preInit.length>0;)e.preInit.shift()()}return ur(),ct(),I?a=e:a=new Promise((p,B)=>{w=p,m=B}),a})})();t.exports=c,t.exports.default=c})(lt)),lt.exports}var It;function vt(){if(It)return De;It=1,Object.defineProperty(De,"__esModule",{value:!0}),De.derivePublicKey=l,De.validateKeyPair=n,De.sign=r,De.verify=a;const t=oe(),o=yr();async function c(){return await o()}async function l(e){const A=await c(),s=(0,t.hexToBytes)(e);if(s.length!==64)throw new Error(`Invalid private key length: expected 64 bytes, got ${s.length}`);const i=1024,u=1088;if(A.HEAPU8.set(s,i),A.ccall("orlp_derive_public_key","number",["number","number"],[u,i])!==0)throw new Error("orlp key derivation failed: invalid private key");const y=new Uint8Array(32);return y.set(A.HEAPU8.subarray(u,u+32)),(0,t.bytesToHex)(y)}async function n(e,A){try{const s=await c(),i=(0,t.hexToBytes)(e),u=(0,t.hexToBytes)(A);if(i.length!==64||u.length!==32)return!1;const f=2048,y=2112;return s.HEAPU8.set(i,f),s.HEAPU8.set(u,y),s.ccall("orlp_validate_keypair","number",["number","number"],[y,f])===1}catch{return!1}}async function r(e,A,s){const i=await c(),u=(0,t.hexToBytes)(e),f=(0,t.hexToBytes)(A),y=(0,t.hexToBytes)(s);if(f.length!==64)throw new Error(`Invalid private key length: expected 64 bytes, got ${f.length}`);if(y.length!==32)throw new Error(`Invalid public key length: expected 32 bytes, got ${y.length}`);const b=1e5,S=2e5,h=3e5,d=4e5;i.HEAPU8.set(u,b),i.HEAPU8.set(f,S),i.HEAPU8.set(y,h),i.ccall("orlp_sign","void",["number","number","number","number","number"],[d,b,u.length,h,S]);const x=new Uint8Array(64);return x.set(i.HEAPU8.subarray(d,d+64)),(0,t.bytesToHex)(x)}async function a(e,A,s){try{const i=await c(),u=(0,t.hexToBytes)(e),f=(0,t.hexToBytes)(A),y=(0,t.hexToBytes)(s);if(u.length!==64||y.length!==32)return!1;const b=5e5,S=6e5,h=7e5;return i.HEAPU8.set(u,S),i.HEAPU8.set(f,b),i.HEAPU8.set(y,h),i.ccall("orlp_verify","number",["number","number","number","number"],[S,b,f.length,h])===1}catch{return!1}}return De}var Dt;function sr(){if(Dt)return _e;Dt=1;var t=_e&&_e.__createBinding||(Object.create?(function(s,i,u,f){f===void 0&&(f=u);var y=Object.getOwnPropertyDescriptor(i,u);(!y||("get"in y?!i.__esModule:y.writable||y.configurable))&&(y={enumerable:!0,get:function(){return i[u]}}),Object.defineProperty(s,f,y)}):(function(s,i,u,f){f===void 0&&(f=u),s[f]=i[u]})),o=_e&&_e.__setModuleDefault||(Object.create?(function(s,i){Object.defineProperty(s,"default",{enumerable:!0,value:i})}):function(s,i){s.default=i}),c=_e&&_e.__importStar||(function(){var s=function(i){return s=Object.getOwnPropertyNames||function(u){var f=[];for(var y in u)Object.prototype.hasOwnProperty.call(u,y)&&(f[f.length]=y);return f},s(i)};return function(i){if(i&&i.__esModule)return i;var u={};if(i!=null)for(var f=s(i),y=0;y<f.length;y++)f[y]!=="default"&&t(u,i,f[y]);return o(u,i),u}})();Object.defineProperty(_e,"__esModule",{value:!0}),_e.Ed25519SignatureVerifier=void 0;const l=c(lr),n=oe(),r=vt();async function a(s){if(typeof globalThis<"u"&&globalThis.crypto&&globalThis.crypto.subtle){const i=await globalThis.crypto.subtle.digest("SHA-512",s);return new Uint8Array(i)}if(typeof wt<"u")try{const{createHash:i}=yt;return i("sha512").update(s).digest()}catch{}throw new Error("No SHA-512 implementation available")}function e(s){if(typeof wt<"u")try{const{createHash:i}=yt;return i("sha512").update(s).digest()}catch{}try{const i=tr(),u=i.lib.WordArray.create(s),f=i.SHA512(u),y=new Uint8Array(64);for(let b=0;b<16;b++){const S=f.words[b]||0;y[b*4]=S>>>24&255,y[b*4+1]=S>>>16&255,y[b*4+2]=S>>>8&255,y[b*4+3]=S&255}return y}catch{throw new Error("No SHA-512 implementation available for synchronous operation")}}l.etc.sha512Async=a;try{l.etc.sha512Sync=e}catch(s){console.debug("Could not set up synchronous SHA-512:",s)}class A{static async verifyAdvertisementSignature(i,u,f,y){try{const b=(0,n.hexToBytes)(i),S=(0,n.hexToBytes)(u),h=(0,n.hexToBytes)(y),d=this.constructAdvertSignedMessage(i,f,h);return await l.verify(S,d,b)}catch(b){return console.error("Ed25519 signature verification failed:",b),!1}}static constructAdvertSignedMessage(i,u,f){const y=(0,n.hexToBytes)(i),b=new Uint8Array(4);b[0]=u&255,b[1]=u>>8&255,b[2]=u>>16&255,b[3]=u>>24&255;const S=new Uint8Array(36+f.length);return S.set(y,0),S.set(b,32),S.set(f,36),S}static getSignedMessageDescription(i,u,f){return`Public Key: ${i} + Timestamp: ${u} (${new Date(u*1e3).toISOString()}) + App Data: ${f}`}static getSignedMessageHex(i,u,f){const y=(0,n.hexToBytes)(f),b=this.constructAdvertSignedMessage(i,u,y);return(0,n.bytesToHex)(b)}static async derivePublicKey(i){try{const u=(0,n.hexToBytes)(i);if(u.length!==64)throw new Error(`Invalid private key length: expected 64 bytes, got ${u.length}`);return await(0,r.derivePublicKey)(i)}catch(u){throw new Error(`Failed to derive public key: ${u instanceof Error?u.message:"Unknown error"}`)}}static derivePublicKeySync(i){try{const u=(0,n.hexToBytes)(i);throw u.length!==64?new Error(`Invalid private key length: expected 64 bytes, got ${u.length}`):new Error("Synchronous key derivation not supported with WASM. Use derivePublicKey() instead.")}catch(u){throw new Error(`Failed to derive public key: ${u instanceof Error?u.message:"Unknown error"}`)}}static async validateKeyPair(i,u){try{return await(0,r.validateKeyPair)(i,u)}catch{return!1}}}return _e.Ed25519SignatureVerifier=A,_e}var Mt;function pr(){if(Mt)return Qe;Mt=1,Object.defineProperty(Qe,"__esModule",{value:!0}),Qe.AdvertPayloadDecoder=void 0;const t=ve(),o=oe(),c=$e(),l=sr();class n{static decode(a,e){try{if(a.length<101){const d={type:t.PayloadType.Advert,version:t.PayloadVersion.Version1,isValid:!1,errors:["Advertisement payload too short"],publicKey:"",timestamp:0,signature:"",appData:{flags:0,deviceRole:t.DeviceRole.ChatNode,hasLocation:!1,hasName:!1}};return e!=null&&e.includeSegments&&(d.segments=[{name:"Invalid Advert Data",description:"Advert payload too short (minimum 101 bytes required)",startByte:e.segmentOffset||0,endByte:(e.segmentOffset||0)+a.length-1,value:(0,o.bytesToHex)(a)}]),d}const A=[],s=(e==null?void 0:e.segmentOffset)||0;let i=0;const u=(0,o.bytesToHex)(a.subarray(i,i+32));e!=null&&e.includeSegments&&A.push({name:"Public Key",description:"Ed25519 public key",startByte:s+i,endByte:s+i+31,value:u}),i+=32;const f=this.readUint32LE(a,i);if(e!=null&&e.includeSegments){const d=new Date(f*1e3);A.push({name:"Timestamp",description:`${f} (${d.toISOString().slice(0,19)}Z)`,startByte:s+i,endByte:s+i+3,value:(0,o.bytesToHex)(a.subarray(i,i+4))})}i+=4;const y=(0,o.bytesToHex)(a.subarray(i,i+64));e!=null&&e.includeSegments&&A.push({name:"Signature",description:"Ed25519 signature",startByte:s+i,endByte:s+i+63,value:y}),i+=64;const b=a[i];if(e!=null&&e.includeSegments){const d=b.toString(2).padStart(8,"0"),x=this.parseDeviceRole(b),w=` | Bits 0-3 (Role): ${(0,c.getDeviceRoleName)(x)} | Bit 4 (Location): ${b&t.AdvertFlags.HasLocation?"Yes":"No"} | Bit 7 (Name): ${b&t.AdvertFlags.HasName?"Yes":"No"}`;A.push({name:"App Flags",description:`Binary: ${d}${w}`,startByte:s+i,endByte:s+i,value:b.toString(16).padStart(2,"0").toUpperCase()})}i+=1;const S={type:t.PayloadType.Advert,version:t.PayloadVersion.Version1,isValid:!0,publicKey:u,timestamp:f,signature:y,appData:{flags:b,deviceRole:this.parseDeviceRole(b),hasLocation:!!(b&t.AdvertFlags.HasLocation),hasName:!!(b&t.AdvertFlags.HasName)}};let h=i;if(b&t.AdvertFlags.HasLocation&&a.length>=h+8){const d=this.readInt32LE(a,h)/1e6,x=this.readInt32LE(a,h+4)/1e6;S.appData.location={latitude:Math.round(d*1e6)/1e6,longitude:Math.round(x*1e6)/1e6},e!=null&&e.includeSegments&&(A.push({name:"Latitude",description:`${d}° (${d})`,startByte:s+h,endByte:s+h+3,value:(0,o.bytesToHex)(a.subarray(h,h+4))}),A.push({name:"Longitude",description:`${x}° (${x})`,startByte:s+h+4,endByte:s+h+7,value:(0,o.bytesToHex)(a.subarray(h+4,h+8))})),h+=8}if(b&t.AdvertFlags.HasFeature1&&(h+=2),b&t.AdvertFlags.HasFeature2&&(h+=2),b&t.AdvertFlags.HasName&&a.length>h){const d=a.subarray(h),x=new TextDecoder("utf-8").decode(d).replace(/\0.*$/,"");S.appData.name=this.sanitizeControlCharacters(x)||x,e!=null&&e.includeSegments&&A.push({name:"Node Name",description:`Node name: "${S.appData.name}"`,startByte:s+h,endByte:s+a.length-1,value:(0,o.bytesToHex)(d)})}return e!=null&&e.includeSegments&&(S.segments=A),S}catch(A){return{type:t.PayloadType.Advert,version:t.PayloadVersion.Version1,isValid:!1,errors:[A instanceof Error?A.message:"Failed to decode advertisement payload"],publicKey:"",timestamp:0,signature:"",appData:{flags:0,deviceRole:t.DeviceRole.ChatNode,hasLocation:!1,hasName:!1}}}}static async decodeWithVerification(a,e){const A=this.decode(a,e);if(!A||!A.isValid)return A;try{const i=a.subarray(100),u=(0,o.bytesToHex)(i),f=await l.Ed25519SignatureVerifier.verifyAdvertisementSignature(A.publicKey,A.signature,A.timestamp,u);A.signatureValid=f,f||(A.signatureError="Ed25519 signature verification failed",A.isValid=!1,A.errors||(A.errors=[]),A.errors.push("Invalid Ed25519 signature"))}catch(s){A.signatureValid=!1,A.signatureError=s instanceof Error?s.message:"Signature verification error",A.isValid=!1,A.errors||(A.errors=[]),A.errors.push("Signature verification failed: "+(s instanceof Error?s.message:"Unknown error"))}return A}static parseDeviceRole(a){switch(a&15){case 1:return t.DeviceRole.ChatNode;case 2:return t.DeviceRole.Repeater;case 3:return t.DeviceRole.RoomServer;case 4:return t.DeviceRole.Sensor;default:return t.DeviceRole.ChatNode}}static readUint32LE(a,e){return a[e]|a[e+1]<<8|a[e+2]<<16|a[e+3]<<24}static readInt32LE(a,e){const A=this.readUint32LE(a,e);return A>2147483647?A-4294967296:A}static sanitizeControlCharacters(a){return a&&a.trim().replace(/[\x00-\x1F\x7F]/g,"")||null}}return Qe.AdvertPayloadDecoder=n,Qe}var Ne={},Ot;function br(){if(Ot)return Ne;Ot=1,Object.defineProperty(Ne,"__esModule",{value:!0}),Ne.TracePayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r,a){try{if(n.length<9){const x={type:t.PayloadType.Trace,version:t.PayloadVersion.Version1,isValid:!1,errors:["Trace payload too short (need at least tag(4) + auth(4) + flags(1))"],traceTag:"00000000",authCode:0,flags:0,pathHashes:[]};return a!=null&&a.includeSegments&&(x.segments=[{name:"Invalid Trace Data",description:"Trace payload too short (minimum 9 bytes required)",startByte:a.segmentOffset||0,endByte:(a.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),x}let e=0;const A=[],s=(a==null?void 0:a.segmentOffset)||0,i=this.readUint32LE(n,e),u=(0,o.numberToHex)(i,8);a!=null&&a.includeSegments&&A.push({name:"Trace Tag",description:`Unique identifier for this trace: 0x${i.toString(16).padStart(8,"0")}`,startByte:s+e,endByte:s+e+3,value:(0,o.bytesToHex)(n.slice(e,e+4))}),e+=4;const f=this.readUint32LE(n,e);a!=null&&a.includeSegments&&A.push({name:"Auth Code",description:`Authentication/verification code: ${f}`,startByte:s+e,endByte:s+e+3,value:(0,o.bytesToHex)(n.slice(e,e+4))}),e+=4;const y=n[e];a!=null&&a.includeSegments&&A.push({name:"Flags",description:`Application-defined control flags: 0x${y.toString(16).padStart(2,"0")} (${y.toString(2).padStart(8,"0")}b)`,startByte:s+e,endByte:s+e,value:y.toString(16).padStart(2,"0").toUpperCase()}),e+=1;const b=[],S=e;for(;e<n.length;)b.push((0,o.byteToHex)(n[e])),e++;if(a!=null&&a.includeSegments&&b.length>0){const x=b.join(" ");A.push({name:"Path Hashes",description:`Node hashes in trace path: ${x}`,startByte:s+S,endByte:s+n.length-1,value:(0,o.bytesToHex)(n.slice(S))})}let h;r&&r.length>0&&(h=r.map(x=>{const g=parseInt(x,16);return(g>127?g-256:g)/4}));const d={type:t.PayloadType.Trace,version:t.PayloadVersion.Version1,isValid:!0,traceTag:u,authCode:f,flags:y,pathHashes:b,snrValues:h};return a!=null&&a.includeSegments&&(d.segments=A),d}catch(e){return{type:t.PayloadType.Trace,version:t.PayloadVersion.Version1,isValid:!1,errors:[e instanceof Error?e.message:"Failed to decode trace payload"],traceTag:"00000000",authCode:0,flags:0,pathHashes:[]}}}static readUint32LE(n,r){return n[r]|n[r+1]<<8|n[r+2]<<16|n[r+3]<<24}}return Ne.TracePayloadDecoder=c,Ne}var qe={},Ht;function xr(){if(Ht)return qe;Ht=1,Object.defineProperty(qe,"__esModule",{value:!0}),qe.GroupTextPayloadDecoder=void 0;const t=ve(),o=xt(),c=oe();class l{static decode(r,a){try{if(r.length<3){const b={type:t.PayloadType.GroupText,version:t.PayloadVersion.Version1,isValid:!1,errors:["GroupText payload too short (need at least channel_hash(1) + MAC(2))"],channelHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0};return a!=null&&a.includeSegments&&(b.segments=[{name:"Invalid GroupText Data",description:"GroupText payload too short (minimum 3 bytes required)",startByte:a.segmentOffset||0,endByte:(a.segmentOffset||0)+r.length-1,value:(0,c.bytesToHex)(r)}]),b}const e=[],A=(a==null?void 0:a.segmentOffset)||0;let s=0;const i=(0,c.byteToHex)(r[s]);a!=null&&a.includeSegments&&e.push({name:"Channel Hash",description:"First byte of SHA256 of channel's shared key",startByte:A+s,endByte:A+s,value:i}),s+=1;const u=(0,c.bytesToHex)(r.subarray(s,s+2));a!=null&&a.includeSegments&&e.push({name:"Cipher MAC",description:"MAC for encrypted data",startByte:A+s,endByte:A+s+1,value:u}),s+=2;const f=(0,c.bytesToHex)(r.subarray(s));a!=null&&a.includeSegments&&r.length>s&&e.push({name:"Ciphertext",description:"Encrypted message content (timestamp + flags + message)",startByte:A+s,endByte:A+r.length-1,value:f});const y={type:t.PayloadType.GroupText,version:t.PayloadVersion.Version1,isValid:!0,channelHash:i,cipherMac:u,ciphertext:f,ciphertextLength:r.length-3};if(a!=null&&a.keyStore&&a.keyStore.hasChannelKey(i)){const b=a.keyStore.getChannelKeys(i);for(const S of b){const h=o.ChannelCrypto.decryptGroupTextMessage(f,u,S);if(h.success&&h.data){y.decrypted={timestamp:h.data.timestamp,flags:h.data.flags,sender:h.data.sender,message:h.data.message};break}}}return a!=null&&a.includeSegments&&(y.segments=e),y}catch(e){return{type:t.PayloadType.GroupText,version:t.PayloadVersion.Version1,isValid:!1,errors:[e instanceof Error?e.message:"Failed to decode GroupText payload"],channelHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0}}}}return qe.GroupTextPayloadDecoder=l,qe}var Le={},Vt;function vr(){if(Vt)return Le;Vt=1,Object.defineProperty(Le,"__esModule",{value:!0}),Le.RequestPayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r){try{if(n.length<4){const b={type:t.PayloadType.Request,version:t.PayloadVersion.Version1,isValid:!1,errors:["Request payload too short (minimum 4 bytes: dest hash + source hash + MAC)"],timestamp:0,requestType:t.RequestType.GetStats,requestData:"",destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:""};return r!=null&&r.includeSegments&&(b.segments=[{name:"Invalid Request Data",description:"Request payload too short (minimum 4 bytes required: 1 for dest hash + 1 for source hash + 2 for MAC)",startByte:r.segmentOffset||0,endByte:(r.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),b}const a=[],e=(r==null?void 0:r.segmentOffset)||0;let A=0;const s=(0,o.bytesToHex)(n.subarray(A,A+1));r!=null&&r.includeSegments&&a.push({name:"Destination Hash",description:`First byte of destination node public key: 0x${s}`,startByte:e+A,endByte:e+A,value:s}),A+=1;const i=(0,o.bytesToHex)(n.subarray(A,A+1));r!=null&&r.includeSegments&&a.push({name:"Source Hash",description:`First byte of source node public key: 0x${i}`,startByte:e+A,endByte:e+A,value:i}),A+=1;const u=(0,o.bytesToHex)(n.subarray(A,A+2));r!=null&&r.includeSegments&&a.push({name:"Cipher MAC",description:"MAC for encrypted data verification (2 bytes)",startByte:e+A,endByte:e+A+1,value:u}),A+=2;const f=(0,o.bytesToHex)(n.subarray(A));r!=null&&r.includeSegments&&n.length>A&&a.push({name:"Ciphertext",description:`Encrypted message data (${n.length-A} bytes). Contains encrypted plaintext with this structure:
• Timestamp (4 bytes) - send time as unix timestamp
• Request Type (1 byte) - type of request (GetStats, GetTelemetryData, etc.)
• Request Data (remaining bytes) - additional request-specific data`,startByte:e+A,endByte:e+n.length-1,value:f});const y={type:t.PayloadType.Request,version:t.PayloadVersion.Version1,isValid:!0,timestamp:0,requestType:t.RequestType.GetStats,requestData:"",destinationHash:s,sourceHash:i,cipherMac:u,ciphertext:f};return r!=null&&r.includeSegments&&(y.segments=a),y}catch(a){return{type:t.PayloadType.Request,version:t.PayloadVersion.Version1,isValid:!1,errors:[a instanceof Error?a.message:"Failed to decode request payload"],timestamp:0,requestType:t.RequestType.GetStats,requestData:"",destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:""}}}}return Le.RequestPayloadDecoder=c,Le}var je={},Ft;function Br(){if(Ft)return je;Ft=1,Object.defineProperty(je,"__esModule",{value:!0}),je.ResponsePayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r){try{if(n.length<4){const b={type:t.PayloadType.Response,version:t.PayloadVersion.Version1,isValid:!1,errors:["Response payload too short (minimum 4 bytes: dest + source + MAC)"],destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0};return r!=null&&r.includeSegments&&(b.segments=[{name:"Invalid Response Data",description:"Response payload too short (minimum 4 bytes required)",startByte:r.segmentOffset||0,endByte:(r.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),b}const a=[],e=(r==null?void 0:r.segmentOffset)||0;let A=0;const s=(0,o.byteToHex)(n[A]);r!=null&&r.includeSegments&&a.push({name:"Destination Hash",description:"First byte of destination node public key",startByte:e+A,endByte:e+A,value:s}),A+=1;const i=(0,o.byteToHex)(n[A]);r!=null&&r.includeSegments&&a.push({name:"Source Hash",description:"First byte of source node public key",startByte:e+A,endByte:e+A,value:i}),A+=1;const u=(0,o.bytesToHex)(n.subarray(A,A+2));r!=null&&r.includeSegments&&a.push({name:"Cipher MAC",description:"MAC for encrypted data in next field",startByte:e+A,endByte:e+A+1,value:u}),A+=2;const f=(0,o.bytesToHex)(n.subarray(A));r!=null&&r.includeSegments&&n.length>A&&a.push({name:"Ciphertext",description:"Encrypted response data (tag + content)",startByte:e+A,endByte:e+n.length-1,value:f});const y={type:t.PayloadType.Response,version:t.PayloadVersion.Version1,isValid:!0,destinationHash:s,sourceHash:i,cipherMac:u,ciphertext:f,ciphertextLength:n.length-4};return r!=null&&r.includeSegments&&(y.segments=a),y}catch(a){return{type:t.PayloadType.Response,version:t.PayloadVersion.Version1,isValid:!1,errors:[a instanceof Error?a.message:"Failed to decode response payload"],destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0}}}}return je.ResponsePayloadDecoder=c,je}var We={},Ut;function _r(){if(Ut)return We;Ut=1,Object.defineProperty(We,"__esModule",{value:!0}),We.AnonRequestPayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r){try{if(n.length<35){const b={type:t.PayloadType.AnonRequest,version:t.PayloadVersion.Version1,isValid:!1,errors:["AnonRequest payload too short (minimum 35 bytes: dest + public key + MAC)"],destinationHash:"",senderPublicKey:"",cipherMac:"",ciphertext:"",ciphertextLength:0};return r!=null&&r.includeSegments&&(b.segments=[{name:"Invalid AnonRequest Data",description:"AnonRequest payload too short (minimum 35 bytes required: 1 for dest hash + 32 for public key + 2 for MAC)",startByte:r.segmentOffset||0,endByte:(r.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),b}const a=[],e=(r==null?void 0:r.segmentOffset)||0;let A=0;const s=(0,o.byteToHex)(n[0]);r!=null&&r.includeSegments&&a.push({name:"Destination Hash",description:`First byte of destination node public key: 0x${s}`,startByte:e+A,endByte:e+A,value:s}),A+=1;const i=(0,o.bytesToHex)(n.subarray(1,33));r!=null&&r.includeSegments&&a.push({name:"Sender Public Key",description:"Ed25519 public key of the sender (32 bytes)",startByte:e+A,endByte:e+A+31,value:i}),A+=32;const u=(0,o.bytesToHex)(n.subarray(33,35));r!=null&&r.includeSegments&&a.push({name:"Cipher MAC",description:"MAC for encrypted data verification (2 bytes)",startByte:e+A,endByte:e+A+1,value:u}),A+=2;const f=(0,o.bytesToHex)(n.subarray(35));r!=null&&r.includeSegments&&n.length>35&&a.push({name:"Ciphertext",description:`Encrypted message data (${n.length-35} bytes). Contains encrypted plaintext with this structure:
• Timestamp (4 bytes) - send time as unix timestamp
• Sync Timestamp (4 bytes) - room server only, sender's "sync messages SINCE x" timestamp  
• Password (remaining bytes) - password for repeater/room`,startByte:e+A,endByte:e+n.length-1,value:f});const y={type:t.PayloadType.AnonRequest,version:t.PayloadVersion.Version1,isValid:!0,destinationHash:s,senderPublicKey:i,cipherMac:u,ciphertext:f,ciphertextLength:n.length-35};return r!=null&&r.includeSegments&&(y.segments=a),y}catch(a){return{type:t.PayloadType.AnonRequest,version:t.PayloadVersion.Version1,isValid:!1,errors:[a instanceof Error?a.message:"Failed to decode AnonRequest payload"],destinationHash:"",senderPublicKey:"",cipherMac:"",ciphertext:"",ciphertextLength:0}}}}return We.AnonRequestPayloadDecoder=c,We}var Ze={},Gt;function wr(){if(Gt)return Ze;Gt=1,Object.defineProperty(Ze,"__esModule",{value:!0}),Ze.AckPayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r){try{if(n.length<4){const i={type:t.PayloadType.Ack,version:t.PayloadVersion.Version1,isValid:!1,errors:["Ack payload too short (minimum 4 bytes for checksum)"],checksum:""};return r!=null&&r.includeSegments&&(i.segments=[{name:"Invalid Ack Data",description:"Ack payload too short (minimum 4 bytes required for checksum)",startByte:r.segmentOffset||0,endByte:(r.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),i}const a=[],e=(r==null?void 0:r.segmentOffset)||0,A=(0,o.bytesToHex)(n.subarray(0,4));r!=null&&r.includeSegments&&a.push({name:"Checksum",description:`CRC checksum of message timestamp, text, and sender pubkey: 0x${A}`,startByte:e,endByte:e+3,value:A}),r!=null&&r.includeSegments&&n.length>4&&a.push({name:"Additional Data",description:"Extra data in Ack payload",startByte:e+4,endByte:e+n.length-1,value:(0,o.bytesToHex)(n.subarray(4))});const s={type:t.PayloadType.Ack,version:t.PayloadVersion.Version1,isValid:!0,checksum:A};return r!=null&&r.includeSegments&&(s.segments=a),s}catch(a){return{type:t.PayloadType.Ack,version:t.PayloadVersion.Version1,isValid:!1,errors:[a instanceof Error?a.message:"Failed to decode Ack payload"],checksum:""}}}}return Ze.AckPayloadDecoder=c,Ze}var Ke={},Qt;function Cr(){if(Qt)return Ke;Qt=1,Object.defineProperty(Ke,"__esModule",{value:!0}),Ke.PathPayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n){try{if(n.length<2)return{type:t.PayloadType.Path,version:t.PayloadVersion.Version1,isValid:!1,errors:["Path payload too short (minimum 2 bytes: path length + extra type)"],pathLength:0,pathHashes:[],extraType:0,extraData:""};const r=n[0],a=(r>>6)+1,e=r&63,A=e*a;if(a===4)return{type:t.PayloadType.Path,version:t.PayloadVersion.Version1,isValid:!1,errors:["Invalid path length byte: reserved hash size (bits 7:6 = 11)"],pathLength:0,pathHashes:[],extraType:0,extraData:""};if(n.length<1+A+1)return{type:t.PayloadType.Path,version:t.PayloadVersion.Version1,isValid:!1,errors:[`Path payload too short (need ${1+A+1} bytes for path length + path + extra type)`],pathLength:e,...a>1?{pathHashSize:a}:{},pathHashes:[],extraType:0,extraData:""};const s=[];for(let f=0;f<e;f++){const y=1+f*a,b=n.subarray(y,y+a);s.push((0,o.bytesToHex)(b))}const i=n[1+A];let u="";return n.length>1+A+1&&(u=(0,o.bytesToHex)(n.subarray(1+A+1))),{type:t.PayloadType.Path,version:t.PayloadVersion.Version1,isValid:!0,pathLength:e,...a>1?{pathHashSize:a}:{},pathHashes:s,extraType:i,extraData:u}}catch(r){return{type:t.PayloadType.Path,version:t.PayloadVersion.Version1,isValid:!1,errors:[r instanceof Error?r.message:"Failed to decode Path payload"],pathLength:0,pathHashes:[],extraType:0,extraData:""}}}}return Ke.PathPayloadDecoder=c,Ke}var Xe={},Nt;function Sr(){if(Nt)return Xe;Nt=1,Object.defineProperty(Xe,"__esModule",{value:!0}),Xe.TextMessagePayloadDecoder=void 0;const t=ve(),o=oe();class c{static decode(n,r){try{if(n.length<4){const b={type:t.PayloadType.TextMessage,version:t.PayloadVersion.Version1,isValid:!1,errors:["TextMessage payload too short (minimum 4 bytes: dest + source + MAC)"],destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0};return r!=null&&r.includeSegments&&(b.segments=[{name:"Invalid TextMessage Data",description:"TextMessage payload too short (minimum 4 bytes required)",startByte:r.segmentOffset||0,endByte:(r.segmentOffset||0)+n.length-1,value:(0,o.bytesToHex)(n)}]),b}const a=[],e=(r==null?void 0:r.segmentOffset)||0;let A=0;const s=(0,o.byteToHex)(n[A]);r!=null&&r.includeSegments&&a.push({name:"Destination Hash",description:"First byte of destination node public key",startByte:e+A,endByte:e+A,value:s}),A+=1;const i=(0,o.byteToHex)(n[A]);r!=null&&r.includeSegments&&a.push({name:"Source Hash",description:"First byte of source node public key",startByte:e+A,endByte:e+A,value:i}),A+=1;const u=(0,o.bytesToHex)(n.subarray(A,A+2));r!=null&&r.includeSegments&&a.push({name:"Cipher MAC",description:"MAC for encrypted data in next field",startByte:e+A,endByte:e+A+1,value:u}),A+=2;const f=(0,o.bytesToHex)(n.subarray(A));r!=null&&r.includeSegments&&n.length>A&&a.push({name:"Ciphertext",description:"Encrypted message data (timestamp + message text)",startByte:e+A,endByte:e+n.length-1,value:f});const y={type:t.PayloadType.TextMessage,version:t.PayloadVersion.Version1,isValid:!0,destinationHash:s,sourceHash:i,cipherMac:u,ciphertext:f,ciphertextLength:n.length-4};return r!=null&&r.includeSegments&&(y.segments=a),y}catch(a){return{type:t.PayloadType.TextMessage,version:t.PayloadVersion.Version1,isValid:!1,errors:[a instanceof Error?a.message:"Failed to decode TextMessage payload"],destinationHash:"",sourceHash:"",cipherMac:"",ciphertext:"",ciphertextLength:0}}}}return Xe.TextMessagePayloadDecoder=c,Xe}var Ye={},qt;function kr(){if(qt)return Ye;qt=1,Object.defineProperty(Ye,"__esModule",{value:!0}),Ye.ControlPayloadDecoder=void 0;const t=ve(),o=oe(),c=$e();class l{static decode(r,a){try{if(r.length<1)return this.createErrorPayload("Control payload too short (minimum 1 byte required)",r,a);const A=r[0]&240;switch(A){case t.ControlSubType.NodeDiscoverReq:return this.decodeDiscoverReq(r,a);case t.ControlSubType.NodeDiscoverResp:return this.decodeDiscoverResp(r,a);default:return this.createErrorPayload(`Unknown control sub-type: 0x${A.toString(16).padStart(2,"0")}`,r,a)}}catch(e){return this.createErrorPayload(e instanceof Error?e.message:"Failed to decode control payload",r,a)}}static decodeDiscoverReq(r,a){const e=[],A=(a==null?void 0:a.segmentOffset)??0;if(r.length<6){const d={type:t.PayloadType.Control,version:t.PayloadVersion.Version1,isValid:!1,errors:["DISCOVER_REQ payload too short (minimum 6 bytes required)"],subType:t.ControlSubType.NodeDiscoverReq,rawFlags:r[0],prefixOnly:!1,typeFilter:0,typeFilterNames:[],tag:0,since:0};return a!=null&&a.includeSegments&&(d.segments=[{name:"Invalid DISCOVER_REQ Data",description:"DISCOVER_REQ payload too short (minimum 6 bytes required)",startByte:A,endByte:A+r.length-1,value:(0,o.bytesToHex)(r)}]),d}let s=0;const i=r[s],u=(i&1)!==0;a!=null&&a.includeSegments&&e.push({name:"Flags",description:`Sub-type: DISCOVER_REQ (0x8) | Prefix Only: ${u}`,startByte:A+s,endByte:A+s,value:i.toString(16).padStart(2,"0").toUpperCase()}),s+=1;const f=r[s],y=this.parseTypeFilter(f);a!=null&&a.includeSegments&&e.push({name:"Type Filter",description:`Filter mask: 0b${f.toString(2).padStart(8,"0")} | Types: ${y.length>0?y.join(", "):"None"}`,startByte:A+s,endByte:A+s,value:f.toString(16).padStart(2,"0").toUpperCase()}),s+=1;const b=this.readUint32LE(r,s);a!=null&&a.includeSegments&&e.push({name:"Tag",description:`Random tag for response matching: 0x${b.toString(16).padStart(8,"0")}`,startByte:A+s,endByte:A+s+3,value:(0,o.bytesToHex)(r.slice(s,s+4))}),s+=4;let S=0;if(r.length>=s+4&&(S=this.readUint32LE(r,s),a!=null&&a.includeSegments)){const d=S>0?new Date(S*1e3).toISOString().slice(0,19)+"Z":"N/A";e.push({name:"Since",description:`Filter timestamp: ${S} (${d})`,startByte:A+s,endByte:A+s+3,value:(0,o.bytesToHex)(r.slice(s,s+4))})}const h={type:t.PayloadType.Control,version:t.PayloadVersion.Version1,isValid:!0,subType:t.ControlSubType.NodeDiscoverReq,rawFlags:i,prefixOnly:u,typeFilter:f,typeFilterNames:y,tag:b,since:S};return a!=null&&a.includeSegments&&(h.segments=e),h}static decodeDiscoverResp(r,a){const e=[],A=(a==null?void 0:a.segmentOffset)??0;if(r.length<14){const E={type:t.PayloadType.Control,version:t.PayloadVersion.Version1,isValid:!1,errors:["DISCOVER_RESP payload too short (minimum 14 bytes required)"],subType:t.ControlSubType.NodeDiscoverResp,rawFlags:r.length>0?r[0]:0,nodeType:t.DeviceRole.Unknown,nodeTypeName:"Unknown",snr:0,tag:0,publicKey:"",publicKeyLength:0};return a!=null&&a.includeSegments&&(E.segments=[{name:"Invalid DISCOVER_RESP Data",description:"DISCOVER_RESP payload too short (minimum 14 bytes required)",startByte:A,endByte:A+r.length-1,value:(0,o.bytesToHex)(r)}]),E}let s=0;const i=r[s],u=i&15,f=(0,c.getDeviceRoleName)(u);a!=null&&a.includeSegments&&e.push({name:"Flags",description:`Sub-type: DISCOVER_RESP (0x9) | Node Type: ${f}`,startByte:A+s,endByte:A+s,value:i.toString(16).padStart(2,"0").toUpperCase()}),s+=1;const y=r[s],b=y>127?y-256:y,S=b/4;a!=null&&a.includeSegments&&e.push({name:"SNR",description:`Inbound SNR: ${S.toFixed(2)} dB (raw: ${y}, signed: ${b})`,startByte:A+s,endByte:A+s,value:y.toString(16).padStart(2,"0").toUpperCase()}),s+=1;const h=this.readUint32LE(r,s);a!=null&&a.includeSegments&&e.push({name:"Tag",description:`Reflected tag from request: 0x${h.toString(16).padStart(8,"0")}`,startByte:A+s,endByte:A+s+3,value:(0,o.bytesToHex)(r.slice(s,s+4))}),s+=4;const x=r.length-s,g=r.slice(s,s+x),w=(0,o.bytesToHex)(g);if(a!=null&&a.includeSegments){const E=x===32?"Full Public Key":"Public Key Prefix";e.push({name:E,description:`${E} (${x} bytes)`,startByte:A+s,endByte:A+s+x-1,value:w})}const m={type:t.PayloadType.Control,version:t.PayloadVersion.Version1,isValid:!0,subType:t.ControlSubType.NodeDiscoverResp,rawFlags:i,nodeType:u,nodeTypeName:f,snr:S,tag:h,publicKey:w,publicKeyLength:x};return a!=null&&a.includeSegments&&(m.segments=e),m}static parseTypeFilter(r){const a=[];return r&1<<t.DeviceRole.ChatNode&&a.push("Chat"),r&1<<t.DeviceRole.Repeater&&a.push("Repeater"),r&1<<t.DeviceRole.RoomServer&&a.push("Room"),r&1<<t.DeviceRole.Sensor&&a.push("Sensor"),a}static createErrorPayload(r,a,e){const A={type:t.PayloadType.Control,version:t.PayloadVersion.Version1,isValid:!1,errors:[r],subType:t.ControlSubType.NodeDiscoverReq,rawFlags:a.length>0?a[0]:0,prefixOnly:!1,typeFilter:0,typeFilterNames:[],tag:0,since:0};return e!=null&&e.includeSegments&&(A.segments=[{name:"Invalid Control Data",description:r,startByte:e.segmentOffset??0,endByte:(e.segmentOffset??0)+a.length-1,value:(0,o.bytesToHex)(a)}]),A}static readUint32LE(r,a){return(r[a]|r[a+1]<<8|r[a+2]<<16|r[a+3]<<24)>>>0}}return Ye.ControlPayloadDecoder=l,Ye}var Lt;function jt(){if(Lt)return Fe;Lt=1,Object.defineProperty(Fe,"__esModule",{value:!0}),Fe.MeshCorePacketDecoder=void 0;const t=ve(),o=oe(),c=$e(),l=Ar(),n=pr(),r=br(),a=xr(),e=vr(),A=Br(),s=_r(),i=wr(),u=Cr(),f=Sr(),y=kr();class b{static decode(h,d){return this.parseInternal(h,!1,d).packet}static async decodeWithVerification(h,d){return(await this.parseInternalAsync(h,!1,d)).packet}static analyzeStructure(h,d){return this.parseInternal(h,!0,d).structure}static async analyzeStructureWithVerification(h,d){return(await this.parseInternalAsync(h,!0,d)).structure}static parseInternal(h,d,x){const g=(0,o.hexToBytes)(h),w=[];if(g.length<2){const m={messageHash:"",routeType:t.RouteType.Flood,payloadType:t.PayloadType.RawCustom,payloadVersion:t.PayloadVersion.Version1,pathLength:0,path:null,payload:{raw:"",decoded:null},totalBytes:g.length,isValid:!1,errors:["Packet too short (minimum 2 bytes required)"]},E={segments:[],totalBytes:g.length,rawHex:h.toUpperCase(),messageHash:"",payload:{segments:[],hex:"",startByte:0,type:"Unknown"}};return{packet:m,structure:E}}try{let m=0;const E=g[0],T=E&3,C=E>>2&15,I=E>>6&3;d&&w.push({name:"Header",description:"Header byte breakdown",startByte:0,endByte:0,value:`0x${E.toString(16).padStart(2,"0")}`,headerBreakdown:{fullBinary:E.toString(2).padStart(8,"0"),fields:[{bits:"0-1",field:"Route Type",value:(0,c.getRouteTypeName)(T),binary:(E&3).toString(2).padStart(2,"0")},{bits:"2-5",field:"Payload Type",value:(0,c.getPayloadTypeName)(C),binary:(E>>2&15).toString(2).padStart(4,"0")},{bits:"6-7",field:"Version",value:I.toString(),binary:(E>>6&3).toString(2).padStart(2,"0")}]}}),m=1;let F;if(T===t.RouteType.TransportFlood||T===t.RouteType.TransportDirect){if(g.length<m+4)throw new Error("Packet too short for transport codes");const v=g[m]|g[m+1]<<8,ee=g[m+2]|g[m+3]<<8;if(F=[v,ee],d){const ge=g[m]|g[m+1]<<8|g[m+2]<<16|g[m+3]<<24;w.push({name:"Transport Code",description:"Used for Direct/Response routing",startByte:m,endByte:m+3,value:`0x${ge.toString(16).padStart(8,"0")}`})}m+=4}if(g.length<m+1)throw new Error("Packet too short for path length");const ce=g[m],{hashSize:D,hopCount:$,byteLength:J}=this.decodePathLenByte(ce);if(D===4)throw new Error("Invalid path length byte: reserved hash size (bits 7:6 = 11)");if(d){const v=D>1?` × ${D}-byte hashes (${J} bytes)`:"";let ee;$===0?ee=D>1?`No path data (${D}-byte hash mode)`:"No path data":T===t.RouteType.Direct||T===t.RouteType.TransportDirect?ee=`${$} hops${v} of routing instructions (decreases as packet travels)`:T===t.RouteType.Flood||T===t.RouteType.TransportFlood?ee=`${$} hops${v} showing route taken (increases as packet floods)`:ee=`Path contains ${$} hops${v}`,w.push({name:"Path Length",description:ee,startByte:m,endByte:m,value:`0x${ce.toString(16).padStart(2,"0")}`,headerBreakdown:{fullBinary:ce.toString(2).padStart(8,"0"),fields:[{bits:"6-7",field:"Hash Size",value:`${D} byte${D>1?"s":""} per hop`,binary:(ce>>6&3).toString(2).padStart(2,"0")},{bits:"0-5",field:"Hop Count",value:`${$} hop${$!==1?"s":""}`,binary:(ce&63).toString(2).padStart(6,"0")}]}})}if(m+=1,g.length<m+J)throw new Error("Packet too short for path data");const ae=g.subarray(m,m+J);let le=null;if($>0){le=[];for(let v=0;v<$;v++){const ee=ae.subarray(v*D,(v+1)*D);le.push((0,o.bytesToHex)(ee))}}if(d&&$>0)if(C===t.PayloadType.Trace){const v=[];for(let ee=0;ee<J;ee++){const ge=g[m+ee],P=(ge>127?ge-256:ge)/4;v.push(`${P.toFixed(2)}dB (0x${ge.toString(16).padStart(2,"0")})`)}w.push({name:"Path SNR Data",description:`SNR values collected during trace: ${v.join(", ")}`,startByte:m,endByte:m+J-1,value:(0,o.bytesToHex)(g.slice(m,m+J))})}else{let v="Routing path information";T===t.RouteType.Direct||T===t.RouteType.TransportDirect?v=`Routing instructions (${D}-byte hashes stripped at each hop as packet travels to destination)`:(T===t.RouteType.Flood||T===t.RouteType.TransportFlood)&&(v=`Historical route taken (${D}-byte hashes added as packet floods through network)`),w.push({name:"Path Data",description:v,startByte:m,endByte:m+J-1,value:(0,o.bytesToHex)(g.slice(m,m+J))})}m+=J;const Q=g.subarray(m),he=(0,o.bytesToHex)(Q);d&&g.length>m&&w.push({name:"Payload",description:`${(0,c.getPayloadTypeName)(C)} payload data`,startByte:m,endByte:g.length-1,value:(0,o.bytesToHex)(g.slice(m))});let L=null;const Z=[];if(C===t.PayloadType.Advert){const v=n.AdvertPayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Trace){const v=r.TracePayloadDecoder.decode(Q,le,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.GroupText){const v=a.GroupTextPayloadDecoder.decode(Q,{...x,includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Request){const v=e.RequestPayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Response){const v=A.ResponsePayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.AnonRequest){const v=s.AnonRequestPayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Ack){const v=i.AckPayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Path)L=u.PathPayloadDecoder.decode(Q);else if(C===t.PayloadType.TextMessage){const v=f.TextMessagePayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}else if(C===t.PayloadType.Control){const v=y.ControlPayloadDecoder.decode(Q,{includeSegments:d,segmentOffset:0});L=v,v!=null&&v.segments&&(Z.push(...v.segments),delete v.segments)}d&&Z.length===0&&g.length>m&&Z.push({name:`${(0,c.getPayloadTypeName)(C)} Payload`,description:`Raw ${(0,c.getPayloadTypeName)(C)} payload data (${Q.length} bytes)`,startByte:0,endByte:Q.length-1,value:(0,o.bytesToHex)(Q)});const ye=this.calculateMessageHash(g,T,C,I),Be={messageHash:ye,routeType:T,payloadType:C,payloadVersion:I,transportCodes:F,pathLength:$,...D>1?{pathHashSize:D}:{},path:le,payload:{raw:he,decoded:L},totalBytes:g.length,isValid:!0},Te={segments:w,totalBytes:g.length,rawHex:h.toUpperCase(),messageHash:ye,payload:{segments:Z,hex:he,startByte:m,type:(0,c.getPayloadTypeName)(C)}};return{packet:Be,structure:Te}}catch(m){const E={messageHash:"",routeType:t.RouteType.Flood,payloadType:t.PayloadType.RawCustom,payloadVersion:t.PayloadVersion.Version1,pathLength:0,path:null,payload:{raw:"",decoded:null},totalBytes:g.length,isValid:!1,errors:[m instanceof Error?m.message:"Unknown decoding error"]},T={segments:[],totalBytes:g.length,rawHex:h.toUpperCase(),messageHash:"",payload:{segments:[],hex:"",startByte:0,type:"Unknown"}};return{packet:E,structure:T}}}static async parseInternalAsync(h,d,x){const g=this.parseInternal(h,d,x);if(g.packet.payloadType===t.PayloadType.Advert&&g.packet.payload.decoded)try{const w=g.packet.payload.decoded,m=await n.AdvertPayloadDecoder.decodeWithVerification((0,o.hexToBytes)(g.packet.payload.raw),{includeSegments:d,segmentOffset:0});m&&(g.packet.payload.decoded=m,m.isValid||(g.packet.isValid=!1,g.packet.errors=m.errors||["Invalid advertisement signature"]),d&&m.segments&&(g.structure.payload.segments=m.segments,delete m.segments))}catch(w){console.error("Signature verification failed:",w)}return g}static validate(h){const d=(0,o.hexToBytes)(h),x=[];if(d.length<2)return x.push("Packet too short (minimum 2 bytes required)"),{isValid:!1,errors:x};try{let g=1;const m=d[0]&3;if((m===t.RouteType.TransportFlood||m===t.RouteType.TransportDirect)&&(d.length<g+4&&x.push("Packet too short for transport codes"),g+=4),d.length<g+1)x.push("Packet too short for path length");else{const E=d[g],{hashSize:T,byteLength:C}=this.decodePathLenByte(E);g+=1,T===4&&x.push("Invalid path length byte: reserved hash size (bits 7:6 = 11)"),d.length<g+C&&x.push("Packet too short for path data"),g+=C}g>=d.length&&x.push("No payload data found")}catch(g){x.push(g instanceof Error?g.message:"Validation error")}return{isValid:x.length===0,errors:x.length>0?x:void 0}}static calculateMessageHash(h,d,x,g){if(x===t.PayloadType.Trace&&h.length>=13){let I=1;if((d===t.RouteType.TransportFlood||d===t.RouteType.TransportDirect)&&(I+=4),h.length>I){const{byteLength:F}=this.decodePathLenByte(h[I]);I+=1+F}if(h.length>=I+4){const F=h[I]|h[I+1]<<8|h[I+2]<<16|h[I+3]<<24;return(0,o.numberToHex)(F,8)}}const w=x<<2|g<<6;let m=1;if((d===t.RouteType.TransportFlood||d===t.RouteType.TransportDirect)&&(m+=4),h.length>m){const{byteLength:I}=this.decodePathLenByte(h[m]);m+=1+I}const E=h.slice(m),T=[w,...Array.from(E)];let C=0;for(let I=0;I<T.length;I++)C=(C<<5)-C+T[I]&4294967295;return(0,o.numberToHex)(C,8)}static createKeyStore(h){return new l.MeshCoreKeyStore(h)}static decodePathLenByte(h){const d=(h>>6)+1,x=h&63;return{hashSize:d,hopCount:x,byteLength:x*d}}}return Fe.MeshCorePacketDecoder=b,Fe}var Me={},Wt;function Zt(){if(Wt)return Me;Wt=1,Object.defineProperty(Me,"__esModule",{value:!0}),Me.createAuthToken=n,Me.verifyAuthToken=r,Me.parseAuthToken=a,Me.decodeAuthTokenPayload=e;const t=vt(),o=oe();function c(A){let s="";if(typeof Buffer<"u")s=Buffer.from(A).toString("base64");else{const i=String.fromCharCode(...Array.from(A));s=btoa(i)}return s.replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"")}function l(A){let s=A.replace(/-/g,"+").replace(/_/g,"/");for(;s.length%4;)s+="=";if(typeof Buffer<"u")return new Uint8Array(Buffer.from(s,"base64"));{const i=atob(s),u=new Uint8Array(i.length);for(let f=0;f<i.length;f++)u[f]=i.charCodeAt(f);return u}}async function n(A,s,i){const u={alg:"Ed25519",typ:"JWT"};A.publicKey?A.publicKey=A.publicKey.toUpperCase():A.publicKey=i.toUpperCase(),A.iat||(A.iat=Math.floor(Date.now()/1e3));const f=JSON.stringify(u),y=JSON.stringify(A),b=new TextEncoder().encode(f),S=new TextEncoder().encode(y),h=c(b),d=c(S),x=`${h}.${d}`,g=new TextEncoder().encode(x),w=(0,o.bytesToHex)(g),m=await(0,t.sign)(w,s,A.publicKey);return`${h}.${d}.${m}`}async function r(A,s){try{const i=A.split(".");if(i.length!==3)return null;const[u,f,y]=i,b=l(u),S=l(f),h=new TextDecoder().decode(b),d=new TextDecoder().decode(S),x=JSON.parse(h),g=JSON.parse(d);if(x.alg!=="Ed25519"||x.typ!=="JWT"||!g.publicKey||!g.iat||s&&g.publicKey.toUpperCase()!==s.toUpperCase()||g.exp&&Math.floor(Date.now()/1e3)>g.exp)return null;const w=`${u}.${f}`,m=new TextEncoder().encode(w),E=(0,o.bytesToHex)(m);return await(0,t.verify)(y,E,g.publicKey)?g:null}catch{return null}}function a(A){try{const s=A.split(".");return s.length!==3?null:{header:s[0],payload:s[1],signature:s[2]}}catch{return null}}function e(A){try{const s=A.split(".");if(s.length!==3)return null;const i=l(s[1]),u=new TextDecoder().decode(i);return JSON.parse(u)}catch{return null}}return Me}var Kt;function Tr(){return Kt||(Kt=1,(function(t){var o=Se&&Se.__createBinding||(Object.create?(function(d,x,g,w){w===void 0&&(w=g);var m=Object.getOwnPropertyDescriptor(x,g);(!m||("get"in m?!x.__esModule:m.writable||m.configurable))&&(m={enumerable:!0,get:function(){return x[g]}}),Object.defineProperty(d,w,m)}):(function(d,x,g,w){w===void 0&&(w=g),d[w]=x[g]})),c=Se&&Se.__setModuleDefault||(Object.create?(function(d,x){Object.defineProperty(d,"default",{enumerable:!0,value:x})}):function(d,x){d.default=x}),l=Se&&Se.__importStar||(function(){var d=function(x){return d=Object.getOwnPropertyNames||function(g){var w=[];for(var m in g)Object.prototype.hasOwnProperty.call(g,m)&&(w[w.length]=m);return w},d(x)};return function(x){if(x&&x.__esModule)return x;var g={};if(x!=null)for(var w=d(x),m=0;m<w.length;m++)w[m]!=="default"&&o(g,x,w[m]);return c(g,x),g}})();Object.defineProperty(t,"__esModule",{value:!0}),t.Utils=t.decodeAuthTokenPayload=t.parseAuthToken=t.verifyAuthToken=t.createAuthToken=t.getControlSubTypeName=t.getRequestTypeName=t.getDeviceRoleName=t.getPayloadVersionName=t.getPayloadTypeName=t.getRouteTypeName=t.numberToHex=t.byteToHex=t.bytesToHex=t.hexToBytes=t.Ed25519SignatureVerifier=t.ChannelCrypto=t.MeshCoreKeyStore=t.ControlSubType=t.RequestType=t.AdvertFlags=t.DeviceRole=t.PayloadVersion=t.PayloadType=t.RouteType=t.MeshCoreDecoder=t.MeshCorePacketDecoder=void 0;var n=jt();Object.defineProperty(t,"MeshCorePacketDecoder",{enumerable:!0,get:function(){return n.MeshCorePacketDecoder}});var r=jt();Object.defineProperty(t,"MeshCoreDecoder",{enumerable:!0,get:function(){return r.MeshCorePacketDecoder}});var a=ve();Object.defineProperty(t,"RouteType",{enumerable:!0,get:function(){return a.RouteType}}),Object.defineProperty(t,"PayloadType",{enumerable:!0,get:function(){return a.PayloadType}}),Object.defineProperty(t,"PayloadVersion",{enumerable:!0,get:function(){return a.PayloadVersion}}),Object.defineProperty(t,"DeviceRole",{enumerable:!0,get:function(){return a.DeviceRole}}),Object.defineProperty(t,"AdvertFlags",{enumerable:!0,get:function(){return a.AdvertFlags}}),Object.defineProperty(t,"RequestType",{enumerable:!0,get:function(){return a.RequestType}}),Object.defineProperty(t,"ControlSubType",{enumerable:!0,get:function(){return a.ControlSubType}});var e=Ar();Object.defineProperty(t,"MeshCoreKeyStore",{enumerable:!0,get:function(){return e.MeshCoreKeyStore}});var A=xt();Object.defineProperty(t,"ChannelCrypto",{enumerable:!0,get:function(){return A.ChannelCrypto}});var s=sr();Object.defineProperty(t,"Ed25519SignatureVerifier",{enumerable:!0,get:function(){return s.Ed25519SignatureVerifier}});var i=oe();Object.defineProperty(t,"hexToBytes",{enumerable:!0,get:function(){return i.hexToBytes}}),Object.defineProperty(t,"bytesToHex",{enumerable:!0,get:function(){return i.bytesToHex}}),Object.defineProperty(t,"byteToHex",{enumerable:!0,get:function(){return i.byteToHex}}),Object.defineProperty(t,"numberToHex",{enumerable:!0,get:function(){return i.numberToHex}});var u=$e();Object.defineProperty(t,"getRouteTypeName",{enumerable:!0,get:function(){return u.getRouteTypeName}}),Object.defineProperty(t,"getPayloadTypeName",{enumerable:!0,get:function(){return u.getPayloadTypeName}}),Object.defineProperty(t,"getPayloadVersionName",{enumerable:!0,get:function(){return u.getPayloadVersionName}}),Object.defineProperty(t,"getDeviceRoleName",{enumerable:!0,get:function(){return u.getDeviceRoleName}}),Object.defineProperty(t,"getRequestTypeName",{enumerable:!0,get:function(){return u.getRequestTypeName}}),Object.defineProperty(t,"getControlSubTypeName",{enumerable:!0,get:function(){return u.getControlSubTypeName}});var f=Zt();Object.defineProperty(t,"createAuthToken",{enumerable:!0,get:function(){return f.createAuthToken}}),Object.defineProperty(t,"verifyAuthToken",{enumerable:!0,get:function(){return f.verifyAuthToken}}),Object.defineProperty(t,"parseAuthToken",{enumerable:!0,get:function(){return f.parseAuthToken}}),Object.defineProperty(t,"decodeAuthTokenPayload",{enumerable:!0,get:function(){return f.decodeAuthTokenPayload}});const y=l($e()),b=l(oe()),S=l(Zt()),h=vt();t.Utils={...y,...b,...S,derivePublicKey:h.derivePublicKey,validateKeyPair:h.validateKeyPair,sign:h.sign,verify:h.verify}})(Se)),Se}var Xt=Tr(),Pr=rr();const nr=nt(Pr);var rt={exports:{}},Rr=rt.exports,Yt;function Er(){return Yt||(Yt=1,(function(t,o){(function(c,l,n){t.exports=l(ar(),rr(),hr())})(Rr,function(c){return c.HmacSHA256})})(rt)),rt.exports}var Ir=Er();const Dr=nt(Ir);var at={exports:{}},Mr=at.exports,Jt;function Or(){return Jt||(Jt=1,(function(t,o){(function(c,l){t.exports=l(ar())})(Mr,function(c){return c.enc.Hex})})(at)),at.exports}var Hr=Or();const Oe=nt(Hr),ir="abcdefghijklmnopqrstuvwxyz0123456789",xe=ir.length,or=ir+"-",pt="[[public room]]",At="8b3387e9c5cdea6ac9e5edbaa115cd72",bt=720*60*60;function Vr(t){if(!t||t.length===0)return null;const o=t.length;let c=0,l=1,n=!1;for(let r=0;r<o;r++){const a=t[r],e=or.indexOf(a);if(e===-1)return null;const A=r===0,s=r===o-1,i=A||s?36:37,u=e===36;if((A||s)&&u||u&&n)return null;n=u,c+=e*l,l*=i}return{length:o,index:c}}function ze(t,o){if(t<=0)return null;let c="",l=o,n=!1;for(let r=0;r<t;r++){const a=r===0,e=r===t-1,A=a||e?36:37,s=l%A;l=Math.floor(l/A);const i=s===36;if(i&&n)return null;n=i,c+=or[s]}return c}function Je(t){return t===pt?At:nr(t).toString(Oe).substring(0,32)}function st(t){return nr(Oe.parse(t)).toString(Oe).substring(0,2)}function cr(t,o,c){const l=c.padEnd(64,"0");return Dr(Oe.parse(t),Oe.parse(l)).toString(Oe).substring(0,4).toLowerCase()===o.toLowerCase()}function ht(t){return t<=0?0:t===1?xe:t===2?xe*xe:xe*xe*Math.pow(xe+1,t-2)}function Fr(t){if(t===1)return xe;if(t===2)return xe*xe;let o=xe,c=1;for(let n=2;n<=t-2;n++){const r=(o+c)*xe,a=o;o=r,c=a}const l=t>2?o+c:1;return xe*l*xe}function Ur(t,o=bt,c){const l=Math.floor(Date.now()/1e3);return t<=l&&t>=l-o}function Gr(t){return!t.includes("�")}class it{constructor(){this.device=null,this.pipeline=null,this.bindGroupLayout=null,this.paramsBuffer=null,this.matchCountBuffer=null,this.matchIndicesBuffer=null,this.ciphertextBuffer=null,this.ciphertextBufferSize=0,this.matchCountReadBuffers=[null,null],this.matchIndicesReadBuffers=[null,null],this.currentReadBufferIndex=0,this.bindGroup=null,this.bindGroupDirty=!0,this.shaderCode=`
// SHA256 round constants
const K: array<u32, 64> = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

// Character lookup table (a-z = 0-25, 0-9 = 26-35, dash = 36)
const CHARS: array<u32, 37> = array<u32, 37>(
  0x61u, 0x62u, 0x63u, 0x64u, 0x65u, 0x66u, 0x67u, 0x68u, 0x69u, 0x6au, // a-j
  0x6bu, 0x6cu, 0x6du, 0x6eu, 0x6fu, 0x70u, 0x71u, 0x72u, 0x73u, 0x74u, // k-t
  0x75u, 0x76u, 0x77u, 0x78u, 0x79u, 0x7au,                             // u-z
  0x30u, 0x31u, 0x32u, 0x33u, 0x34u, 0x35u, 0x36u, 0x37u, 0x38u, 0x39u, // 0-9
  0x2du                                                                  // dash
);

struct Params {
  target_channel_hash: u32,
  batch_offset: u32,
  name_length: u32,
  batch_size: u32,
  target_mac: u32,           // First 2 bytes of target MAC (in high 16 bits)
  ciphertext_words: u32,     // Number of 32-bit words in ciphertext
  ciphertext_len_bits: u32,  // Length of ciphertext in bits
  verify_mac: u32,           // 1 to verify MAC, 0 to skip
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> match_count: atomic<u32>;
@group(0) @binding(2) var<storage, read_write> match_indices: array<u32>;
@group(0) @binding(3) var<storage, read> ciphertext: array<u32>; // Ciphertext data

fn rotr(x: u32, n: u32) -> u32 {
  return (x >> n) | (x << (32u - n));
}

fn ch(x: u32, y: u32, z: u32) -> u32 {
  return (x & y) ^ (~x & z);
}

fn maj(x: u32, y: u32, z: u32) -> u32 {
  return (x & y) ^ (x & z) ^ (y & z);
}

fn sigma0(x: u32) -> u32 {
  return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u);
}

fn sigma1(x: u32) -> u32 {
  return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u);
}

fn gamma0(x: u32) -> u32 {
  return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u);
}

fn gamma1(x: u32) -> u32 {
  return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u);
}

// Convert index to room name bytes, returns the hash as a u32 for the first byte check
fn index_to_room_name(idx: u32, length: u32, msg: ptr<function, array<u32, 16>>) -> bool {
  // Message starts with '#' (0x23)
  var byte_pos = 0u;
  var word_idx = 0u;
  var current_word = 0x23000000u; // '#' in big-endian position 0
  byte_pos = 1u;

  var remaining = idx;
  var prev_was_dash = false;

  // Generate room name from index
  for (var i = 0u; i < length; i++) {
    let char_count = select(37u, 36u, i == 0u || i == length - 1u); // no dash at start/end
    var char_idx = remaining % char_count;
    remaining = remaining / char_count;

    // Check for consecutive dashes (invalid)
    let is_dash = char_idx == 36u && i > 0u && i < length - 1u;
    if (is_dash && prev_was_dash) {
      return false; // Invalid: consecutive dashes
    }
    prev_was_dash = is_dash;

    // Map char index to actual character
    let c = CHARS[char_idx];

    // Pack byte into current word (big-endian)
    let shift = (3u - byte_pos % 4u) * 8u;
    if (byte_pos % 4u == 0u && byte_pos > 0u) {
      (*msg)[word_idx] = current_word;
      word_idx = word_idx + 1u;
      current_word = 0u;
    }
    current_word = current_word | (c << shift);
    byte_pos = byte_pos + 1u;
  }

  // Add padding: 0x80 followed by zeros, then length in bits
  let msg_len_bits = (length + 1u) * 8u; // +1 for '#'

  // Add 0x80 padding byte
  let shift = (3u - byte_pos % 4u) * 8u;
  if (byte_pos % 4u == 0u) {
    (*msg)[word_idx] = current_word;
    word_idx = word_idx + 1u;
    current_word = 0x80000000u;
  } else {
    current_word = current_word | (0x80u << shift);
  }
  byte_pos = byte_pos + 1u;

  // Store current word
  if (byte_pos % 4u == 0u || word_idx < 14u) {
    (*msg)[word_idx] = current_word;
    word_idx = word_idx + 1u;
  }

  // Zero-fill until word 14
  for (var i = word_idx; i < 14u; i++) {
    (*msg)[i] = 0u;
  }

  // Length in bits (64-bit, but we only use lower 32 bits for short messages)
  (*msg)[14u] = 0u;
  (*msg)[15u] = msg_len_bits;

  return true;
}

fn sha256_block(msg: ptr<function, array<u32, 16>>) -> array<u32, 8> {
  // Initialize hash values
  var h: array<u32, 8> = array<u32, 8>(
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
  );

  // Message schedule
  var w: array<u32, 64>;
  for (var i = 0u; i < 16u; i++) {
    w[i] = (*msg)[i];
  }
  for (var i = 16u; i < 64u; i++) {
    w[i] = gamma1(w[i-2u]) + w[i-7u] + gamma0(w[i-15u]) + w[i-16u];
  }

  // Compression
  var a = h[0]; var b = h[1]; var c = h[2]; var d = h[3];
  var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7];

  for (var i = 0u; i < 64u; i++) {
    let t1 = hh + sigma1(e) + ch(e, f, g) + K[i] + w[i];
    let t2 = sigma0(a) + maj(a, b, c);
    hh = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + t2;
  }

  h[0] = h[0] + a; h[1] = h[1] + b; h[2] = h[2] + c; h[3] = h[3] + d;
  h[4] = h[4] + e; h[5] = h[5] + f; h[6] = h[6] + g; h[7] = h[7] + hh;

  return h;
}

// Compute SHA256 of the key (16 bytes) to get channel hash
fn sha256_key(key: array<u32, 4>) -> u32 {
  var msg: array<u32, 16>;

  // Key bytes (16 bytes = 4 words)
  msg[0] = key[0];
  msg[1] = key[1];
  msg[2] = key[2];
  msg[3] = key[3];

  // Padding: 0x80 followed by zeros
  msg[4] = 0x80000000u;
  for (var i = 5u; i < 14u; i++) {
    msg[i] = 0u;
  }

  // Length: 128 bits
  msg[14] = 0u;
  msg[15] = 128u;

  let hash = sha256_block(&msg);

  // Return first byte of hash (big-endian)
  return hash[0] >> 24u;
}

// HMAC-SHA256 for MAC verification
// Key is 16 bytes (4 words), padded to 32 bytes with zeros for MeshCore
// Returns first 2 bytes of HMAC (as u32 in high 16 bits)
fn hmac_sha256_mac(key: array<u32, 4>, ciphertext_len: u32) -> u32 {
  // HMAC: H((K' ^ opad) || H((K' ^ ipad) || message))
  // K' is 64 bytes (32 bytes key + 32 bytes zero padding for MeshCore, then padded to 64)
  // ipad = 0x36 repeated, opad = 0x5c repeated

  // Build padded key (64 bytes = 16 words)
  // MeshCore uses 32-byte secret: 16-byte key + 16 zero bytes
  var k_pad: array<u32, 16>;
  k_pad[0] = key[0];
  k_pad[1] = key[1];
  k_pad[2] = key[2];
  k_pad[3] = key[3];
  for (var i = 4u; i < 16u; i++) {
    k_pad[i] = 0u;
  }

  // Inner hash: SHA256((K' ^ ipad) || message)
  // First block: K' ^ ipad (64 bytes)
  var inner_block: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) {
    inner_block[i] = k_pad[i] ^ 0x36363636u;
  }

  // Initialize hash state with first block
  var h: array<u32, 8> = sha256_block(&inner_block);

  // Process ciphertext blocks (continuing from h state)
  let ciphertext_words = params.ciphertext_words;
  var word_idx = 0u;

  // Process full 64-byte blocks of ciphertext
  while (word_idx + 16u <= ciphertext_words) {
    var block: array<u32, 16>;
    for (var i = 0u; i < 16u; i++) {
      block[i] = ciphertext[word_idx + i];
    }
    h = sha256_block_continue(&block, h);
    word_idx = word_idx + 16u;
  }

  // Final block with remaining ciphertext + padding
  var final_block: array<u32, 16>;
  var remaining = ciphertext_words - word_idx;
  for (var i = 0u; i < 16u; i++) {
    if (i < remaining) {
      final_block[i] = ciphertext[word_idx + i];
    } else if (i == remaining) {
      // Add 0x80 padding
      final_block[i] = 0x80000000u;
    } else {
      final_block[i] = 0u;
    }
  }

  // Add length (64 bytes of ipad + ciphertext length)
  let total_bits = 512u + params.ciphertext_len_bits;
  if (remaining < 14u) {
    final_block[14] = 0u;
    final_block[15] = total_bits;
    h = sha256_block_continue(&final_block, h);
  } else {
    // Need extra block for length
    h = sha256_block_continue(&final_block, h);
    var len_block: array<u32, 16>;
    for (var i = 0u; i < 14u; i++) {
      len_block[i] = 0u;
    }
    len_block[14] = 0u;
    len_block[15] = total_bits;
    h = sha256_block_continue(&len_block, h);
  }

  let inner_hash = h;

  // Outer hash: SHA256((K' ^ opad) || inner_hash)
  var outer_block: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) {
    outer_block[i] = k_pad[i] ^ 0x5c5c5c5cu;
  }
  h = sha256_block(&outer_block);

  // Second block: inner_hash (32 bytes) + padding
  var hash_block: array<u32, 16>;
  for (var i = 0u; i < 8u; i++) {
    hash_block[i] = inner_hash[i];
  }
  hash_block[8] = 0x80000000u;
  for (var i = 9u; i < 14u; i++) {
    hash_block[i] = 0u;
  }
  hash_block[14] = 0u;
  hash_block[15] = 512u + 256u; // 64 bytes opad + 32 bytes inner hash

  h = sha256_block_continue(&hash_block, h);

  // Return first 2 bytes (high 16 bits of first word)
  return h[0] & 0xFFFF0000u;
}

// SHA256 block computation continuing from existing state
fn sha256_block_continue(msg: ptr<function, array<u32, 16>>, h_in: array<u32, 8>) -> array<u32, 8> {
  var h = h_in;

  // Message schedule
  var w: array<u32, 64>;
  for (var i = 0u; i < 16u; i++) {
    w[i] = (*msg)[i];
  }
  for (var i = 16u; i < 64u; i++) {
    w[i] = gamma1(w[i-2u]) + w[i-7u] + gamma0(w[i-15u]) + w[i-16u];
  }

  // Compression
  var a = h[0]; var b = h[1]; var c = h[2]; var d = h[3];
  var e = h[4]; var f = h[5]; var g = h[6]; var hh = h[7];

  for (var i = 0u; i < 64u; i++) {
    let t1 = hh + sigma1(e) + ch(e, f, g) + K[i] + w[i];
    let t2 = sigma0(a) + maj(a, b, c);
    hh = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + t2;
  }

  h[0] = h[0] + a; h[1] = h[1] + b; h[2] = h[2] + c; h[3] = h[3] + d;
  h[4] = h[4] + e; h[5] = h[5] + f; h[6] = h[6] + g; h[7] = h[7] + hh;

  return h;
}

// Process a single candidate and record match if found
fn process_candidate(name_idx: u32) {
  // Generate message for this room name
  var msg: array<u32, 16>;
  let valid = index_to_room_name(name_idx, params.name_length, &msg);

  if (!valid) {
    return;
  }

  // Compute SHA256("#roomname") - this gives us the key
  let key_hash = sha256_block(&msg);

  // Take first 16 bytes (4 words) as the key
  var key: array<u32, 4>;
  key[0] = key_hash[0];
  key[1] = key_hash[1];
  key[2] = key_hash[2];
  key[3] = key_hash[3];

  // Compute SHA256(key) to get channel hash
  let channel_hash = sha256_key(key);

  // Check if channel hash matches target
  if (channel_hash != params.target_channel_hash) {
    return;
  }

  // Channel hash matches - verify MAC if enabled
  if (params.verify_mac == 1u) {
    let computed_mac = hmac_sha256_mac(key, params.ciphertext_len_bits);
    if (computed_mac != params.target_mac) {
      return;
    }
  }

  // Found a match - record the index
  let match_idx = atomicAdd(&match_count, 1u);
  if (match_idx < 1024u) { // Limit stored matches
    match_indices[match_idx] = name_idx;
  }
}

// Each thread processes 32 candidates to amortize thread overhead
const CANDIDATES_PER_THREAD: u32 = 32u;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let base_idx = global_id.x * CANDIDATES_PER_THREAD;

  for (var i = 0u; i < CANDIDATES_PER_THREAD; i++) {
    let idx = base_idx + i;
    if (idx >= params.batch_size) {
      return;
    }
    let name_idx = params.batch_offset + idx;
    process_candidate(name_idx);
  }
}
`}async init(){if(!navigator.gpu)return console.warn("WebGPU not supported"),!1;try{const o=await navigator.gpu.requestAdapter();if(!o)return console.warn("No GPU adapter found"),!1;this.device=await o.requestDevice(),this.bindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}}]}),this.paramsBuffer=this.device.createBuffer({size:32,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.matchCountBuffer=this.device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.matchIndicesBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC});for(let n=0;n<2;n++)this.matchCountReadBuffers[n]=this.device.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.matchIndicesReadBuffers[n]=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const c=this.device.createShaderModule({code:this.shaderCode}),l=this.device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});return this.pipeline=this.device.createComputePipeline({layout:l,compute:{module:c,entryPoint:"main"}}),!0}catch(o){return console.error("WebGPU initialization failed:",o),!1}}isAvailable(){return this.device!==null&&this.pipeline!==null}indexToRoomName(o,c){return ze(c,o)}countNamesForLength(o){return Fr(o)}async runBatch(o,c,l,n,r,a){if(!this.device||!this.pipeline||!this.bindGroupLayout||!this.paramsBuffer||!this.matchCountBuffer||!this.matchIndicesBuffer||!this.matchCountReadBuffers[0]||!this.matchCountReadBuffers[1]||!this.matchIndicesReadBuffers[0]||!this.matchIndicesReadBuffers[1])throw new Error("GPU not initialized");const e=this.currentReadBufferIndex;this.currentReadBufferIndex=1-this.currentReadBufferIndex;const A=this.matchCountReadBuffers[e],s=this.matchIndicesReadBuffers[e],i=r&&a?1:0;let u,f=0,y=0;if(i){const m=new Uint8Array(r.length/2);for(let F=0;F<m.length;F++)m[F]=parseInt(r.substr(F*2,2),16);f=m.length*8;const E=Math.ceil(m.length/4)*4,T=new Uint8Array(E);T.set(m),u=new Uint32Array(E/4);for(let F=0;F<u.length;F++)u[F]=T[F*4]<<24|T[F*4+1]<<16|T[F*4+2]<<8|T[F*4+3];const C=parseInt(a.substr(0,2),16),I=parseInt(a.substr(2,2),16);y=C<<24|I<<16}else u=new Uint32Array([0]);const b=Math.max(u.length*4,4);(!this.ciphertextBuffer||this.ciphertextBufferSize<b)&&(this.ciphertextBuffer&&this.ciphertextBuffer.destroy(),this.ciphertextBuffer=this.device.createBuffer({size:b,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.ciphertextBufferSize=b,this.bindGroupDirty=!0);const S=new Uint32Array([o,l,c,n,y,u.length,f,i]);this.device.queue.writeBuffer(this.paramsBuffer,0,S),this.device.queue.writeBuffer(this.ciphertextBuffer,0,u),this.device.queue.writeBuffer(this.matchCountBuffer,0,it.ZERO_DATA),(this.bindGroupDirty||!this.bindGroup)&&(this.bindGroup=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.paramsBuffer}},{binding:1,resource:{buffer:this.matchCountBuffer}},{binding:2,resource:{buffer:this.matchIndicesBuffer}},{binding:3,resource:{buffer:this.ciphertextBuffer}}]}),this.bindGroupDirty=!1);const h=this.device.createCommandEncoder(),d=h.beginComputePass();d.setPipeline(this.pipeline),d.setBindGroup(0,this.bindGroup),d.dispatchWorkgroups(Math.ceil(n/(256*32))),d.end(),h.copyBufferToBuffer(this.matchCountBuffer,0,A,0,4),h.copyBufferToBuffer(this.matchIndicesBuffer,0,s,0,1024*4),this.device.queue.submit([h.finish()]),await A.mapAsync(GPUMapMode.READ);const g=new Uint32Array(A.getMappedRange())[0];A.unmap();const w=[];if(g>0){await s.mapAsync(GPUMapMode.READ);const m=new Uint32Array(s.getMappedRange());for(let E=0;E<Math.min(g,1024);E++)w.push(m[E]);s.unmap()}return w}destroy(){var o,c,l,n,r,a,e,A;(o=this.paramsBuffer)==null||o.destroy(),(c=this.matchCountBuffer)==null||c.destroy(),(l=this.matchIndicesBuffer)==null||l.destroy(),(n=this.ciphertextBuffer)==null||n.destroy(),(r=this.matchCountReadBuffers[0])==null||r.destroy(),(a=this.matchCountReadBuffers[1])==null||a.destroy(),(e=this.matchIndicesReadBuffers[0])==null||e.destroy(),(A=this.matchIndicesReadBuffers[1])==null||A.destroy(),this.paramsBuffer=null,this.matchCountBuffer=null,this.matchIndicesBuffer=null,this.ciphertextBuffer=null,this.ciphertextBufferSize=0,this.matchCountReadBuffers=[null,null],this.matchIndicesReadBuffers=[null,null],this.currentReadBufferIndex=0,this.bindGroup=null,this.bindGroupDirty=!0,this.device&&(this.device.destroy(),this.device=null),this.pipeline=null,this.bindGroupLayout=null}}it.ZERO_DATA=new Uint32Array([0]);function Qr(){return typeof navigator<"u"&&"gpu"in navigator}class ot{constructor(){this.device=null,this.pipeline=null,this.bindGroupLayout=null,this.paramsBuffer=null,this.matchCountBuffer=null,this.matchIBuffer=null,this.matchJBuffer=null,this.ciphertextBuffer=null,this.wordDataBuffer=null,this.wordOffsetsBuffer=null,this.matchCountReadBuffer=null,this.matchIReadBuffer=null,this.matchJReadBuffer=null,this.wordCount=0,this.ciphertextBufferSize=0,this.shaderCode=`
// SHA256 round constants
const K: array<u32, 64> = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u
);

// Pre-computed HMAC ipad/opad XOR states for common key padding (0x36/0x5c repeated)
const IPAD_XOR: u32 = 0x36363636u;
const OPAD_XOR: u32 = 0x5c5c5c5cu;

struct Params {
  target_channel_hash: u32,
  word_count: u32,
  i_start: u32,           // Starting i index (row) - computed on CPU from 64-bit offset
  j_start: u32,           // Starting j index (col) - computed on CPU from 64-bit offset
  batch_size: u32,
  target_mac: u32,
  ciphertext_words: u32,
  ciphertext_len_bits: u32,
  max_combined_len: u32,
  _padding: u32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read_write> match_count: atomic<u32>;
@group(0) @binding(2) var<storage, read_write> match_i: array<u32>;  // Separate array for i indices
@group(0) @binding(3) var<storage, read_write> match_j: array<u32>;  // Separate array for j indices
@group(0) @binding(4) var<storage, read> ciphertext: array<u32>;
@group(0) @binding(5) var<storage, read> word_data: array<u32>;
@group(0) @binding(6) var<storage, read> word_offsets: array<u32>;

// Inline bit rotation for better performance
fn rotr(x: u32, n: u32) -> u32 {
  return (x >> n) | (x << (32u - n));
}

// SHA256 compression function - processes one 64-byte block
// Takes mutable state h and message block msg
fn sha256_compress(h: ptr<function, array<u32, 8>>, msg: ptr<function, array<u32, 16>>) {
  var w: array<u32, 64>;

  // Load message into first 16 words
  w[0] = (*msg)[0]; w[1] = (*msg)[1]; w[2] = (*msg)[2]; w[3] = (*msg)[3];
  w[4] = (*msg)[4]; w[5] = (*msg)[5]; w[6] = (*msg)[6]; w[7] = (*msg)[7];
  w[8] = (*msg)[8]; w[9] = (*msg)[9]; w[10] = (*msg)[10]; w[11] = (*msg)[11];
  w[12] = (*msg)[12]; w[13] = (*msg)[13]; w[14] = (*msg)[14]; w[15] = (*msg)[15];

  // Extend message schedule
  for (var i = 16u; i < 64u; i++) {
    let s0 = rotr(w[i-15u], 7u) ^ rotr(w[i-15u], 18u) ^ (w[i-15u] >> 3u);
    let s1 = rotr(w[i-2u], 17u) ^ rotr(w[i-2u], 19u) ^ (w[i-2u] >> 10u);
    w[i] = w[i-16u] + s0 + w[i-7u] + s1;
  }

  var a = (*h)[0]; var b = (*h)[1]; var c = (*h)[2]; var d = (*h)[3];
  var e = (*h)[4]; var f = (*h)[5]; var g = (*h)[6]; var hv = (*h)[7];

  // Main compression loop
  for (var i = 0u; i < 64u; i++) {
    let S1 = rotr(e, 6u) ^ rotr(e, 11u) ^ rotr(e, 25u);
    let ch = (e & f) ^ (~e & g);
    let t1 = hv + S1 + ch + K[i] + w[i];
    let S0 = rotr(a, 2u) ^ rotr(a, 13u) ^ rotr(a, 22u);
    let maj = (a & b) ^ (a & c) ^ (b & c);
    let t2 = S0 + maj;
    hv = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + t2;
  }

  (*h)[0] += a; (*h)[1] += b; (*h)[2] += c; (*h)[3] += d;
  (*h)[4] += e; (*h)[5] += f; (*h)[6] += g; (*h)[7] += hv;
}

// Initialize SHA256 state
fn sha256_init() -> array<u32, 8> {
  return array<u32, 8>(
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u
  );
}

// Compute channel hash from 16-byte key
fn compute_channel_hash(key: array<u32, 4>) -> u32 {
  var h = sha256_init();
  var msg: array<u32, 16>;
  msg[0] = key[0]; msg[1] = key[1]; msg[2] = key[2]; msg[3] = key[3];
  msg[4] = 0x80000000u;
  msg[5] = 0u; msg[6] = 0u; msg[7] = 0u; msg[8] = 0u; msg[9] = 0u;
  msg[10] = 0u; msg[11] = 0u; msg[12] = 0u; msg[13] = 0u; msg[14] = 0u;
  msg[15] = 128u;
  sha256_compress(&h, &msg);
  return h[0] >> 24u;
}

// HMAC-SHA256 with precomputed ipad/opad states (optimization from OpenCL version)
// Returns first 2 bytes of HMAC as u32 (in high 16 bits)
fn hmac_sha256_optimized(key: array<u32, 4>) -> u32 {
  // Precompute ipad state: SHA256 state after processing (key XOR ipad)
  var h_ipad = sha256_init();
  var ipad_block: array<u32, 16>;
  ipad_block[0] = key[0] ^ IPAD_XOR;
  ipad_block[1] = key[1] ^ IPAD_XOR;
  ipad_block[2] = key[2] ^ IPAD_XOR;
  ipad_block[3] = key[3] ^ IPAD_XOR;
  ipad_block[4] = IPAD_XOR; ipad_block[5] = IPAD_XOR; ipad_block[6] = IPAD_XOR; ipad_block[7] = IPAD_XOR;
  ipad_block[8] = IPAD_XOR; ipad_block[9] = IPAD_XOR; ipad_block[10] = IPAD_XOR; ipad_block[11] = IPAD_XOR;
  ipad_block[12] = IPAD_XOR; ipad_block[13] = IPAD_XOR; ipad_block[14] = IPAD_XOR; ipad_block[15] = IPAD_XOR;
  sha256_compress(&h_ipad, &ipad_block);

  // Process ciphertext with ipad state
  var h = h_ipad;
  let ct_words = params.ciphertext_words;
  var word_idx = 0u;

  // Process full blocks
  while (word_idx + 16u <= ct_words) {
    var block: array<u32, 16>;
    block[0] = ciphertext[word_idx]; block[1] = ciphertext[word_idx+1u];
    block[2] = ciphertext[word_idx+2u]; block[3] = ciphertext[word_idx+3u];
    block[4] = ciphertext[word_idx+4u]; block[5] = ciphertext[word_idx+5u];
    block[6] = ciphertext[word_idx+6u]; block[7] = ciphertext[word_idx+7u];
    block[8] = ciphertext[word_idx+8u]; block[9] = ciphertext[word_idx+9u];
    block[10] = ciphertext[word_idx+10u]; block[11] = ciphertext[word_idx+11u];
    block[12] = ciphertext[word_idx+12u]; block[13] = ciphertext[word_idx+13u];
    block[14] = ciphertext[word_idx+14u]; block[15] = ciphertext[word_idx+15u];
    sha256_compress(&h, &block);
    word_idx += 16u;
  }

  // Final block with remaining ciphertext + padding
  var final_block: array<u32, 16>;
  let remaining = ct_words - word_idx;
  for (var i = 0u; i < 16u; i++) {
    if (i < remaining) {
      final_block[i] = ciphertext[word_idx + i];
    } else if (i == remaining) {
      final_block[i] = 0x80000000u;
    } else {
      final_block[i] = 0u;
    }
  }

  let total_bits = 512u + params.ciphertext_len_bits;
  if (remaining < 14u) {
    final_block[14] = 0u;
    final_block[15] = total_bits;
    sha256_compress(&h, &final_block);
  } else {
    sha256_compress(&h, &final_block);
    var len_block: array<u32, 16>;
    for (var i = 0u; i < 14u; i++) { len_block[i] = 0u; }
    len_block[14] = 0u;
    len_block[15] = total_bits;
    sha256_compress(&h, &len_block);
  }

  // Inner hash complete, now outer hash
  // Precompute opad state
  var h_opad = sha256_init();
  var opad_block: array<u32, 16>;
  opad_block[0] = key[0] ^ OPAD_XOR;
  opad_block[1] = key[1] ^ OPAD_XOR;
  opad_block[2] = key[2] ^ OPAD_XOR;
  opad_block[3] = key[3] ^ OPAD_XOR;
  opad_block[4] = OPAD_XOR; opad_block[5] = OPAD_XOR; opad_block[6] = OPAD_XOR; opad_block[7] = OPAD_XOR;
  opad_block[8] = OPAD_XOR; opad_block[9] = OPAD_XOR; opad_block[10] = OPAD_XOR; opad_block[11] = OPAD_XOR;
  opad_block[12] = OPAD_XOR; opad_block[13] = OPAD_XOR; opad_block[14] = OPAD_XOR; opad_block[15] = OPAD_XOR;
  sha256_compress(&h_opad, &opad_block);

  // Final HMAC block: inner_hash + padding
  var hash_block: array<u32, 16>;
  hash_block[0] = h[0]; hash_block[1] = h[1]; hash_block[2] = h[2]; hash_block[3] = h[3];
  hash_block[4] = h[4]; hash_block[5] = h[5]; hash_block[6] = h[6]; hash_block[7] = h[7];
  hash_block[8] = 0x80000000u;
  hash_block[9] = 0u; hash_block[10] = 0u; hash_block[11] = 0u;
  hash_block[12] = 0u; hash_block[13] = 0u; hash_block[14] = 0u;
  hash_block[15] = 512u + 256u;
  sha256_compress(&h_opad, &hash_block);

  return h_opad[0] & 0xFFFF0000u;
}

// Read a byte from packed word data (big-endian within u32)
fn read_byte(byte_offset: u32) -> u32 {
  let word_idx = byte_offset >> 2u;
  let byte_in_word = byte_offset & 3u;
  let word = word_data[word_idx];
  return (word >> ((3u - byte_in_word) << 3u)) & 0xFFu;
}

// Process a single word pair
fn process_word_pair(word1_idx: u32, word2_idx: u32) -> bool {
  let offset_len1 = word_offsets[word1_idx];
  let offset1 = offset_len1 >> 8u;    // 24 bits for offset (up to 16M bytes)
  let len1 = offset_len1 & 0xFFu;     // 8 bits for length (up to 255 chars)

  let offset_len2 = word_offsets[word2_idx];
  let offset2 = offset_len2 >> 8u;
  let len2 = offset_len2 & 0xFFu;

  let combined_len = len1 + len2;
  if (combined_len > params.max_combined_len) {
    return false;
  }

  // Check for consecutive dashes at join point
  if (len1 > 0u && len2 > 0u) {
    let last1 = read_byte(offset1 + len1 - 1u);
    let first2 = read_byte(offset2);
    if (last1 == 0x2du && first2 == 0x2du) {
      return false;
    }
  }

  // Build message: "#" + word1 + word2
  var msg: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) { msg[i] = 0u; }

  let total_len = 1u + combined_len;
  var byte_pos = 0u;
  var current_word = 0x23000000u;  // '#' at position 0
  byte_pos = 1u;

  // Copy word1
  for (var i = 0u; i < len1; i++) {
    let c = read_byte(offset1 + i);
    let shift = (3u - (byte_pos & 3u)) << 3u;
    current_word |= c << shift;
    byte_pos++;
    if ((byte_pos & 3u) == 0u) {
      msg[(byte_pos >> 2u) - 1u] = current_word;
      current_word = 0u;
    }
  }

  // Copy word2
  for (var i = 0u; i < len2; i++) {
    let c = read_byte(offset2 + i);
    let shift = (3u - (byte_pos & 3u)) << 3u;
    current_word |= c << shift;
    byte_pos++;
    if ((byte_pos & 3u) == 0u) {
      msg[(byte_pos >> 2u) - 1u] = current_word;
      current_word = 0u;
    }
  }

  // Add 0x80 padding
  let shift = (3u - (byte_pos & 3u)) << 3u;
  current_word |= 0x80u << shift;
  msg[(byte_pos) >> 2u] = current_word;
  msg[15] = total_len << 3u;

  // Compute key = SHA256("#" + word1 + word2)
  var h = sha256_init();
  sha256_compress(&h, &msg);

  let key = array<u32, 4>(h[0], h[1], h[2], h[3]);

  // Check channel hash first (fast rejection)
  if (compute_channel_hash(key) != params.target_channel_hash) {
    return false;
  }

  // Verify MAC (expensive, only if channel hash matches)
  return hmac_sha256_optimized(key) == params.target_mac;
}

// Process multiple pairs per thread for better throughput
const PAIRS_PER_THREAD: u32 = 32u;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let base_idx = global_id.x * PAIRS_PER_THREAD;
  let word_count = params.word_count;
  let batch_size = params.batch_size;

  // i_start and j_start are computed on CPU from 64-bit batch_offset
  // This avoids needing 64-bit math in WGSL
  let i_start = params.i_start;
  let j_start = params.j_start;

  for (var p = 0u; p < PAIRS_PER_THREAD; p++) {
    let offset = base_idx + p;
    if (offset >= batch_size) { return; }

    // Compute actual (i, j) from starting position + offset
    // offset = local_i * word_count + local_j where local_j < word_count
    let total_j = j_start + offset;
    let extra_i = total_j / word_count;
    let i = i_start + extra_i;
    let j = total_j % word_count;

    if (i >= word_count) { return; }

    if (process_word_pair(i, j)) {
      let idx = atomicAdd(&match_count, 1u);
      if (idx < 1024u) {
        match_i[idx] = i;
        match_j[idx] = j;
      }
    }
  }
}
`}async init(){if(!navigator.gpu)return!1;try{const o=await navigator.gpu.requestAdapter();if(!o)return!1;this.device=await o.requestDevice(),this.bindGroupLayout=this.device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:"storage"}},{binding:4,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:5,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}},{binding:6,visibility:GPUShaderStage.COMPUTE,buffer:{type:"read-only-storage"}}]}),this.paramsBuffer=this.device.createBuffer({size:40,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),this.matchCountBuffer=this.device.createBuffer({size:4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),this.matchIBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.matchJBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),this.matchCountReadBuffer=this.device.createBuffer({size:4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.matchIReadBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),this.matchJReadBuffer=this.device.createBuffer({size:1024*4,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});const c=this.device.createShaderModule({code:this.shaderCode}),l=this.device.createPipelineLayout({bindGroupLayouts:[this.bindGroupLayout]});return this.pipeline=this.device.createComputePipeline({layout:l,compute:{module:c,entryPoint:"main"}}),!0}catch(o){return console.error("WebGPU word pairs initialization failed:",o),!1}}uploadWords(o){if(!this.device)throw new Error("GPU not initialized");this.wordCount=o.length;let c=0;for(const e of o)c+=e.length;const l=new Uint8Array(Math.ceil(c/4)*4),n=new Uint32Array(o.length);let r=0;for(let e=0;e<o.length;e++){const A=o[e];n[e]=r<<8|A.length;for(let s=0;s<A.length;s++)l[r++]=A.charCodeAt(s)}const a=new Uint32Array(Math.ceil(c/4));for(let e=0;e<a.length;e++)a[e]=l[e*4]<<24|l[e*4+1]<<16|l[e*4+2]<<8|l[e*4+3];this.wordDataBuffer&&this.wordDataBuffer.destroy(),this.wordOffsetsBuffer&&this.wordOffsetsBuffer.destroy(),this.wordDataBuffer=this.device.createBuffer({size:Math.max(a.byteLength,4),usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.wordDataBuffer,0,a),this.wordOffsetsBuffer=this.device.createBuffer({size:n.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.device.queue.writeBuffer(this.wordOffsetsBuffer,0,n)}async runBatch(o,c,l,n,r){if(!this.device||!this.pipeline||!this.bindGroupLayout||!this.paramsBuffer||!this.matchCountBuffer||!this.matchIBuffer||!this.matchJBuffer||!this.matchCountReadBuffer||!this.matchIReadBuffer||!this.matchJReadBuffer||!this.wordDataBuffer||!this.wordOffsetsBuffer)throw new Error("GPU not initialized or words not uploaded");const a=new Uint8Array(n.length/2);for(let C=0;C<a.length;C++)a[C]=parseInt(n.substr(C*2,2),16);const e=a.length*8,A=Math.ceil(a.length/4)*4,s=new Uint8Array(A);s.set(a);const i=new Uint32Array(A/4);for(let C=0;C<i.length;C++)i[C]=s[C*4]<<24|s[C*4+1]<<16|s[C*4+2]<<8|s[C*4+3];const u=parseInt(r.substr(0,2),16),f=parseInt(r.substr(2,2),16),y=u<<24|f<<16,b=Math.max(i.length*4,4);(!this.ciphertextBuffer||this.ciphertextBufferSize<b)&&(this.ciphertextBuffer&&this.ciphertextBuffer.destroy(),this.ciphertextBuffer=this.device.createBuffer({size:b,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),this.ciphertextBufferSize=b);const S=Math.floor(c/this.wordCount),h=c%this.wordCount,d=new Uint32Array([o,this.wordCount,S,h,l,y,i.length,e,30,0]);this.device.queue.writeBuffer(this.paramsBuffer,0,d),this.device.queue.writeBuffer(this.ciphertextBuffer,0,i),this.device.queue.writeBuffer(this.matchCountBuffer,0,ot.ZERO_DATA);const x=this.device.createBindGroup({layout:this.bindGroupLayout,entries:[{binding:0,resource:{buffer:this.paramsBuffer}},{binding:1,resource:{buffer:this.matchCountBuffer}},{binding:2,resource:{buffer:this.matchIBuffer}},{binding:3,resource:{buffer:this.matchJBuffer}},{binding:4,resource:{buffer:this.ciphertextBuffer}},{binding:5,resource:{buffer:this.wordDataBuffer}},{binding:6,resource:{buffer:this.wordOffsetsBuffer}}]}),g=this.device.createCommandEncoder(),w=g.beginComputePass();w.setPipeline(this.pipeline),w.setBindGroup(0,x),w.dispatchWorkgroups(Math.ceil(l/(256*32))),w.end(),g.copyBufferToBuffer(this.matchCountBuffer,0,this.matchCountReadBuffer,0,4),g.copyBufferToBuffer(this.matchIBuffer,0,this.matchIReadBuffer,0,1024*4),g.copyBufferToBuffer(this.matchJBuffer,0,this.matchJReadBuffer,0,1024*4),this.device.queue.submit([g.finish()]),await this.matchCountReadBuffer.mapAsync(GPUMapMode.READ);const E=new Uint32Array(this.matchCountReadBuffer.getMappedRange())[0];this.matchCountReadBuffer.unmap();const T=[];if(E>0){await this.matchIReadBuffer.mapAsync(GPUMapMode.READ),await this.matchJReadBuffer.mapAsync(GPUMapMode.READ);const C=new Uint32Array(this.matchIReadBuffer.getMappedRange()),I=new Uint32Array(this.matchJReadBuffer.getMappedRange());for(let F=0;F<Math.min(E,1024);F++)T.push([C[F],I[F]]);this.matchIReadBuffer.unmap(),this.matchJReadBuffer.unmap()}return T}getWordCount(){return this.wordCount}destroy(){var o,c,l,n,r,a,e,A,s,i;(o=this.paramsBuffer)==null||o.destroy(),(c=this.matchCountBuffer)==null||c.destroy(),(l=this.matchIBuffer)==null||l.destroy(),(n=this.matchJBuffer)==null||n.destroy(),(r=this.ciphertextBuffer)==null||r.destroy(),(a=this.wordDataBuffer)==null||a.destroy(),(e=this.wordOffsetsBuffer)==null||e.destroy(),(A=this.matchCountReadBuffer)==null||A.destroy(),(s=this.matchIReadBuffer)==null||s.destroy(),(i=this.matchJReadBuffer)==null||i.destroy(),this.device&&(this.device.destroy(),this.device=null),this.pipeline=null,this.bindGroupLayout=null}}ot.ZERO_DATA=new Uint32Array([0]);class zt{runBatch(o,c,l,n,r,a){const e=[],A=o.toString(16).padStart(2,"0"),s=!!(r&&a);for(let i=0;i<n;i++){const u=l+i,f=ze(c,u);if(!f)continue;const y=Je("#"+f);st(y)===A&&(s&&!cr(r,a,y)||e.push(u))}return e}destroy(){}}const Nr=/^[a-z0-9-]+$/,qr=/^[a-z0-9].*[a-z0-9]$|^[a-z0-9]$/,Lr=/--/;function ft(t){return!(!t||t.length===0||!Nr.test(t)||t.length>1&&!qr.test(t)||Lr.test(t))}class jr{constructor(){this.gpuInstance=null,this.gpuWordPairs=null,this.cpuInstance=null,this.wordlist=[],this.abortFlag=!1,this.useTimestampFilter=!0,this.useUtf8Filter=!0,this.useSenderFilter=!0,this.validSeconds=bt,this.useCpu=!1}async loadWordlist(o){const c=await fetch(o);if(!c.ok)throw new Error(`Failed to load wordlist: ${c.status} ${c.statusText}`);const n=(await c.text()).split(`
`).map(r=>r.trim().toLowerCase()).filter(r=>r.length>0);this.wordlist=n.filter(ft)}setWordlist(o){this.wordlist=o.map(c=>c.trim().toLowerCase()).filter(ft)}abort(){this.abortFlag=!0}isGpuAvailable(){return Qr()}async decodePacket(o){var l;const c=o.trim().replace(/\s+/g,"").replace(/^0x/i,"");if(!c||!/^[0-9a-fA-F]+$/.test(c))return null;try{const r=(l=(await Xt.MeshCorePacketDecoder.decodeWithVerification(c,{})).payload)==null?void 0:l.decoded;return!(r!=null&&r.channelHash)||!(r!=null&&r.ciphertext)||!(r!=null&&r.cipherMac)?null:{channelHash:r.channelHash.toLowerCase(),ciphertext:r.ciphertext.toLowerCase(),cipherMac:r.cipherMac.toLowerCase(),isGroupText:!0}}catch{return null}}async crack(o,c,l){this.abortFlag=!1,this.useTimestampFilter=(c==null?void 0:c.useTimestampFilter)??!0,this.useUtf8Filter=(c==null?void 0:c.useUtf8Filter)??!0,this.useSenderFilter=(c==null?void 0:c.useSenderFilter)??!0,this.validSeconds=(c==null?void 0:c.validSeconds)??bt,this.useCpu=(c==null?void 0:c.forceCpu)??!1;const n=(c==null?void 0:c.maxLength)??8,r=(c==null?void 0:c.startingLength)??1,a=(c==null?void 0:c.useDictionary)??!0,e=(c==null?void 0:c.useTwoWordCombinations)??!1,A=(c==null?void 0:c.startFromType)??"bruteforce",s=o.toLowerCase(),i=await this.decodePacket(s);if(!i)return{found:!1,error:"Invalid packet or not a GroupText packet"};const{channelHash:u,ciphertext:f,cipherMac:y}=i,b=parseInt(u,16);this.useCpu?this.cpuInstance||(this.cpuInstance=new zt):this.gpuInstance||(this.gpuInstance=new it,await this.gpuInstance.init()||(this.useCpu=!0,this.cpuInstance=new zt));const S=performance.now();let h=0,d=performance.now(),x=r,g=0,w=0,m=!1,E=!1,T=0,C=0;if(c!=null&&c.startFrom){const R=c.startFrom.toLowerCase();if(A==="dictionary"){const P=this.wordlist.indexOf(R);P>=0&&(w=P+1)}else if(A==="dictionary-pair"){m=!0;const P=R.indexOf("+");P>0&&(c._pairResumeWord1=R.substring(0,P),c._pairResumeWord2=R.substring(P+1))}else{m=!0,E=!0;const P=Vr(R);P&&(x=Math.max(r,P.length),g=P.index+1,g>=ht(x)&&(x++,g=0))}}let I=0;a&&!m&&this.wordlist.length>0&&(I+=this.wordlist.length-w);const F=30,ce=15;let D=[],$=[],J=0,ae=[],le=[];if(a&&e&&!E&&this.wordlist.length>0){D=this.wordlist.filter(O=>O.length<=ce),$=D.map(O=>O.length);const R=c;if(R._pairResumeWord1&&R._pairResumeWord2){const O=D.indexOf(R._pairResumeWord1),G=D.indexOf(R._pairResumeWord2);O>=0&&G>=0&&(T=O,C=G+1,C>=D.length&&(T++,C=0))}ae=new Array(ce+1).fill(0);for(const O of $)ae[O]++;le=new Array(F+1).fill(0);let P=0;for(let O=0;O<=F;O++)O<=ce&&(P+=ae[O]),le[O]=P;for(let O=T;O<D.length;O++){const G=$[O],re=F-G,X=le[Math.min(re,ce)];O===T&&C>0?J+=Math.max(0,X-C):J+=X}I+=J}for(let R=x;R<=n;R++)I+=ht(R);I-=g;const Q=(R,P,O)=>{if(!l)return;const re=(performance.now()-S)/1e3,X=re>0?Math.round(h/re):0,pe=I-h,ue=X>0?pe/X:0;l({checked:h,total:I,percent:I>0?Math.min(100,h/I*100):0,rateKeysPerSec:X,etaSeconds:ue,elapsedSeconds:re,currentLength:P,currentPosition:O,phase:R})},he=R=>{if(!cr(f,y,R))return{valid:!1};const P=Xt.ChannelCrypto.decryptGroupTextMessage(f,y,R);return!P.success||!P.data?{valid:!1}:this.useTimestampFilter&&!Ur(P.data.timestamp,this.validSeconds)?{valid:!1}:this.useUtf8Filter&&!Gr(P.data.message)?{valid:!1}:this.useSenderFilter&&!P.data.sender?{valid:!1}:{valid:!0,message:P.data.sender?`${P.data.sender}: ${P.data.message}`:P.data.message}};if(!m&&w===0&&x===r&&g===0){Q("public-key",0,pt);const R=st(At);if(u===R){const P=he(At);if(P.valid)return{found:!0,roomName:pt,key:At,decryptedMessage:P.message}}}let L,Z;const ye=()=>({found:!1,aborted:!0,resumeFrom:L,resumeType:Z});if(a&&!m&&this.wordlist.length>0)for(let R=w;R<this.wordlist.length;R++){if(this.abortFlag)return ye();const P=this.wordlist[R],O=Je("#"+P),G=st(O);if(parseInt(G,16)===b){const X=he(O);if(X.valid)return{found:!0,roomName:P,key:O,decryptedMessage:X.message,resumeFrom:P,resumeType:"dictionary"}}h++,L=P,Z="dictionary";const re=performance.now();re-d>=200&&(Q("wordlist",P.length,P),d=re,await new Promise(X=>setTimeout(X,0)))}if(a&&e&&!E&&D.length>0){const R=D.length*D.length,P=T*D.length+C;let O=!this.useCpu;if(O&&(this.gpuWordPairs||(this.gpuWordPairs=new ot,await this.gpuWordPairs.init()||(O=!1,this.gpuWordPairs=null)),this.gpuWordPairs&&this.gpuWordPairs.uploadWords(D)),O&&this.gpuWordPairs){const X=(c==null?void 0:c.gpuDispatchMs)??1e3;let pe=1048576,ue=!1,Ae=P;for(;Ae<R;){if(this.abortFlag)return ye();const fe=Math.min(pe,R-Ae),_=performance.now(),V=await this.gpuWordPairs.runBatch(b,Ae,fe,f,y),U=performance.now()-_;if(h+=fe,!ue&&fe>=1048576&&U>0){const j=X/U,ne=Math.round(fe*j),q=Math.pow(2,Math.round(Math.log2(Math.max(1048576,ne))));pe=Math.min(Math.max(1048576,q),536862720),ue=!0}for(const[j,ne]of V){const q=D[j],we=D[ne],Ce=q+we,et=Je("#"+Ce),tt=he(et);if(tt.valid)return{found:!0,roomName:Ce,key:et,decryptedMessage:tt.message,resumeFrom:`${q}+${we}`,resumeType:"dictionary-pair"}}Ae+=fe;const me=Ae-1,de=Math.floor(me/D.length),se=me%D.length;de<D.length&&(L=`${D[de]}+${D[se]}`,Z="dictionary-pair");const Y=performance.now();if(Y-d>=200){const j=Math.floor(Math.min(Ae,R-1)/D.length),ne=Math.min(Ae,R-1)%D.length;Q("wordlist-pairs",0,`${D[j]}+${D[ne]}`),d=Y,await new Promise(q=>setTimeout(q,0))}}}else for(let G=T;G<D.length;G++){const re=D[G],X=$[G],pe=F-X,ue=G===T?C:0;for(let Ae=ue;Ae<D.length;Ae++){if(this.abortFlag)return ye();const fe=$[Ae];if(fe>pe)continue;const _=D[Ae],V=re+_;if(!ft(V))continue;const U=Je("#"+V),me=st(U);if(parseInt(me,16)===b){const se=he(U);if(se.valid)return{found:!0,roomName:V,key:U,decryptedMessage:se.message,resumeFrom:`${re}+${_}`,resumeType:"dictionary-pair"}}h++,L=`${re}+${_}`,Z="dictionary-pair";const de=performance.now();de-d>=200&&(Q("wordlist-pairs",X+fe,`${re}+${_}`),d=de,await new Promise(se=>setTimeout(se,0)))}}}const Be=this.useCpu?1024:32768,Te=65535*256*32,v=(c==null?void 0:c.gpuDispatchMs)??1e3;let ee=Be,ge=!1;for(let R=x;R<=n;R++){if(this.abortFlag)return ye();const P=ht(R);let O=R===x?g:0;for(;O<P;){if(this.abortFlag)return ye();const G=Math.min(ee,P-O),re=performance.now();let X;this.useCpu?X=this.cpuInstance.runBatch(b,R,O,G,f,y):X=await this.gpuInstance.runBatch(b,R,O,G,f,y);const pe=performance.now()-re;if(h+=G,!this.useCpu&&!ge&&G>=Be&&pe>0){const _=v/pe,V=Math.round(G*_),U=Math.pow(2,Math.round(Math.log2(Math.max(Be,V))));ee=Math.min(Math.max(Be,U),Te),ge=!0}for(const _ of X){const V=ze(R,_);if(!V)continue;const U=Je("#"+V),me=he(U);if(me.valid)return{found:!0,roomName:V,key:U,decryptedMessage:me.message,resumeFrom:V,resumeType:"bruteforce"}}O+=G;const ue=Math.min(O-1,P-1),Ae=ze(R,ue);Ae&&(L=Ae,Z="bruteforce");const fe=performance.now();if(fe-d>=200){const _=ze(R,Math.min(O,P-1))||"";Q("bruteforce",R,_),d=fe,await new Promise(V=>setTimeout(V,0))}}}return{found:!1,resumeFrom:L,resumeType:Z}}destroy(){this.gpuInstance&&(this.gpuInstance.destroy(),this.gpuInstance=null),this.gpuWordPairs&&(this.gpuWordPairs.destroy(),this.gpuWordPairs=null),this.cpuInstance&&(this.cpuInstance.destroy(),this.cpuInstance=null)}}var gt,$t;function Wr(){return $t||($t=1,gt={webm:"data:video/webm;base64,GkXfowEAAAAAAAAfQoaBAUL3gQFC8oEEQvOBCEKChHdlYm1Ch4EEQoWBAhhTgGcBAAAAAAAVkhFNm3RALE27i1OrhBVJqWZTrIHfTbuMU6uEFlSua1OsggEwTbuMU6uEHFO7a1OsghV17AEAAAAAAACkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmAQAAAAAAAEUq17GDD0JATYCNTGF2ZjU1LjMzLjEwMFdBjUxhdmY1NS4zMy4xMDBzpJBlrrXf3DCDVB8KcgbMpcr+RImIQJBgAAAAAAAWVK5rAQAAAAAAD++uAQAAAAAAADLXgQFzxYEBnIEAIrWcg3VuZIaFVl9WUDiDgQEj44OEAmJaAOABAAAAAAAABrCBsLqBkK4BAAAAAAAPq9eBAnPFgQKcgQAitZyDdW5khohBX1ZPUkJJU4OBAuEBAAAAAAAAEZ+BArWIQOdwAAAAAABiZIEgY6JPbwIeVgF2b3JiaXMAAAAAAoC7AAAAAAAAgLUBAAAAAAC4AQN2b3JiaXMtAAAAWGlwaC5PcmcgbGliVm9yYmlzIEkgMjAxMDExMDEgKFNjaGF1ZmVudWdnZXQpAQAAABUAAABlbmNvZGVyPUxhdmM1NS41Mi4xMDIBBXZvcmJpcyVCQ1YBAEAAACRzGCpGpXMWhBAaQlAZ4xxCzmvsGUJMEYIcMkxbyyVzkCGkoEKIWyiB0JBVAABAAACHQXgUhIpBCCGEJT1YkoMnPQghhIg5eBSEaUEIIYQQQgghhBBCCCGERTlokoMnQQgdhOMwOAyD5Tj4HIRFOVgQgydB6CCED0K4moOsOQghhCQ1SFCDBjnoHITCLCiKgsQwuBaEBDUojILkMMjUgwtCiJqDSTX4GoRnQXgWhGlBCCGEJEFIkIMGQcgYhEZBWJKDBjm4FITLQagahCo5CB+EIDRkFQCQAACgoiiKoigKEBqyCgDIAAAQQFEUx3EcyZEcybEcCwgNWQUAAAEACAAAoEiKpEiO5EiSJFmSJVmSJVmS5omqLMuyLMuyLMsyEBqyCgBIAABQUQxFcRQHCA1ZBQBkAAAIoDiKpViKpWiK54iOCISGrAIAgAAABAAAEDRDUzxHlETPVFXXtm3btm3btm3btm3btm1blmUZCA1ZBQBAAAAQ0mlmqQaIMAMZBkJDVgEACAAAgBGKMMSA0JBVAABAAACAGEoOogmtOd+c46BZDppKsTkdnEi1eZKbirk555xzzsnmnDHOOeecopxZDJoJrTnnnMSgWQqaCa0555wnsXnQmiqtOeeccc7pYJwRxjnnnCateZCajbU555wFrWmOmkuxOeecSLl5UptLtTnnnHPOOeecc84555zqxekcnBPOOeecqL25lpvQxTnnnE/G6d6cEM4555xzzjnnnHPOOeecIDRkFQAABABAEIaNYdwpCNLnaCBGEWIaMulB9+gwCRqDnELq0ehopJQ6CCWVcVJKJwgNWQUAAAIAQAghhRRSSCGFFFJIIYUUYoghhhhyyimnoIJKKqmooowyyyyzzDLLLLPMOuyssw47DDHEEEMrrcRSU2011lhr7jnnmoO0VlprrbVSSimllFIKQkNWAQAgAAAEQgYZZJBRSCGFFGKIKaeccgoqqIDQkFUAACAAgAAAAABP8hzRER3RER3RER3RER3R8RzPESVREiVREi3TMjXTU0VVdWXXlnVZt31b2IVd933d933d+HVhWJZlWZZlWZZlWZZlWZZlWZYgNGQVAAACAAAghBBCSCGFFFJIKcYYc8w56CSUEAgNWQUAAAIACAAAAHAUR3EcyZEcSbIkS9IkzdIsT/M0TxM9URRF0zRV0RVdUTdtUTZl0zVdUzZdVVZtV5ZtW7Z125dl2/d93/d93/d93/d93/d9XQdCQ1YBABIAADqSIymSIimS4ziOJElAaMgqAEAGAEAAAIriKI7jOJIkSZIlaZJneZaomZrpmZ4qqkBoyCoAABAAQAAAAAAAAIqmeIqpeIqoeI7oiJJomZaoqZoryqbsuq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq7ruq4LhIasAgAkAAB0JEdyJEdSJEVSJEdygNCQVQCADACAAAAcwzEkRXIsy9I0T/M0TxM90RM901NFV3SB0JBVAAAgAIAAAAAAAAAMybAUy9EcTRIl1VItVVMt1VJF1VNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVN0zRNEwgNWQkAkAEAkBBTLS3GmgmLJGLSaqugYwxS7KWxSCpntbfKMYUYtV4ah5RREHupJGOKQcwtpNApJq3WVEKFFKSYYyoVUg5SIDRkhQAQmgHgcBxAsixAsiwAAAAAAAAAkDQN0DwPsDQPAAAAAAAAACRNAyxPAzTPAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA0jRA8zxA8zwAAAAAAAAA0DwP8DwR8EQRAAAAAAAAACzPAzTRAzxRBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABA0jRA8zxA8zwAAAAAAAAAsDwP8EQR0DwRAAAAAAAAACzPAzxRBDzRAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAEOAAABBgIRQasiIAiBMAcEgSJAmSBM0DSJYFTYOmwTQBkmVB06BpME0AAAAAAAAAAAAAJE2DpkHTIIoASdOgadA0iCIAAAAAAAAAAAAAkqZB06BpEEWApGnQNGgaRBEAAAAAAAAAAAAAzzQhihBFmCbAM02IIkQRpgkAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAGHAAAAgwoQwUGrIiAIgTAHA4imUBAIDjOJYFAACO41gWAABYliWKAABgWZooAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAYcAAACDChDBQashIAiAIAcCiKZQHHsSzgOJYFJMmyAJYF0DyApgFEEQAIAAAocAAACLBBU2JxgEJDVgIAUQAABsWxLE0TRZKkaZoniiRJ0zxPFGma53meacLzPM80IYqiaJoQRVE0TZimaaoqME1VFQAAUOAAABBgg6bE4gCFhqwEAEICAByKYlma5nmeJ4qmqZokSdM8TxRF0TRNU1VJkqZ5niiKommapqqyLE3zPFEURdNUVVWFpnmeKIqiaaqq6sLzPE8URdE0VdV14XmeJ4qiaJqq6roQRVE0TdNUTVV1XSCKpmmaqqqqrgtETxRNU1Vd13WB54miaaqqq7ouEE3TVFVVdV1ZBpimaaqq68oyQFVV1XVdV5YBqqqqruu6sgxQVdd1XVmWZQCu67qyLMsCAAAOHAAAAoygk4wqi7DRhAsPQKEhKwKAKAAAwBimFFPKMCYhpBAaxiSEFEImJaXSUqogpFJSKRWEVEoqJaOUUmopVRBSKamUCkIqJZVSAADYgQMA2IGFUGjISgAgDwCAMEYpxhhzTiKkFGPOOScRUoox55yTSjHmnHPOSSkZc8w556SUzjnnnHNSSuacc845KaVzzjnnnJRSSuecc05KKSWEzkEnpZTSOeecEwAAVOAAABBgo8jmBCNBhYasBABSAQAMjmNZmuZ5omialiRpmud5niiapiZJmuZ5nieKqsnzPE8URdE0VZXneZ4oiqJpqirXFUXTNE1VVV2yLIqmaZqq6rowTdNUVdd1XZimaaqq67oubFtVVdV1ZRm2raqq6rqyDFzXdWXZloEsu67s2rIAAPAEBwCgAhtWRzgpGgssNGQlAJABAEAYg5BCCCFlEEIKIYSUUggJAAAYcAAACDChDBQashIASAUAAIyx1lprrbXWQGettdZaa62AzFprrbXWWmuttdZaa6211lJrrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmuttdZaa6211lprrbXWWmstpZRSSimllFJKKaWUUkoppZRSSgUA+lU4APg/2LA6wknRWGChISsBgHAAAMAYpRhzDEIppVQIMeacdFRai7FCiDHnJKTUWmzFc85BKCGV1mIsnnMOQikpxVZjUSmEUlJKLbZYi0qho5JSSq3VWIwxqaTWWoutxmKMSSm01FqLMRYjbE2ptdhqq7EYY2sqLbQYY4zFCF9kbC2m2moNxggjWywt1VprMMYY3VuLpbaaizE++NpSLDHWXAAAd4MDAESCjTOsJJ0VjgYXGrISAAgJACAQUooxxhhzzjnnpFKMOeaccw5CCKFUijHGnHMOQgghlIwx5pxzEEIIIYRSSsaccxBCCCGEkFLqnHMQQgghhBBKKZ1zDkIIIYQQQimlgxBCCCGEEEoopaQUQgghhBBCCKmklEIIIYRSQighlZRSCCGEEEIpJaSUUgohhFJCCKGElFJKKYUQQgillJJSSimlEkoJJYQSUikppRRKCCGUUkpKKaVUSgmhhBJKKSWllFJKIYQQSikFAAAcOAAABBhBJxlVFmGjCRcegEJDVgIAZAAAkKKUUiktRYIipRikGEtGFXNQWoqocgxSzalSziDmJJaIMYSUk1Qy5hRCDELqHHVMKQYtlRhCxhik2HJLoXMOAAAAQQCAgJAAAAMEBTMAwOAA4XMQdAIERxsAgCBEZohEw0JweFAJEBFTAUBigkIuAFRYXKRdXECXAS7o4q4DIQQhCEEsDqCABByccMMTb3jCDU7QKSp1IAAAAAAADADwAACQXAAREdHMYWRobHB0eHyAhIiMkAgAAAAAABcAfAAAJCVAREQ0cxgZGhscHR4fICEiIyQBAIAAAgAAAAAggAAEBAQAAAAAAAIAAAAEBB9DtnUBAAAAAAAEPueBAKOFggAAgACjzoEAA4BwBwCdASqwAJAAAEcIhYWIhYSIAgIABhwJ7kPfbJyHvtk5D32ych77ZOQ99snIe+2TkPfbJyHvtk5D32ych77ZOQ99YAD+/6tQgKOFggADgAqjhYIAD4AOo4WCACSADqOZgQArADECAAEQEAAYABhYL/QACIBDmAYAAKOFggA6gA6jhYIAT4AOo5mBAFMAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCAGSADqOFggB6gA6jmYEAewAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYIAj4AOo5mBAKMAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCAKSADqOFggC6gA6jmYEAywAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYIAz4AOo4WCAOSADqOZgQDzADECAAEQEAAYABhYL/QACIBDmAYAAKOFggD6gA6jhYIBD4AOo5iBARsAEQIAARAQFGAAYWC/0AAiAQ5gGACjhYIBJIAOo4WCATqADqOZgQFDADECAAEQEAAYABhYL/QACIBDmAYAAKOFggFPgA6jhYIBZIAOo5mBAWsAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCAXqADqOFggGPgA6jmYEBkwAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYIBpIAOo4WCAbqADqOZgQG7ADECAAEQEAAYABhYL/QACIBDmAYAAKOFggHPgA6jmYEB4wAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYIB5IAOo4WCAfqADqOZgQILADECAAEQEAAYABhYL/QACIBDmAYAAKOFggIPgA6jhYICJIAOo5mBAjMAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCAjqADqOFggJPgA6jmYECWwAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYICZIAOo4WCAnqADqOZgQKDADECAAEQEAAYABhYL/QACIBDmAYAAKOFggKPgA6jhYICpIAOo5mBAqsAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCArqADqOFggLPgA6jmIEC0wARAgABEBAUYABhYL/QACIBDmAYAKOFggLkgA6jhYIC+oAOo5mBAvsAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCAw+ADqOZgQMjADECAAEQEAAYABhYL/QACIBDmAYAAKOFggMkgA6jhYIDOoAOo5mBA0sAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCA0+ADqOFggNkgA6jmYEDcwAxAgABEBAAGAAYWC/0AAiAQ5gGAACjhYIDeoAOo4WCA4+ADqOZgQObADECAAEQEAAYABhYL/QACIBDmAYAAKOFggOkgA6jhYIDuoAOo5mBA8MAMQIAARAQABgAGFgv9AAIgEOYBgAAo4WCA8+ADqOFggPkgA6jhYID+oAOo4WCBA+ADhxTu2sBAAAAAAAAEbuPs4EDt4r3gQHxghEr8IEK",mp4:"data:video/mp4;base64,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"}),gt}var mt,er;function Zr(){if(er)return mt;er=1;const{webm:t,mp4:o}=Wr(),c=()=>typeof navigator<"u"&&parseFloat((""+(/CPU.*OS ([0-9_]{3,4})[0-9_]{0,1}|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent)||[0,""])[1]).replace("undefined","3_2").replace("_",".").replace("_",""))<10&&!window.MSStream,l=()=>"wakeLock"in navigator;class n{constructor(){if(this.enabled=!1,l()){this._wakeLock=null;const a=()=>{this._wakeLock!==null&&document.visibilityState==="visible"&&this.enable()};document.addEventListener("visibilitychange",a),document.addEventListener("fullscreenchange",a)}else c()?this.noSleepTimer=null:(this.noSleepVideo=document.createElement("video"),this.noSleepVideo.setAttribute("title","No Sleep"),this.noSleepVideo.setAttribute("playsinline",""),this._addSourceToVideo(this.noSleepVideo,"webm",t),this._addSourceToVideo(this.noSleepVideo,"mp4",o),this.noSleepVideo.addEventListener("loadedmetadata",()=>{this.noSleepVideo.duration<=1?this.noSleepVideo.setAttribute("loop",""):this.noSleepVideo.addEventListener("timeupdate",()=>{this.noSleepVideo.currentTime>.5&&(this.noSleepVideo.currentTime=Math.random())})}))}_addSourceToVideo(a,e,A){var s=document.createElement("source");s.src=A,s.type=`video/${e}`,a.appendChild(s)}get isEnabled(){return this.enabled}enable(){return l()?navigator.wakeLock.request("screen").then(a=>{this._wakeLock=a,this.enabled=!0,console.log("Wake Lock active."),this._wakeLock.addEventListener("release",()=>{console.log("Wake Lock released.")})}).catch(a=>{throw this.enabled=!1,console.error(`${a.name}, ${a.message}`),a}):c()?(this.disable(),console.warn(`
        NoSleep enabled for older iOS devices. This can interrupt
        active or long-running network requests from completing successfully.
        See https://github.com/richtr/NoSleep.js/issues/15 for more details.
      `),this.noSleepTimer=window.setInterval(()=>{document.hidden||(window.location.href=window.location.href.split("#")[0],window.setTimeout(window.stop,0))},15e3),this.enabled=!0,Promise.resolve()):this.noSleepVideo.play().then(e=>(this.enabled=!0,e)).catch(e=>{throw this.enabled=!1,e})}disable(){l()?(this._wakeLock&&this._wakeLock.release(),this._wakeLock=null):c()?this.noSleepTimer&&(console.warn(`
          NoSleep now disabled for older iOS devices.
        `),window.clearInterval(this.noSleepTimer),this.noSleepTimer=null):this.noSleepVideo.pause(),this.enabled=!1}}return mt=n,mt}var Kr=Zr();const Xr=nt(Kr);function Jr({packets:t,channels:o,onChannelCreate:c,onRunningChange:l,visible:n=!1}){const[r,a]=H.useState(!1),[e,A]=H.useState(6),[s,i]=H.useState(!1),[u,f]=H.useState(!0),[y,b]=H.useState(!1),[S,h]=H.useState(!1),[d,x]=H.useState(null),[g,w]=H.useState(new Map),[m,E]=H.useState([]),[T,C]=H.useState(!1),[I,F]=H.useState(null),[ce,D]=H.useState(null),[$,J]=H.useState(0),ae=H.useRef(null),le=H.useRef(null),Q=H.useRef(!1),he=H.useRef(!1),L=H.useRef(!1),Z=H.useRef(new Map),ye=H.useRef(!1),Be=H.useRef(6),Te=H.useRef(!0),v=H.useRef(!1),ee=H.useRef(!1),ge=H.useRef(new Set),R=H.useRef(new Set),P=H.useRef(new Set);H.useEffect(()=>{const _=new jr;ae.current=_,F(_.isGpuAvailable());const V=new Xr;return le.current=V,()=>{_.destroy(),ae.current=null,V.disable(),le.current=null}},[]),H.useEffect(()=>{!n||T||fr(async()=>{const{ENGLISH_WORDLIST:_}=await import("./wordlist-BtmChKSf.js");return{ENGLISH_WORDLIST:_}},[]).then(({ENGLISH_WORDLIST:_})=>{ae.current&&(ae.current.setWordlist(_),C(!0))}).catch(_=>{console.error("Failed to load wordlist:",_),dt.error("Failed to load wordlist",{description:"Cracking will not be available"})})},[n,T]),H.useEffect(()=>{const _=()=>{Ct.getUndecryptedPacketCount().then(({count:U})=>D(U)).catch(()=>D(null))};_();const V=setInterval(_,36e5);return()=>clearInterval(V)},[]);const O=H.useMemo(()=>new Set(o.map(_=>_.key.toUpperCase())),[o]);H.useEffect(()=>{P.current=O},[O]);const G=t.filter(_=>_.payload_type==="GROUP_TEXT"&&!_.decrypted);H.useEffect(()=>{let _=0;w(V=>{const U=new Map(V);let me=!1;for(const de of G)if(!U.has(de.id)){const se=gr(de.data);if(se&&R.current.has(se)){_++;continue}se&&R.current.add(se),U.set(de.id,{packet:de,attempts:0,lastAttemptLength:0,status:"pending"}),me=!0}return me?(Z.current=U,U):V}),_>0&&J(V=>V+_)},[G.length]),H.useEffect(()=>{Z.current=g},[g]),H.useEffect(()=>{ye.current=s},[s]),H.useEffect(()=>{Be.current=e},[e]),H.useEffect(()=>{Te.current=u},[u]),H.useEffect(()=>{v.current=y},[y]),H.useEffect(()=>{ee.current=S},[S]),H.useEffect(()=>{ge.current=new Set(G.map(_=>_.id))},[G]),H.useEffect(()=>{l==null||l(r)},[r,l]);const re=Array.from(g.values()).filter(_=>_.status==="pending").length,X=Array.from(g.values()).filter(_=>_.status==="cracked").length,pe=Array.from(g.values()).filter(_=>_.status==="failed").length,ue=H.useCallback(async()=>{if(L.current||!ae.current||!Q.current)return;const _=Z.current;let V=null,U=null;for(const[Y,j]of _.entries())if(j.status==="pending"){V=j,U=Y;break}if(!V&&ye.current){const Y=Array.from(_.entries()).filter(([,j])=>j.status==="failed"&&j.lastAttemptLength<10);Y.length>0&&(Y.sort((j,ne)=>j[1].lastAttemptLength-ne[1].lastAttemptLength),[U,V]=Y[0])}if(!V||U===null){Q.current&&setTimeout(()=>ue(),1e3);return}if(!ge.current.has(U)){w(Y=>{const j=new Map(Y);return j.delete(U),j}),Q.current&&setTimeout(()=>ue(),10);return}L.current=!0;const me=Be.current,de=V.lastAttemptLength>0,se=de?V.lastAttemptLength+1:me;try{const Y=await ae.current.crack(V.packet.data,{maxLength:se,useSenderFilter:!0,useTimestampFilter:!0,useUtf8Filter:!0,useTwoWordCombinations:ee.current,...v.current&&{gpuDispatchMs:1e4},...de&&{useDictionary:!1,useTwoWordCombinations:!1,startingLength:se}},j=>{x(j)});if(he.current){he.current=!1,L.current=!1,x(null);return}if(Y.found&&Y.roomName&&Y.key){w(q=>{const we=new Map(q),Ce=we.get(U);return Ce&&we.set(U,{...Ce,status:"cracked",attempts:Ce.attempts+1,lastAttemptLength:se}),we});const j={roomName:Y.roomName,key:Y.key,packetId:U,message:Y.decryptedMessage||"",crackedAt:Date.now()};E(q=>[...q,j]);const ne=Y.key.toUpperCase();if(!P.current.has(ne))try{const q="#"+Y.roomName;await c(q,Y.key),Te.current&&await Ct.decryptHistoricalPackets({key_type:"channel",channel_name:q})}catch(q){console.error("Failed to create channel or decrypt historical:",q),dt.error("Failed to save cracked channel",{description:q instanceof Error?q.message:"Channel discovered but could not be saved"})}}else w(j=>{const ne=new Map(j),q=ne.get(U);return q&&ne.set(U,{...q,status:"failed",attempts:q.attempts+1,lastAttemptLength:se}),ne})}catch(Y){console.error("Cracking error:",Y),w(j=>{const ne=new Map(j),q=ne.get(U);return q&&ne.set(U,{...q,status:"failed",attempts:q.attempts+1,lastAttemptLength:se}),ne})}L.current=!1,x(null),Q.current&&setTimeout(()=>ue(),100)},[c]),Ae=()=>{var _;if(!I){dt.error("WebGPU not available",{description:"Cracking requires Chrome 113+ or Edge 113+ with WebGPU support."});return}a(!0),Q.current=!0,he.current=!1,(_=le.current)==null||_.enable(),ue()},fe=()=>{var _,V;a(!1),Q.current=!1,he.current=!0,(_=ae.current)==null||_.abort(),(V=le.current)==null||V.disable()};return M.jsxs("div",{className:"flex flex-col h-full p-3 gap-3 bg-background border-t border-border overflow-auto",children:[M.jsxs("div",{className:"flex items-center gap-3 flex-wrap",children:[M.jsxs("div",{className:"flex items-center gap-2",children:[M.jsx("label",{htmlFor:"cracker-max-length",className:"text-sm text-muted-foreground",children:"Max Length:"}),M.jsx("input",{id:"cracker-max-length",type:"number",min:1,max:10,value:e,onChange:_=>A(Math.min(10,Math.max(1,parseInt(_.target.value)||6))),className:"w-14 px-2 py-1 text-sm bg-muted border border-border rounded"})]}),M.jsxs("label",{className:"flex items-center gap-2 text-sm text-muted-foreground cursor-pointer",children:[M.jsx("input",{type:"checkbox",checked:s,onChange:_=>i(_.target.checked),className:"rounded"}),"Retry failed at n+1"]}),M.jsxs("label",{className:"flex items-center gap-2 text-sm text-muted-foreground cursor-pointer",children:[M.jsx("input",{type:"checkbox",checked:u,onChange:_=>f(_.target.checked),className:"rounded"}),"Decrypt historical packets if key found"]}),u&&M.jsx("span",{className:"text-xs text-muted-foreground",children:ce!==null&&ce>0?`(${ce.toLocaleString()} packets; messages will stream in as decrypted)`:"(messages will stream in as decrypted)"}),M.jsxs("label",{className:"flex items-center gap-2 text-sm text-muted-foreground cursor-pointer",children:[M.jsx("input",{type:"checkbox",checked:S,onChange:_=>h(_.target.checked),className:"rounded"}),"Try word pairs"]}),M.jsxs("label",{className:"flex items-center gap-2 text-sm text-muted-foreground cursor-pointer",children:[M.jsx("input",{type:"checkbox",checked:y,onChange:_=>b(_.target.checked),className:"rounded"}),"Turbo mode (experimental)"]})]}),M.jsx("button",{onClick:r?fe:Ae,disabled:!T||I===!1,className:mr("w-48 px-4 py-1.5 rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",r?"bg-destructive text-destructive-foreground hover:bg-destructive/90":"bg-primary text-primary-foreground hover:bg-primary/90","disabled:opacity-50 disabled:cursor-not-allowed"),children:r?"Stop Search":I===!1?"GPU Not Available":T?"Find Rooms":"Loading dictionary..."}),M.jsxs("div",{className:"flex gap-4 text-sm",children:[M.jsxs("span",{className:"text-muted-foreground",children:["Pending: ",M.jsx("span",{className:"text-foreground font-medium",children:re})]}),M.jsxs("span",{className:"text-muted-foreground",children:["Cracked: ",M.jsx("span",{className:"text-success font-medium",children:X})]}),M.jsxs("span",{className:"text-muted-foreground",children:["Failed: ",M.jsx("span",{className:"text-destructive font-medium",children:pe})]}),$>0&&M.jsxs("span",{className:"text-muted-foreground",children:["Skipped (dup):"," ",M.jsx("span",{className:"text-muted-foreground font-medium",children:$})]})]}),d&&M.jsxs("div",{className:"space-y-1",children:[M.jsxs("div",{className:"flex justify-between text-xs text-muted-foreground",children:[M.jsxs("span",{children:[d.phase==="wordlist"?"Dictionary":d.phase==="wordlist-pairs"?"Word Pairs":d.phase==="bruteforce"?"Bruteforce":"Public Key",d.phase==="bruteforce"&&` - Length ${d.currentLength}`,":"," ",d.currentPosition]}),M.jsxs("span",{children:[d.rateKeysPerSec>=1e9?`${(d.rateKeysPerSec/1e9).toFixed(2)} Gkeys/s`:`${(d.rateKeysPerSec/1e6).toFixed(1)} Mkeys/s`," ","• ETA:"," ",d.etaSeconds<60?`${Math.round(d.etaSeconds)}s`:`${Math.round(d.etaSeconds/60)}m`]})]}),M.jsx("div",{className:"h-2 bg-muted rounded overflow-hidden",role:"progressbar","aria-valuenow":Math.round(d.percent),"aria-valuemin":0,"aria-valuemax":100,"aria-label":"Cracking progress",children:M.jsx("div",{className:"h-full bg-primary transition-all duration-200",style:{width:`${d.percent}%`}})})]}),I===!1&&M.jsx("div",{className:"text-sm text-destructive",role:"alert",children:"WebGPU not available. Cracking requires Chrome 113+ or Edge 113+."}),!T&&I!==!1&&M.jsx("div",{className:"text-sm text-muted-foreground",role:"status",children:"Loading wordlist..."}),m.length>0&&M.jsxs("div",{children:[M.jsx("div",{className:"text-xs text-muted-foreground mb-1",children:"Cracked Rooms:"}),M.jsx("div",{className:"space-y-1",children:m.map((_,V)=>M.jsxs("div",{className:"text-sm bg-success/10 border border-success/20 rounded px-2 py-1",children:[M.jsxs("span",{className:"text-success font-medium",children:["#",_.roomName]}),M.jsxs("span",{className:"text-muted-foreground ml-2 text-xs",children:['"',_.message.slice(0,50),_.message.length>50?"...":"",'"']})]},V))})]}),M.jsx("hr",{className:"border-border"}),M.jsxs("p",{className:"text-sm text-muted-foreground leading-relaxed",children:["For unknown-keyed GroupText packets, this will attempt to dictionary attack, then brute force payloads as they arrive, testing room names up to the specified length to discover active rooms on the local mesh (GroupText packets may not be hashtag messages; we have no way of knowing but try as if they are).",M.jsx("strong",{children:" Retry failed at n+1"})," will let the cracker return to the failed queue and pick up messages it couldn't crack, attempting them at one longer length.",M.jsx("strong",{children:" Try word pairs"}),' will also try every combination of two dictionary words concatenated together (e.g. "hello" + "world" = "#helloworld") after the single-word dictionary pass; this can substantially increase search time.',M.jsx("strong",{children:" Decrypt historical"})," will run an async job on any room name it finds to see if any historically captured packets will decrypt with that key.",M.jsx("strong",{children:" Turbo mode"})," will push your GPU to the max (target dispatch time of 10s) and may allow accelerated cracking and/or system instability."]})]})}export{Jr as CrackerPanel};
//# sourceMappingURL=CrackerPanel-CQP9hluh.js.map

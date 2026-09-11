// 最終更新: 2026-09-11 — 1つのGPUコンテキストで同じ称号の光を共有し、最大30fpsで描画する。
import { TITLE_MOTION_EVENT, titleMotionEnabled } from "./titleMotion";

type Target = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  rank: number;
  visible: boolean;
};
type Renderer = ReturnType<typeof createRenderer>;
let shared: Renderer;

const vertexSource = `attribute vec2 position;
varying vec2 uv;
void main(){ uv=position*.5+.5; gl_Position=vec4(position,0.,1.); }`;
const fragmentSource = `precision mediump float;
varying vec2 uv;
uniform float time;
uniform float rank;
float noise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float softNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(noise(i),noise(i+vec2(1,0)),f.x),mix(noise(i+vec2(0,1)),noise(i+vec2(1,1)),f.x),f.y);}
float star(vec2 p){p=abs(p);return exp(-length(p)*70.)+exp(-p.x*350.-p.y*40.)*.5+exp(-p.y*350.-p.x*40.)*.5;}
void main(){
 float t=time;vec2 p=uv;
 float edge=1.-smoothstep(.02,.21,min(p.y,1.-p.y));
 float sides=1.-smoothstep(.02,.20,min(p.x,1.-p.x));
 float protect=max(edge,sides*.8);
 float glint=pow(max(0.,cos(p.x*5.+p.y*1.4-t*.8)),24.);
 float grain=softNoise(vec2(p.x*35.,p.y*100.));
 vec3 color=vec3(1.,.79,.38);float light=0.;
 if(rank<62.){
   light=(glint*.7+grain*.08)*protect;
   light+=star((p-vec2(.15+.7*(sin(t*.4)*.5+.5),.88))*vec2(3.,1.))*.4;
 }else if(rank<64.){
   float smoke=softNoise(vec2(p.x*5.,p.y*4.-t*.25));
   smoke+=softNoise(vec2(p.x*11.+smoke,p.y*9.-t*.38))*.45;
   light=smoothstep(.55,1.25,smoke)*protect*(.4+.22*sin(t*1.4));
   float ember=pow(max(0.,sin(p.x*24.+t*.5+smoke*4.)),10.)*edge;
   light+=ember*.32;color=mix(vec3(.9,.1,.16),vec3(1.,.55,.22),ember);
 }else if(rank<66.){
   float fracture=abs(sin(p.x*19.+p.y*4.+softNoise(p*11.)*3.));
   float flow=pow(max(0.,sin(p.y*6.-t*1.1+p.x*3.)),4.);
   light=(1.-smoothstep(.015,.15,fracture))*flow*.65*protect;
   light+=glint*.18*protect;color=vec3(.32,1.,.64);
 }else if(rank<69.){
   float satin=.5+.5*sin(p.x*13.+p.y*4.+t*.3);
   light=(glint*.65+satin*.06)*protect;
   for(int i=0;i<4;i++){float k=float(i);vec2 pos=vec2(.12+k*.25,.5+.39*sin(k*2.+t*.25));light+=star((p-pos)*vec2(3.,1.))*(.25+.25*sin(t*.8+k));}
   color=mix(vec3(1.,.69,.19),vec3(1.,.96,.73),glint);
 }else{
   float wave=sin(p.x*6.+t*.22+sin(p.y*7.-t*.35));
   float silk=pow(.5+.5*sin(p.y*11.+wave*3.-t*.45),5.);
   color=.72+.28*cos(vec3(0.,2.,4.)+wave*2.+t*.15);
   light=(silk*.4+glint*.35)*protect;
   for(int i=0;i<6;i++){float k=float(i);vec2 pos=vec2(.08+k*.168,.5+.39*sin(k*2.3+t*.14));light+=star((p-pos)*vec2(3.,1.))*(.2+.3*pow(.5+.5*sin(t+k),2.));}
 }
 gl_FragColor=vec4(color,clamp(light,0.,.7));
}`;

// 最終更新: 2026-09-11 — GPU非対応・省モーション・コンテキスト喪失時はCSS演出に戻す。
function createRenderer() {
  const source = document.createElement("canvas");
  source.width = 256;
  source.height = 80;
  const gl = source.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
  });
  if (!gl) return undefined;
  const program = gl.createProgram();
  const buffer = gl.createBuffer();
  if (!program || !buffer) return undefined;
  for (const [type, code] of [
    [gl.VERTEX_SHADER, vertexSource],
    [gl.FRAGMENT_SHADER, fragmentSource],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) {
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      return undefined;
    }
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      return undefined;
    }
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    return undefined;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const timeUniform = gl.getUniformLocation(program, "time");
  const rankUniform = gl.getUniformLocation(program, "rank");
  const targets = new Set<Target>();
  let request = 0,
    previous = 0,
    elapsed = 2.5,
    failed = false;

  // 最終更新: 2026-09-11 — 文字の背後を暗く保ち、端の反射と粒子だけ合成する。
  const tick = (now: number) => {
    request = 0;
    if (failed || document.hidden || !titleMotionEnabled()) return;
    const visible = [...targets].filter((target) => target.visible);
    if (!visible.length) return;
    if (now - previous >= 1000 / 30) {
      elapsed += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      gl.uniform1f(timeUniform, elapsed);
      for (const rank of new Set(visible.map((target) => target.rank))) {
        gl.uniform1f(rankUniform, rank);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        for (const target of visible.filter((entry) => entry.rank === rank)) {
          target.context.clearRect(0, 0, 256, 80);
          target.context.drawImage(source, 0, 0);
          target.canvas.dataset.ready = "true";
        }
      }
    }
    request = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(request);
    request = 0;
    if (!titleMotionEnabled() || failed)
      for (const target of targets) target.canvas.dataset.ready = "false";
    if (
      !failed &&
      !document.hidden &&
      titleMotionEnabled() &&
      [...targets].some((target) => target.visible)
    ) {
      previous = performance.now();
      request = requestAnimationFrame(tick);
    }
  };
  const lost = (event: Event) => {
    event.preventDefault();
    failed = true;
    sync();
  };
  source.addEventListener("webglcontextlost", lost);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener(TITLE_MOTION_EVENT, sync);
  return {
    targets,
    sync,
    dispose() {
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener(TITLE_MOTION_EVENT, sync);
      source.removeEventListener("webglcontextlost", lost);
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

// 最終更新: 2026-09-11 — 同じ称号は1回だけGPUで計算し、表示先へ小さな画像として配る。
export function registerTitleShader(canvas: HTMLCanvasElement, rank: number) {
  try {
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    shared ??= createRenderer();
    const renderer = shared;
    if (!renderer) return undefined;
    canvas.width = 256;
    canvas.height = 80;
    const target: Target = { canvas, context, rank, visible: false };
    renderer.targets.add(target);
    return {
      setVisible(visible: boolean) {
        target.visible = visible;
        renderer.sync();
      },
      dispose() {
        renderer.targets.delete(target);
        canvas.dataset.ready = "false";
        if (!renderer.targets.size) {
          renderer.dispose();
          shared = undefined;
        } else renderer.sync();
      },
    };
  } catch {
    return undefined;
  }
}

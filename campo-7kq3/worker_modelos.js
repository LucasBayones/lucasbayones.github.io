// Engram Campo · hilo de modelos del teléfono (transformers.js): voz (Whisper), fotos (CLIP) y libreta (Florence-2). v41 (5 nov 2026) · PRELIMINAR.
// Vive en un hilo aparte con su propia memoria. Cuando la app lo termina (worker.terminate), el sistema recupera TODA la memoria de los modelos:
// en iPhone es la única forma segura de pasar de un modelo a otro (la memoria del motor ORT en el hilo principal nunca se devuelve).
// Mensajes: {id, cmd, ...} -> {id, tipo:"progreso", p} ... {id, tipo:"ok", r} | {id, tipo:"error", error}
let tjs = null, lib = {lib: "no cargada", url: ""}, ortBase = "", ortCdn = ""; const pipes = {};
async function cargarLib(bases, cdn, ortDist){
  ortCdn = ortDist || "";
  for(let i = 0; i < bases.length; i++){ const b = bases[i]; try{ tjs = await import(b + "transformers.min.js"); ortBase = b; lib = {lib: i === 0 ? "local" : "raíz del sitio", url: b}; break; }catch(e){ tjs = null; } }
  if(!tjs){ tjs = await import(cdn); ortBase = ortCdn; lib = {lib: "cdn", url: cdn}; }
  tjs.env.allowLocalModels = false; tjs.env.useBrowserCache = true; return lib;
}
// v42: con motor wasm se usa el binario de ONNX Runtime SIN JSEP (ort-wasm-simd-threaded.wasm). El binario JSEP (el que trae transformers.js por
// defecto, con asyncify para WebGPU) dispara un error del compilador de WebKit 26 en iOS: CPU al 400 %, memoria que crece y la app muerta
// (onnxruntime issue 26827). Con WebGPU hace falta el JSEP: queda el prefijo normal. Se decide por carga; este hilo nace nuevo para cada modelo.
function elegirBinario(device){
  const base = ortBase || ortCdn; if(!base) return "sin base";
  if(device === "wasm"){ tjs.env.backends.onnx.wasm.wasmPaths = {mjs: base + "ort-wasm-simd-threaded.mjs", wasm: base + "ort-wasm-simd-threaded.wasm"}; return "wasm sin JSEP (" + base + ")"; }
  tjs.env.backends.onnx.wasm.wasmPaths = base; return "JSEP (" + base + ")";
}
async function imagen(blob, max){
  let img = await tjs.RawImage.fromBlob(blob);
  try{ const mx = Math.max(img.width || 0, img.height || 0); if(max && mx > max){ const s = max/mx; img = await img.resize(Math.round(img.width*s), Math.round(img.height*s)); } }catch(e){}
  return img;
}
self.onmessage = async (e) => {
  const m = e.data || {}; const id = m.id;
  const prog = p => { try{ self.postMessage({id, tipo:"progreso", p: {status: p && p.status, progress: p && p.progress, file: p && p.file}}); }catch(err){} };
  try{
    let r = true;
    if(m.cmd === "lib") r = await cargarLib(m.bases || [], m.cdn, m.ortDist);
    else if(!tjs) throw new Error("biblioteca no cargada en el hilo de modelos");
    else if(m.cmd === "binario") r = elegirBinario(m.device);
    else if(m.cmd === "cargar_voz"){ elegirBinario(m.device); pipes.voz = await tjs.pipeline("automatic-speech-recognition", m.modelo, {device: m.device, dtype: m.dtype, progress_callback: prog}); }
    else if(m.cmd === "transcribir"){ if(!pipes.voz) throw new Error("modelo de voz no cargado"); const out = await pipes.voz(m.audio, m.opts || {}); r = {text: out && out.text, chunks: (out && out.chunks || []).map(c=>({timestamp: c.timestamp, text: c.text}))}; }
    else if(m.cmd === "cargar_fotos"){ elegirBinario(m.device); pipes.fotos = await tjs.pipeline("zero-shot-image-classification", m.modelo, {device: m.device, dtype: m.dtype || "q8", progress_callback: prog}); }
    else if(m.cmd === "clasificar"){ if(!pipes.fotos) throw new Error("modelo de fotos no cargado"); const img = await imagen(m.blob, m.max || 1280); const out = await pipes.fotos(img, m.etiquetas || []); r = (out || []).map(x=>({label: x.label, score: x.score})); }
    else if(m.cmd === "cargar_libreta"){ elegirBinario(m.device);
      const model = await tjs.Florence2ForConditionalGeneration.from_pretrained(m.modelo, {dtype: m.dtype, device: m.device, progress_callback: prog});
      const processor = await tjs.AutoProcessor.from_pretrained(m.modelo, {progress_callback: prog}); const tokenizer = await tjs.AutoTokenizer.from_pretrained(m.modelo, {progress_callback: prog});
      pipes.libreta = {model, processor, tokenizer};
    }
    else if(m.cmd === "ocr"){
      const L = pipes.libreta; if(!L) throw new Error("lector de libreta no cargado"); const img = await imagen(m.blob, m.max || 1280); const task = m.task || "<OCR>";
      const vision = await L.processor(img); const text = L.tokenizer(L.processor.construct_prompts(task));
      const ids = await L.model.generate(Object.assign({}, text, vision, {max_new_tokens: m.max_new_tokens || 512})); const gen = L.tokenizer.batch_decode(ids, {skip_special_tokens: false})[0];
      let res = null; try{ const pp = L.processor.post_process_generation(gen, task, img.size || [img.width, img.height]); res = pp && pp[task] != null ? pp[task] : null; }catch(err){ res = null; }
      r = {gen, res, size: [img.width, img.height]};
    }
    else if(m.cmd === "liberar"){ for(const k of Object.keys(pipes)){ try{ const p = pipes[k]; if(p && p.dispose) await p.dispose(); else if(p && p.model && p.model.dispose) await p.model.dispose(); }catch(err){} delete pipes[k]; } }
    else if(m.cmd === "estado"){ r = {lib, cargados: Object.keys(pipes)}; }
    else throw new Error("orden desconocida: " + m.cmd);
    self.postMessage({id, tipo: "ok", r});
  }catch(err){ self.postMessage({id, tipo: "error", error: String(err && err.message || err).slice(0, 300)}); }
};

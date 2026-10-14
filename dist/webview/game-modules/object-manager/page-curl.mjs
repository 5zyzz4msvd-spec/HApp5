// The same UVs sample both the generated paper and the rendered page content.
export function curledPageMesh({ progress, direction = 1, spine = 716, top = 114, width = 438, height = 530, grabY = .5, columns = 56, rows = 10 }) {
  const p = Math.max(0, Math.min(1, progress)), bend = 1.25 * Math.sin(Math.PI * p), theta = Math.PI * p - bend / 2;
  const vertices = [], indices = [];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    const u = col / columns, v = row / rows, angle = theta + bend * u;
    const x = Math.abs(bend) < .0001 ? width * u * Math.cos(theta) : width * (Math.sin(angle) - Math.sin(theta)) / bend;
    const z = Math.abs(bend) < .0001 ? width * u * Math.sin(theta) : width * (Math.cos(theta) - Math.cos(angle)) / bend;
    const twist = Math.sin(Math.PI * p) * u * (grabY - .5) * height * .18;
    vertices.push(spine + direction * x, top + v * height + twist, z, u, v, Math.cos(angle));
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export function mountCurvedPage(canvas, { width = 1280, height = 820 } = {}) {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) return null;
  canvas.width = width * 2; canvas.height = height * 2;
  function shader(type, source) { const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value); if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(value)); return value; }
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, `attribute vec3 position;attribute vec2 uv;attribute float normal;uniform vec2 viewport;varying vec2 texUV;varying float light;void main(){float zoom=1400.0/(1400.0-position.z);gl_Position=vec4((position.x/viewport.x*2.0-1.0)*zoom,(1.0-position.y/viewport.y*2.0)*zoom,-position.z/1400.0,1.0);texUV=uv;light=.76+.24*abs(normal);}`));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `precision mediump float;uniform sampler2D front;uniform sampler2D back;uniform float reverse;varying vec2 texUV;varying float light;void main(){bool face=gl_FrontFacing;if(reverse>.5)face=!face;vec2 q=texUV;if((face&&reverse>.5)||(!face&&reverse<.5))q.x=1.0-q.x;vec4 c=face?texture2D(front,q):texture2D(back,q);gl_FragColor=vec4(c.rgb*light,c.a);}`));
  gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.uniform2f(gl.getUniformLocation(program, "viewport"), width, height);
  gl.uniform1i(gl.getUniformLocation(program, "front"), 0); gl.uniform1i(gl.getUniformLocation(program, "back"), 1);
  const vertex = gl.createBuffer(), index = gl.createBuffer(), textures = [gl.createTexture(), gl.createTexture()];
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex);
  for (const [name, size, offset] of [["position", 3, 0], ["uv", 2, 12], ["normal", 1, 20]]) { const loc = gl.getAttribLocation(program, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 24, offset); }
  gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.viewport(0, 0, canvas.width, canvas.height);
  function setPages(front, back) {
    for (const [unit, source] of [front, back].entries()) {
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, textures[unit]); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
  }
  function render(options) {
    const mesh = curledPageMesh(options); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(gl.getUniformLocation(program, "reverse"), options.direction < 0 ? 1 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex); gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.DYNAMIC_DRAW); gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }
  return { setPages, render, clear() { gl.clear(gl.COLOR_BUFFER_BIT); }, destroy() { for (const t of textures) gl.deleteTexture(t); gl.deleteBuffer(vertex); gl.deleteBuffer(index); gl.deleteProgram(program); } };
}

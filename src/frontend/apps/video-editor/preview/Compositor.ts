// Minimal WebGL2 compositor: draws a single VideoFrame as a textured quad,
// scaled with "contain" to fit the canvas (letterboxed against black).
const VERT = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
out vec2 v_uv;
uniform vec2 u_scale;
void main() {
  v_uv = a_uv;
  gl_Position = vec4(a_pos * u_scale, 0.0, 1.0);
}`

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
void main() {
  outColor = texture(u_tex, v_uv);
}`

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error('Failed to create shader')
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s)
    gl.deleteShader(s)
    throw new Error('Shader compile error: ' + log)
  }
  return s
}

export class Compositor {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private texture: WebGLTexture
  private uScaleLoc: WebGLUniformLocation | null

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl
    const vs = compileShader(gl, gl.VERTEX_SHADER, VERT)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG)
    const program = gl.createProgram()
    if (!program) throw new Error('Failed to create program')
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.bindAttribLocation(program, 0, 'a_pos')
    gl.bindAttribLocation(program, 1, 'a_uv')
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program))
    }
    this.program = program

    const vao = gl.createVertexArray()
    if (!vao) throw new Error('Failed to create VAO')
    this.vao = vao
    gl.bindVertexArray(vao)

    const verts = new Float32Array([
      // pos.xy,  uv.xy
      -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0,
    ])
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8)
    gl.bindVertexArray(null)

    const tex = gl.createTexture()
    if (!tex) throw new Error('Failed to create texture')
    this.texture = tex
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.uScaleLoc = gl.getUniformLocation(program, 'u_scale')
  }

  draw(
    frame: VideoFrame,
    canvasW: number,
    canvasH: number,
    fit: 'contain' | 'cover' = 'contain',
  ): void {
    const gl = this.gl
    gl.viewport(0, 0, canvasW, canvasH)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.useProgram(this.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    // Upload the frame as the texture. VideoFrame is a valid TexImageSource.
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      frame as unknown as TexImageSource,
    )

    const fW = frame.displayWidth
    const fH = frame.displayHeight
    const canvasAspect = canvasW / canvasH
    const frameAspect = fW / fH
    let scaleX = 1
    let scaleY = 1
    if (fit === 'cover') {
      // Fill the canvas, cropping overflow (one axis > 1 → clipped by viewport).
      if (frameAspect > canvasAspect) scaleX = frameAspect / canvasAspect
      else scaleY = canvasAspect / frameAspect
    } else {
      // Contain: keep aspect, fit inside canvas, letterbox.
      if (frameAspect > canvasAspect) scaleY = canvasAspect / frameAspect
      else scaleX = frameAspect / canvasAspect
    }
    gl.uniform2f(this.uScaleLoc, scaleX, scaleY)

    gl.bindVertexArray(this.vao)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.bindVertexArray(null)
  }

  clear(canvasW: number, canvasH: number): void {
    const gl = this.gl
    gl.viewport(0, 0, canvasW, canvasH)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteTexture(this.texture)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.program)
  }
}

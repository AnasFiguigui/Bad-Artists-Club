'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle } from 'ogl'

function hexToVec3(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  return [r, g, b]
}

const vertexShader = `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShader = `
  precision highp float;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform float uTimeSpeed;
  uniform float uWarpStrength;
  uniform float uWarpFrequency;
  uniform float uWarpSpeed;
  uniform float uWarpAmplitude;
  uniform float uBlendAngle;
  uniform float uBlendSoftness;
  uniform float uRotation;
  uniform float uNoiseScale;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform float uGrainAnimated;
  uniform float uContrast;
  uniform float uGamma;
  uniform float uSaturation;
  uniform float uCenterX;
  uniform float uCenterY;
  uniform float uZoom;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColorBalance;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float grain(vec2 uv, float t) {
    return fract(sin(dot(uv + t, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    float t = iTime * uTimeSpeed;

    // Center and zoom
    uv = (uv - vec2(uCenterX, uCenterY)) / uZoom + vec2(uCenterX, uCenterY);

    // Rotation
    float angle = uRotation * 3.14159 / 180.0;
    vec2 center = vec2(0.5);
    uv -= center;
    uv = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * uv;
    uv += center;

    // Warp
    float warpX = snoise(vec3(uv * uWarpFrequency, t * uWarpSpeed)) * uWarpAmplitude;
    float warpY = snoise(vec3(uv * uWarpFrequency + 100.0, t * uWarpSpeed)) * uWarpAmplitude;
    uv += vec2(warpX, warpY) * uWarpStrength;

    // Noise-based color mixing
    float n1 = snoise(vec3(uv * uNoiseScale, t * 0.5));
    float n2 = snoise(vec3(uv * uNoiseScale + 50.0, t * 0.3));

    // Blend
    float blendRad = uBlendAngle * 3.14159 / 180.0;
    float blendFactor = dot(uv - 0.5, vec2(cos(blendRad), sin(blendRad)));
    blendFactor = smoothstep(-uBlendSoftness, uBlendSoftness, blendFactor);

    // Color mixing
    vec3 color = mix(uColor1, uColor2, smoothstep(-0.5, 0.5, n1));
    color = mix(color, uColor3, smoothstep(-0.3, 0.6, n2) * blendFactor);

    // Color balance
    color *= uColorBalance;

    // Contrast
    color = (color - 0.5) * uContrast + 0.5;

    // Gamma
    color = pow(max(color, 0.0), vec3(1.0 / uGamma));

    // Saturation
    float lum = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(lum), color, uSaturation);

    // Grain
    float grainTime = uGrainAnimated > 0.5 ? t : 0.0;
    float g = grain(vUv * uGrainScale, grainTime);
    color += (g - 0.5) * uGrainAmount;

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`

interface GrainientProps {
  readonly timeSpeed?: number
  readonly colorBalance?: [number, number, number]
  readonly warpStrength?: number
  readonly warpFrequency?: number
  readonly warpSpeed?: number
  readonly warpAmplitude?: number
  readonly blendAngle?: number
  readonly blendSoftness?: number
  readonly rotationAmount?: number
  readonly noiseScale?: number
  readonly grainAmount?: number
  readonly grainScale?: number
  readonly grainAnimated?: boolean
  readonly contrast?: number
  readonly gamma?: number
  readonly saturation?: number
  readonly centerX?: number
  readonly centerY?: number
  readonly zoom?: number
  readonly color1?: string
  readonly color2?: string
  readonly color3?: string
  readonly className?: string
}

export function Grainient({
  timeSpeed = 0.05,
  colorBalance = [1, 1, 1],
  warpStrength = 1,
  warpFrequency = 5,
  warpSpeed = 0.2,
  warpAmplitude = 0.3,
  blendAngle = 45,
  blendSoftness = 0.5,
  rotationAmount = 0,
  noiseScale = 1.3,
  grainAmount = 0.15,
  grainScale = 700,
  grainAnimated = false,
  contrast = 1.1,
  gamma = 0.95,
  saturation = 1.2,
  centerX = 0.2,
  centerY = 0.2,
  zoom = 2.5,
  color1 = '#FF9FFC',
  color2 = '#5227FF',
  color3 = '#B19EEF',
  className = '',
}: GrainientProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new Renderer({ alpha: true, antialias: true })
    const gl = renderer.gl
    container.appendChild(gl.canvas as HTMLCanvasElement)

    const geometry = new Triangle(gl)

    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: [container.clientWidth, container.clientHeight, 1] },
        uTimeSpeed: { value: timeSpeed },
        uColorBalance: { value: colorBalance },
        uWarpStrength: { value: warpStrength },
        uWarpFrequency: { value: warpFrequency },
        uWarpSpeed: { value: warpSpeed },
        uWarpAmplitude: { value: warpAmplitude },
        uBlendAngle: { value: blendAngle },
        uBlendSoftness: { value: blendSoftness },
        uRotation: { value: rotationAmount },
        uNoiseScale: { value: noiseScale },
        uGrainAmount: { value: grainAmount },
        uGrainScale: { value: grainScale },
        uGrainAnimated: { value: grainAnimated ? 1 : 0 },
        uContrast: { value: contrast },
        uGamma: { value: gamma },
        uSaturation: { value: saturation },
        uCenterX: { value: centerX },
        uCenterY: { value: centerY },
        uZoom: { value: zoom },
        uColor1: { value: hexToVec3(color1) },
        uColor2: { value: hexToVec3(color2) },
        uColor3: { value: hexToVec3(color3) },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      program.uniforms.iResolution.value = [w, h, 1]
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()

    let animId: number
    const startTime = performance.now()

    const update = () => {
      program.uniforms.iTime.value = (performance.now() - startTime) * 0.001
      renderer.render({ scene: mesh })
      animId = requestAnimationFrame(update)
    }
    animId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      const canvas = gl.canvas as HTMLCanvasElement
      if (canvas.parentNode === container) {
        canvas.remove()
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  )
}

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ArrowRight, Table2, Activity, Gauge, ShieldCheck, type LucideIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stat {
  num: string;
  label: string;
}

interface FrequencyDatum {
  name: string;
  value: number;
  color: string;
}

interface Feature {
  Icon: LucideIcon;
  title: string;
  desc: string;
}

const STATS: Stat[] = [
  { num: '200k', label: 'rows, in-memory' },
  { num: 'O(1)', label: 'date-window scans' },
  { num: '<16ms', label: 'target frame budget' },
  { num: '100%', label: 'typed, zero any' },
];

// Query frequency by operation type — how often each interaction hits the worker
const FREQUENCY_DATA: FrequencyDatum[] = [
  { name: 'Filter', value: 38, color: '#2f80ed' },
  { name: 'Sort', value: 24, color: '#56ccf2' },
  { name: 'Search', value: 21, color: '#6fcf97' },
  { name: 'Aggregate', value: 17, color: '#2d9cdb' },
];

const FEATURES: Feature[] = [
  {
    Icon: Table2,
    title: 'Virtualized data explorer',
    desc: 'Sort, search and filter two hundred thousand records through a windowed table that renders only the rows on screen.',
  },
  {
    Icon: Activity,
    title: 'Worker-side aggregation',
    desc: 'The dataset lives inside a Web Worker as columnar typed arrays. Charts receive aggregates, never raw rows.',
  },
  {
    Icon: Gauge,
    title: 'Measured performance',
    desc: 'A dedicated monitor reports real query, search and render latencies — p50 and p95, pulled straight from ring buffers.',
  },
  {
    Icon: ShieldCheck,
    title: 'Production patterns',
    desc: 'Memoized pipelines, debounced search, query caching, error boundaries, skeleton states and empty states.',
  },
];

const TECH: string[] = ['React', 'TypeScript', 'Web Workers', 'TanStack'];

function FeatureCard({ Icon, title, desc }: Feature) {
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotY = (px - 0.5) * 8;
    const rotX = (py - 0.5) * -8;
    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px)`;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
  };
  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateY(0px)';
  };
  return (
    <div className="pa-card" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="pa-card-glow" />
      <div className="pa-card-icon">
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <h3 className="pa-card-title">{title}</h3>
      <p className="pa-card-desc">{desc}</p>
    </div>
  );
}

interface BarUserData {
  baseH: number;
  phase: number;
}

interface NodeUserData {
  angle: number;
  radius: number;
  speed: number;
  yOff: number;
  line: THREE.Line;
}

export default function PulseAnalyticsLanding() {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = sceneRef.current;
    if (!container) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = container.clientWidth;
    let height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const pLight1 = new THREE.PointLight(0x2f80ed, 2.6, 22);
    pLight1.position.set(3, 3, 4);
    const pLight2 = new THREE.PointLight(0x56ccf2, 2.0, 22);
    pLight2.position.set(-4, -2.5, 3);
    const pLight3 = new THREE.PointLight(0xffffff, 1.2, 22);
    pLight3.position.set(0, 4, 6);
    scene.add(ambient, pLight1, pLight2, pLight3);

    const rig = new THREE.Group();
    scene.add(rig);

    // Central glass panel
    const panelGeo = new THREE.BoxGeometry(4.4, 2.7, 0.06);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xdcf1fc,
      transparent: true,
      opacity: 0.35,
      roughness: 0.2,
      metalness: 0.15,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    rig.add(panel);

    const edgeGeo = new THREE.EdgesGeometry(panelGeo);
    const edgeLines = new THREE.LineSegments(
      edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x2d9cdb, transparent: true, opacity: 0.55 })
    );
    panel.add(edgeLines);

    // Bars living on the panel — a frequency spectrum, each bar an operation's hit rate
    const barCount = 11;
    const bars: THREE.Mesh[] = [];
    const colorA = new THREE.Color(0x2d9cdb);
    const colorB = new THREE.Color(0x2f80ed);
    for (let i = 0; i < barCount; i++) {
      const h = 0.45 + Math.random() * 1.35;
      const geo = new THREE.BoxGeometry(0.2, h, 0.07);
      const t = i / (barCount - 1);
      const color = colorA.clone().lerp(colorB, t);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.45,
        metalness: 0.2,
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(-1.85 + i * (3.7 / (barCount - 1)), -0.95 + h / 2, 0.1);
      bar.userData = { baseH: h, phase: Math.random() * Math.PI * 2 } as BarUserData;
      panel.add(bar);
      bars.push(bar);
    }

    // Orbiting nodes with connective lines
    const nodeGroup = new THREE.Group();
    rig.add(nodeGroup);
    const nodeCount = 7;
    const nodes: THREE.Mesh[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const geo = new THREE.IcosahedronGeometry(0.13, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x2f80ed,
        emissive: 0x2f80ed,
        emissiveIntensity: 0.45,
        wireframe: i % 2 === 0,
        roughness: 0.3,
        metalness: 0.3,
      });
      const node = new THREE.Mesh(geo, mat);
      const angle = (i / nodeCount) * Math.PI * 2;
      const radius = 3.1 + (i % 2) * 0.3;

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2d9cdb, transparent: true, opacity: 0.3 });
      const line = new THREE.Line(lineGeo, lineMat);
      nodeGroup.add(line);

      node.userData = {
        angle,
        radius,
        speed: 0.16 + Math.random() * 0.08,
        yOff: Math.random() * Math.PI * 2,
        line,
      } as NodeUserData;
      nodeGroup.add(node);
      nodes.push(node);
    }

    // Thin orbit ring
    const torusGeo = new THREE.TorusGeometry(3.5, 0.012, 8, 120);
    const torusMat = new THREE.MeshBasicMaterial({ color: 0x2f80ed, transparent: true, opacity: 0.35 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2.3;
    rig.add(torus);

    // Background particle field
    const particleCount = 260;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 3;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x2d9cdb,
      size: 0.028,
      transparent: true,
      opacity: 0.45,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    let mouseX = 0;
    let mouseY = 0;
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    };
    container.addEventListener('mousemove', handlePointerMove);

    const clock = new THREE.Clock();
    let frameId: number;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      const targetRotY = mouseX * 0.32;
      const targetRotX = mouseY * 0.14;
      rig.rotation.y += (targetRotY - rig.rotation.y) * 0.045;
      rig.rotation.x += (-targetRotX - rig.rotation.x) * 0.045;
      if (!reduceMotion) rig.rotation.y += 0.0016;

      bars.forEach((b) => {
        const data = b.userData as BarUserData;
        const h = data.baseH + Math.sin(t * 1.15 + data.phase) * 0.14;
        b.scale.y = h / data.baseH;
      });

      nodes.forEach((n) => {
        const data = n.userData as NodeUserData;
        const angle = data.angle + t * data.speed * (reduceMotion ? 0 : 1);
        n.position.set(
          Math.cos(angle) * data.radius,
          Math.sin(t * 0.55 + data.yOff) * 0.55,
          Math.sin(angle) * data.radius * 0.4
        );
        n.rotation.x += 0.008;
        n.rotation.y += 0.012;
        const posAttr = data.line.geometry.attributes.position as THREE.BufferAttribute;
        posAttr.setXYZ(1, n.position.x, n.position.y, n.position.z);
        posAttr.needsUpdate = true;
      });

      if (!reduceMotion) {
        particles.rotation.y += 0.0004;
        torus.rotation.z += 0.0011;
      }

      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      width = container.clientWidth;
      height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeChild(renderer.domElement);
      renderer.dispose();
      [panelGeo, edgeGeo, torusGeo, particleGeo].forEach((g) => g.dispose());
      bars.forEach((b) => {
        b.geometry.dispose();
        (b.material as THREE.Material).dispose();
      });
      nodes.forEach((n) => {
        const data = n.userData as NodeUserData;
        n.geometry.dispose();
        (n.material as THREE.Material).dispose();
        data.line.geometry.dispose();
        (data.line.material as THREE.Material).dispose();
      });
    };
  }, []);

  return (
    <div className="pa-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');

        .pa-root {
          --bg-0: #ffffff;
          --bg-1: #eaf6ff;
          --violet: #2f80ed;
          --blue: #2d9cdb;
          --cyan: #56ccf2;
          --ink: #10233d;
          --ink-dim: #5b7290;
          --glass-border: rgba(45,156,219,0.22);
          --glass-fill: rgba(86,204,242,0.10);

          background: linear-gradient(180deg, var(--bg-0), var(--bg-1) 70%);
          color: var(--ink);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }

        .pa-root::before {
          content: '';
          position: absolute;
          inset: 0;
          height: 900px;
          background:
            radial-gradient(60% 50% at 80% 0%, rgba(86,204,242,0.28), transparent 65%),
            radial-gradient(50% 45% at 10% 15%, rgba(47,128,237,0.14), transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        .pa-nav, .pa-hero, .pa-stats, .pa-features, .pa-footer {
          position: relative;
          z-index: 1;
        }

        .pa-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 28px clamp(20px, 5vw, 64px) 0;
          max-width: 1280px;
          margin: 0 auto;
        }

        .pa-brand { display: flex; align-items: center; gap: 12px; }

        .pa-logo {
          width: 34px; height: 34px; border-radius: 10px;
          background: linear-gradient(135deg, var(--blue), var(--violet));
          display: flex; align-items: center; justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700; font-size: 16px; color: white;
          box-shadow: 0 6px 18px -4px rgba(76,110,245,0.6);
        }

        .pa-wordmark { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 17px; letter-spacing: -0.01em; }

        .pa-signin {
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
          color: var(--ink); background: var(--glass-fill);
          border: 1px solid var(--glass-border); border-radius: 10px;
          padding: 9px 18px; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;
        }
        .pa-signin:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); }
        .pa-signin:focus-visible { outline: 2px solid var(--cyan); outline-offset: 2px; }

        .pa-hero {
          max-width: 1280px; margin: 0 auto;
          padding: clamp(48px, 8vw, 88px) clamp(20px, 5vw, 64px) 0;
          display: grid; grid-template-columns: 1fr; gap: 48px; align-items: center;
        }
        @media (min-width: 900px) {
          .pa-hero { grid-template-columns: 1.05fr 0.95fr; gap: 56px; }
        }

        .pa-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 14.5px; font-weight: 500; color: var(--ink-dim);
          background: var(--glass-fill); border: 1px solid var(--glass-border);
          border-radius: 999px; padding: 7px 14px 7px 12px;
        }
        .pa-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: var(--cyan); box-shadow: 0 0 0 0 rgba(53,213,224,0.6);
          animation: pa-pulse 2.4s ease-out infinite;
        }
        @keyframes pa-pulse {
          0% { box-shadow: 0 0 0 0 rgba(53,213,224,0.55); }
          70% { box-shadow: 0 0 0 7px rgba(53,213,224,0); }
          100% { box-shadow: 0 0 0 0 rgba(53,213,224,0); }
        }
        @media (prefers-reduced-motion: reduce) { .pa-dot { animation: none; } }

        .pa-headline {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 600;
          font-size: clamp(34px, 5vw, 52px);
          line-height: 1.08;
          letter-spacing: -0.02em;
          margin: 22px 0 20px;
          max-width: 15ch;
        }
        .pa-gradient-text {
          background: linear-gradient(120deg, var(--blue), var(--violet) 60%, var(--cyan));
          -webkit-background-clip: text; background-clip: text; color: transparent;
        }

        .pa-sub {
          font-size: 17px; line-height: 1.65; color: var(--ink-dim);
          max-width: 46ch; margin-bottom: 32px;
        }

        .pa-cta-row { display: flex; flex-wrap: wrap; gap: 14px; }

        .pa-btn-primary {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14.5px; color: white;
          background: linear-gradient(135deg, var(--blue), var(--violet));
          border: none; border-radius: 12px; padding: 13px 22px; cursor: pointer;
          box-shadow: 0 12px 28px -10px rgba(45,156,219,0.5);
          transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
        }
        .pa-btn-primary:hover { transform: translateY(-2px); filter: brightness(1.06); box-shadow: 0 16px 34px -10px rgba(47,128,237,0.55); }
        .pa-btn-primary:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

        .pa-btn-secondary {
          font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14.5px; color: var(--ink);
          background: var(--glass-fill); border: 1px solid var(--glass-border);
          border-radius: 12px; padding: 13px 22px; cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
        }
        .pa-btn-secondary:hover { background: rgba(86,204,242,0.16); border-color: rgba(45,156,219,0.35); transform: translateY(-2px); }
        .pa-btn-secondary:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

        .pa-scene {
          position: relative; width: 100%; aspect-ratio: 4 / 3.1;
          border-radius: 28px; overflow: hidden;
          border: 1px solid var(--glass-border);
          background: rgba(86,204,242,0.06);
          box-shadow: 0 40px 90px -25px rgba(45,156,219,0.35), inset 0 1px 0 rgba(255,255,255,0.5);
        }

        .pa-stats {
          max-width: 1280px; margin: 64px auto 0;
          padding: 0 clamp(20px, 5vw, 64px);
        }
        .pa-signin {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500;
          color: var(--ink); background: var(--glass-fill);
          border: 1px solid var(--glass-border); border-radius: 10px;
          padding: 9px 18px; cursor: pointer; transition: background 0.2s ease, border-color 0.2s ease;
        }
        .pa-stats-inner {
          border-top: 1px solid var(--glass-border);
          border-bottom: 1px solid var(--glass-border);
          display: grid; grid-template-columns: repeat(2, 1fr);
          padding: 30px 0;
        }
        @media (min-width: 700px) {
          .pa-stats-inner { grid-template-columns: repeat(4, 1fr); }
        }
        .pa-stat {
          padding: 10px clamp(4px, 2vw, 20px);
          border-left: 1px solid var(--glass-border);
        }
        .pa-stat:nth-child(odd) { border-left: none; }
        @media (min-width: 700px) {
          .pa-stat:nth-child(odd) { border-left: 1px solid var(--glass-border); }
          .pa-stat:first-child { border-left: none; }
        }
        .pa-stat-num {
          font-family: 'Space Grotesk', sans-serif; font-weight: 700;
          font-size: clamp(22px, 3vw, 30px);
        }
        .pa-stat-label { font-size: 14.5px; color: var(--ink-dim); margin-top: 4px; }

        .pa-features {
          max-width: 1280px; margin: 0 auto;
          padding: 88px clamp(20px, 5vw, 64px) 96px;
          display: grid; grid-template-columns: 1fr; gap: 20px;
        }
        @media (min-width: 800px) {
          .pa-features { grid-template-columns: 1fr 1fr; gap: 22px; }
        }

        .pa-card {
          position: relative;
          background: var(--glass-fill);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 28px;
          transition: transform 0.12s ease-out, border-color 0.2s ease;
          will-change: transform;
          transform-style: preserve-3d;
          overflow: hidden;
        }
        .pa-card:hover { border-color: rgba(255,255,255,0.18); }
        .pa-card-glow {
          position: absolute; inset: 0; opacity: 0; pointer-events: none;
          background: radial-gradient(220px circle at var(--mx, 50%) var(--my, 50%), rgba(124,92,255,0.16), transparent 70%);
          transition: opacity 0.25s ease;
        }
        .pa-card:hover .pa-card-glow { opacity: 1; }
        .pa-card-icon {
          width: 40px; height: 40px; border-radius: 11px;
          background: linear-gradient(135deg, rgba(76,110,245,0.25), rgba(124,92,255,0.25));
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          color: var(--cyan); margin-bottom: 18px;
        }
        .pa-card-title { font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 18px; margin-bottom: 10px; }
        .pa-card-desc { font-size: 15.5px; line-height: 1.6; color: var(--ink-dim); }

        .pa-freq {
          max-width: 1280px; margin: 0 auto;
          padding: 0 clamp(20px, 5vw, 64px) 96px;
        }
        .pa-freq-panel {
          background: var(--glass-fill);
          border: 1px solid var(--glass-border);
          border-radius: 24px;
          padding: clamp(24px, 4vw, 40px);
          display: grid; grid-template-columns: 1fr; gap: 28px; align-items: center;
        }
        @media (min-width: 800px) {
          .pa-freq-panel { grid-template-columns: 0.9fr 1.1fr; gap: 40px; }
        }
        .pa-freq-title {
          font-family: 'Space Grotesk', sans-serif; font-weight: 600;
          font-size: clamp(22px, 2.6vw, 28px); margin-bottom: 12px;
        }
        .pa-freq-desc { font-size: 15.5px; line-height: 1.6; color: var(--ink-dim); max-width: 42ch; }
        .pa-freq-chart { width: 100%; height: 280px; }
        .pa-freq-legend-item { font-size: 14px; color: var(--ink-dim); }

        .pa-footer {
          max-width: 1280px; margin: 0 auto;
          padding: 26px clamp(20px, 5vw, 64px) 40px;
          border-top: 1px solid var(--glass-border);
          display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px;
        }
        .pa-footer-label { font-size: 14.5px; color: var(--ink-dim); }
        .pa-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .pa-chip {
          font-size: 13.5px; color: var(--ink-dim);
          background: var(--glass-fill); border: 1px solid var(--glass-border);
          border-radius: 999px; padding: 5px 12px;
        }
      `}</style>

      <nav className="pa-nav">
        <div className="pa-brand">
          <div className="pa-logo">P</div>
          <span className="pa-wordmark">Pulse Analytics</span>
        </div>
        <a href="/auth" className="pa-signin">Sign in</a>
      </nav>

      <section className="pa-hero">
        <div>
          <div className="pa-badge">
            <span className="pa-dot" />
            Built for 200k-row datasets
          </div>
          <h1 className="pa-headline">
            An analytics dashboard built to{' '}
            <span className="pa-gradient-text">outrun the dataset.</span>
          </h1>
          <p className="pa-sub">
            Pulse Analytics explores two hundred thousand ad-performance records through a
            virtualized explorer, worker-side aggregation, and a telemetry layer that measures
            its own frame budget — a working reference for production-grade React architecture.
          </p>
          <div className="pa-cta-row">
            <button className="pa-btn-primary">
              Launch dashboard <ArrowRight size={17} />
            </button>
            <button className="pa-btn-secondary">Read the architecture</button>
          </div>
        </div>
        <div className="pa-scene" ref={sceneRef} />
      </section>

      <section className="pa-stats">
        <div className="pa-stats-inner">
          {STATS.map((s) => (
            <div className="pa-stat" key={s.label}>
              <div className="pa-stat-num">{s.num}</div>
              <div className="pa-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="pa-freq">
        <div className="pa-freq-panel">
          <div>
            <h2 className="pa-freq-title">Operation frequency</h2>
            <p className="pa-freq-desc">
              How often each interaction hits the worker, measured over a typical session.
              Filtering dominates the query mix, which is why it gets its own memoized pipeline.
            </p>
          </div>
          <div className="pa-freq-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={FREQUENCY_DATA}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="85%"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {FREQUENCY_DATA.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid rgba(45,156,219,0.25)',
                    borderRadius: 10,
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ fontFamily: 'Inter, sans-serif', fontSize: 14 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="pa-features">
        {FEATURES.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </section>

      <footer className="pa-footer">
        <span className="pa-footer-label">Pulse Analytics — Performance R&D</span>
        <div className="pa-chips">
          {TECH.map((t) => (
            <span className="pa-chip" key={t}>{t}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
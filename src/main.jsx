import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import L from 'leaflet';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BatteryCharging,
  ChevronDown, ChevronRight, CircleHelp, Compass, Crosshair, Fuel, Gauge,
  Globe2, Map, Menu, Minus, Navigation, Plane, Plus, Power, Radio, Route,
  Settings2, SlidersHorizontal, Sparkles, Volume2, Wind, X,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './style.css';

const START = { lat: 19.0896, lon: 72.8656 };
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const initialFlight = {
  lat: START.lat, lon: START.lon, altitude: 1450, speed: 142, heading: 285,
  verticalSpeed: 0, throttle: 72, pitch: 0, bank: 0, fuel: 87,
};

function AircraftScene({ flight, running, setRunning }) {
  const mountRef = useRef(null);
  const stateRef = useRef({ flight, running });
  useEffect(() => { stateRef.current = { flight, running }; }, [flight, running]);

  useEffect(() => {
    const root = mountRef.current;
    if (!root) return undefined;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a2c2d0');
    scene.fog = new THREE.Fog('#a2c2d0', 1800, 9500);
    const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 14000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    root.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#d5e8f4', '#596965', 2.4));
    const sun = new THREE.DirectionalLight('#fff0d6', 3.2);
    sun.position.set(-600, 1100, 500);
    sun.castShadow = true;
    scene.add(sun);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(24000, 24000),
      new THREE.MeshStandardMaterial({ color: '#667962', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -4;
    ground.receiveShadow = true;
    scene.add(ground);

    // Explicitly a visual placeholder; this is not an A320/737 model.
    const city = new THREE.Group();
    const palette = ['#9c9284', '#c4b8a0', '#7b8b83', '#ded2bc', '#a8a28f'];
    for (let i = 0; i < 145; i += 1) {
      const angle = i * 2.399;
      const radius = 150 + Math.sqrt(i) * 112 + (i % 7) * 35;
      const height = 12 + ((i * 47) % 70);
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(24 + ((i * 13) % 45), height, 24 + ((i * 17) % 29)),
        new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.9 }),
      );
      building.position.set(Math.cos(angle) * radius, height / 2 - 3, Math.sin(angle) * radius);
      building.castShadow = i < 50;
      building.receiveShadow = true;
      city.add(building);
    }
    scene.add(city);

    // Temporary, code-generated silhouette for interaction testing only.
    const aircraft = new THREE.Group();
    const shell = new THREE.MeshStandardMaterial({ color: '#e8e4da', metalness: 0.14, roughness: 0.46 });
    const accent = new THREE.MeshStandardMaterial({ color: '#e77b46', roughness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: '#253e50', metalness: 0.35, roughness: 0.3 });
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 11, 16), shell);
    fuselage.rotation.x = Math.PI / 2;
    aircraft.add(fuselage);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.72, 2.8, 16), shell);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 6.8;
    aircraft.add(nose);
    const tailShape = new THREE.Shape();
    tailShape.moveTo(-1.5, 1.5); tailShape.lineTo(-16, -2.2); tailShape.lineTo(-14.8, -4.1);
    tailShape.lineTo(-3, -1.2); tailShape.lineTo(3, -1.2); tailShape.lineTo(14.8, -4.1);
    tailShape.lineTo(16, -2.2); tailShape.lineTo(1.5, 1.5); tailShape.closePath();
    const wings = new THREE.Mesh(new THREE.ExtrudeGeometry(tailShape, { depth: 0.2, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 1 }), shell);
    wings.rotation.x = Math.PI / 2;
    aircraft.add(wings);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 3), accent);
    fin.position.set(0, 1.2, -5);
    aircraft.add(fin);
    for (const side of [-1, 1]) {
      const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.82, 3.1, 14), glass);
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 7.6, -1.05, -1.1);
      aircraft.add(engine);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1, 2), accent);
      tip.position.set(side * 15.7, 0.5, -2.5);
      aircraft.add(tip);
    }
    scene.add(aircraft);

    const resize = () => {
      const { width, height } = root.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    resize();
    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const { flight: data, running: active } = stateRef.current;
      const heading = THREE.MathUtils.degToRad(data.heading);
      aircraft.rotation.order = 'YXZ';
      aircraft.rotation.y = Math.PI - heading;
      aircraft.rotation.z = THREE.MathUtils.degToRad(-data.bank);
      aircraft.rotation.x = THREE.MathUtils.degToRad(data.pitch);
      aircraft.position.y = clamp((data.altitude - 400) * 0.055, 22, 380);
      const desiredCamera = aircraft.position.clone().add(new THREE.Vector3(Math.sin(heading) * 22, 46, -106));
      camera.position.lerp(desiredCamera, 0.055);
      camera.lookAt(aircraft.position.clone().add(new THREE.Vector3(0, 2, 42)));
      if (active) {
        city.position.x += Math.sin(heading) * 0.0007;
        city.position.z -= Math.cos(heading) * 0.0007;
      }
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
        else object.material?.dispose();
      });
      renderer.dispose();
      root.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="scene-wrap" ref={mountRef}>
    <div className="scene-label"><span className="live-dot" /> SIMULATED · PROCEDURAL SCENE</div>
    <div className="scene-coordinates">{flight.lat.toFixed(3)}° N &nbsp; {flight.lon.toFixed(3)}° E</div>
    <div className="scene-controls"><span>PROTOTYPE AIRCRAFT</span><button onClick={() => setRunning(!running)} aria-label={running ? 'Pause flight' : 'Resume flight'}>{running ? 'Ⅱ' : '▶'}</button></div>
    <div className="flight-hud">
      {[['ALT', Math.round(flight.altitude).toLocaleString(), 'ft'], ['SPD', Math.round(flight.speed), 'kt'], ['HDG', String(Math.round(flight.heading)).padStart(3, '0'), '°'], ['VS', `${flight.verticalSpeed >= 0 ? '+' : ''}${Math.round(flight.verticalSpeed)}`, 'fpm']].map(([label, value, unit]) =>
        <div key={label}><small>{label}</small><strong>{value}<i> {unit}</i></strong></div>)}
    </div>
  </div>;
}

function MiniMap({ flight, setFlight, expanded, setExpanded }) {
  const mapRef = useRef(null);
  const instanceRef = useRef(null);
  const markerRef = useRef(null);
  useEffect(() => {
    if (!mapRef.current || instanceRef.current) return undefined;
    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([START.lat, START.lon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const icon = L.divIcon({ className: 'plane-marker', html: '<span>▲</span>', iconSize: [26, 26], iconAnchor: [13, 13] });
    markerRef.current = L.marker([flight.lat, flight.lon], { icon, interactive: false }).addTo(map);
    map.on('click', (event) => setFlight((current) => ({ ...current, lat: event.latlng.lat, lon: event.latlng.lng })));
    instanceRef.current = map;
    const timer = setTimeout(() => map.invalidateSize(), 100);
    return () => { clearTimeout(timer); map.remove(); instanceRef.current = null; };
  }, []);
  useEffect(() => {
    if (!instanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([flight.lat, flight.lon]);
    markerRef.current.getElement()?.style.setProperty('--plane-heading', `${flight.heading}deg`);
    instanceRef.current.panTo([flight.lat, flight.lon], { animate: false });
  }, [flight.lat, flight.lon, flight.heading]);
  useEffect(() => {
    if (!instanceRef.current) return undefined;
    const timer = setTimeout(() => instanceRef.current?.invalidateSize(), 120);
    return () => clearTimeout(timer);
  }, [expanded]);
  return <section className={`panel map-panel ${expanded ? 'map-expanded' : ''}`}>
    <div className="panel-title"><span><Map size={15} /> FLIGHT MAP</span><button className="icon-btn" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Shrink map' : 'Expand map'}>{expanded ? <Minus size={15} /> : <Plus size={15} />}</button></div>
    <div className="map-canvas" ref={mapRef} />
    <div className="map-legend"><span><i className="legend-plane">▲</i> AKS 01</span><span>{Math.round(flight.heading).toString().padStart(3, '0')}° HDG</span></div>
    <div className="map-hint">OpenStreetMap · Tap to reposition · Buildings in scene are illustrative</div>
  </section>;
}

function Metric({ label, value, unit, icon: Icon, accent }) {
  return <div className="metric"><div className={`metric-icon ${accent || ''}`}><Icon size={15} /></div><div><span className="metric-label">{label}</span><strong>{value}<small>{unit}</small></strong></div></div>;
}

function FlightData({ flight }) {
  return <section className="panel instruments">
    <div className="panel-title"><span><Activity size={15} /> FLIGHT DATA</span><span className="autopilot-chip"><span /> SIM ACTIVE</span></div>
    <div className="metrics-grid">
      <Metric label="ALTITUDE" value={Math.round(flight.altitude).toLocaleString()} unit=" FT" icon={ArrowUp} accent="orange" />
      <Metric label="AIRSPEED" value={Math.round(flight.speed)} unit=" KT" icon={Gauge} />
      <Metric label="HEADING" value={Math.round(flight.heading).toString().padStart(3, '0')} unit=" °" icon={Compass} />
      <Metric label="VERTICAL" value={`${flight.verticalSpeed >= 0 ? '+' : ''}${Math.round(flight.verticalSpeed)}`} unit=" FPM" icon={Wind} />
    </div>
    <div className="gauge-row"><div className="gauge-label"><span>ALTITUDE</span><span>{Math.round(flight.altitude).toLocaleString()} FT</span></div><div className="gauge-track"><i style={{ width: `${clamp(flight.altitude / 12000 * 100, 2, 98)}%` }} /></div></div>
    <div className="gauge-row"><div className="gauge-label"><span>IAS</span><span>{Math.round(flight.speed)} KT</span></div><div className="gauge-track blue"><i style={{ width: `${clamp(flight.speed / 320 * 100, 2, 98)}%` }} /></div></div>
    <div className="attitude"><div className="attitude-sky" style={{ transform: `rotate(${-flight.bank}deg)`, top: `${50 - flight.pitch * 2}%` }} /><div className="attitude-symbol"><span /><i /></div><span className="attitude-tag">ATTITUDE · SIMULATED</span></div>
    <div className="engine-row"><Fuel size={14} /><span>FUEL</span><strong>{flight.fuel.toFixed(0)}%</strong><div className="fuel-track"><i style={{ width: `${flight.fuel}%` }} /></div><span>DEMO</span></div>
  </section>;
}

function Mcdu({ flight, setFlight, plan, setPlan, cycle, setCycle }) {
  const [page, setPage] = useState('F-PLN');
  const [entry, setEntry] = useState('');
  const [pilotId, setPilotId] = useState(() => localStorage.getItem('akash-simbrief-id') || '');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [fixes, setFixes] = useState(plan.waypoints);
  const importPlan = async () => {
    if (!pilotId.trim()) { setNotice('Enter your SimBrief user ID first.'); return; }
    setLoading(true);
    setNotice('Requesting your latest dispatch…');
    localStorage.setItem('akash-simbrief-id', pilotId.trim());
    try {
      const response = await fetch(`https://www.simbrief.com/api/xml.fetcher.php?userid=${encodeURIComponent(pilotId.trim())}&json=1`);
      if (!response.ok) throw new Error(`SimBrief returned ${response.status}`);
      const data = await response.json();
      const navlog = data.navlog?.fix || data.navlog || [];
      const routeFixes = Array.isArray(navlog) ? navlog.map((fix) => fix.ident).filter(Boolean).slice(0, 12) : [];
      const waypoints = routeFixes.length ? routeFixes : [data.origin?.icao_code, data.destination?.icao_code].filter(Boolean);
      if (!waypoints.length) throw new Error('No route fixes found in dispatch.');
      setFixes(waypoints);
      setPlan({ origin: data.origin?.icao_code || '—', destination: data.destination?.icao_code || '—', flightNumber: data.general?.flight_number || 'AKS 01', waypoints });
      const airac = data.params?.airac;
      setCycle(airac ? `SimBrief dispatch · AIRAC ${airac}` : 'SimBrief dispatch · AIRAC not supplied');
      setNotice(`Dispatch loaded: ${data.origin?.icao_code || '—'} → ${data.destination?.icao_code || '—'}`);
    } catch (error) {
      setNotice(`Import failed: ${error.message}. Check your ID and dispatch.`);
    } finally { setLoading(false); }
  };
  const execute = () => {
    const value = entry.trim().toUpperCase();
    if (!value) return;
    if (/^\d{3}$/.test(value)) setFlight((current) => ({ ...current, heading: Number(value) }));
    else if (/^FL\d{2,3}$/.test(value)) setFlight((current) => ({ ...current, altitude: Number(value.slice(2)) * 100 }));
    else if (/^[A-Z0-9]{2,5}$/.test(value)) {
      const next = [...fixes.slice(0, 11), value];
      setFixes(next);
      setPlan((current) => ({ ...current, waypoints: next }));
    } else { setNotice('Enter a fix, 3-digit heading, or flight level (FLxxx).'); return; }
    setNotice(`${value} set in the prototype flight computer.`);
    setEntry('');
  };
  const key = (value) => {
    if (value === 'CLR') setEntry((current) => current.slice(0, -1));
    else if (value === 'EXEC') execute();
    else setEntry((current) => `${current}${value}`.slice(0, 12));
  };
  return <section className="panel mcdu-panel">
    <div className="panel-title"><span><Radio size={15} /> MCDU · PROTOTYPE</span><span className="small-live">NOT CERTIFIED</span></div>
    <div className="mcdu-screen">
      <div className="mcdu-top"><span>AKASH WEB SIM</span><span>{page} <ChevronDown size={11} /></span></div>
      <div className="mcdu-cycle">{cycle.toUpperCase()}</div>
      {page === 'F-PLN' && <div className="route-block"><div className="route-head"><span>FROM / TO</span><span>FLIGHT PLAN</span></div><div className="route-cities"><strong>{plan.origin}</strong><Route size={16} /><strong>{plan.destination}</strong></div><div className="fix-list">{fixes.map((fix, index) => <div key={`${fix}-${index}`}><span>· &nbsp;{fix}</span><small>{index === 0 ? 'ORIGIN' : index === fixes.length - 1 ? 'DEST' : 'FIX'}</small></div>)}</div></div>}
      {page !== 'F-PLN' && <div className="mcdu-page-content"><span>{page} · SIMULATION</span><strong>{page === 'PERF' ? `FL${Math.round(flight.altitude / 100)}` : page === 'DATA' ? cycle.toUpperCase() : fixes[1] || 'SELECT FIX'}</strong><p>DEMO FLIGHT COMPUTER<br />NOT CONNECTED TO AIRCRAFT SYSTEMS</p></div>}
      <div className="mcdu-entry"><span>›</span><input aria-label="MCDU scratchpad" value={entry} onChange={(event) => setEntry(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter') execute(); }} placeholder="INSERT ENTRY" /><button onClick={execute}>→</button></div>
    </div>
    <div className="mcdu-pages">{['F-PLN', 'DIR TO', 'PERF', 'DATA'].map((name) => <button key={name} className={page === name ? 'selected' : ''} onClick={() => setPage(name)}>{name}</button>)}</div>
    <div className="keypad">{['DIR', 'PROG', 'PERF', 'INIT', 'F-PLN', 'RAD NAV', 'DATA', 'SEC F-PLN', 'CLR', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'DOT', '0', 'EXEC'].map((value) => <button key={value} className={['EXEC', 'CLR'].includes(value) ? `key-${value.toLowerCase()}` : ''} onClick={() => ['DIR', 'PERF', 'DATA', 'F-PLN'].includes(value) ? setPage(value === 'DIR' ? 'DIR TO' : value) : key(value === 'DOT' ? '.' : value)}>{value}</button>)}</div>
    <div className="simbrief"><label>SIMBRIEF USER ID<input value={pilotId} onChange={(event) => setPilotId(event.target.value)} placeholder="Pilot ID" /></label><button onClick={importPlan} disabled={loading}>{loading ? 'LOADING…' : 'IMPORT OFP'} <ChevronRight size={13} /></button></div>
    {notice && <div className="mcdu-notice">{notice}</div>}
    <div className="data-disclaimer"><CircleHelp size={12} /> No AIRAC dataset is bundled. Cycle displays only when supplied in dispatch data.</div>
  </section>;
}

function App() {
  const [flight, setFlight] = useState(initialFlight);
  const [running, setRunning] = useState(true);
  const [plan, setPlan] = useState({ origin: 'VABB', destination: 'VOGO', flightNumber: 'AKS 01', waypoints: ['BOM', 'DCT', 'PUN', 'DCT', 'GOI'] });
  const [cycle, setCycle] = useState('NO NAVDATA LOADED');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [control, setControl] = useState({ bank: 0, pitch: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sensitivity, setSensitivity] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!running) return;
      setFlight((current) => {
        const pitch = clamp(current.pitch + control.pitch * 0.0009 * sensitivity, -18, 18);
        const bank = clamp(current.bank + control.bank * 0.0015 * sensitivity, -28, 28);
        const heading = (current.heading + bank * 0.018 + 360) % 360;
        const speed = clamp(current.speed + (current.throttle - 55) * 0.002, 70, 315);
        const verticalSpeed = clamp(pitch * 95 + (current.throttle - 72) * 10, -2500, 2800);
        const altitude = clamp(current.altitude + verticalSpeed / 60, 200, 41000);
        const distance = speed / 3600 / 60;
        const radians = heading * Math.PI / 180;
        return {
          ...current, pitch, bank, heading, speed, altitude, verticalSpeed,
          lat: current.lat + Math.cos(radians) * distance,
          lon: current.lon + Math.sin(radians) * distance / Math.cos(current.lat * Math.PI / 180),
          fuel: Math.max(0, current.fuel - 0.0005),
        };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [running, control, sensitivity]);
  useEffect(() => {
    const down = (event) => {
      if (event.target instanceof HTMLInputElement) return;
      const keys = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] };
      if (keys[event.key]) { event.preventDefault(); setControl({ bank: keys[event.key][0], pitch: keys[event.key][1] }); }
      if (event.code === 'Space') { event.preventDefault(); setRunning((active) => !active); }
      if (event.key.toLowerCase() === 'w') setFlight((current) => ({ ...current, throttle: clamp(current.throttle + 2, 0, 100) }));
      if (event.key.toLowerCase() === 's') setFlight((current) => ({ ...current, throttle: clamp(current.throttle - 2, 0, 100) }));
    };
    const up = (event) => { if (event.key.startsWith('Arrow')) setControl({ bank: 0, pitch: 0 }); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);
  const adjustThrottle = (change) => setFlight((current) => ({ ...current, throttle: clamp(current.throttle + change, 0, 100) }));
  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Plane size={20} /></div><div><strong>AKASH<span> WEB SIM</span></strong><small>THE SKY IS YOURS</small></div></div>
      <div className="top-center"><span className="live-dot" /> EXPERIMENTAL SIM <i /> {plan.flightNumber} <i /> {plan.origin} → {plan.destination}</div>
      <div className="top-actions"><span className="weather"><span>☀</span> 31° &nbsp; MUMBAI</span><button className="icon-btn settings-toggle" onClick={() => setSettingsOpen(!settingsOpen)} aria-label="Settings"><Settings2 size={17} /></button><button className="icon-btn mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle cockpit"><Menu size={19} /></button></div>
    </header>
    <div className="prototype-banner">EARLY PROTOTYPE — generic visual aircraft, not a realistic A320 or B737. Accurate aircraft and cockpit assets are not included.</div>
    <div className="dashboard">
      <section className="left-column">
        <div className="panel flight-card"><div className="flight-card-top"><div><span className="eyebrow">YOUR FLIGHT</span><h1>{plan.flightNumber}</h1></div><div className="aircraft-badge"><Plane size={18} /><span>GENERIC<br /><b>DEMO</b></span></div></div>
          <div className="route-summary"><div><small>DEPARTURE</small><strong>{plan.origin}</strong><span>CHHATRAPATI SHIVAJI</span></div><div className="route-line"><i /><Plane size={14} /><i /></div><div><small>ARRIVAL</small><strong>{plan.destination}</strong><span>GOA / DUTABOLIM</span></div></div>
          <div className="flight-card-footer"><span><span className="live-dot" /> ENROUTE</span><span><Navigation size={12} /> {Math.round(flight.heading)}°</span><span><Globe2 size={12} /> INDIA</span></div>
        </div>
        <FlightData flight={flight} />
        <MiniMap flight={flight} setFlight={setFlight} expanded={mapExpanded} setExpanded={setMapExpanded} />
      </section>
      <section className="center-column">
        <div className="viewport-panel"><div className="viewport-top"><span><Crosshair size={14} /> EXTERNAL VIEW</span><span><span className="live-dot" /> PROCEDURAL DEMO <ChevronDown size={13} /></span></div>
          <AircraftScene flight={flight} running={running} setRunning={setRunning} />
          <div className="viewport-bottom"><span>ILLUSTRATIVE CITY · MUMBAI, INDIA</span><span><span className="live-dot" /> {running ? 'SIM RUNNING' : 'PAUSED'}</span><button onClick={() => { setMapExpanded(true); document.querySelector('.map-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><Crosshair size={12} /> CENTER MAP</button></div>
        </div>
        <section className="panel controls-panel"><div className="panel-title"><span><SlidersHorizontal size={15} /> FLIGHT CONTROLS</span><span className="controls-hint">ARROWS · W/S THROTTLE · SPACE PAUSE</span></div>
          <div className="control-body">
            <div className="control-group"><span className="control-caption">ROLL</span><div className="control-pad"><button onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setControl({ bank: -0.5, pitch: 0 }); }} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Bank left"><ArrowLeft /></button><span className="control-center"><i style={{ transform: `rotate(${flight.bank}deg)` }} /></span><button onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setControl({ bank: 0.5, pitch: 0 }); }} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Bank right"><ArrowRight /></button></div></div>
            <div className="control-group"><span className="control-caption">PITCH</span><div className="control-pad pitch-pad"><button onPointerDown={() => setControl({ bank: 0, pitch: -0.5 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Pitch up"><ArrowUp /></button><span className="control-center"><i style={{ transform: `translateY(${flight.pitch * .6}px)` }} /></span><button onPointerDown={() => setControl({ bank: 0, pitch: 0.5 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Pitch down"><ArrowDown /></button></div></div>
            <div className="control-group throttle-group"><span className="control-caption">THROTTLE <b>{Math.round(flight.throttle)}%</b></span><div className="throttle-wrap"><button onClick={() => adjustThrottle(-5)} aria-label="Decrease throttle">−</button><input aria-label="Throttle" type="range" min="0" max="100" value={flight.throttle} onChange={(event) => setFlight((current) => ({ ...current, throttle: Number(event.target.value) }))} /><button onClick={() => adjustThrottle(5)} aria-label="Increase throttle"><Plus size={15} /></button></div></div>
            <button className={`start-button ${running ? 'paused' : ''}`} onClick={() => setRunning(!running)}>{running ? <><Power size={16} /> PAUSE</> : <><Sparkles size={16} /> RESUME</>}</button>
          </div>
          {settingsOpen && <div className="settings-popover"><strong>FLIGHT SETTINGS</strong><label>Control sensitivity<input type="range" min="0.5" max="2" step="0.1" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /></label><span>Weather: clear · visual demo only</span><button onClick={() => { setFlight(initialFlight); setRunning(true); }}>RESET FLIGHT</button></div>}
        </section>
        <div className="mobile-control-bar"><button onPointerDown={() => setControl({ bank: -0.6, pitch: 0 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Bank left"><ArrowLeft /></button><button onPointerDown={() => setControl({ bank: 0, pitch: -0.6 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Pitch up"><ArrowUp /></button><button className="mobile-pause" onClick={() => setRunning(!running)}>{running ? 'PAUSE' : 'FLY'}</button><button onPointerDown={() => setControl({ bank: 0, pitch: 0.6 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Pitch down"><ArrowDown /></button><button onPointerDown={() => setControl({ bank: 0.6, pitch: 0 })} onPointerUp={() => setControl({ bank: 0, pitch: 0 })} onPointerLeave={() => setControl({ bank: 0, pitch: 0 })} aria-label="Bank right"><ArrowRight /></button></div>
        <div className="bottom-strip"><span><span className="live-dot" /> DEMO SYSTEMS</span><span><BatteryCharging size={14} /> FUEL {flight.fuel.toFixed(0)}%</span><span><Volume2 size={14} /> AUDIO N/A</span><button onClick={() => setMobileMenu(!mobileMenu)}><Radio size={14} /> FLIGHT DECK</button></div>
      </section>
      <section className={`right-column ${mobileMenu ? 'mobile-open' : ''}`}><div className="right-heading"><span>FLIGHT DECK</span><button className="icon-btn close-mobile" onClick={() => setMobileMenu(false)} aria-label="Close cockpit"><X size={16} /></button></div>
        <Mcdu flight={flight} setFlight={setFlight} plan={plan} setPlan={setPlan} cycle={cycle} setCycle={setCycle} />
        <div className="panel nav-panel"><div className="panel-title"><span><Compass size={15} /> NAVIGATION</span><span className="small-live">SIMULATED</span></div><div className="nav-rose"><div className="rose-ring"><span className="rose-n">N</span><span className="rose-s">S</span><span className="rose-e">E</span><span className="rose-w">W</span><i className="rose-plane" style={{ transform: `translate(-50%, -50%) rotate(${flight.heading}deg)` }}>▲</i><small>{Math.round(flight.heading).toString().padStart(3, '0')}°</small></div></div><div className="nav-readout"><span>GPS POSITION</span><strong>{flight.lat.toFixed(4)}°N&nbsp; {flight.lon.toFixed(4)}°E</strong><span>INDICATIONS FOR DEMO ONLY</span></div></div>
        <div className="panel route-panel"><div className="panel-title"><span><Route size={15} /> ROUTE OVERVIEW</span><button className="icon-btn" onClick={() => setMapExpanded(true)} aria-label="Open map"><ChevronRight size={15} /></button></div><div className="route-mini"><div><strong>{plan.origin}</strong><small>ORIGIN</small></div><div className="route-mini-line"><i /><Navigation size={12} /><i /></div><div><strong>{plan.destination}</strong><small>DEST</small></div></div><div className="route-mini-meta"><span><Navigation size={12} /> {plan.waypoints?.length || 0} FIXES</span><span><Wind size={12} /> DEMO</span></div><div className="route-airac"><span>AIRAC / NAV SOURCE</span><strong>{cycle}</strong></div></div>
      </section>
    </div>
    <footer className="footer"><span>© 2026 AKASH WEB SIM</span><span>EXPERIMENTAL FLIGHT SIM <span className="footer-saffron">✦</span></span><span>MAP DATA © OPENSTREETMAP CONTRIBUTORS</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);

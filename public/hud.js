// JARVIS Holographic Radar & HUD Canvas Engine
// Renders high-fidelity holographic radar, 3D wireframe core, radial compass, and telemetry stream

export class JarvisHud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.animationId = null;
    this.isSpeaking = false;
    this.isThinking = false;
    this.time = 0;
    this.audioWaveData = new Array(32).fill(0);

    // 3D Sphere vertices for holographic wireframe
    this.sphereNodes = this.generateSphereNodes(40, 75);
    this.sphereRotation = { x: 0, y: 0, z: 0 };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.start();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = Math.min(520, Math.max(380, this.width * 0.52));

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.scale(dpr, dpr);
  }

  generateSphereNodes(count, radius) {
    const nodes = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      nodes.push({ x: x * radius, y: y * radius, z: z * radius });
    }
    return nodes;
  }

  setSpeaking(speaking) {
    this.isSpeaking = speaking;
  }

  setThinking(thinking) {
    this.isThinking = thinking;
  }

  start() {
    const loop = () => {
      this.render();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Time scaling: faster when speaking or thinking
    const speed = this.isSpeaking ? 0.045 : this.isThinking ? 0.06 : 0.02;
    this.time += speed;

    // Clear with dark space background
    ctx.clearRect(0, 0, w, h);

    // Layout coordinates based on container size
    const isMobile = w < 680;
    const radarCenter = isMobile
      ? { x: w * 0.5, y: h * 0.42, r: Math.min(w * 0.38, 140) }
      : { x: w * 0.36, y: h * 0.48, r: Math.min(w * 0.28, 175) };

    const sphereCenter = isMobile
      ? { x: w * 0.82, y: h * 0.18, r: 40 }
      : { x: w * 0.82, y: h * 0.28, r: Math.min(w * 0.11, 75) };

    const compassCenter = isMobile
      ? { x: w * 0.82, y: h * 0.75, r: 40 }
      : { x: w * 0.82, y: h * 0.72, r: Math.min(w * 0.11, 72) };

    // 1. Draw Main Left Holographic Radar
    this.drawRadar(ctx, radarCenter.x, radarCenter.y, radarCenter.r);

    // 2. Draw Top-Right 3D Holographic Sphere
    this.drawHoloSphere(ctx, sphereCenter.x, sphereCenter.y, sphereCenter.r);

    // 3. Draw Bottom-Right Radial Compass / Target Caliper
    this.drawRadialCompass(ctx, compassCenter.x, compassCenter.y, compassCenter.r);

    // 4. Draw Infrared & Audio Equalizer Spectrum (Bottom)
    this.drawEqualizerSpectrum(ctx, w * 0.05, h * 0.90, w * 0.55, 30);

    // 5. Draw HUD Cyberpunk Callouts & Header
    this.drawHudOverlay(ctx, w, h);
  }

  // --- 1. MAIN HOLOGRAPHIC RADAR ---
  drawRadar(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);

    const pulse = this.isSpeaking ? Math.sin(this.time * 6) * 4 : Math.sin(this.time * 2) * 1.5;

    // Glow background
    const bgGrad = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 1.05);
    bgGrad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    bgGrad.addColorStop(0.6, 'rgba(0, 112, 243, 0.05)');
    bgGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Concentric grid rings
    const ringFractions = [0.15, 0.32, 0.5, 0.68, 0.85, 1.0];
    ringFractions.forEach((frac, i) => {
      ctx.beginPath();
      ctx.arc(0, 0, r * frac + (i === 5 ? pulse : 0), 0, Math.PI * 2);
      ctx.strokeStyle = i === 5 ? 'rgba(0, 240, 255, 0.8)' : 'rgba(0, 240, 255, 0.22)';
      ctx.lineWidth = i === 5 ? 2 : 1;
      if (i % 2 === 1) {
        ctx.setLineDash([4, 6]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Radial crosshairs & angle division ticks
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(cos * (r * 0.15), sin * (r * 0.15));
      ctx.lineTo(cos * r, sin * r);
      ctx.strokeStyle = deg % 90 === 0 ? 'rgba(0, 240, 255, 0.35)' : 'rgba(0, 240, 255, 0.12)';
      ctx.lineWidth = deg % 90 === 0 ? 1.5 : 1;
      ctx.stroke();

      // Outer tick notches
      ctx.beginPath();
      ctx.moveTo(cos * (r * 0.96), sin * (r * 0.96));
      ctx.lineTo(cos * (r * 1.04), sin * (r * 1.04));
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Outer Segmented Caliper Brackets (Clockwise & Counter-Clockwise)
    ctx.save();
    ctx.rotate(this.time * 0.4);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.08, 0, Math.PI * 0.4);
    ctx.arc(0, 0, r * 1.08, Math.PI * 0.6, Math.PI * 0.9);
    ctx.arc(0, 0, r * 1.08, Math.PI * 1.1, Math.PI * 1.45);
    ctx.arc(0, 0, r * 1.08, Math.PI * 1.6, Math.PI * 1.95);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-this.time * 0.25);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, Math.PI * 0.2, Math.PI * 0.5);
    ctx.arc(0, 0, r * 1.15, Math.PI * 0.8, Math.PI * 1.2);
    ctx.arc(0, 0, r * 1.15, Math.PI * 1.5, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(0, 112, 243, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Sweeping Radar Sectors
    const sweepAngle = this.time * 1.5;
    this.drawSweepSector(ctx, r * 0.98, sweepAngle, 0.7, 'rgba(0, 240, 255, 0.35)');
    this.drawSweepSector(ctx, r * 0.85, sweepAngle + Math.PI * 0.9, 0.35, 'rgba(0, 112, 243, 0.25)');

    // Target Blips with glow
    this.drawTargetBlip(ctx, r * 0.55, this.time * 0.5, 'TGT-01');
    this.drawTargetBlip(ctx, r * 0.78, -this.time * 0.35 + 2.2, 'JARVIS');
    if (this.isSpeaking) {
      this.drawTargetBlip(ctx, r * 0.38, this.time * 1.2, 'AUDIO-TX');
    }

    // Center Core / Crosshair
    ctx.beginPath();
    ctx.arc(0, 0, 8 + (this.isSpeaking ? 3 : 0), 0, Math.PI * 2);
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Tactical Tags on right edge of radar
    const tagX = r * 1.05;
    this.drawTacticalTag(ctx, tagX, -r * 0.4, 'GBU - 38', 'ALM MAX', '#00f0ff');
    this.drawTacticalTag(ctx, tagX, -r * 0.15, 'SYS - 02', 'ONLINE', '#00df8f');
    this.drawTacticalTag(ctx, tagX, r * 0.1, 'SEC - 03', 'ACTIVE', '#0070f3');
    this.drawTacticalTag(ctx, tagX, r * 0.35, 'TRK - 04', this.isSpeaking ? 'TRANSMIT' : 'STANDBY', this.isSpeaking ? '#ff3366' : '#f5a623');

    ctx.restore();
  }

  drawSweepSector(ctx, radius, startAngle, fanSize, color) {
    ctx.save();
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle - (i / steps) * fanSize;
      const a2 = startAngle - ((i + 1) / steps) * fanSize;
      const alpha = (1 - i / steps) * 0.45;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, a2, a1);
      ctx.closePath();
      ctx.fillStyle = color.replace(/[\d.]+\)$/, `${alpha})`);
      ctx.fill();
    }
    // Leading bright line
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  drawTargetBlip(ctx, distance, angle, label) {
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fillText(label, x + 10, y + 3);
    ctx.restore();
  }

  drawTacticalTag(ctx, x, y, line1, line2, accentColor) {
    ctx.save();
    ctx.fillStyle = 'rgba(7, 12, 24, 0.85)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.roundRect(x, y - 10, 68, 22, 4);
    ctx.fill();
    ctx.stroke();

    // Color pill
    ctx.fillStyle = accentColor;
    ctx.fillRect(x + 3, y - 7, 3, 16);

    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(line1, x + 10, y);
    ctx.fillStyle = accentColor;
    ctx.fillText(line2, x + 10, y + 9);
    ctx.restore();
  }

  // --- 2. 3D HOLOGRAPHIC WIREFRAME SPHERE ---
  drawHoloSphere(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);

    // Rotate 3D orientation
    const rotSpeed = this.isSpeaking ? 0.035 : 0.015;
    this.sphereRotation.x += rotSpeed * 0.7;
    this.sphereRotation.y += rotSpeed;
    this.sphereRotation.z += rotSpeed * 0.4;

    const rx = this.sphereRotation.x;
    const ry = this.sphereRotation.y;
    const rz = this.sphereRotation.z;

    // Pulse size with speech
    const currentRadius = radius * (1 + (this.isSpeaking ? Math.sin(this.time * 8) * 0.08 : 0));

    // Project 3D nodes to 2D
    const projected = this.sphereNodes.map((node) => {
      // Rotate around X
      let y1 = node.y * Math.cos(rx) - node.z * Math.sin(rx);
      let z1 = node.y * Math.sin(rx) + node.z * Math.cos(rx);

      // Rotate around Y
      let x2 = node.x * Math.cos(ry) + z1 * Math.sin(ry);
      let z2 = -node.x * Math.sin(ry) + z1 * Math.cos(ry);

      // Rotate around Z
      let x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
      let y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);

      // Scale
      const scale = (currentRadius / 75);
      return {
        x: x3 * scale,
        y: y3 * scale,
        z: z2 * scale,
      };
    });

    // Outer glowing boundary circle
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius * 1.1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw lines connecting nearby nodes
    ctx.lineWidth = 0.8;
    for (let i = 0; i < projected.length; i++) {
      for (let j = i + 1; j < projected.length; j++) {
        const dx = projected[i].x - projected[j].x;
        const dy = projected[i].y - projected[j].y;
        const dz = projected[i].z - projected[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < currentRadius * 0.85) {
          const depthAlpha = ((projected[i].z + projected[j].z) / (currentRadius * 2) + 0.5);
          const alpha = Math.max(0.05, Math.min(0.8, (1 - dist / (currentRadius * 0.85)) * depthAlpha));

          ctx.beginPath();
          ctx.moveTo(projected[i].x, projected[i].y);
          ctx.lineTo(projected[j].x, projected[j].y);
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.stroke();
        }
      }
    }

    // Draw glowing node vertices
    projected.forEach((p) => {
      const alpha = Math.max(0.2, (p.z / (currentRadius * 2)) + 0.6);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.z > 0 ? 2.5 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = p.z > 0 ? '#fff' : 'rgba(0, 240, 255, 0.6)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = p.z > 0 ? 8 : 2;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Orbiting orbital ring
    ctx.save();
    ctx.rotate(this.time * 0.6);
    ctx.beginPath();
    ctx.ellipse(0, 0, currentRadius * 1.3, currentRadius * 0.35, Math.PI / 4, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 112, 243, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Section label
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('NEURAL MESH // 3D', -currentRadius, currentRadius * 1.25);

    ctx.restore();
  }

  // --- 3. BOTTOM-RIGHT RADIAL COMPASS & SPIKE RING ---
  drawRadialCompass(ctx, cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);

    // Outer rotating spiked gear
    ctx.save();
    ctx.rotate(-this.time * 0.5);
    const spikeCount = 36;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const innerR = radius * 0.82;
      const outerR = radius * (0.95 + (this.isSpeaking ? (i % 3 === 0 ? 0.15 : 0.05) : 0.05));

      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR);
      ctx.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      ctx.strokeStyle = i % 4 === 0 ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = i % 4 === 0 ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();

    // Concentric ring with dotted border
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.58, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 112, 243, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Rotating inner tri-caliper
    ctx.save();
    ctx.rotate(this.time * 0.8);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.45, a, a + Math.PI * 0.35);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    ctx.restore();

    // Glowing core
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = this.isSpeaking ? '#ff3366' : '#00f0ff';
    ctx.shadowColor = this.isSpeaking ? '#ff3366' : '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Peripheral mini channel badges (01, 02, 03)
    const badgeX = radius * 1.08;
    ['01', '02', '03'].forEach((num, idx) => {
      const bY = -radius * 0.4 + idx * 24;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, bY, 22, 16, 3);
      ctx.fill();
      ctx.stroke();

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(num, badgeX + 5, bY + 11);
    });

    ctx.restore();
  }

  // --- 4. EQUALIZER SPECTRUM (BOTTOM) ---
  drawEqualizerSpectrum(ctx, x, y, width, height) {
    ctx.save();
    const barCount = 38;
    const barWidth = (width / barCount) - 3;

    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.fillText('INFRARED / VOCAL SPECTRUM', x, y - 6);

    for (let i = 0; i < barCount; i++) {
      let magnitude;
      if (this.isSpeaking) {
        // High frequency reactive dance during speech
        magnitude = (Math.sin(this.time * 8 + i * 0.5) * 0.5 + 0.5) * 0.85 + Math.random() * 0.15;
      } else if (this.isThinking) {
        // Rolling wave while model is generating
        magnitude = (Math.sin(this.time * 4 + i * 0.3) * 0.5 + 0.5) * 0.5;
      } else {
        // Subtle ambient pulse
        magnitude = (Math.sin(this.time * 1.5 + i * 0.2) * 0.5 + 0.5) * 0.25;
      }

      const barH = Math.max(3, magnitude * height);
      const bx = x + i * (barWidth + 3);
      const by = y + (height - barH);

      const grad = ctx.createLinearGradient(0, by, 0, by + barH);
      grad.addColorStop(0, '#00f0ff');
      grad.addColorStop(1, '#0070f3');

      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, barWidth, barH);
    }
    ctx.restore();
  }

  // --- 5. HUD CYBERPUNK LABELS & TELEMETRY ---
  drawHudOverlay(ctx, w, h) {
    ctx.save();

    // Top Right "RADAR" Bar (from reference image)
    const barX = w * 0.65;
    const barY = 16;
    const barW = Math.min(w * 0.32, 240);

    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.fillRect(barX, barY, barW, 26);

    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillStyle = '#000';
    ctx.fillText('RADAR & TACTICAL HUD', barX + 14, barY + 18);

    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(barX, barY + 28, barW, 2);

    ctx.font = '8px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.fillText('RADAR AND INFRARED DISPLAY // SYSTEM ACTIVE', barX, barY + 40);

    // Environment Telemetry Box (center right)
    if (w > 720) {
      const envX = w * 0.57;
      const envY = h * 0.34;
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(envX, envY, 130, 95, 4);
      ctx.fill();
      ctx.stroke();

      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('● ENVIRONMENT SCN', envX + 8, envY + 16);

      ctx.font = '7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fillText(`FREQ: ${(1420 + Math.sin(this.time) * 12).toFixed(1)} MHz`, envX + 8, envY + 32);
      ctx.fillText(`BEAM: AZ ${(180 + Math.sin(this.time * 0.5) * 45).toFixed(0)}° EL 22°`, envX + 8, envY + 44);
      ctx.fillText(`STATE: ${this.isSpeaking ? 'TRANSMITTING' : this.isThinking ? 'PROCESSING' : 'LISTENING'}`, envX + 8, envY + 56);
      ctx.fillText(`ENCRYPT: QUANTUM-AES`, envX + 8, envY + 68);
      ctx.fillText(`ORCHESTRATOR: ONLINE`, envX + 8, envY + 80);
    }

    // Prominent HUD Identifier (from reference image)
    ctx.font = 'bold 38px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.fillText('7', w * 0.52, h * 0.94);

    ctx.restore();
  }
}

import {
	BoxGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DirectionalLight,
	DoubleSide,
	Group,
	HemisphereLight,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PerspectiveCamera,
	PointLight,
	Scene,
	SphereGeometry,
	Vector3
} from 'three';

export interface DisasterVisualManager {
	group: Group;
	update: (delta: number, elapsed: number, stageNumber: number) => void;
	triggerShake: (durationSec: number, intensity: number) => void;
	applyCameraShake: (camera: PerspectiveCamera, delta: number) => void;
	setBlackoutActive: (active: boolean) => void;
	dispose: () => void;
}

export function createDisasterVisuals(
	scene: Scene,
	sunLight: DirectionalLight,
	hemiLight: HemisphereLight
): DisasterVisualManager {
	const group = new Group();
	group.name = 'DisasterVisualEffects';
	scene.add(group);

	const disposables: { dispose: () => void }[] = [];

	// ── 1. Concrete Rubble & Fracture Blocks ──────────────────────────────────
	const rubbleMat = new MeshStandardMaterial({
		color: '#64748b',
		roughness: 0.9,
		metalness: 0.1
	});
	disposables.push(rubbleMat);

	const rubbleGeo1 = new BoxGeometry(1.2, 0.4, 0.9);
	const rubbleGeo2 = new BoxGeometry(0.8, 0.35, 1.4);
	const rubbleGeo3 = new BoxGeometry(1.6, 0.5, 0.7);
	disposables.push(rubbleGeo1, rubbleGeo2, rubbleGeo3);

	const rubblePositions = [
		[-16, 0.25, -2],
		[-15.2, 0.2, -3.4],
		[-17, 0.3, -4],
		[-8, 0.2, 7],
		[-7.2, 0.25, 8.5],
		[-2, 0.3, -7],
		[2, 0.4, 3],
		[10, 0.6, 6]
	];

	for (let i = 0; i < rubblePositions.length; i++) {
		const [x, y, z] = rubblePositions[i];
		const geo = i % 3 === 0 ? rubbleGeo1 : i % 3 === 1 ? rubbleGeo2 : rubbleGeo3;
		const mesh = new Mesh(geo, rubbleMat);
		mesh.position.set(x, y, z);
		mesh.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3);
		mesh.castShadow = true;
		group.add(mesh);
	}

	// ── 2. Secondary Fire Effect (Active Stage 3+) ─────────────────────────────
	const fireGroup = new Group();
	fireGroup.position.set(-10, 0.4, 6);
	group.add(fireGroup);

	// Glowing flame cones
	const flameMat = new MeshBasicMaterial({
		color: '#ff5500',
		transparent: true,
		opacity: 0.85
	});
	disposables.push(flameMat);

	const flameGeo = new ConeGeometry(0.5, 1.4, 6);
	disposables.push(flameGeo);

	const flameMeshes: Mesh[] = [];
	for (let i = 0; i < 4; i++) {
		const f = new Mesh(flameGeo, flameMat);
		f.position.set((i - 1.5) * 0.45, 0.7, (Math.random() - 0.5) * 0.4);
		fireGroup.add(f);
		flameMeshes.push(f);
	}

	// Dynamic fire point light
	const fireLight = new PointLight('#ff4400', 0, 16);
	fireLight.position.set(0, 1.5, 0);
	fireGroup.add(fireLight);

	// Smoke plume
	const smokeMat = new MeshBasicMaterial({
		color: '#334155',
		transparent: true,
		opacity: 0.4
	});
	disposables.push(smokeMat);
	const smokeGeo = new SphereGeometry(0.6, 6, 6);
	disposables.push(smokeGeo);
	const smokeMeshes: { mesh: Mesh; baseScale: number; speed: number; phase: number }[] = [];

	for (let i = 0; i < 5; i++) {
		const s = new Mesh(smokeGeo, smokeMat);
		s.position.set((Math.random() - 0.5) * 0.8, 1.2 + i * 0.7, (Math.random() - 0.5) * 0.8);
		fireGroup.add(s);
		smokeMeshes.push({
			mesh: s,
			baseScale: 0.7 + i * 0.25,
			speed: 0.6 + i * 0.15,
			phase: i * 1.2
		});
	}

	// ── 3. Gas Leak Vapor Plume (Active Stage 4+) ──────────────────────────────
	const gasGroup = new Group();
	gasGroup.position.set(-6, 0.3, -8);
	group.add(gasGroup);

	const gasMat = new MeshBasicMaterial({
		color: '#a5f3fc',
		transparent: true,
		opacity: 0.35,
		side: DoubleSide
	});
	disposables.push(gasMat);

	const gasCylinderGeo = new CylinderGeometry(0.2, 0.8, 2.2, 8);
	disposables.push(gasCylinderGeo);
	const gasVaporMesh = new Mesh(gasCylinderGeo, gasMat);
	gasVaporMesh.position.y = 1.1;
	gasGroup.add(gasVaporMesh);

	// ── 4. Emergency Strobe Light Beacon ─────────────────────────────────────────
	const beaconLight = new PointLight('#ef4444', 0, 22);
	beaconLight.position.set(19, 6.5, 4);
	group.add(beaconLight);

	// ── 5. Camera Shake Controller ──────────────────────────────────────────────
	let shakeDuration = 0;
	let shakeMaxDuration = 0;
	let shakeIntensity = 0;
	let blackoutMode = false;

	function triggerShake(durationSec: number, intensity: number) {
		shakeDuration = durationSec;
		shakeMaxDuration = durationSec;
		shakeIntensity = intensity;
	}

	function applyCameraShake(camera: PerspectiveCamera, delta: number) {
		if (shakeDuration > 0) {
			shakeDuration -= delta;
			const progress = Math.max(0, shakeDuration / shakeMaxDuration);
			const currentMagnitude = shakeIntensity * progress;

			// Apply procedural jitter
			const offsetX = (Math.random() - 0.5) * currentMagnitude * 0.15;
			const offsetY = (Math.random() - 0.5) * currentMagnitude * 0.2;
			const offsetZ = (Math.random() - 0.5) * currentMagnitude * 0.15;

			camera.position.x += offsetX;
			camera.position.y += offsetY;
			camera.position.z += offsetZ;
		}
	}

	function setBlackoutActive(active: boolean) {
		blackoutMode = active;
	}

	function update(delta: number, elapsed: number, stageNumber: number) {
		// Fire visual activation (Stage 3+)
		const fireActive = stageNumber >= 3;
		fireGroup.visible = fireActive;
		if (fireActive) {
			// Flicker flames
			flameMeshes.forEach((f, idx) => {
				const s = 1.0 + Math.sin(elapsed * 9 + idx) * 0.25;
				f.scale.set(s, s * (1.1 + Math.cos(elapsed * 7 + idx) * 0.2), s);
			});
			// Flicker light
			fireLight.intensity = 2.0 + Math.sin(elapsed * 12) * 0.8;

			// Animate rising smoke
			smokeMeshes.forEach((s) => {
				s.mesh.position.y = 1.2 + ((elapsed * s.speed + s.phase) % 3.0);
				const progress = (s.mesh.position.y - 1.2) / 3.0;
				const curScale = s.baseScale * (1.0 + progress * 0.8);
				s.mesh.scale.set(curScale, curScale, curScale);
				(s.mesh.material as MeshBasicMaterial).opacity = 0.4 * (1.0 - progress);
			});
		}

		// Gas visual activation (Stage 4+)
		const gasActive = stageNumber >= 4;
		gasGroup.visible = gasActive;
		if (gasActive) {
			const pulse = 1.0 + Math.sin(elapsed * 8) * 0.15;
			gasVaporMesh.scale.set(pulse, 1.0 + Math.cos(elapsed * 6) * 0.1, pulse);
		}

		// Blackout lighting adaptation (Stage 5+)
		const isBlackout = stageNumber >= 5 || blackoutMode;
		if (isBlackout) {
			sunLight.intensity = Math.max(0.2, sunLight.intensity - delta * 0.6);
			hemiLight.intensity = Math.max(0.25, hemiLight.intensity - delta * 0.4);
			hemiLight.color.set('#334155');

			// Flash emergency strobe beacon
			const flash = Math.sin(elapsed * 6) > 0.4;
			beaconLight.intensity = flash ? 3.5 : 0.2;
		} else {
			beaconLight.intensity = 0;
		}
	}

	function dispose() {
		disposables.forEach((d) => d.dispose());
		if (scene.children.includes(group)) {
			scene.remove(group);
		}
		group.clear();
	}

	return {
		group,
		update,
		triggerShake,
		applyCameraShake,
		setBlackoutActive,
		dispose
	};
}

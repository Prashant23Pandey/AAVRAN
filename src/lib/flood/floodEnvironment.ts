import {
	BoxGeometry,
	BufferAttribute,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	RingGeometry,
	SphereGeometry,
	Vector3
} from 'three';

export interface FloodEnvironment {
	group: Group;
	getElevation: (x: number, z: number) => number;
	safeZonePosition: Vector3;
	safeZoneRadius: number;
	cautionZonePosition: Vector3;
	cautionZoneRadius: number;
	dangerZonePosition: Vector3;
	dangerZoneRadius: number;
	rescuePointPosition: Vector3;
	rescuePointRadius: number;
	commandCenterPosition: Vector3;
	update: (delta: number, elapsed: number) => void;
	dispose: () => void;
}

/**
 * Analytical ground elevation field.
 * Low flood basin: x <= -8 (Y ~ 0 to 0.4)
 * Ascending road/hill: -8 < x < 18 (Y ~ 0.5 to 5.2)
 * Safe Plateau: 18 <= x < 28 (Y ~ 5.5 to 6.2)
 * Rescue Summit: x >= 28, z >= 15 (Y ~ 8.5 to 9.2)
 */
export function getTerrainHeight(x: number, z: number): number {
	// Base slope along X axis
	let h = 0;

	if (x < -10) {
		// Low-lying river basin & lower downtown
		h = 0.2 + Math.sin(x * 0.15) * 0.15 + Math.cos(z * 0.18) * 0.12;
	} else if (x < 18) {
		// Progressive uphill slope
		const t = (x - (-10)) / 28; // 0 to 1
		// Smoothstep curve for natural hill ascent
		const smooth = t * t * (3 - 2 * t);
		h = 0.2 + smooth * 5.4 + Math.sin(z * 0.12) * 0.2;
	} else {
		// Plateau & Summit
		const extraSummit = Math.max(0, (x - 22) * 0.28 + (z - 10) * 0.22);
		h = 5.8 + Math.min(extraSummit, 3.2) + Math.sin((x + z) * 0.1) * 0.15;
	}

	// Boundary dropoff
	const distFromCenter = Math.sqrt(x * x + z * z);
	if (distFromCenter > 44) {
		const falloff = (distFromCenter - 44) * 0.4;
		h -= falloff;
	}

	return Math.max(-1.5, h);
}

export function createFloodEnvironment(): FloodEnvironment {
	const group = new Group();
	group.name = 'FloodEnvironment';

	const disposables: { dispose: () => void }[] = [];

	// 1. Terrain Mesh
	const terrainSize = 100;
	const segments = 80;
	const terrainGeo = new PlaneGeometry(terrainSize, terrainSize, segments, segments);
	terrainGeo.rotateX(-Math.PI / 2);

	const posAttr = terrainGeo.attributes.position as BufferAttribute;
	for (let i = 0; i < posAttr.count; i++) {
		const vx = posAttr.getX(i);
		const vz = posAttr.getZ(i);
		const vy = getTerrainHeight(vx, vz);
		posAttr.setY(i, vy);
	}
	terrainGeo.computeVertexNormals();

	// Rich green-slate hillside grass material
	const terrainMat = new MeshStandardMaterial({
		color: '#4e7a52',
		roughness: 0.92,
		metalness: 0.05,
		flatShading: true
	});
	disposables.push(terrainGeo, terrainMat);

	const terrainMesh = new Mesh(terrainGeo, terrainMat);
	terrainMesh.receiveShadow = true;
	group.add(terrainMesh);

	// Shared Materials
	const roadMat = new MeshStandardMaterial({ color: '#323639', roughness: 0.85 });
	const roadStripeMat = new MeshStandardMaterial({ color: '#f59e0b', roughness: 0.5 });
	const concreteMat = new MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.8 });
	const wallMat = new MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.7 });
	const wallAltMat = new MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.75 });
	const brickMat = new MeshStandardMaterial({ color: '#994436', roughness: 0.8 });
	const roofMat = new MeshStandardMaterial({ color: '#b91c1c', roughness: 0.65 });
	const roofBlueMat = new MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.65 });
	const windowMat = new MeshStandardMaterial({ color: '#7dd3fc', roughness: 0.2, metalness: 0.4 });
	const woodMat = new MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
	const foliageMat = new MeshStandardMaterial({ color: '#2d6a4f', roughness: 0.85, flatShading: true });
	const lightPoleMat = new MeshStandardMaterial({ color: '#475569', roughness: 0.4, metalness: 0.6 });
	const beaconSafeMat = new MeshStandardMaterial({
		color: '#22c55e',
		emissive: '#16a34a',
		emissiveIntensity: 0.8
	});
	const beaconRescueMat = new MeshStandardMaterial({
		color: '#ea580c',
		emissive: '#c2410c',
		emissiveIntensity: 0.9
	});
	const beaconDangerMat = new MeshStandardMaterial({
		color: '#ef4444',
		emissive: '#dc2626',
		emissiveIntensity: 1.0
	});
	const beaconCautionMat = new MeshStandardMaterial({
		color: '#f59e0b',
		emissive: '#d97706',
		emissiveIntensity: 0.9
	});
	const warningMat = new MeshStandardMaterial({
		color: '#fbbf24',
		emissive: '#d97706',
		emissiveIntensity: 0.4
	});

	disposables.push(
		roadMat,
		roadStripeMat,
		concreteMat,
		wallMat,
		wallAltMat,
		brickMat,
		roofMat,
		roofBlueMat,
		windowMat,
		woodMat,
		foliageMat,
		lightPoleMat,
		beaconSafeMat,
		beaconRescueMat,
		beaconDangerMat,
		beaconCautionMat,
		warningMat
	);

	// 2. Main Ascending Evacuation Highway & Roads
	// A curved path from low downtown up to the safe plateau
	const roadPoints = [
		{ x: -30, z: 0 },
		{ x: -20, z: -2 },
		{ x: -10, z: 0 },
		{ x: 0, z: 4 },
		{ x: 10, z: 6 },
		{ x: 20, z: 4 },
		{ x: 28, z: 12 },
		{ x: 32, z: 24 }
	];

	for (let i = 0; i < roadPoints.length - 1; i++) {
		const p1 = roadPoints[i];
		const p2 = roadPoints[i + 1];
		const midX = (p1.x + p2.x) / 2;
		const midZ = (p1.z + p2.z) / 2;
		const midY = getTerrainHeight(midX, midZ) + 0.08;

		const dx = p2.x - p1.x;
		const dz = p2.z - p1.z;
		const length = Math.sqrt(dx * dx + dz * dz);
		const angle = Math.atan2(dx, dz);

		// Asphalt segment
		const roadSegGeo = new BoxGeometry(5.4, 0.16, length);
		disposables.push(roadSegGeo);
		const roadMesh = new Mesh(roadSegGeo, roadMat);
		roadMesh.position.set(midX, midY, midZ);
		roadMesh.rotation.y = angle;
		roadMesh.receiveShadow = true;
		group.add(roadMesh);

		// Road center divider stripe
		const stripeGeo = new BoxGeometry(0.24, 0.18, length * 0.7);
		disposables.push(stripeGeo);
		const stripeMesh = new Mesh(stripeGeo, roadStripeMat);
		stripeMesh.position.set(midX, midY + 0.02, midZ);
		stripeMesh.rotation.y = angle;
		group.add(stripeMesh);
	}

	// 3. Residential Houses & Buildings
	function addBuilding(
		x: number,
		z: number,
		w: number,
		d: number,
		stories: number,
		mat: MeshStandardMaterial,
		roofColorMat: MeshStandardMaterial,
		rotY = 0
	) {
		const baseY = getTerrainHeight(x, z);
		const h = stories * 2.8;

		const buildingGroup = new Group();
		buildingGroup.position.set(x, baseY, z);
		buildingGroup.rotation.y = rotY;

		// Foundation / Walls
		const wallsGeo = new BoxGeometry(w, h, d);
		disposables.push(wallsGeo);
		const wallsMesh = new Mesh(wallsGeo, mat);
		wallsMesh.position.y = h / 2;
		wallsMesh.castShadow = true;
		wallsMesh.receiveShadow = true;
		buildingGroup.add(wallsMesh);

		// Pitched Roof
		const roofGeo = new CylinderGeometry(0.1, Math.max(w, d) * 0.72, 1.4, 4);
		disposables.push(roofGeo);
		const roofMesh = new Mesh(roofGeo, roofColorMat);
		roofMesh.position.y = h + 0.7;
		roofMesh.rotation.y = Math.PI / 4;
		roofMesh.castShadow = true;
		buildingGroup.add(roofMesh);

		// Windows
		for (let s = 0; s < stories; s++) {
			const winY = 1.4 + s * 2.6;
			const winGeo = new BoxGeometry(0.9, 1.0, 0.1);
			disposables.push(winGeo);

			const winFront = new Mesh(winGeo, windowMat);
			winFront.position.set(0, winY, d / 2 + 0.05);
			buildingGroup.add(winFront);

			const winBack = new Mesh(winGeo, windowMat);
			winBack.position.set(0, winY, -d / 2 - 0.05);
			buildingGroup.add(winBack);
		}

		// Door
		const doorGeo = new BoxGeometry(1.0, 1.8, 0.1);
		disposables.push(doorGeo);
		const doorMesh = new Mesh(doorGeo, woodMat);
		doorMesh.position.set(0, 0.9, d / 2 + 0.06);
		buildingGroup.add(doorMesh);

		group.add(buildingGroup);
	}

	// Lower Downtown Buildings (These face impending flood danger)
	addBuilding(-22, -10, 6, 5, 2, wallMat, roofMat, 0.2);
	addBuilding(-15, -14, 5, 5, 1, brickMat, roofBlueMat, -0.1);
	addBuilding(-25, 8, 7, 6, 3, wallAltMat, roofMat, 0.3);
	addBuilding(-18, 12, 5, 4, 1, wallMat, roofBlueMat, -0.4);
	addBuilding(-8, -12, 6, 5, 2, wallAltMat, roofMat, 0.15);

	// Mid-Hill Residences
	addBuilding(2, -6, 5, 5, 2, wallMat, roofBlueMat, -0.2);
	addBuilding(6, 14, 6, 5, 2, brickMat, roofMat, 0.25);
	addBuilding(12, -4, 5, 4, 1, wallAltMat, roofBlueMat, 0.1);

	// 3b. Emergency Evacuation Command Center Landmark (Plateau Sector)
	const commandCenterPos = new Vector3(18, getTerrainHeight(18, -6), -6);
	const commandGroup = new Group();
	commandGroup.position.copy(commandCenterPos);

	// Main Command Center bunker
	const cmdGeo = new BoxGeometry(7.5, 3.8, 6.2);
	const cmdMat = new MeshStandardMaterial({ color: '#1e3a8a', roughness: 0.5 }); // Emergency Blue
	disposables.push(cmdGeo, cmdMat);
	const cmdMesh = new Mesh(cmdGeo, cmdMat);
	cmdMesh.position.y = 1.9;
	cmdMesh.castShadow = true;
	cmdMesh.receiveShadow = true;
	commandGroup.add(cmdMesh);

	// White reflective trim
	const trimGeo = new BoxGeometry(7.6, 0.4, 6.3);
	const trimMat = new MeshStandardMaterial({ color: '#f8fafc', emissive: '#f8fafc', emissiveIntensity: 0.3 });
	disposables.push(trimGeo, trimMat);
	const trimMesh = new Mesh(trimGeo, trimMat);
	trimMesh.position.y = 3.6;
	commandGroup.add(trimMesh);

	// Emergency Radio Tower
	const towerGeo = new CylinderGeometry(0.12, 0.25, 8.5, 6);
	disposables.push(towerGeo);
	const tower = new Mesh(towerGeo, lightPoleMat);
	tower.position.set(2.8, 6.5, -2.2);
	tower.castShadow = true;
	commandGroup.add(tower);

	// Tower blinking emergency strobe
	const strobeGeo = new SphereGeometry(0.35, 12, 12);
	const strobeMat = new MeshStandardMaterial({
		color: '#38bdf8',
		emissive: '#0284c7',
		emissiveIntensity: 1.2
	});
	disposables.push(strobeGeo, strobeMat);
	const strobe = new Mesh(strobeGeo, strobeMat);
	strobe.position.set(2.8, 10.8, -2.2);
	commandGroup.add(strobe);

	// Digital Flood Warning Status Board (Amber LED style)
	const boardFrameGeo = new BoxGeometry(3.6, 1.8, 0.2);
	const boardFrameMat = new MeshStandardMaterial({ color: '#0f172a', roughness: 0.4 });
	const boardScreenGeo = new BoxGeometry(3.4, 1.6, 0.22);
	const boardScreenMat = new MeshStandardMaterial({
		color: '#f59e0b',
		emissive: '#d97706',
		emissiveIntensity: 0.9
	});
	disposables.push(boardFrameGeo, boardFrameMat, boardScreenGeo, boardScreenMat);

	const warnBoard = new Group();
	warnBoard.position.set(0, 4.8, 3.1);
	warnBoard.add(new Mesh(boardFrameGeo, boardFrameMat));
	warnBoard.add(new Mesh(boardScreenGeo, boardScreenMat));
	commandGroup.add(warnBoard);

	// Signpost Landmark with 3 Stacked Panels:
	// "EMERGENCY" / "EVACUATION" / "CENTER"
	const signPillarGeo = new CylinderGeometry(0.08, 0.08, 4.8, 6);
	disposables.push(signPillarGeo);
	const signPillar = new Mesh(signPillarGeo, lightPoleMat);
	signPillar.position.set(-4.5, 2.4, 2.5);
	commandGroup.add(signPillar);

	function createSignBoard(text: string, yPos: number, bgColor: string, emissiveColor: string) {
		const bGeo = new BoxGeometry(2.8, 0.6, 0.1);
		const bMat = new MeshStandardMaterial({
			color: bgColor,
			emissive: emissiveColor,
			emissiveIntensity: 0.7
		});
		disposables.push(bGeo, bMat);
		const bMesh = new Mesh(bGeo, bMat);
		bMesh.position.set(-4.5, yPos, 2.5);
		commandGroup.add(bMesh);
	}

	createSignBoard('EMERGENCY', 3.8, '#dc2626', '#b91c1c'); // Red panel
	createSignBoard('EVACUATION', 3.0, '#0284c7', '#0369a1'); // Blue panel
	createSignBoard('CENTER', 2.2, '#16a34a', '#15803d'); // Green panel

	group.add(commandGroup);

	// Safe Plateau Outpost & Secondary Building (positioned clear of the evacuation trail)
	addBuilding(16, 22, 8, 6, 2, wallMat, roofMat, -0.3);

	// 4. Low-Poly Trees & Foliage
	const treeTrunkGeo = new CylinderGeometry(0.2, 0.35, 1.8, 6);
	const treeFoliageGeo = new CylinderGeometry(0.1, 1.4, 3.2, 7);
	disposables.push(treeTrunkGeo, treeFoliageGeo);

	function addTree(x: number, z: number, scale = 1.0) {
		const baseY = getTerrainHeight(x, z);
		const treeGroup = new Group();
		treeGroup.position.set(x, baseY, z);
		treeGroup.scale.setScalar(scale);

		const trunk = new Mesh(treeTrunkGeo, woodMat);
		trunk.position.y = 0.9;
		trunk.castShadow = true;
		treeGroup.add(trunk);

		const foliage = new Mesh(treeFoliageGeo, foliageMat);
		foliage.position.y = 2.8;
		foliage.castShadow = true;
		treeGroup.add(foliage);

		group.add(treeGroup);
	}

	const treeCoords = [
		[-28, -4],
		[-26, 16],
		[-12, -6],
		[-14, 18],
		[-4, -14],
		[-2, 12],
		[4, -12],
		[8, 2],
		[14, 16],
		[16, -10],
		[24, -2],
		[20, 22],
		[28, 2],
		[34, 10]
	];

	for (const [tx, tz] of treeCoords) {
		addTree(tx, tz, 0.8 + Math.random() * 0.4);
	}

	// 5. Street Infrastructure & Emergency Signage
	function addStreetLamp(x: number, z: number) {
		const baseY = getTerrainHeight(x, z);
		const poleGroup = new Group();
		poleGroup.position.set(x, baseY, z);

		const poleGeo = new CylinderGeometry(0.08, 0.1, 4.2, 6);
		disposables.push(poleGeo);
		const poleMesh = new Mesh(poleGeo, lightPoleMat);
		poleMesh.position.y = 2.1;
		poleGroup.add(poleMesh);

		const headGeo = new BoxGeometry(0.6, 0.2, 0.3);
		disposables.push(headGeo);
		const headMesh = new Mesh(headGeo, warningMat);
		headMesh.position.set(0.2, 4.2, 0);
		poleGroup.add(headMesh);

		group.add(poleGroup);
	}

	addStreetLamp(-18, 2);
	addStreetLamp(-8, 3);
	addStreetLamp(2, 7);
	addStreetLamp(12, 8);
	addStreetLamp(22, 7);

	// Road Evacuation Signposts
	function addSignpost(x: number, z: number, labelText: string, rotY = 0) {
		const baseY = getTerrainHeight(x, z);
		const signGroup = new Group();
		signGroup.position.set(x, baseY, z);
		signGroup.rotation.y = rotY;

		const poleGeo = new CylinderGeometry(0.06, 0.06, 2.4, 6);
		disposables.push(poleGeo);
		const pole = new Mesh(poleGeo, lightPoleMat);
		pole.position.y = 1.2;
		signGroup.add(pole);

		const boardGeo = new BoxGeometry(1.6, 0.9, 0.08);
		disposables.push(boardGeo);
		const board = new Mesh(boardGeo, warningMat);
		board.position.set(0, 2.0, 0);
		signGroup.add(board);

		group.add(signGroup);
	}

	addSignpost(-12, 2.5, 'EVACUATION ROUTE', 0.2);
	addSignpost(4, 8.5, 'HIGHER GROUND ->', -0.3);
	addSignpost(16, 8.0, 'SAFE ZONE AHEAD', -0.1);

	// Hazard: Submerged Electrical Transformer in low street (RED DANGER ZONE)
	const dangerZonePos = new Vector3(-16, getTerrainHeight(-16, -4) + 0.1, -4);
	const dangerZoneRadius = 5.0;

	const transformerGroup = new Group();
	transformerGroup.position.copy(dangerZonePos);

	const transGeo = new BoxGeometry(1.2, 1.4, 1.2);
	const transMat = new MeshStandardMaterial({ color: '#475569', roughness: 0.6 });
	disposables.push(transGeo, transMat);
	const transMesh = new Mesh(transGeo, transMat);
	transMesh.position.y = 0.7;
	transformerGroup.add(transMesh);

	const hazardGeo = new BoxGeometry(0.8, 0.5, 0.1);
	disposables.push(hazardGeo);
	const hazardMesh = new Mesh(hazardGeo, warningMat);
	hazardMesh.position.set(0, 1.1, 0.65);
	transformerGroup.add(hazardMesh);

	// Red Danger Perimeter Ring
	const dangerRingGeo = new RingGeometry(dangerZoneRadius - 0.4, dangerZoneRadius, 32);
	dangerRingGeo.rotateX(-Math.PI / 2);
	disposables.push(dangerRingGeo);
	const dangerRingMesh = new Mesh(dangerRingGeo, beaconDangerMat);
	dangerRingMesh.position.y = 0.05;
	transformerGroup.add(dangerRingMesh);

	// Flashing Red Danger Beacon atop pole
	const dangerPoleGeo = new CylinderGeometry(0.08, 0.08, 2.8, 6);
	disposables.push(dangerPoleGeo);
	const dangerPole = new Mesh(dangerPoleGeo, lightPoleMat);
	dangerPole.position.set(0.8, 1.4, 0.8);
	transformerGroup.add(dangerPole);

	const dangerOrbGeo = new SphereGeometry(0.35, 16, 16);
	disposables.push(dangerOrbGeo);
	const dangerOrb = new Mesh(dangerOrbGeo, beaconDangerMat);
	dangerOrb.position.set(0.8, 2.9, 0.8);
	transformerGroup.add(dangerOrb);

	group.add(transformerGroup);

	// CAUTION ZONE: Mid-Slope Flooded Crossing (YELLOW/ORANGE CAUTION MARKER)
	const cautionZonePos = new Vector3(4, getTerrainHeight(4, 6) + 0.1, 6);
	const cautionZoneRadius = 4.5;

	const cautionGroup = new Group();
	cautionGroup.position.copy(cautionZonePos);

	const cautionRingGeo = new RingGeometry(cautionZoneRadius - 0.4, cautionZoneRadius, 32);
	cautionRingGeo.rotateX(-Math.PI / 2);
	disposables.push(cautionRingGeo);
	const cautionRingMesh = new Mesh(cautionRingGeo, beaconCautionMat);
	cautionRingMesh.position.y = 0.05;
	cautionGroup.add(cautionRingMesh);

	const cautionPoleGeo = new CylinderGeometry(0.08, 0.08, 2.6, 6);
	disposables.push(cautionPoleGeo);
	const cautionPole = new Mesh(cautionPoleGeo, lightPoleMat);
	cautionPole.position.set(0, 1.3, 0);
	cautionGroup.add(cautionPole);

	const cautionOrbGeo = new SphereGeometry(0.35, 16, 16);
	disposables.push(cautionOrbGeo);
	const cautionOrb = new Mesh(cautionOrbGeo, beaconCautionMat);
	cautionOrb.position.set(0, 2.7, 0);
	cautionGroup.add(cautionOrb);

	group.add(cautionGroup);

	// 6. Mission 1: Safe Zone (Elevation Plateau, ~5.8m elevation)
	const safeZonePos = new Vector3(20, getTerrainHeight(20, 4) + 0.1, 4);
	const safeZoneRadius = 4.5;

	const safeZoneGroup = new Group();
	safeZoneGroup.position.copy(safeZonePos);

	const safeRingGeo = new RingGeometry(safeZoneRadius - 0.5, safeZoneRadius, 32);
	safeRingGeo.rotateX(-Math.PI / 2);
	disposables.push(safeRingGeo);
	const safeRingMesh = new Mesh(safeRingGeo, beaconSafeMat);
	safeZoneGroup.add(safeRingMesh);

	// Safe area emergency beacon pillar
	const safePillarGeo = new CylinderGeometry(0.25, 0.35, 3.2, 8);
	disposables.push(safePillarGeo);
	const safePillar = new Mesh(safePillarGeo, concreteMat);
	safePillar.position.y = 1.6;
	safeZoneGroup.add(safePillar);

	const safeBeaconOrbGeo = new SphereGeometry(0.45, 16, 16);
	disposables.push(safeBeaconOrbGeo);
	const safeBeaconOrb = new Mesh(safeBeaconOrbGeo, beaconSafeMat);
	safeBeaconOrb.position.y = 3.4;
	safeZoneGroup.add(safeBeaconOrb);

	group.add(safeZoneGroup);

	// 7. Mission 2: Emergency Rescue Point (Hill Summit, ~8.8m elevation)
	const rescuePointPos = new Vector3(32, getTerrainHeight(32, 24) + 0.1, 24);
	const rescuePointRadius = 5.0;

	const rescueGroup = new Group();
	rescueGroup.position.copy(rescuePointPos);

	// Helipad circle & "H" mark
	const helipadGeo = new CylinderGeometry(rescuePointRadius, rescuePointRadius, 0.2, 32);
	disposables.push(helipadGeo);
	const helipadMat = new MeshStandardMaterial({ color: '#1e293b', roughness: 0.7 });
	disposables.push(helipadMat);
	const helipadMesh = new Mesh(helipadGeo, helipadMat);
	helipadMesh.position.y = 0.1;
	helipadMesh.receiveShadow = true;
	rescueGroup.add(helipadMesh);

	// Helipad ring
	const helipadRingGeo = new RingGeometry(rescuePointRadius - 0.6, rescuePointRadius - 0.2, 32);
	helipadRingGeo.rotateX(-Math.PI / 2);
	disposables.push(helipadRingGeo);
	const helipadRing = new Mesh(helipadRingGeo, warningMat);
	helipadRing.position.y = 0.22;
	rescueGroup.add(helipadRing);

	// "H" bar elements
	const hBar1Geo = new BoxGeometry(0.4, 0.05, 3.2);
	const hBar2Geo = new BoxGeometry(0.4, 0.05, 3.2);
	const hBarCrossGeo = new BoxGeometry(1.6, 0.05, 0.4);
	disposables.push(hBar1Geo, hBar2Geo, hBarCrossGeo);

	const h1 = new Mesh(hBar1Geo, warningMat);
	h1.position.set(-0.8, 0.23, 0);
	const h2 = new Mesh(hBar2Geo, warningMat);
	h2.position.set(0.8, 0.23, 0);
	const hCross = new Mesh(hBarCrossGeo, warningMat);
	hCross.position.set(0, 0.23, 0);
	rescueGroup.add(h1, h2, hCross);

	// Emergency Shelter Cabin beside helipad
	const shelterGeo = new BoxGeometry(4.2, 2.6, 3.4);
	disposables.push(shelterGeo);
	const shelterMat = new MeshStandardMaterial({ color: '#f8fafc', roughness: 0.6 });
	disposables.push(shelterMat);
	const shelter = new Mesh(shelterGeo, shelterMat);
	shelter.position.set(-4.5, 1.3, -2);
	shelter.castShadow = true;
	shelter.receiveShadow = true;
	rescueGroup.add(shelter);

	// Shelter emergency roof
	const shelterRoofGeo = new CylinderGeometry(0.1, 3.2, 1.2, 4);
	shelterRoofGeo.rotateY(Math.PI / 4);
	disposables.push(shelterRoofGeo);
	const shelterRoof = new Mesh(shelterRoofGeo, roofMat);
	shelterRoof.position.set(-4.5, 3.1, -2);
	rescueGroup.add(shelterRoof);

	// Radio Antenna Tower with flashing beacon
	const mastGeo = new CylinderGeometry(0.08, 0.15, 6.0, 6);
	disposables.push(mastGeo);
	const mast = new Mesh(mastGeo, lightPoleMat);
	mast.position.set(4.2, 3.0, -3.5);
	rescueGroup.add(mast);

	const rescueBeaconOrbGeo = new SphereGeometry(0.4, 16, 16);
	disposables.push(rescueBeaconOrbGeo);
	const rescueBeaconOrb = new Mesh(rescueBeaconOrbGeo, beaconRescueMat);
	rescueBeaconOrb.position.set(4.2, 6.1, -3.5);
	rescueGroup.add(rescueBeaconOrb);

	group.add(rescueGroup);

	function update(delta: number, elapsed: number) {
		// Pulsing beacon lights and rings
		const pulseSafe = 0.5 + Math.sin(elapsed * 4) * 0.5;
		beaconSafeMat.emissiveIntensity = 0.4 + pulseSafe * 0.8;
		safeRingMesh.scale.setScalar(1.0 + pulseSafe * 0.05);

		const pulseRescue = 0.5 + Math.cos(elapsed * 5) * 0.5;
		beaconRescueMat.emissiveIntensity = 0.5 + pulseRescue * 1.0;
		helipadRing.scale.setScalar(1.0 + pulseRescue * 0.03);

		const pulseDanger = 0.5 + Math.sin(elapsed * 6) * 0.5;
		beaconDangerMat.emissiveIntensity = 0.5 + pulseDanger * 1.1;
		dangerRingMesh.scale.setScalar(1.0 + pulseDanger * 0.04);

		const pulseCaution = 0.5 + Math.cos(elapsed * 4.5) * 0.5;
		beaconCautionMat.emissiveIntensity = 0.4 + pulseCaution * 0.8;
		cautionRingMesh.scale.setScalar(1.0 + pulseCaution * 0.03);
	}

	function dispose() {
		for (const d of disposables) {
			d.dispose();
		}
	}

	return {
		group,
		getElevation: getTerrainHeight,
		safeZonePosition: safeZonePos,
		safeZoneRadius,
		cautionZonePosition: cautionZonePos,
		cautionZoneRadius,
		dangerZonePosition: dangerZonePos,
		dangerZoneRadius,
		rescuePointPosition: rescuePointPos,
		rescuePointRadius,
		commandCenterPosition: commandCenterPos,
		update,
		dispose
	};
}

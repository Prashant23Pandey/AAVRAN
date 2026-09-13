import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	RingGeometry,
	Vector3
} from 'three';

export interface EvacuationRoute {
	group: Group;
	update: (delta: number, elapsed: number) => void;
	dispose: () => void;
}

export function createEvacuationRoute(getElevation: (x: number, z: number) => number): EvacuationRoute {
	const group = new Group();
	group.name = 'EvacuationRouteMarkers';

	const disposables: { dispose: () => void }[] = [];

	// Vibrant emerald green reflective material
	const routeArrowMat = new MeshStandardMaterial({
		color: '#10b981',
		emissive: '#059669',
		emissiveIntensity: 0.8,
		side: DoubleSide
	});

	const poleMat = new MeshStandardMaterial({ color: '#475569', roughness: 0.5 });
	const boardMat = new MeshStandardMaterial({
		color: '#065f46',
		emissive: '#047857',
		emissiveIntensity: 0.6
	});

	disposables.push(routeArrowMat, poleMat, boardMat);

	// Key waypoints along the route
	const routeWaypoints = [
		{ x: -26, z: 0, label: 'RESIDENTIAL AREA' },
		{ x: -16, z: 2, label: 'ROUTE CORRIDOR' },
		{ x: -6, z: 3, label: 'UPHILL DETOUR' },
		{ x: 4, z: 6, label: 'ASSEMBLY JUNCTION' },
		{ x: 12, z: 6, label: 'ASSEMBLY POINT' },
		{ x: 18, z: 4, label: 'SAFE PLATEAU APPROACH' },
		{ x: 24, z: 10, label: 'SUMMIT RIDGE' },
		{ x: 30, z: 20, label: 'RESCUE OUTPOST TRAIL' }
	];

	// 1. Green Chevron Arrows along ground
	const arrowMeshes: Mesh[] = [];
	const arrowGeo = new ConeGeometry(0.55, 1.2, 3);
	arrowGeo.rotateX(-Math.PI / 2);
	disposables.push(arrowGeo);

	for (let i = 0; i < routeWaypoints.length - 1; i++) {
		const p1 = routeWaypoints[i];
		const p2 = routeWaypoints[i + 1];

		// Put 2 arrows between each waypoint pair
		for (const frac of [0.35, 0.75]) {
			const ax = p1.x + (p2.x - p1.x) * frac;
			const az = p1.z + (p2.z - p1.z) * frac;
			const ay = getElevation(ax, az) + 0.12;

			const arrowMesh = new Mesh(arrowGeo, routeArrowMat);
			arrowMesh.position.set(ax, ay, az);

			const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
			arrowMesh.rotation.y = angle;

			group.add(arrowMesh);
			arrowMeshes.push(arrowMesh);
		}
	}

	// 2. Small Emergency Route Signposts
	const poleGeo = new CylinderGeometry(0.05, 0.05, 1.8, 6);
	const signGeo = new BoxGeometry(1.2, 0.6, 0.06);
	disposables.push(poleGeo, signGeo);

	const signCoords = [
		{ x: -20, z: 1.5, rotY: 0.1 },
		{ x: 2, z: 5.5, rotY: -0.2 },
		{ x: 14, z: 5.0, rotY: -0.1 },
		{ x: 22, z: 8.0, rotY: 0.3 }
	];

	for (const sc of signCoords) {
		const sy = getElevation(sc.x, sc.z);
		const signGroup = new Group();
		signGroup.position.set(sc.x, sy, sc.z);
		signGroup.rotation.y = sc.rotY;

		const pole = new Mesh(poleGeo, poleMat);
		pole.position.y = 0.9;
		signGroup.add(pole);

		const board = new Mesh(signGeo, boardMat);
		board.position.y = 1.5;
		signGroup.add(board);

		group.add(signGroup);
	}

	function update(delta: number, elapsed: number) {
		// Pulsing green glow along arrows
		const glow = 0.6 + Math.sin(elapsed * 4) * 0.4;
		routeArrowMat.emissiveIntensity = glow;

		// Subtle wave bobbing for arrows
		for (let i = 0; i < arrowMeshes.length; i++) {
			const m = arrowMeshes[i];
			m.scale.setScalar(1.0 + Math.sin(elapsed * 3 + i * 0.4) * 0.05);
		}
	}

	function dispose() {
		for (const d of disposables) {
			d.dispose();
		}
	}

	return {
		group,
		update,
		dispose
	};
}

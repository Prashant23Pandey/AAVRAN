import {
	BoxGeometry,
	CapsuleGeometry,
	Color,
	ConeGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	RingGeometry,
	SphereGeometry,
	Vector3
} from 'three';
import type { CivilianNpc, NpcType } from './npcTypes';

export interface NpcMeshBundle {
	group: Group;
	animateWalk: (elapsed: number, isMoving: boolean) => void;
	setAssistedVisual: (assisted: boolean) => void;
	markerGroup: Group;
	dispose: () => void;
}

export function buildNpcVisual(type: NpcType, name: string): NpcMeshBundle {
	const group = new Group();
	group.name = `NPC_${name}_${type}`;

	const disposables: { dispose: () => void }[] = [];

	// Common dimensions adjusted per type
	let scale = 1.0;
	let shirtColor = '#2563eb'; // Adult default blue
	let pantsColor = '#334155';
	let hairColor = '#3e2723';
	let hasCane = false;
	let hasBag = false;
	let isChild = false;

	if (type === 'elderly') {
		scale = 0.94;
		shirtColor = '#d97706'; // Amber / beige cardigan
		pantsColor = '#64748b';
		hairColor = '#cbd5e1'; // Silver hair
		hasCane = true;
	} else if (type === 'child') {
		scale = 0.68;
		shirtColor = '#e11d48'; // Bright red
		pantsColor = '#1e3a8a';
		hairColor = '#78350f';
		isChild = true;
	} else if (type === 'carrying_bag') {
		scale = 1.02;
		shirtColor = '#059669'; // Emerald green
		pantsColor = '#1e293b';
		hairColor = '#1c1917';
		hasBag = true;
	}

	const skinMat = new MeshStandardMaterial({ color: '#fed7aa', roughness: 0.6 });
	const shirtMat = new MeshStandardMaterial({ color: shirtColor, roughness: 0.7 });
	const pantsMat = new MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
	const hairMat = new MeshStandardMaterial({ color: hairColor, roughness: 0.5 });
	const shoeMat = new MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
	const accessoryMat = new MeshStandardMaterial({ color: '#78350f', roughness: 0.7 });

	disposables.push(skinMat, shirtMat, pantsMat, hairMat, shoeMat, accessoryMat);

	// Root offset node for scaling
	const modelRoot = new Group();
	modelRoot.scale.setScalar(scale);
	group.add(modelRoot);

	// Torso
	const torsoGeo = new CapsuleGeometry(0.24, 0.46, 6, 12);
	disposables.push(torsoGeo);
	const torso = new Mesh(torsoGeo, shirtMat);
	torso.position.y = 0.95;
	torso.castShadow = true;
	if (type === 'elderly') {
		torso.rotation.x = 0.12; // Slight stoop
	}
	modelRoot.add(torso);

	// Head
	const headGeo = new SphereGeometry(0.18, 12, 12);
	disposables.push(headGeo);
	const head = new Mesh(headGeo, skinMat);
	head.position.y = 1.38;
	head.castShadow = true;
	if (type === 'elderly') {
		head.position.z = 0.06;
	}
	modelRoot.add(head);

	// Hair / Cap
	const hairGeo = new SphereGeometry(0.19, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
	disposables.push(hairGeo);
	const hair = new Mesh(hairGeo, hairMat);
	hair.position.copy(head.position);
	hair.position.y += 0.04;
	modelRoot.add(hair);

	// Legs
	const legGeo = new CylinderGeometry(0.08, 0.08, 0.55, 6);
	disposables.push(legGeo);

	const leftLegGroup = new Group();
	leftLegGroup.position.set(-0.12, 0.55, 0);
	const leftLegMesh = new Mesh(legGeo, pantsMat);
	leftLegMesh.position.y = -0.27;
	leftLegMesh.castShadow = true;
	leftLegGroup.add(leftLegMesh);
	modelRoot.add(leftLegGroup);

	const rightLegGroup = new Group();
	rightLegGroup.position.set(0.12, 0.55, 0);
	const rightLegMesh = new Mesh(legGeo, pantsMat);
	rightLegMesh.position.y = -0.27;
	rightLegMesh.castShadow = true;
	rightLegGroup.add(rightLegMesh);
	modelRoot.add(rightLegGroup);

	// Elderly Walking Cane
	if (hasCane) {
		const caneGeo = new CylinderGeometry(0.02, 0.02, 0.85, 6);
		disposables.push(caneGeo);
		const cane = new Mesh(caneGeo, accessoryMat);
		cane.position.set(0.3, 0.42, 0.2);
		cane.rotation.z = -0.15;
		modelRoot.add(cane);
	}

	// Person with Evacuation Bag
	if (hasBag) {
		const bagGeo = new BoxGeometry(0.25, 0.35, 0.38);
		disposables.push(bagGeo);
		const bag = new Mesh(bagGeo, accessoryMat);
		bag.position.set(-0.32, 0.85, 0);
		modelRoot.add(bag);
	}

	// Status Marker Beacon above head
	const markerGroup = new Group();
	markerGroup.position.y = scale * 1.8;

	const markerPillGeo = new ConeGeometry(0.18, 0.35, 6);
	markerPillGeo.rotateX(Math.PI);
	disposables.push(markerPillGeo);

	const markerMat = new MeshStandardMaterial({
		color: '#f59e0b', // Yellow: Needs Help
		emissive: '#d97706',
		emissiveIntensity: 0.8
	});
	disposables.push(markerMat);

	const markerMesh = new Mesh(markerPillGeo, markerMat);
	markerGroup.add(markerMesh);
	group.add(markerGroup);

	function animateWalk(elapsed: number, isMoving: boolean) {
		if (isMoving) {
			const freq = isChild ? 14 : type === 'elderly' ? 7 : 10;
			const swing = Math.sin(elapsed * freq) * 0.35;
			leftLegGroup.rotation.x = swing;
			rightLegGroup.rotation.x = -swing;
			modelRoot.position.y = Math.abs(Math.sin(elapsed * freq * 2)) * 0.05;
		} else {
			leftLegGroup.rotation.x = 0;
			rightLegGroup.rotation.x = 0;
			modelRoot.position.y = 0;
		}

		// Floating marker gentle bob & spin
		markerGroup.position.y = scale * 1.8 + Math.sin(elapsed * 4) * 0.08;
		markerGroup.rotation.y = elapsed * 2.5;
	}

	function setAssistedVisual(assisted: boolean) {
		if (assisted) {
			markerMat.color.set('#22c55e');
			markerMat.emissive.set('#16a34a');
			markerMat.emissiveIntensity = 0.9;
		} else {
			markerMat.color.set('#f59e0b');
			markerMat.emissive.set('#d97706');
			markerMat.emissiveIntensity = 0.8;
		}
	}

	function dispose() {
		for (const d of disposables) {
			d.dispose();
		}
	}

	return {
		group,
		animateWalk,
		setAssistedVisual,
		markerGroup,
		dispose
	};
}

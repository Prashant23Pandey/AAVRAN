import {
	BoxGeometry,
	CylinderGeometry,
	DoubleSide,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	RingGeometry,
	SphereGeometry,
	Vector3
} from 'three';
import type { EmergencyItemType } from './trainingState';

export type InteractableType = 'sign' | 'hazard' | 'item' | 'station' | 'action_point';

export interface CreateInteractableConfig {
	id: string;
	title: string;
	actionPrompt: string; // e.g., "READ WARNING", "INSPECT MAP", "COLLECT FIRST AID"
	type: InteractableType;
	x: number;
	y: number;
	z: number;
	interactionRadius?: number;
	itemReward?: EmergencyItemType;
	stageActive?: number; // 0 = active across all stages, or 1..10
	description?: string;
	onInteract?: () => { message: string; points?: number; itemCollected?: EmergencyItemType };
}

export interface InteractableObject {
	id: string;
	title: string;
	actionPrompt: string;
	type: InteractableType;
	position: Vector3;
	interactionRadius: number;
	itemReward?: EmergencyItemType;
	stageActive: number;
	isCompleted: boolean;
	description?: string;
	meshGroup: Group;
	beaconRing: Mesh;
	onInteract?: () => { message: string; points?: number; itemCollected?: EmergencyItemType };
}

export interface InteractivePropsManager {
	group: Group;
	addInteractable: (cfg: CreateInteractableConfig) => InteractableObject;
	getNearestInteractable: (playerPos: Vector3, stageNumber: number, radius?: number) => InteractableObject | null;
	interactWith: (id: string) => {
		success: boolean;
		result?: { message: string; points?: number; itemCollected?: EmergencyItemType };
	};
	setInteractableCompleted: (id: string, completed?: boolean) => void;
	getInteractableById: (id: string) => InteractableObject | null;
	update: (delta: number, elapsed: number, stageNumber: number) => void;
	dispose: () => void;
}

export function createInteractivePropsManager(): InteractivePropsManager {
	const group = new Group();
	group.name = 'InteractivePropsGroup';

	const interactables: InteractableObject[] = [];
	const disposables: { dispose: () => void }[] = [];

	// Reusable Materials
	const signWoodMat = new MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
	const signBoardMat = new MeshStandardMaterial({ color: '#fef08a', roughness: 0.6 });
	const mapBoardMat = new MeshStandardMaterial({ color: '#60a5fa', roughness: 0.5 });
	const hazardBoxMat = new MeshStandardMaterial({ color: '#ef4444', roughness: 0.5, metalness: 0.4 });
	const hazardStripesMat = new MeshStandardMaterial({ color: '#fbbf24', roughness: 0.4 });
	const supplyKitMat = new MeshStandardMaterial({ color: '#f97316', roughness: 0.4, metalness: 0.2 });
	const deskMat = new MeshStandardMaterial({ color: '#334155', roughness: 0.7 });
	const terminalMat = new MeshStandardMaterial({ color: '#22c55e', roughness: 0.3, emissive: '#15803d', emissiveIntensity: 0.4 });

	// Beacon materials
	const beaconAmberMat = new MeshBasicMaterial({ color: '#fbbf24', side: DoubleSide, transparent: true, opacity: 0.65 });
	const beaconRedMat = new MeshBasicMaterial({ color: '#ef4444', side: DoubleSide, transparent: true, opacity: 0.7 });
	const beaconCyanMat = new MeshBasicMaterial({ color: '#38bdf8', side: DoubleSide, transparent: true, opacity: 0.8 });
	const beaconGreenMat = new MeshBasicMaterial({ color: '#22c55e', side: DoubleSide, transparent: true, opacity: 0.75 });
	const beaconWhiteMat = new MeshBasicMaterial({ color: '#ffffff', side: DoubleSide, transparent: true, opacity: 0.7 });

	disposables.push(
		signWoodMat,
		signBoardMat,
		mapBoardMat,
		hazardBoxMat,
		hazardStripesMat,
		supplyKitMat,
		deskMat,
		terminalMat,
		beaconAmberMat,
		beaconRedMat,
		beaconCyanMat,
		beaconGreenMat,
		beaconWhiteMat
	);

	function buildPropVisual(type: InteractableType, itemReward?: EmergencyItemType): { propMesh: Group; beaconRing: Mesh } {
		const propMesh = new Group();

		// Ground Beacon Ring
		const ringGeo = new RingGeometry(0.85, 1.25, 24);
		ringGeo.rotateX(-Math.PI / 2);
		disposables.push(ringGeo);

		let chosenBeaconMat = beaconAmberMat;
		if (type === 'hazard') chosenBeaconMat = beaconRedMat;
		else if (type === 'item') chosenBeaconMat = beaconCyanMat;
		else if (type === 'station') chosenBeaconMat = beaconGreenMat;
		else if (type === 'action_point') chosenBeaconMat = beaconWhiteMat;

		const beaconRing = new Mesh(ringGeo, chosenBeaconMat);
		beaconRing.position.y = 0.04;
		propMesh.add(beaconRing);

		if (type === 'sign') {
			// Wooden post
			const postGeo = new CylinderGeometry(0.08, 0.08, 1.8, 8);
			disposables.push(postGeo);
			const post = new Mesh(postGeo, signWoodMat);
			post.position.y = 0.9;
			post.castShadow = true;
			propMesh.add(post);

			// Board
			const boardGeo = new BoxGeometry(1.2, 0.8, 0.08);
			disposables.push(boardGeo);
			const board = new Mesh(boardGeo, signBoardMat);
			board.position.y = 1.4;
			board.castShadow = true;
			propMesh.add(board);
		} else if (type === 'hazard') {
			// Metal box / transformer fixture
			const boxGeo = new BoxGeometry(0.9, 1.2, 0.6);
			disposables.push(boxGeo);
			const box = new Mesh(boxGeo, hazardBoxMat);
			box.position.y = 0.6;
			box.castShadow = true;
			propMesh.add(box);

			// Warning Stripe Indicator
			const stripeGeo = new BoxGeometry(0.92, 0.3, 0.62);
			disposables.push(stripeGeo);
			const stripe = new Mesh(stripeGeo, hazardStripesMat);
			stripe.position.y = 0.65;
			propMesh.add(stripe);
		} else if (type === 'item') {
			// Floating supply case
			const kitGeo = new BoxGeometry(0.65, 0.45, 0.45);
			disposables.push(kitGeo);
			const kit = new Mesh(kitGeo, supplyKitMat);
			kit.position.y = 0.65;
			kit.castShadow = true;
			propMesh.add(kit);

			// White medical/gear cross or emblem
			const emblemGeo = new BoxGeometry(0.2, 0.2, 0.48);
			disposables.push(emblemGeo);
			const emblem = new Mesh(emblemGeo, terminalMat);
			emblem.position.y = 0.65;
			propMesh.add(emblem);
		} else if (type === 'station') {
			// Command field desk
			const deskGeo = new BoxGeometry(1.4, 0.85, 0.8);
			disposables.push(deskGeo);
			const desk = new Mesh(deskGeo, deskMat);
			desk.position.y = 0.425;
			desk.castShadow = true;
			propMesh.add(desk);

			// Radio Terminal
			const termGeo = new BoxGeometry(0.5, 0.35, 0.35);
			disposables.push(termGeo);
			const terminal = new Mesh(termGeo, terminalMat);
			terminal.position.set(0, 0.95, 0);
			propMesh.add(terminal);
		} else if (type === 'action_point') {
			// Canopy or perimeter marker
			const markerGeo = new CylinderGeometry(0.4, 0.4, 0.2, 16);
			disposables.push(markerGeo);
			const marker = new Mesh(markerGeo, terminalMat);
			marker.position.y = 0.1;
			propMesh.add(marker);
		}

		return { propMesh, beaconRing };
	}

	function addInteractable(cfg: CreateInteractableConfig): InteractableObject {
		const { propMesh, beaconRing } = buildPropVisual(cfg.type, cfg.itemReward);
		propMesh.position.set(cfg.x, cfg.y, cfg.z);
		group.add(propMesh);

		const obj: InteractableObject = {
			id: cfg.id,
			title: cfg.title,
			actionPrompt: cfg.actionPrompt,
			type: cfg.type,
			position: new Vector3(cfg.x, cfg.y, cfg.z),
			interactionRadius: cfg.interactionRadius || 3.5,
			itemReward: cfg.itemReward,
			stageActive: cfg.stageActive !== undefined ? cfg.stageActive : 0,
			isCompleted: false,
			description: cfg.description,
			meshGroup: propMesh,
			beaconRing,
			onInteract: cfg.onInteract
		};

		interactables.push(obj);
		return obj;
	}

	function getNearestInteractable(
		playerPos: Vector3,
		stageNumber: number,
		radius = 3.5
	): InteractableObject | null {
		let bestObj: InteractableObject | null = null;
		let bestDist = radius;

		for (const obj of interactables) {
			// Filter by stage: if stageActive is set, it must match current stage (or stageActive === 0)
			if (obj.stageActive !== 0 && obj.stageActive !== stageNumber) {
				continue;
			}
			// Don't re-prompt collected items
			if (obj.type === 'item' && obj.isCompleted) {
				continue;
			}

			const dist = playerPos.distanceTo(obj.position);
			const maxRadius = Math.max(radius, obj.interactionRadius);
			if (dist < maxRadius && dist < bestDist) {
				bestDist = dist;
				bestObj = obj;
			}
		}

		return bestObj;
	}

	function interactWith(id: string): {
		success: boolean;
		result?: { message: string; points?: number; itemCollected?: EmergencyItemType };
	} {
		const found = interactables.find((o) => o.id === id);
		if (!found) return { success: false };

		found.isCompleted = true;
		if (found.type === 'item') {
			found.meshGroup.visible = false;
		}

		let result: { message: string; points?: number; itemCollected?: EmergencyItemType } = {
			message: `${found.title}: Inspected.`,
			points: found.type === 'hazard' ? 5 : found.type === 'item' ? 3 : 5,
			itemCollected: found.itemReward
		};

		if (found.onInteract) {
			result = found.onInteract();
		}

		return { success: true, result };
	}

	function setInteractableCompleted(id: string, completed = true) {
		const found = interactables.find((o) => o.id === id);
		if (found) {
			found.isCompleted = completed;
			if (found.type === 'item' && completed) {
				found.meshGroup.visible = false;
			}
		}
	}

	function getInteractableById(id: string): InteractableObject | null {
		return interactables.find((o) => o.id === id) || null;
	}

	function update(delta: number, elapsed: number, stageNumber: number) {
		const pulse = 0.5 + Math.sin(elapsed * 3.5) * 0.3;

		for (const obj of interactables) {
			const isRelevantStage = obj.stageActive === 0 || obj.stageActive === stageNumber;
			obj.meshGroup.visible = isRelevantStage && !(obj.type === 'item' && obj.isCompleted);

			if (obj.meshGroup.visible) {
				// Pulse ground beacon ring
				const ringMat = obj.beaconRing.material as MeshBasicMaterial;
				if (ringMat) {
					ringMat.opacity = obj.isCompleted ? 0.25 : pulse;
				}

				// Gentle floating and subtle rotation for collectible items
				if (obj.type === 'item' && !obj.isCompleted) {
					const itemChild = obj.meshGroup.children[1];
					if (itemChild) {
						itemChild.position.y = 0.65 + Math.sin(elapsed * 2.5 + obj.position.x) * 0.08;
						itemChild.rotation.y = elapsed * 1.2;
					}
				}
			}
		}
	}

	function dispose() {
		for (const d of disposables) {
			d.dispose();
		}
		while (group.children.length > 0) {
			group.remove(group.children[0]);
		}
		interactables.length = 0;
	}

	return {
		group,
		addInteractable,
		getNearestInteractable,
		interactWith,
		setInteractableCompleted,
		getInteractableById,
		update,
		dispose
	};
}

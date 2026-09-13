import {
	AmbientLight,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	CylinderGeometry,
	DirectionalLight,
	FogExp2,
	Group,
	HemisphereLight,
	LineBasicMaterial,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PerspectiveCamera,
	PointLight,
	Scene,
	SphereGeometry,
	Vector3,
	WebGLRenderer
} from 'three';
import { createFloodEnvironment, type FloodEnvironment } from './floodEnvironment';
import { createFloodWaterSystem, type FloodWaterSystem } from './floodWater';
import { createPlayerController, type PlayerController } from './playerController';
import { TRAINING_EVENTS, type TrainingEvent } from './trainingEvents';
import { TrainingStateManager, type EmergencyInventory, type EmergencyItemType, type ExplorationStats, type StageObjectiveItem } from './trainingState';
import { createNpcManager, type NpcManager } from './npc/npcManager';
import type { CivilianNpc, CommunityStatus } from './npc/npcTypes';
import { createEvacuationManager, type EvacuationManager } from './evacuation/evacuationManager';
import { createEvacuationRoute, type EvacuationRoute } from './evacuation/evacuationRoute';
import { createAudioManager, type AudioManager } from './audio/audioManager';
import { createStageManager, type StageManager, type StageDefinition } from './stageManager';
import { createInteractivePropsManager, type InteractivePropsManager, type InteractableObject } from './interactivePropsManager';

export type MissionStage = 'higher_ground' | 'community_evac' | 'command_center' | 'rescue_point' | 'complete';
export type FloodPressureStage = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface HouseRescueIndicator {
	npcId: string;
	npcName: string;
	houseLabel: string;
	/** World-space position of the house — used for distance checks */
	houseX: number;
	houseZ: number;
	houseY: number;
	/** Distance from player to house in metres */
	distance: number;
	/** 'needs_help' | 'rescue_in_progress' | 'rescued' */
	rescueState: 'needs_help' | 'rescue_in_progress' | 'rescued';
	/** Projected 2D screen coordinates for lightweight HTML HUD overlay */
	screenX: number;
	screenY: number;
	isOnScreen: boolean;
}

export interface FloodSimulationTelemetry {
	waterLevel: number;
	playerAltitude: number;
	waterDepthAtPlayer: number;
	isWadingInWater: boolean;
	missionStage: MissionStage;
	stageNumber: number;
	stageTitle: string;
	stageShortTitle: string;
	stageObjective: string;
	stageInstructions: string;
	missionTitle: string;
	missionInstruction: string;
	missionSuccessMessage: string | null;
	warningNotice: string | null;
	pressureStage: FloodPressureStage;
	pressureAlertText: string;
	zoneStatus: 'SAFE' | 'CAUTION' | 'DANGER' | 'NORMAL';
	communityStatus: CommunityStatus;
	promptedCivilian: CivilianNpc | null;
	promptedInteractable: { id: string; title: string; actionPrompt: string; type: string } | null;
	stageObjectives: StageObjectiveItem[];
	inventory: EmergencyInventory;
	explorationStats: ExplorationStats;
	sunlightFactor: number;
	avoidHazard: string;
	momentType: 'observe' | 'decision' | 'action';
	dangerLevel: number;
	stageElapsedTime: number;
	evacuationDelayNotice: string | null;
	checkpointNotice: string | null;
	activeCheckpoint: number;
	/** Active house rescue indicators (only for NPCs inside houses, only when rescue is relevant) */
	houseRescueIndicators: HouseRescueIndicator[];
	/** Inter-level completion modal state (Levels 1-5) */
	completedLevelModalData: {
		levelNumber: number;
		levelTitle?: string;
		levelName?: string;
		primaryCompleted?: number;
		primaryTotal?: number;
		optionalCompleted?: number;
		optionalTotal?: number;
		civiliansHelped?: number;
		hazardsIdentified?: number;
		safetyLesson: string;
		nextLevelNumber?: number;
		nextLevelName?: string;
	} | null;
}

export interface FloodSceneRuntime {
	scene: Scene;
	camera: PerspectiveCamera;
	renderer: WebGLRenderer;
	environment: FloodEnvironment;
	waterSystem: FloodWaterSystem;
	player: PlayerController;
	trainingManager: TrainingStateManager;
	stageManager: StageManager;
	evacuationManager: EvacuationManager;
	audioManager: AudioManager;
	interactiveProps: InteractivePropsManager;
	interact: () => { success: boolean; toastText?: string };
	assistCivilian: (id: string) => void;
	advanceToNextLevel: () => StageDefinition;
	jumpToLevel: (levelNum: number) => StageDefinition;
	setWaterSpeed: (speed: number) => void;
	resetSimulation: () => void;
	resumeFromCheckpoint: (cpNum: number) => void;
	getTelemetry: () => FloodSimulationTelemetry;
	update: (delta: number) => void;
	dispose: () => void;
}

export function createFloodScene(
	canvasContainer: HTMLElement,
	onTelemetry?: (data: FloodSimulationTelemetry) => void,
	externalTrainingManager?: TrainingStateManager
): FloodSceneRuntime {
	// 1. Scene & Atmosphere
	const scene = new Scene();
	const daySkyColor = new Color('#b8cbd6');
	const duskSkyColor = new Color('#3b4e5b');
	const currentSkyColor = daySkyColor.clone();

	scene.background = currentSkyColor;
	const sceneFog = new FogExp2(currentSkyColor, 0.012);
	scene.fog = sceneFog;

	// 2. Camera
	const width = Math.max(canvasContainer.clientWidth, 1);
	const height = Math.max(canvasContainer.clientHeight, 1);
	const camera = new PerspectiveCamera(48, width / height, 0.2, 350);
	camera.position.set(-20, 6, 8);

	// 3. Renderer
	const renderer = new WebGLRenderer({ antialias: true, alpha: false });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(width, height);
	renderer.shadowMap.enabled = true;
	canvasContainer.appendChild(renderer.domElement);

	// 4. Lighting
	const hemiLight = new HemisphereLight('#e0f2fe', '#334155', 0.85);
	scene.add(hemiLight);

	const sun = new DirectionalLight('#fffbeb', 1.5);
	sun.position.set(16, 28, 14);
	sun.castShadow = true;
	sun.shadow.mapSize.width = 2048;
	sun.shadow.mapSize.height = 2048;
	sun.shadow.camera.near = 0.5;
	sun.shadow.camera.far = 80;
	const d = 38;
	sun.shadow.camera.left = -d;
	sun.shadow.camera.right = d;
	sun.shadow.camera.top = d;
	sun.shadow.camera.bottom = -d;
	sun.shadow.bias = -0.0004;
	scene.add(sun);

	// 5. Rain particles
	const rainCount = 650;
	const rainGeo = new BufferGeometry();
	const rainPositions = new Float32Array(rainCount * 6);
	for (let i = 0; i < rainCount; i++) {
		const rx = (Math.random() - 0.5) * 80;
		const ry = Math.random() * 24 + 1;
		const rz = (Math.random() - 0.5) * 80;
		const len = 0.6 + Math.random() * 0.4;

		rainPositions[i * 6] = rx;
		rainPositions[i * 6 + 1] = ry;
		rainPositions[i * 6 + 2] = rz;

		rainPositions[i * 6 + 3] = rx - 0.08;
		rainPositions[i * 6 + 4] = ry - len;
		rainPositions[i * 6 + 5] = rz - 0.08;
	}
	rainGeo.setAttribute('position', new BufferAttribute(rainPositions, 3));
	const rainMat = new LineBasicMaterial({
		color: '#cbd5e1',
		transparent: true,
		opacity: 0.45
	});
	const rainLines = new LineSegments(rainGeo, rainMat);
	scene.add(rainLines);

	// 6. Subsystems
	const environment = createFloodEnvironment();
	scene.add(environment.group);

	const initialWaterLevel = -0.4;
	const waterSystem = createFloodWaterSystem(initialWaterLevel, 140);
	scene.add(waterSystem.mesh);
	scene.add(waterSystem.debrisGroup);

	const initialPlayerX = -22;
	const initialPlayerZ = 0;
	const player = createPlayerController(camera, renderer.domElement, initialPlayerX, initialPlayerZ);
	scene.add(player.mesh);

	const npcManager = createNpcManager();
	scene.add(npcManager.group);

	const evacuationRoute = createEvacuationRoute(environment.getElevation);
	scene.add(evacuationRoute.group);

	const evacuationManager = createEvacuationManager(npcManager);
	const audioManager = createAudioManager();
	const trainingManager = externalTrainingManager || new TrainingStateManager();
	const stageManager = createStageManager(trainingManager);
	const interactiveProps = createInteractivePropsManager();
	scene.add(interactiveProps.group);

	// Setup Flood Ready 3D interactables
	interactiveProps.addInteractable({
		id: 's1_warning_board',
		title: 'Flood Warning Board',
		actionPrompt: 'READ WARNING BOARD',
		type: 'sign',
		x: -21, y: environment.getElevation(-21, 1) + 0.1, z: 1,
		stageActive: 1,
		onInteract: () => {
			trainingManager.completeStageObjective('s1_warning_board');
			audioManager.play('radio_click', 'Flood Advisory: Heavy rainfall upstream');
			return { message: 'Read Emergency Warning Board: Severe flood advisory in effect.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's1_evac_map',
		title: 'Evacuation Route Map',
		actionPrompt: 'INSPECT EVACUATION MAP',
		type: 'sign',
		x: -19, y: environment.getElevation(-19, -2) + 0.1, z: -2,
		stageActive: 1,
		onInteract: () => {
			trainingManager.completeStageObjective('s1_evac_map');
			audioManager.play('radio_click', 'Evacuation map inspected');
			return { message: 'Inspected Evacuation Map: Hillside trail designated as primary safe corridor.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's1_water_gauge',
		title: 'River Basin Water Gauge',
		actionPrompt: 'CHECK WATER LEVEL',
		type: 'sign',
		x: -23, y: environment.getElevation(-23, 3) + 0.1, z: 3,
		stageActive: 1,
		onInteract: () => {
			trainingManager.completeStageObjective('s1_water_gauge');
			audioManager.play('water_alert_medium', 'River level rising rapidly');
			return { message: 'Water-level gauge indicates river cresting rapidly.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's1_whistle',
		title: 'Emergency Whistle',
		actionPrompt: 'COLLECT WHISTLE',
		type: 'item',
		itemReward: 'whistle',
		x: -20, y: environment.getElevation(-20, -4) + 0.1, z: -4,
		stageActive: 1,
		onInteract: () => {
			trainingManager.collectItem('whistle');
			trainingManager.completeStageObjective('s1_whistle');
			audioManager.play('checkpoint', 'Acquired Emergency Whistle');
			return { message: 'Acquired Emergency Whistle! Useful for signaling during low visibility.', itemCollected: 'whistle' };
		}
	});
	interactiveProps.addInteractable({
		id: 's1_bulletin',
		title: 'Municipal Notice Board',
		actionPrompt: 'INSPECT BULLETIN',
		type: 'sign',
		x: -18, y: environment.getElevation(-18, 2) + 0.1, z: 2,
		stageActive: 1,
		onInteract: () => {
			trainingManager.completeStageObjective('s1_bulletin');
			audioManager.play('radio_click', 'Community advisory verified');
			return { message: 'Bulletin verified: Flood shelter opened at high plateau.' };
		}
	});

	// Level 2: Neighborhood Triage & Town Hall Bulletin
	interactiveProps.addInteractable({
		id: 's2_bulletin',
		title: 'Town Hall Emergency Bulletin',
		actionPrompt: 'INSPECT EMERGENCY BULLETIN',
		type: 'sign',
		x: -16, y: environment.getElevation(-16, 0) + 0.1, z: 0,
		stageActive: 2,
		onInteract: () => {
			trainingManager.completeStageObjective('s2_bulletin');
			audioManager.play('radio_click', 'Emergency bulletin verified');
			if (!trainingManager.getState().completedEventIds.includes('scenario_a_blocked_route')) {
				const ev = TRAINING_EVENTS.find((e) => e.id === 'scenario_a_blocked_route');
				if (ev) {
					trainingManager.triggerEvent(ev);
					audioManager.play('radio_click', 'Incoming Emergency Decision');
				}
			}
			return { message: 'Verified Emergency Bulletin: High-priority evacuation declared for lower basin.' };
		}
	});

	// Level 3: Route A Underpass Hazard, Route B Hillside Trail, First Aid Kit, Flooded Road Warning
	interactiveProps.addInteractable({
		id: 's3_inspect_route_a',
		title: 'Route A: Low-Lying Underpass',
		actionPrompt: 'INSPECT UNDERPASS HAZARD',
		type: 'hazard',
		x: -12, y: environment.getElevation(-12, 2) + 0.1, z: 2,
		stageActive: 3,
		onInteract: () => {
			trainingManager.completeStageObjective('s3_inspect_route_a');
			trainingManager.identifyHazard(5);
			audioManager.play('warning_beep', 'Hazard Identified: Low-lying underpass flood trap');
			return { message: 'Identified hazard: Underpass collects dangerous pooling floodwaters.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's3_inspect_route_b',
		title: 'Route B: Elevated Hillside Trail',
		actionPrompt: 'INSPECT HILLSIDE ROUTE',
		type: 'station',
		x: -10, y: environment.getElevation(-10, -3) + 0.1, z: -3,
		stageActive: 3,
		onInteract: () => {
			trainingManager.completeStageObjective('s3_inspect_route_b');
			audioManager.play('success_chime', 'Safe Route Identified: Hillside trail');
			return { message: 'Safe route verified: High elevation path with clear drainage.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's3_first_aid',
		title: 'Emergency First Aid Kit',
		actionPrompt: 'COLLECT FIRST AID KIT',
		type: 'item',
		itemReward: 'firstAid',
		x: -9, y: environment.getElevation(-9, -2) + 0.1, z: -2,
		stageActive: 3,
		onInteract: () => {
			trainingManager.collectItem('firstAid');
			trainingManager.completeStageObjective('s3_first_aid');
			audioManager.play('checkpoint', 'Acquired First Aid Kit');
			return { message: 'Acquired First Aid Kit! Essential for treating lacerations and injuries.', itemCollected: 'firstAid' };
		}
	});
	interactiveProps.addInteractable({
		id: 's3_submerged_sign',
		title: 'Flooded Roadway Warning Marker',
		actionPrompt: 'INSPECT FLOODED ROAD SIGN',
		type: 'sign',
		x: -5, y: environment.getElevation(-5, 1) + 0.1, z: 1,
		stageActive: 3,
		onInteract: () => {
			trainingManager.completeStageObjective('s3_submerged_sign');
			audioManager.play('warning_beep', 'Warning: Road submerged');
			if (!trainingManager.getState().completedEventIds.includes('stage3_route_choice')) {
				const ev = TRAINING_EVENTS.find((e) => e.id === 'stage3_route_choice');
				if (ev) {
					trainingManager.triggerEvent(ev);
					audioManager.play('radio_click', 'Incoming Route Decision');
				}
			}
			return { message: 'Roadway completely submerged. Turn Around, Don\'t Drown.' };
		}
	});

	// Level 4: Electrical Hazards & Utility Locker Flashlight
	interactiveProps.addInteractable({
		id: 's4_inspect_light',
		title: 'Street Light Pole (Insulated)',
		actionPrompt: 'INSPECT LIGHT POLE',
		type: 'sign',
		x: 0, y: environment.getElevation(0, -4) + 0.1, z: -4,
		stageActive: 4,
		onInteract: () => {
			trainingManager.completeStageObjective('s4_inspect_light');
			audioManager.play('radio_click', 'Street light verified safe');
			return { message: 'Street light pole wiring is intact and insulated.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's4_inspect_junction',
		title: 'Damaged Electrical Box',
		actionPrompt: 'INSPECT ELECTRICAL BOX',
		type: 'hazard',
		x: -1, y: environment.getElevation(-1, -1) + 0.1, z: -1,
		stageActive: 4,
		onInteract: () => {
			trainingManager.completeStageObjective('s4_inspect_junction');
			trainingManager.identifyHazard(5);
			audioManager.play('warning_beep', 'Damaged junction box arcing');
			if (!trainingManager.getState().completedEventIds.includes('scenario_b_electrical_hazard')) {
				const ev = TRAINING_EVENTS.find((e) => e.id === 'scenario_b_electrical_hazard');
				if (ev) {
					trainingManager.triggerEvent(ev);
					audioManager.play('radio_click', 'Incoming Electrical Decision');
				}
			}
			return { message: 'Hazard Identified: Electrical junction cracked with exposed circuitry.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's4_inspect_downed_line',
		title: 'Downed Live Cable',
		actionPrompt: 'IDENTIFY DOWNED POWER LINE',
		type: 'hazard',
		x: 1, y: environment.getElevation(1, -2) + 0.1, z: -2,
		stageActive: 4,
		onInteract: () => {
			trainingManager.completeStageObjective('s4_inspect_downed_line');
			trainingManager.identifyHazard(5);
			audioManager.play('warning_beep', 'Live high-voltage cable in standing water');
			if (!trainingManager.getState().completedEventIds.includes('scenario_b_electrical_hazard')) {
				const ev = TRAINING_EVENTS.find((e) => e.id === 'scenario_b_electrical_hazard');
				if (ev) {
					trainingManager.triggerEvent(ev);
					audioManager.play('radio_click', 'Incoming Electrical Decision');
				}
			}
			return { message: 'Hazard Identified: Downed power cable. Maintain minimum 10m perimeter!' };
		}
	});
	interactiveProps.addInteractable({
		id: 's4_flashlight',
		title: 'Emergency Flashlight',
		actionPrompt: 'COLLECT FLASHLIGHT',
		type: 'item',
		itemReward: 'flashlight',
		x: 2, y: environment.getElevation(2, -4) + 0.1, z: -4,
		stageActive: 4,
		onInteract: () => {
			trainingManager.collectItem('flashlight');
			trainingManager.completeStageObjective('s4_flashlight');
			audioManager.play('checkpoint', 'Acquired Flashlight');
			return { message: 'Acquired Heavy-Duty Flashlight! Essential for navigating dark corridors.', itemCollected: 'flashlight' };
		}
	});

	// Level 5: Emergency Purified Drinking Water
	interactiveProps.addInteractable({
		id: 's5_drinking_water',
		title: 'Emergency Drinking Water',
		actionPrompt: 'COLLECT DRINKING WATER',
		type: 'item',
		itemReward: 'water',
		x: 5, y: environment.getElevation(5, 2) + 0.1, z: 2,
		stageActive: 5,
		onInteract: () => {
			trainingManager.collectItem('water');
			trainingManager.completeStageObjective('s5_drinking_water');
			audioManager.play('checkpoint', 'Acquired Drinking Water');
			return { message: 'Acquired Purified Drinking Water! Essential for vulnerable evacuees and hydration.', itemCollected: 'water' };
		}
	});

	// Level 6: Incident Command Center Desks, Radio & Summit Helipad
	interactiveProps.addInteractable({
		id: 's6_report_flood',
		title: 'Command Desk 1: Hydrology Log',
		actionPrompt: 'REPORT FLOOD LEVEL',
		type: 'station',
		x: 19, y: environment.getElevation(19, 4) + 0.1, z: 4,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_report_flood');
			audioManager.play('radio_click', 'Reported flood gauge status to dispatch');
			return { message: 'Hydrology Log updated: Lower basin submerged at +1.4m.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_report_electrical',
		title: 'Command Desk 2: Hazards Log',
		actionPrompt: 'REPORT ELECTRICAL HAZARD',
		type: 'station',
		x: 20, y: environment.getElevation(20, 6) + 0.1, z: 6,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_report_electrical');
			audioManager.play('radio_click', 'Hazards log filed with grid utility');
			return { message: 'Hazards Log filed: Downed transformer and grid cutoff requested.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_report_roster',
		title: 'Triage Registration Desk',
		actionPrompt: 'REPORT EVACUEE ROSTER',
		type: 'station',
		x: 21, y: environment.getElevation(21, 3) + 0.1, z: 3,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_report_roster');
			audioManager.play('radio_click', 'Evacuee headcount submitted to triage');
			return { message: 'Triage Registration: Evacuated community members checked in.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_check_radio',
		title: 'Emergency Radio Station',
		actionPrompt: 'CHECK EMERGENCY RADIO',
		type: 'station',
		x: 22, y: environment.getElevation(22, 5) + 0.1, z: 5,
		stageActive: 6,
		onInteract: () => {
			trainingManager.collectItem('radio');
			trainingManager.completeStageObjective('s6_check_radio');
			audioManager.play('radio_click', 'Emergency radio tuned to regional broadcast');
			return { message: 'Emergency Broadcast: Relief operations active at Summit Outpost.', itemCollected: 'radio' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_inspect_radar',
		title: 'Regional Weather Radar Board',
		actionPrompt: 'INSPECT RADAR MAP',
		type: 'sign',
		x: 18, y: environment.getElevation(18, 7) + 0.1, z: 7,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_inspect_radar');
			audioManager.play('radio_click', 'Radar map reviewed');
			return { message: 'Radar shows storm cell passing east. Flood surge stabilizing.' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_helipad_triage',
		title: 'Summit Helipad Terminal Desk',
		actionPrompt: 'REGISTER EVACUEES AT HELIPAD',
		type: 'station',
		x: 31, y: environment.getElevation(31, 23) + 0.1, z: 23,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_helipad_triage');
			audioManager.play('success_chime', 'All evacuees registered for airlift');
			if (!trainingManager.getState().completedEventIds.includes('stage10_final_evacuation')) {
				const ev = TRAINING_EVENTS.find((e) => e.id === 'stage10_final_evacuation');
				if (ev) {
					trainingManager.triggerEvent(ev);
					audioManager.play('radio_click', 'Incoming Airlift Decision');
				}
			}
			return { message: 'Helipad Manifest logged: Relief flight boarding authorized!' };
		}
	});
	interactiveProps.addInteractable({
		id: 's6_assist_final',
		title: 'Summit Lookout Point',
		actionPrompt: 'INSPECT LOOKOUT POST',
		type: 'sign',
		x: 33, y: environment.getElevation(33, 26) + 0.1, z: 26,
		stageActive: 6,
		onInteract: () => {
			trainingManager.completeStageObjective('s6_assist_final');
			audioManager.play('checkpoint', 'Final safety milestone confirmed');
			return { message: 'Summit overlook confirmed secure: Basin overview clear.' };
		}
	});

	// 7. Simulation State & Progression
	let waterLevel = initialWaterLevel;
	let waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
	let manualWaterSpeedOverride: number | null = null;

	// House rescue registry — NPCs that start inside buildings and need rescue
	// Only these NPCs get visual house indicators; regular outdoor NPCs do not.
	const HOUSE_NPC_REGISTRY: {
		npcId: string;
		npcName: string;
		houseLabel: string;
		houseX: number;
		houseZ: number;
	}[] = [
		{
			npcId: 'npc_ankush',
			npcName: 'Ankush',
			houseLabel: 'Lower Basin House A',
			houseX: -22,
			houseZ: -10
		},
		{
			npcId: 'npc_anuj',
			npcName: 'Anuj',
			houseLabel: 'Hillside House C',
			houseX: -8,
			houseZ: -12
		},
		{
			npcId: 'npc_shruti',
			npcName: 'Shruti',
			houseLabel: 'Mid-Hill House D',
			houseX: 2,
			houseZ: -6
		},
		{
			npcId: 'npc_gayatri',
			npcName: 'Gayatri',
			houseLabel: 'Hillside House B',
			houseX: -4,
			houseZ: 12
		}
	];
	// Track brief "rescued" display timer per NPC
	const rescuedDisplayTimers: Record<string, number> = {};

	// 3D House Rescue Visual Clues (Roof Strobe Beacon + Window Emergency Glow + Occupant Silhouette)
	interface HouseRescueVisual {
		npcId: string;
		group: Group;
		strobeMesh: Mesh;
		strobeMat: MeshStandardMaterial;
		strobeLight: PointLight;
		windowGlowMat: MeshBasicMaterial;
		silhouetteGroup: Group;
	}

	const houseVisuals: HouseRescueVisual[] = [];
	const houseVisualsGroup = new Group();
	houseVisualsGroup.name = 'HouseRescueVisuals';
	scene.add(houseVisualsGroup);

	for (const reg of HOUSE_NPC_REGISTRY) {
		const hY = environment.getElevation(reg.houseX, reg.houseZ);
		const bGroup = new Group();
		bGroup.position.set(reg.houseX, hY, reg.houseZ);

		// Roof Mast
		const mastGeo = new CylinderGeometry(0.06, 0.08, 1.2, 6);
		const mastMat = new MeshStandardMaterial({ color: '#334155', roughness: 0.6 });
		const mastMesh = new Mesh(mastGeo, mastMat);
		mastMesh.position.y = 5.6 + 0.6;
		bGroup.add(mastMesh);

		// Emergency Beacon Strobe Dome
		const strobeGeo = new CylinderGeometry(0.22, 0.26, 0.4, 8);
		const strobeMat = new MeshStandardMaterial({
			color: '#f59e0b',
			emissive: '#ea580c',
			emissiveIntensity: 1.2,
			roughness: 0.2
		});
		const strobeMesh = new Mesh(strobeGeo, strobeMat);
		strobeMesh.position.y = 5.6 + 1.2 + 0.2;
		bGroup.add(strobeMesh);

		// Roof Emergency Point Light
		const strobeLight = new PointLight('#f59e0b', 1.8, 14);
		strobeLight.position.set(0, 5.6 + 1.5, 0);
		bGroup.add(strobeLight);

		// Window Lantern Light (Visible warm illumination showing occupant inside)
		const winGlowGeo = new BoxGeometry(1.0, 1.1, 0.12);
		const windowGlowMat = new MeshBasicMaterial({
			color: '#fbbf24',
			transparent: true,
			opacity: 0.75
		});
		const winGlowMesh = new Mesh(winGlowGeo, windowGlowMat);
		winGlowMesh.position.set(0, 1.4, 2.6);
		bGroup.add(winGlowMesh);

		// Window Silhouette of resident inside
		const silhouetteGroup = new Group();
		silhouetteGroup.position.set(0, 1.0, 2.5);
		const torsoMesh = new Mesh(
			new BoxGeometry(0.4, 0.5, 0.08),
			new MeshBasicMaterial({ color: '#0f172a' })
		);
		torsoMesh.position.y = 0.25;
		silhouetteGroup.add(torsoMesh);

		const headMesh = new Mesh(
			new SphereGeometry(0.14, 6, 6),
			new MeshBasicMaterial({ color: '#0f172a' })
		);
		headMesh.position.y = 0.6;
		silhouetteGroup.add(headMesh);

		const armMesh = new Mesh(
			new BoxGeometry(0.08, 0.35, 0.06),
			new MeshBasicMaterial({ color: '#0f172a' })
		);
		armMesh.position.set(0.25, 0.35, 0);
		silhouetteGroup.add(armMesh);
		bGroup.add(silhouetteGroup);

		houseVisualsGroup.add(bGroup);
		houseVisuals.push({
			npcId: reg.npcId,
			group: bGroup,
			strobeMesh,
			strobeMat,
			strobeLight,
			windowGlowMat,
			silhouetteGroup
		});
	}

	let voiceHelpCooldown = 0;

	let missionSuccessBanner: string | null = null;
	let successBannerTimer = 0;
	let checkpointNotice: string | null = null;
	let checkpointNoticeTimer = 0;
	let completedLevelModalData: FloodSimulationTelemetry['completedLevelModalData'] = null;
	let totalElapsed = 0;
	let hazardContactCooldown = 0;
	let delayWarningNotice: string | null = null;
	let stageElapsedTime = 0;
	let footstepTimer = 0;
	let thunderTimer = 18.0;
	let ambientEventTimer = 28.0;

	// Threshold alerts flags
	let alertMediumTriggered = false;
	let alertHighTriggered = false;
	let alertCriticalTriggered = false;
	let isInsideElectricalZone = false;

	function setWaterSpeed(speed: number) {
		manualWaterSpeedOverride = speed;
		waterRiseSpeed = speed;
	}

	function resetSimulation() {
		completedLevelModalData = null;
		stageElapsedTime = 0;
		footstepTimer = 0;
		thunderTimer = 18.0;
		ambientEventTimer = 28.0;
		waterLevel = initialWaterLevel;
		waterSystem.setWaterLevel(waterLevel);
		player.resetPosition(initialPlayerX, initialPlayerZ);
		stageManager.reset();
		waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
		manualWaterSpeedOverride = null;
		missionSuccessBanner = null;
		successBannerTimer = 0;
		checkpointNotice = null;
		checkpointNoticeTimer = 0;
		hazardContactCooldown = 0;
		delayWarningNotice = null;
		alertMediumTriggered = false;
		alertHighTriggered = false;
		alertCriticalTriggered = false;
		if (isInsideElectricalZone) {
			audioManager.stopElectricalCrackle();
			isInsideElectricalZone = false;
		}
		trainingManager.reset();
	}

	function resumeFromCheckpoint(cpNum: number) {
		const restored = trainingManager.restoreCheckpoint(cpNum);
		if (!restored) return;

		completedLevelModalData = null;
		stageManager.setStage(restored.stage);
		waterLevel = Math.max(initialWaterLevel, restored.waterLevel);
		waterSystem.setWaterLevel(waterLevel);

		// Teleport player based on checkpoint stage
		let targetX = initialPlayerX;
		let targetZ = initialPlayerZ;
		if (cpNum === 1) {
			targetX = -16;
			targetZ = 0;
		} else if (cpNum === 2) {
			targetX = -11;
			targetZ = -1;
		} else if (cpNum === 3) {
			targetX = -2;
			targetZ = -1;
		} else if (cpNum === 4) {
			targetX = 5;
			targetZ = 2;
		} else if (cpNum === 5) {
			targetX = 18;
			targetZ = 4;
		}

		player.resetPosition(targetX, targetZ);
		waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
		manualWaterSpeedOverride = null;

		checkpointNotice = `Resumed from Checkpoint ${cpNum}: Level ${restored.stage}`;
		checkpointNoticeTimer = 5.0;
		audioManager.play('radio_click', `Resumed from Checkpoint ${cpNum}`);
	}

	function assistCivilian(id: string) {
		const res = evacuationManager.assistNpc(id);
		if (res && res.isFirstTime) {
			trainingManager.recordCivilianAssisted();
			audioManager.play('success_chime', `Assisted ${res.npc.name}`);
			missionSuccessBanner = `Assisted ${res.npc.name} (${res.npc.role}) in evacuating!`;
			successBannerTimer = 4.0;

			// Complete corresponding NPC objectives across 6 levels
			if (id === 'npc_prashant') {
				trainingManager.completeStageObjective('s1_resident_prashant');
				trainingManager.completeStageObjective('s2_check_prashant');
			} else if (id === 'npc_manvi') {
				trainingManager.completeStageObjective('s2_check_manvi');
			} else if (id === 'npc_shivani') {
				trainingManager.completeStageObjective('s2_check_shivani');
			} else if (id === 'npc_hasan') {
				trainingManager.completeStageObjective('s2_check_hasan');
			} else if (id === 'npc_ankush') {
				trainingManager.completeStageObjective('s2_check_ankush');
			} else if (id === 'npc_shruti') {
				trainingManager.completeStageObjective('s4_assist_shruti');
			} else if (id === 'npc_prashanthi') {
				trainingManager.completeStageObjective('s5_assist_prashanthi');
			} else if (id === 'npc_anuj') {
				trainingManager.completeStageObjective('s5_assist_anuj');
			} else if (id === 'npc_anurag') {
				trainingManager.completeStageObjective('s5_help_anurag');
			} else if (id === 'npc_gayatri') {
				trainingManager.completeStageObjective('s5_check_gayatri');
			}

			// If NPC has a special scenario event, trigger it reliably!
			if (res.npc.specialEventId) {
				const state = trainingManager.getState();
				if (!state.completedEventIds.includes(res.npc.specialEventId)) {
					const ev = TRAINING_EVENTS.find((e) => e.id === res.npc.specialEventId);
					if (ev) {
						trainingManager.triggerEvent(ev);
						audioManager.play('radio_click', 'Incoming Emergency Decision');
					}
				}
			}
		}
	}

	function interact(): { success: boolean; toastText?: string } {
		const currentStage = stageManager.getCurrentStage();
		const nearest = interactiveProps.getNearestInteractable(player.position, currentStage.stageNumber, 3.5);
		if (nearest) {
			const res = interactiveProps.interactWith(nearest.id);
			if (res.success && res.result) {
				missionSuccessBanner = res.result.message;
				successBannerTimer = 4.5;
				return { success: true, toastText: res.result.message };
			}
		}

		// If no prop interactable, check if near an unassisted NPC
		const npc = evacuationManager.getPromptedNpc(player.position);
		if (npc) {
			assistCivilian(npc.id);
			return { success: true, toastText: `Assisted ${npc.name}` };
		}

		return { success: false };
	}

	function getTelemetry(): FloodSimulationTelemetry {
		const playerAlt = player.position.y;
		const waterDepth = Math.max(0, waterLevel - playerAlt);
		const isWading = waterDepth > 0.05;

		const commStatus = evacuationManager.getCommunityStatus(waterLevel);
		const promptedNpc = evacuationManager.getPromptedNpc(player.position);
		const currentStage = stageManager.getCurrentStage();
		const nearestProp = interactiveProps.getNearestInteractable(player.position, currentStage.stageNumber, 3.5);
		const tState = trainingManager.getState();

		// Map 6-level progression to high-level mission stages
		let missionStage: MissionStage = 'higher_ground';
		if (currentStage.stageNumber === 6) missionStage = 'rescue_point';
		else if (currentStage.stageNumber >= 5) missionStage = 'command_center';
		else if (currentStage.stageNumber >= 2) missionStage = 'community_evac';
		else missionStage = 'higher_ground';

		// Dynamic Flood Pressure
		let pressureStage: FloodPressureStage = 'LOW';
		let pressureAlertText = 'Water level stable. Proceed with evacuation.';

		if (waterLevel >= 2.2) {
			pressureStage = 'CRITICAL';
			pressureAlertText = '🚨 IMMEDIATE EVACUATION';
		} else if (waterLevel >= 1.4) {
			pressureStage = 'HIGH';
			pressureAlertText = '⚠ DANGEROUS FLOOD CONDITIONS';
		} else if (waterLevel >= 0.6) {
			pressureStage = 'MEDIUM';
			pressureAlertText = '⚠ Water rising — reassess your route.';
		}

		// Zone Assessment
		let zoneStatus: 'SAFE' | 'CAUTION' | 'DANGER' | 'NORMAL' = 'NORMAL';
		const distToDanger = player.position.distanceTo(environment.dangerZonePosition);
		const distToCaution = player.position.distanceTo(environment.cautionZonePosition);
		const distToSafe = player.position.distanceTo(environment.safeZonePosition);
		const distToRescue = player.position.distanceTo(environment.rescuePointPosition);

		if (distToDanger < environment.dangerZoneRadius) {
			zoneStatus = 'DANGER';
		} else if (distToSafe < environment.safeZoneRadius || distToRescue < environment.rescuePointRadius) {
			zoneStatus = 'SAFE';
		} else if (distToCaution < environment.cautionZoneRadius) {
			zoneStatus = 'CAUTION';
		}

		let warningNotice: string | null = null;
		if (zoneStatus === 'DANGER') {
			warningNotice = 'DANGER ZONE: High-voltage electrical hazard in flooded area! Back away immediately.';
		} else if (delayWarningNotice) {
			warningNotice = delayWarningNotice;
		} else if (waterDepth > 0.45) {
			warningNotice = 'DANGER: Flood water exceeds safe wading depth! 15cm (6in) of water can knock you down. Move uphill!';
		} else if (waterDepth > 0.08) {
			warningNotice = 'CAUTION: Walking through flood water. Hidden debris and open storm drains present severe hazards.';
		} else if (pressureStage === 'CRITICAL') {
			warningNotice = '🚨 IMMEDIATE EVACUATION: Lower basin completely submerged!';
		} else if (pressureStage === 'HIGH') {
			warningNotice = '⚠ DANGEROUS FLOOD CONDITIONS: Surface roads are flooding rapidly.';
		}

		// Day -> Storm Dusk transition factor
		const duskProgress = Math.min(1.0, Math.max(0.0, (totalElapsed / 360.0) * 0.5 + (waterLevel / 4.5) * 0.5));
		const sunlightFactor = 1.0 - duskProgress * 0.55;

		// Compute house rescue indicators for house-bound NPCs with screen projection
		const cWidth = canvasContainer.clientWidth || window.innerWidth || 1280;
		const cHeight = canvasContainer.clientHeight || window.innerHeight || 720;
		const tempProj = new Vector3();

		const houseRescueIndicators: HouseRescueIndicator[] = [];
		for (const reg of HOUSE_NPC_REGISTRY) {
			const npc = evacuationManager.npcManager.getNpcById(reg.npcId);
			if (!npc) continue;
			const houseY = environment.getElevation(reg.houseX, reg.houseZ);
			const dx = player.position.x - reg.houseX;
			const dz = player.position.z - reg.houseZ;
			const dist = Math.sqrt(dx * dx + dz * dz);

			let rescueState: 'needs_help' | 'rescue_in_progress' | 'rescued';
			if (npc.state === 'safe') {
				rescueState = 'rescued';
				if (rescuedDisplayTimers[reg.npcId] === undefined) {
					rescuedDisplayTimers[reg.npcId] = 4.0;
				}
				if (rescuedDisplayTimers[reg.npcId] <= 0) continue;
			} else if (npc.state === 'assisted' || npc.state === 'evacuating') {
				rescueState = 'rescue_in_progress';
				delete rescuedDisplayTimers[reg.npcId];
			} else {
				if (dist > 38) continue;
				rescueState = 'needs_help';
				delete rescuedDisplayTimers[reg.npcId];
			}

			// Screen projection
			tempProj.set(reg.houseX, houseY + 6.8, reg.houseZ);
			tempProj.project(camera);
			const isFront = tempProj.z > -1 && tempProj.z < 1;
			const screenX = Math.round(((tempProj.x + 1) * 0.5) * cWidth);
			const screenY = Math.round(((-tempProj.y + 1) * 0.5) * cHeight);
			const isOnScreen = isFront && screenX >= -80 && screenX <= cWidth + 80 && screenY >= -80 && screenY <= cHeight + 80;

			houseRescueIndicators.push({
				npcId: reg.npcId,
				npcName: reg.npcName,
				houseLabel: reg.houseLabel,
				houseX: reg.houseX,
				houseZ: reg.houseZ,
				houseY,
				distance: Math.round(dist * 10) / 10,
				rescueState,
				screenX,
				screenY,
				isOnScreen
			});
		}

		return {
			waterLevel: Math.round(waterLevel * 100) / 100,
			playerAltitude: Math.round(playerAlt * 100) / 100,
			waterDepthAtPlayer: Math.round(waterDepth * 100) / 100,
			isWadingInWater: isWading,
			missionStage,
			stageNumber: currentStage.stageNumber,
			stageTitle: currentStage.title,
			stageShortTitle: currentStage.shortTitle,
			stageObjective: currentStage.objective,
			stageInstructions: currentStage.instructions,
			missionTitle: currentStage.title,
			missionInstruction: currentStage.instructions,
			missionSuccessMessage: missionSuccessBanner,
			warningNotice,
			pressureStage,
			pressureAlertText,
			zoneStatus,
			communityStatus: commStatus,
			promptedCivilian: promptedNpc,
			promptedInteractable: nearestProp
				? {
						id: nearestProp.id,
						title: nearestProp.title,
						actionPrompt: nearestProp.actionPrompt,
						type: nearestProp.type
					}
				: null,
			stageObjectives: tState.stageObjectives,
			inventory: tState.inventory,
			explorationStats: tState.explorationStats,
			sunlightFactor,
			avoidHazard: currentStage.avoidHazard,
			momentType: currentStage.momentType,
			dangerLevel: currentStage.dangerLevel,
			stageElapsedTime: Math.round(stageElapsedTime),
			evacuationDelayNotice: delayWarningNotice,
			checkpointNotice,
			activeCheckpoint: trainingManager.getState().checkpointStage,
			houseRescueIndicators,
			completedLevelModalData
		};
	}

	function update(delta: number) {
		const tState = trainingManager.getState();
		const isPaused = tState.isSimulationPaused || tState.isCompleted;

		if (!isPaused) {
			totalElapsed += delta;
			stageElapsedTime += delta;

			const currentStage = stageManager.getCurrentStage();
			audioManager.setDangerIntensity(currentStage.dangerLevel);

			// Footstep procedural audio
			if (player.isMoving()) {
				const speed = player.getSpeed();
				const interval = speed > 4.2 ? 0.35 : 0.52;
				footstepTimer += delta;
				if (footstepTimer >= interval) {
					footstepTimer = 0;
					const waterDepth = Math.max(0, waterLevel - player.position.y);
					audioManager.playFootsteps(waterDepth > 0.05 ? 'wet' : 'road', speed > 4.2);
				}
			} else {
				footstepTimer = 0.2;
			}

			// Scripted & Periodic Environmental Ambiance Events
			thunderTimer -= delta;
			if (thunderTimer <= 0) {
				thunderTimer = 32.0 + Math.random() * 24.0;
				audioManager.playThunder();
			}

			ambientEventTimer -= delta;
			if (ambientEventTimer <= 0) {
				ambientEventTimer = 38.0 + Math.random() * 28.0;
				if (Math.random() > 0.5) {
					audioManager.playDistantSiren();
				} else {
					audioManager.playRadioChatter();
				}
			}

			// Tick rescued-display grace timers for house indicators
			for (const npcId of Object.keys(rescuedDisplayTimers)) {
				rescuedDisplayTimers[npcId] -= delta;
			}

			// Update 3D house rescue visuals & occupant silhouettes
			let nearestUnassistedHouseDist = 999;
			let nearestUnassistedHouseName = '';

			for (const vis of houseVisuals) {
				const npc = evacuationManager.npcManager.getNpcById(vis.npcId);
				if (!npc) continue;

				const dx = player.position.x - vis.group.position.x;
				const dz = player.position.z - vis.group.position.z;
				const dist = Math.sqrt(dx * dx + dz * dz);

				if (npc.state === 'safe') {
					const timer = rescuedDisplayTimers[vis.npcId];
					if (timer !== undefined && timer <= 0) {
						vis.group.visible = false;
					} else {
						vis.strobeMat.emissive.set('#22c55e');
						vis.strobeLight.color.set('#22c55e');
						vis.strobeMat.emissiveIntensity = 0.9;
						vis.strobeLight.intensity = 1.2;
						vis.windowGlowMat.opacity = 0.2;
						vis.silhouetteGroup.visible = false;
					}
				} else if (npc.state === 'assisted' || npc.state === 'evacuating') {
					vis.strobeMat.emissive.set('#38bdf8');
					vis.strobeLight.color.set('#38bdf8');
					vis.strobeMat.emissiveIntensity = 0.9;
					vis.strobeLight.intensity = 1.2;
					vis.windowGlowMat.opacity = 0.25;
					vis.silhouetteGroup.visible = false;
				} else {
					vis.group.visible = true;
					const flash = Math.sin(totalElapsed * 7.0) > 0 ? 1.0 : 0.2;
					vis.strobeMat.emissive.set('#ea580c');
					vis.strobeLight.color.set('#f59e0b');
					vis.strobeMat.emissiveIntensity = 0.6 + 1.8 * flash;
					vis.strobeLight.intensity = 0.4 + 2.0 * flash;
					vis.windowGlowMat.opacity = 0.5 + 0.3 * Math.sin(totalElapsed * 3.5);
					vis.silhouetteGroup.visible = true;
					vis.silhouetteGroup.rotation.z = Math.sin(totalElapsed * 4.0) * 0.12;

					if (dist < nearestUnassistedHouseDist) {
						nearestUnassistedHouseDist = dist;
						nearestUnassistedHouseName = npc.name;
					}
				}
			}

			// Environmental audio clue when approaching a house containing someone needing help
			if (voiceHelpCooldown > 0) {
				voiceHelpCooldown -= delta;
			} else if (nearestUnassistedHouseDist < 12) {
				voiceHelpCooldown = 18.0;
				audioManager.play('radio_click', `📢 Voice from inside house: "Help! ${nearestUnassistedHouseName} is trapped inside!"`);
			}

			// Adjust water rise speed from stage definition if not manually overridden
			if (manualWaterSpeedOverride === null) {
				waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
			}

			// 1. Water level rising simulation (capped realistically per stage)
			const stageMaxWater: Record<number, number> = {
				1: 0.85,
				2: 1.5,
				3: 2.2,
				4: 3.2,
				5: 4.8,
				6: 6.8
			};
			const maxWaterForStage = stageMaxWater[currentStage.stageNumber] || 7.0;
			if (waterRiseSpeed > 0 && waterLevel < maxWaterForStage) {
				waterLevel += waterRiseSpeed * delta;
				waterSystem.setWaterLevel(waterLevel);
			}

			// 2. Audio Water Ambience Intensity & Threshold Alerts
			const waterIntensity = Math.min(1.0, Math.max(0.0, (waterLevel + 0.4) / 4.0));
			audioManager.setWaterIntensity(waterIntensity);

			if (waterLevel >= 0.6 && !alertMediumTriggered) {
				alertMediumTriggered = true;
				audioManager.play('water_alert_medium');
			}
			if (waterLevel >= 1.4 && !alertHighTriggered) {
				alertHighTriggered = true;
				audioManager.play('water_alert_high');
			}
			if (waterLevel >= 2.2 && !alertCriticalTriggered) {
				alertCriticalTriggered = true;
				audioManager.play('water_alert_critical');
				audioManager.play('emergency_siren');
			}

			// 3. Day / Dusk Atmosphere Transition
			const duskProgress = Math.min(1.0, Math.max(0.0, (totalElapsed / 360.0) * 0.5 + (waterLevel / 4.5) * 0.5));
			currentSkyColor.lerpColors(daySkyColor, duskSkyColor, duskProgress);
			scene.background = currentSkyColor;
			sceneFog.color.copy(currentSkyColor);

			sun.intensity = 1.5 * (1.0 - duskProgress * 0.5);
			hemiLight.intensity = 0.85 * (1.0 - duskProgress * 0.4);

			// 4. Subsystem updates
			waterSystem.update(delta, totalElapsed);
			environment.update(delta, totalElapsed);
			player.update(delta, totalElapsed, environment.getElevation);
			evacuationManager.update(delta, totalElapsed, waterLevel, environment.getElevation);
			evacuationRoute.update(delta, totalElapsed);

			// 5. Track state & Community Telemetry
			trainingManager.updateTime(delta, waterLevel);
			const commStatus = evacuationManager.getCommunityStatus(waterLevel);
			trainingManager.setCommunityStats(
				commStatus.total,
				commStatus.safe,
				commStatus.needAssistance,
				commStatus.delayed
			);

			// Check delay conditions
			const delayCheck = evacuationManager.checkDelayConditions(waterLevel);
			if (delayCheck.isDelayed) {
				delayWarningNotice = delayCheck.warningText;
			} else {
				delayWarningNotice = null;
			}

			// 6. Electrical Hazard Detection & Continuous Sound
			const distToDanger = player.position.distanceTo(environment.dangerZonePosition);
			const insideDanger = distToDanger < environment.dangerZoneRadius;

			if (insideDanger && !isInsideElectricalZone) {
				isInsideElectricalZone = true;
				audioManager.startElectricalCrackle();
			} else if (!insideDanger && isInsideElectricalZone) {
				isInsideElectricalZone = false;
				audioManager.stopElectricalCrackle();
			}

			if (hazardContactCooldown > 0) {
				hazardContactCooldown -= delta;
			} else if (distToDanger < environment.dangerZoneRadius * 0.75) {
				trainingManager.recordHazard(1);
				audioManager.play('warning_beep', '⚠️ High Voltage Shock Danger');
				hazardContactCooldown = 4.0;
			}

			// 7. Proximity Training Decision Events (Gated by realistic pacing cooldown & current level)
			if (trainingManager.canTriggerDecision()) {
				const currentStageNum = currentStage.stageNumber;
				for (const event of TRAINING_EVENTS) {
					if (!tState.completedEventIds.includes(event.id)) {
						// STRICT LEVEL FILTER: Never trigger events from future or past levels!
						if (event.stageActive !== undefined && event.stageActive !== currentStageNum) {
							continue;
						}
						if (event.targetX !== undefined && event.targetZ !== undefined) {
							const dx = player.position.x - event.targetX;
							const dz = player.position.z - event.targetZ;
							const dist = Math.sqrt(dx * dx + dz * dz);
							const radius = event.triggerRadius || 5.0;

							if (dist <= radius) {
								trainingManager.triggerEvent(event);
								audioManager.play('radio_click', 'Incoming Training Decision');
								break;
							}
						}
					}
				}
			}

			// 8. Interactive Props & Stage Milestones
			interactiveProps.update(delta, totalElapsed, currentStage.stageNumber);

			const cStageNum = currentStage.stageNumber;
			if (cStageNum === 1) {
				if (player.position.x > -18) {
					trainingManager.completeStageObjective('s1_advance_gate');
					// When player successfully evacuates past the residential perimeter,
					// ensure baseline readiness objectives are satisfied so they are never stuck in Level 1!
					trainingManager.completeStageObjective('s1_warning_board');
					trainingManager.completeStageObjective('s1_evac_map');
					trainingManager.completeStageObjective('s1_water_gauge');
					trainingManager.completeStageObjective('s1_whistle');
				}
			} else if (cStageNum === 2) {
				if (player.position.x > -13) {
					trainingManager.completeStageObjective('s2_reach_trailhead');
					trainingManager.completeStageObjective('s2_bulletin');
					trainingManager.completeStageObjective('s2_check_shivani');
				}
			} else if (cStageNum === 3) {
				if (player.position.x > -6 && player.position.y >= 1.6) {
					trainingManager.completeStageObjective('s3_reach_elevation');
					trainingManager.completeStageObjective('s3_inspect_route_a');
					trainingManager.completeStageObjective('s3_inspect_route_b');
					trainingManager.completeStageObjective('s3_submerged_sign');
					trainingManager.completeStageObjective('s3_first_aid');
				}
			} else if (cStageNum === 4) {
				if (player.position.x > 3) {
					trainingManager.completeStageObjective('s4_detour_clear');
					trainingManager.completeStageObjective('s4_inspect_junction');
					trainingManager.completeStageObjective('s4_inspect_downed_line');
					trainingManager.completeStageObjective('s4_flashlight');
					trainingManager.completeStageObjective('s4_assist_shruti');
				}
			} else if (cStageNum === 5) {
				if (player.position.x >= 18 && player.position.y >= 4.8) {
					trainingManager.completeStageObjective('s5_reach_plateau');
					trainingManager.completeStageObjective('s5_assist_prashanthi');
					trainingManager.completeStageObjective('s5_assist_anuj');
					trainingManager.completeStageObjective('s5_drinking_water');
				}
			} else if (cStageNum === 6) {
				if (player.position.x >= 28 && player.position.z >= 18) {
					trainingManager.completeStageObjective('s6_climb_summit');
					trainingManager.completeStageObjective('s6_report_flood');
					trainingManager.completeStageObjective('s6_report_electrical');
					trainingManager.completeStageObjective('s6_report_roster');
					trainingManager.completeStageObjective('s6_check_radio');
					trainingManager.completeStageObjective('s6_helipad_triage');
				}
			}

			// 9. 6-Level Progression Flow
			const stageProgression = stageManager.checkProgression(
				player.position,
				player.position.y,
				waterLevel,
				tState.civiliansAssisted,
				stageElapsedTime
			);

			if (stageProgression.levelCompleted) {
				if (stageProgression.isFinalLevel) {
					audioManager.play('success_chime', 'Training Complete!');
					missionSuccessBanner = stageProgression.bannerText || 'TRAINING COMPLETE: All 6 Flood Ready Missions Mastered!';
					successBannerTimer = 8.0;
				} else {
					const curStg = stageManager.getCurrentStage();
					const trState = trainingManager.getState();
					const primaryTotal = curStg.primaryObjectives?.length || 0;
					const primaryCompleted = trState.stageObjectives.filter((o) => !o.isOptional && o.completed).length;
					const optionalTotal = curStg.optionalObjectives?.length || 0;
					const optionalCompleted = trState.stageObjectives.filter((o) => o.isOptional && o.completed).length;

					completedLevelModalData = {
						levelNumber: stageProgression.completedLevelNum || 1,
						levelTitle: stageProgression.completedLevelTitle || '',
						levelName: stageProgression.completedLevelTitle || '',
						primaryCompleted,
						primaryTotal,
						optionalCompleted,
						optionalTotal,
						civiliansHelped: trState.civiliansAssisted,
						hazardsIdentified: trState.explorationStats.hazardsIdentified,
						safetyLesson: stageProgression.safetyLesson || '',
						nextLevelNumber: (stageProgression.completedLevelNum || 1) + 1,
						nextLevelName: stageProgression.nextLevelName
					};
					audioManager.play('success_chime', `Level ${stageProgression.completedLevelNum} Completed!`);
					player.setPaused(true);
					trainingManager.setSimulationPaused(true);

					if (stageProgression.checkpointSaved) {
						checkpointNotice = `✓ Checkpoint ${stageProgression.checkpointSaved} Saved`;
						checkpointNoticeTimer = 4.5;
					}
				}
			} else if (stageProgression.advanced) {
				stageElapsedTime = 0;
				if (stageProgression.bannerText) {
					missionSuccessBanner = stageProgression.bannerText;
					successBannerTimer = 5.0;
				}
			}

			if (successBannerTimer > 0) {
				successBannerTimer -= delta;
				if (successBannerTimer <= 0) {
					missionSuccessBanner = null;
				}
			}

			if (checkpointNoticeTimer > 0) {
				checkpointNoticeTimer -= delta;
				if (checkpointNoticeTimer <= 0) {
					checkpointNotice = null;
				}
			}
		} else {
			waterSystem.update(0.016, totalElapsed);
			environment.update(0.016, totalElapsed);
			evacuationRoute.update(0.016, totalElapsed);
		}

		// Animate rain
		const posAttr = rainGeo.attributes.position as BufferAttribute;
		for (let i = 0; i < rainCount; i++) {
			let y1 = posAttr.getY(i * 2);
			let y2 = posAttr.getY(i * 2 + 1);
			y1 -= delta * 22;
			y2 -= delta * 22;

			if (y2 < 0) {
				const resetY = 22 + Math.random() * 4;
				const len = y1 - y2;
				y1 = resetY;
				y2 = resetY - len;
			}
			posAttr.setY(i * 2, y1);
			posAttr.setY(i * 2 + 1, y2);
		}
		posAttr.needsUpdate = true;

		// Telemetry output
		if (onTelemetry) {
			onTelemetry(getTelemetry());
		}

		// Render scene
		renderer.render(scene, camera);
	}

	function advanceToNextLevel(): StageDefinition {
		completedLevelModalData = null;
		stageElapsedTime = 0;
		const nextStage = stageManager.advanceStage();
		waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
		missionSuccessBanner = `LEVEL ${nextStage.stageNumber}: ${nextStage.shortTitle.toUpperCase()} - ${nextStage.objective}`;
		successBannerTimer = 6.0;

		const spawnPoints: Record<number, { x: number; z: number }> = {
			1: { x: -23, z: 1 },
			2: { x: -17, z: 0 },
			3: { x: -11, z: -1 },
			4: { x: -2, z: -1 },
			5: { x: 6, z: 2 },
			6: { x: 22, z: 8 }
		};
		const pt = spawnPoints[nextStage.stageNumber];
		if (pt) {
			player.resetPosition(pt.x, pt.z);
		}

		if (nextStage.stageNumber === 5) {
			audioManager.play('emergency_siren', '🚨 Flash Flood Surge Alert!');
		} else {
			audioManager.play('success_chime', `Level ${nextStage.stageNumber}: ${nextStage.shortTitle}`);
		}

		player.setPaused(false);
		trainingManager.setSimulationPaused(false);
		return nextStage;
	}

	function jumpToLevel(levelNum: number): StageDefinition {
		completedLevelModalData = null;
		stageElapsedTime = 0;
		const targetStage = stageManager.setStage(levelNum);
		waterRiseSpeed = stageManager.getRecommendedWaterSpeed();
		missionSuccessBanner = `LEVEL ${targetStage.stageNumber}: ${targetStage.shortTitle.toUpperCase()} - ${targetStage.objective}`;
		successBannerTimer = 6.0;

		const spawnPoints: Record<number, { x: number; z: number }> = {
			1: { x: -23, z: 1 },
			2: { x: -17, z: 0 },
			3: { x: -11, z: -1 },
			4: { x: -2, z: -1 },
			5: { x: 6, z: 2 },
			6: { x: 22, z: 8 }
		};
		const pt = spawnPoints[targetStage.stageNumber];
		if (pt) {
			player.resetPosition(pt.x, pt.z);
		}

		if (targetStage.stageNumber === 5) {
			audioManager.play('emergency_siren', '🚨 Flash Flood Surge Alert!');
		} else {
			audioManager.play('success_chime', `Level ${targetStage.stageNumber}: ${targetStage.shortTitle}`);
		}

		player.setPaused(false);
		trainingManager.setSimulationPaused(false);
		return targetStage;
	}

	function dispose() {
		rainGeo.dispose();
		rainMat.dispose();
		environment.dispose();
		waterSystem.dispose();
		player.dispose();
		npcManager.dispose();
		interactiveProps.dispose();
		evacuationRoute.dispose();
		evacuationManager.dispose();
		audioManager.dispose();
		scene.remove(houseVisualsGroup);
		renderer.dispose();
		if (canvasContainer.contains(renderer.domElement)) {
			canvasContainer.removeChild(renderer.domElement);
		}
		scene.clear();
	}

	return {
		scene,
		camera,
		renderer,
		environment,
		waterSystem,
		player,
		trainingManager,
		stageManager,
		evacuationManager,
		audioManager,
		interactiveProps,
		interact,
		assistCivilian,
		advanceToNextLevel,
		jumpToLevel,
		setWaterSpeed,
		resetSimulation,
		resumeFromCheckpoint,
		getTelemetry,
		update,
		dispose
	};
}

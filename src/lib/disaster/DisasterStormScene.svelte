<script lang="ts">
	import { onMount } from 'svelte';
	import {
		AmbientLight,
		BufferAttribute,
		BufferGeometry,
		Color,
		DirectionalLight,
		FogExp2,
		HemisphereLight,
		LineBasicMaterial,
		LineSegments,
		PerspectiveCamera,
		Scene,
		Vector3,
		WebGLRenderer
	} from 'three';
	import { createFloodEnvironment, type FloodEnvironment } from '../flood/floodEnvironment';
	import { createPlayerController, type PlayerController } from '../flood/playerController';
	import { createNpcManager, type NpcManager } from '../flood/npc/npcManager';
	import { createEvacuationRoute, type EvacuationRoute } from '../flood/evacuation/evacuationRoute';
	import { createAudioManager, type AudioManager } from '../flood/audio/audioManager';
	import {
		TrainingStateManager,
		type TrainingState,
		type CheckpointData,
		type StageObjectiveItem,
		type EmergencyInventory,
		type ExplorationStats
	} from '../flood/trainingState';
	import type { CivilianNpc } from '../flood/npc/npcTypes';
	import {
		DISASTER_STAGE_DEFINITIONS,
		DISASTER_EVENTS,
		DISASTER_SAFETY_LESSONS,
		type DisasterStageDefinition
	} from './disasterScenario';
	import { createDisasterVisuals, type DisasterVisualManager } from './disasterEnvironment';
	import TrainingDecision from '../flood/TrainingDecision.svelte';
	import DisasterComplete from './DisasterComplete.svelte';
	import PauseAssessModal from '../flood/PauseAssessModal.svelte';
	import LevelCompleteModal from '../common/LevelCompleteModal.svelte';
	import type { AudioCaption } from '../flood/audio/audioManager';
	import { DISASTER_STATE_KEY, saveSimulationResult } from '../common/storage';
	import {
		createInteractivePropsManager,
		type InteractivePropsManager,
		type InteractableObject
	} from '../flood/interactivePropsManager';
	import type { HouseRescueIndicator } from '../flood/createFloodScene';

	import DisasterStart from './DisasterStart.svelte';

	let { onExitToMenu }: { onExitToMenu?: () => void } = $props();

	let canvasContainer = $state<HTMLDivElement | null>(null);

	const trainingManager = new TrainingStateManager();
	let trainingState = $state<TrainingState>(trainingManager.getState());

	let showStartModal = $state(true);
	let showDecisionModal = $state(false);
	let showScenarioReview = $state(false);
	let showCheckpointModal = $state(false);
	let showPauseAssessModal = $state(false);
	let showVolumePanel = $state(false);
	let showSettingsPanel = $state(false);

	let audioFeedbackToast = $state<string | null>(null);
	let checkpointNotice = $state<string | null>(null);
	let liveCaption = $state<AudioCaption | null>(null);
	let audioToastTimer: ReturnType<typeof setTimeout> | null = null;
	let checkpointNoticeTimer: ReturnType<typeof setTimeout> | null = null;
	let captionTimer: ReturnType<typeof setTimeout> | null = null;

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	// Stage-specific assessment data for Pause & Assess modal
	const stageAssessments: Record<number, { danger: string; direction: string; help: string; avoid: string }> = {
		1: {
			danger: 'Violent seismic shaking — falling ceiling fixtures, flying glass, and structural debris.',
			direction: 'Under a sturdy desk or interior wall away from windows; then move to open ground.',
			help: 'Alert nearby residents to perform DROP, COVER and HOLD ON immediately.',
			avoid: '🏢 Windows, exterior walls, hanging objects, and running outdoors during shaking.'
		},
		2: {
			danger: 'Cracked masonry, unstable building facades, and a spreading secondary electrical fire.',
			direction: 'Open sidewalks and perimeter routes at least 10m from buildings, upwind from smoke.',
			help: 'Warn residents near smoke plumes and guide them away from fire and cracked structures.',
			avoid: '🧱 Entering cracked structures, approaching smoke, or crossing falling debris paths.'
		},
		3: {
			danger: 'Explosive natural gas vapor cloud from ruptured distribution main and blackout with downed cables.',
			direction: 'Upwind away from hissing sound; follow illuminated corridor markers to substation.',
			help: 'Prevent anyone from flipping switches, lighting flames, or using phones; keep 10m back from wires.',
			avoid: '💨 Gas vapor clouds, open flames, and touching fallen power lines.'
		},
		4: {
			danger: 'Trapped, injured, and vulnerable residents inside compromised buildings and rubble paths.',
			direction: 'Search neighborhood, inspect houses with PERSON INSIDE banner, escort to assembly.',
			help: 'Elderly resident Prashanthi, injured Anurag, separated child Anuj, and trapped resident inside house.',
			avoid: '🏃 Entering uninspected collapsed rooms or abandoning vulnerable evacuees.'
		},
		5: {
			danger: 'Multi-hazard evacuation corridor: spreading embers, live lines, crowd confusion, and rubble.',
			direction: 'Designated wide-road open corridor toward the district assembly registration desk.',
			help: 'Multiple civilian groups, elderly residents, families, and stranded evacuees (5+).',
			avoid: '🚧 Narrow alleys, structural overhangs, and hazardous utility areas.'
		},
		6: {
			danger: 'Residual perimeter hazards, missing persons unaccounted for, triage logistics.',
			direction: 'Emergency Response Operations Center and Summit Relief Outpost.',
			help: 'Locate missing resident Shruti at perimeter, file hazard reports, and confirm accountability.',
			avoid: '⚠️ Re-entering unsecured disaster ruins without authorization.'
		}
	};

	let volumeSettings = $state({
		master: 80,
		water: 70, // Environment Ambience
		alerts: 85,
		ui: 75
	});

	let isAudioMuted = $state(false);
	let currentStageIndex = $state(0);
	let currentStage = $derived(DISASTER_STAGE_DEFINITIONS[currentStageIndex]);

	let promptedCivilian = $state<CivilianNpc | null>(null);
	let promptedInteractable = $state<InteractableObject | null>(null);
	let interactToast = $state<string | null>(null);
	let interactToastTimer: ReturnType<typeof setTimeout> | null = null;
	let missionSuccessBanner = $state<string | null>(null);
	let bannerTimer: ReturnType<typeof setTimeout> | null = null;
	let stageElapsedTime = 0;
	let ambientEventTimer = 22.0;

	// Runtime references
	let audioManager: AudioManager | null = null;
	let visualManager: DisasterVisualManager | null = null;
	let player: PlayerController | null = null;
	let camera: PerspectiveCamera | null = null;
	let renderer: WebGLRenderer | null = null;
	let npcManager: NpcManager | null = null;
	let environment: FloodEnvironment | null = null;
	let interactiveProps: InteractivePropsManager | null = null;
	let houseRescueIndicators = $state<HouseRescueIndicator[]>([]);

	let completedLevelData = $state<{
		levelNumber: number;
		levelName: string;
		primaryCompleted: number;
		primaryTotal: number;
		optionalCompleted: number;
		optionalTotal: number;
		civiliansHelped: number;
		hazardsIdentified: number;
		safetyLesson: string;
		nextLevelNumber?: number;
	} | null>(null);

	function handleContinueNextLevel() {
		completedLevelData = null;
		player?.setPaused(false);
		advanceToStage(currentStageIndex + 1);
	}

	function handleSelectLevel(lvl: number) {
		completedLevelData = null;
		player?.setPaused(false);
		advanceToStage(lvl - 1);
	}

	const HOUSE_NPC_REGISTRY = [
		{ npcId: 'npc_ankush', npcName: 'Ankush', houseLabel: 'Damaged Downtown House A', houseX: -22, houseZ: -10 },
		{ npcId: 'npc_anuj', npcName: 'Anuj', houseLabel: 'Compromised Structure C', houseX: -8, houseZ: -12 },
		{ npcId: 'npc_shruti', npcName: 'Shruti', houseLabel: 'Mid-Hill Residence D', houseX: 2, houseZ: -6 },
		{ npcId: 'npc_gayatri', npcName: 'Gayatri', houseLabel: 'Hillside Building B', houseX: -4, houseZ: 12 }
	];
	const rescuedDisplayTimers: Record<string, number> = {};

	// Checkpoint persistence in localStorage
	function saveDisasterCheckpoint(cpNum: number) {
		trainingManager.saveCheckpoint(cpNum, 0);
		try {
			const st = trainingManager.getState();
			localStorage.setItem(
				DISASTER_STATE_KEY,
				JSON.stringify({
					stageIndex: currentStageIndex,
					state: st
				})
			);
		} catch {
			// ignore
		}
		checkpointNotice = `✓ Checkpoint ${cpNum} Saved: ${currentStage.shortTitle}`;
		if (checkpointNoticeTimer) clearTimeout(checkpointNoticeTimer);
		checkpointNoticeTimer = setTimeout(() => {
			checkpointNotice = null;
		}, 4000);
	}

	function loadSavedDisasterState(): { stageIndex: number; state: TrainingState } | null {
		try {
			const raw = localStorage.getItem(DISASTER_STATE_KEY);
			if (raw) return JSON.parse(raw);
		} catch {
			// ignore
		}
		return null;
	}

	function handleResumeCheckpoint(cpNum: number) {
		const restored = trainingManager.restoreCheckpoint(cpNum);
		if (restored) {
			currentStageIndex = Math.max(0, Math.min(DISASTER_STAGE_DEFINITIONS.length - 1, restored.stage - 1));
			trainingManager.setStage(currentStageIndex + 1);
			stageElapsedTime = 0;

			// Teleport player based on stage
			let targetX = -22;
			let targetZ = 0;
			if (cpNum === 1) { targetX = -15; targetZ = 0; }
			else if (cpNum === 2) { targetX = -7; targetZ = -4; }
			else if (cpNum === 3) { targetX = 3; targetZ = 2; }
			else if (cpNum === 4) { targetX = 12; targetZ = 3; }
			else if (cpNum === 5) { targetX = 19; targetZ = 4; }

			player?.resetPosition(targetX, targetZ);
			checkpointNotice = `Resumed from Checkpoint ${cpNum}: ${currentStage.shortTitle}`;
			audioManager?.play('radio_click', `Resumed Checkpoint ${cpNum}`);
		}
		showCheckpointModal = false;
	}

	function executeFullReset() {
		currentStageIndex = 0;
		trainingManager.reset();
		player?.resetPosition(-22, 0);
		visualManager?.setBlackoutActive(false);
		showCheckpointModal = false;
		showScenarioReview = false;
		missionSuccessBanner = 'Simulation Reset: Stage 1 — Earthquake Strike';
		setTimeout(() => (missionSuccessBanner = null), 3000);
	}

	function handleResetClick() {
		if (trainingState.checkpointStage > 0) {
			showCheckpointModal = true;
		} else {
			executeFullReset();
		}
	}

	function advanceToStage(idx: number) {
		if (idx >= DISASTER_STAGE_DEFINITIONS.length) {
			trainingManager.completeTraining();
			audioManager?.play('training_complete', '🏆 Disaster Storm Completed!');
			saveSimulationResult('disaster', trainingState.safetyScore, 'EMERGENCY READY');
			return;
		}

		currentStageIndex = idx;
		stageElapsedTime = 0;
		const stg = DISASTER_STAGE_DEFINITIONS[idx];
		trainingManager.setStage(stg.stageNumber);

		// Spawn / reposition player at stage trailhead to prevent premature objective trigger
		const spawnPoints = [
			{ x: -22, z: 0 },
			{ x: -16, z: 0 },
			{ x: -7, z: -2 },
			{ x: 2, z: 0 },
			{ x: 13, z: 2 },
			{ x: 22, z: 1 }
		];
		if (spawnPoints[idx] && player) {
			player.resetPosition(spawnPoints[idx].x, spawnPoints[idx].z);
		}

		// Set multi-objectives for this stage
		if (stg.primaryObjectives && stg.optionalObjectives) {
			trainingManager.setStageObjectives(stg.primaryObjectives, stg.optionalObjectives);
		}

		missionSuccessBanner = `${stg.title}: ${stg.objective}`;
		if (bannerTimer) clearTimeout(bannerTimer);
		bannerTimer = setTimeout(() => {
			missionSuccessBanner = null;
		}, 5000);

		if (stg.checkpointNum) {
			saveDisasterCheckpoint(stg.checkpointNum);
		}

		// Stage-specific audio/visual triggers
		if (stg.id === 'earthquake_strike') {
			audioManager?.startEarthquakeRumble(0.8);
			visualManager?.triggerShake(4.0, 2.0);
			setTimeout(() => audioManager?.stopEarthquakeRumble(), 4000);
		} else if (stg.id === 'structural_damage_fire') {
			audioManager?.startFireAmbience();
			audioManager?.play('structural_crack', '🔥 Fire Outbreak Detected');
		} else if (stg.id === 'gas_leak_power_failure') {
			audioManager?.startGasHiss();
			audioManager?.play('gas_leak_hiss', '💨 Gas Leak Hiss');
			audioManager?.play('blackout_shutdown', '⚡ Power Grid Collapse');
			visualManager?.setBlackoutActive(true);
		} else if (stg.id === 'community_rescue') {
			audioManager?.play('success_chime', '🤝 Community Rescue Activated');
		} else if (stg.id === 'large_scale_evacuation') {
			audioManager?.play('emergency_announcement', '📢 Evacuate Along Open Corridors');
		} else if (stg.id === 'final_emergency_response') {
			audioManager?.play('success_chime', '🏕️ Emergency Command Response');
		} else {
			audioManager?.play('success_chime', `Level ${stg.stageNumber}: ${stg.shortTitle}`);
		}
	}

	function handleDecisionChoice(choiceId: 'A' | 'B' | 'C' | 'D') {
		const rec = trainingManager.submitDecision(choiceId);
		if (rec && audioManager) {
			audioManager.play(rec.isCorrect ? 'decision_correct' : 'decision_wrong');
		}

		// Complete the decision objective for this stage
		if (rec) {
			trainingManager.completeStageObjective(rec.eventId);
		}

		// Cascading consequence processing
		if (rec) {
			const cStage = currentStage.id;
			if (cStage === 'earthquake_strike' && !rec.isCorrect) {
				trainingManager.updateCascading({ structuralRisk: true });
			} else if (cStage === 'structural_damage' && choiceId === 'A') {
				trainingManager.updateCascading({ structuralRisk: true });
			} else if (cStage === 'secondary_fire' && rec.isCorrect) {
				trainingManager.updateCascading({ fireEncounter: true });
			} else if (cStage === 'gas_leak') {
				if (choiceId === 'A' || choiceId === 'B') {
					trainingManager.updateCascading({ gasHazardSeverity: 'HIGH' });
				} else if (rec.isCorrect) {
					trainingManager.updateCascading({ gasLeakHandled: true, gasHazardSeverity: 'NONE' });
				}
			} else if (cStage === 'help_community' && rec.isCorrect) {
				trainingManager.updateCascading({
					vulnerablePeopleHelped: (trainingState.cascading?.vulnerablePeopleHelped || 0) + 1
				});
			} else if (cStage === 'aftershock') {
				trainingManager.updateCascading({ aftershockPrepared: rec.isCorrect });
			} else if (cStage === 'community_evacuation') {
				trainingManager.updateCascading({
					routeChoice: choiceId === 'B' ? 'LONG_SAFE' : 'SHORT_RISKY'
				});
			}
		}
	}

	// [E] Interact handler — tries interactable prop first, then NPC
	function handleInteract() {
		if (!player || !interactiveProps) return;
		const nearest = interactiveProps.getNearestInteractable(player.position, currentStageIndex + 1, 3.5);
		if (nearest) {
			const result = interactiveProps.interactWith(nearest.id);
			if (result.success && result.result) {
				interactToast = result.result.message;
				if (interactToastTimer) clearTimeout(interactToastTimer);
				interactToastTimer = setTimeout(() => { interactToast = null; }, 4000);
				if (result.result.itemCollected) {
					audioManager?.play('checkpoint', `Collected: ${result.result.itemCollected}`);
				}
			}
			return;
		}
		// Fallback to NPC assist
		if (promptedCivilian) {
			handleAssistCivilian(promptedCivilian.id);
		}
	}

	function handleDecisionContinue() {
		audioManager?.play('decision_continue');
		trainingManager.resumeFromDecision();
	}

	function handleAssistCivilian(id: string) {
		if (!npcManager) return;
		const res = npcManager.assistNpc(id);
		if (res && res.isFirstTime) {
			trainingManager.recordCivilianAssisted();
			audioManager?.play('success_chime', `Assisted ${res.npc.name}`);
			missionSuccessBanner = `Assisted ${res.npc.name} (${res.npc.role}) in joining evacuation!`;
			if (bannerTimer) clearTimeout(bannerTimer);
			bannerTimer = setTimeout(() => (missionSuccessBanner = null), 4000);

			// Map NPC assist to disaster stage objectives
			if (res.npc.id === 'npc_prashanthi') trainingManager.completeStageObjective('d6_triage_elderly');
			if (res.npc.id === 'npc_anuj') trainingManager.completeStageObjective('d6_triage_child');
			if (res.npc.id === 'npc_anurag') trainingManager.completeStageObjective('d6_triage_injured');
			if (res.npc.id === 'npc_prashant') trainingManager.completeStageObjective('d1_check_panicked_npc');
			if (res.npc.id === 'npc_manvi') trainingManager.completeStageObjective('d3_warn_resident_1');
			if (res.npc.id === 'npc_shivani') trainingManager.completeStageObjective('d3_warn_resident_2');
			if (res.npc.id === 'npc_hasan') trainingManager.completeStageObjective('d3_warn_resident_3');
			if (res.npc.id === 'npc_gayatri') trainingManager.completeStageObjective('d7_help_fallen');
			if (res.npc.id === 'npc_shruti') trainingManager.completeStageObjective('d9_search_missing');
		}
	}

	function handleVolumeChange(channel: 'master' | 'water' | 'alerts' | 'ui', val: number) {
		volumeSettings[channel] = val;
		audioManager?.setVolume(channel, val / 100);
	}

	function handleToggleAudio() {
		if (!audioManager) return;
		const nextMute = !isAudioMuted;
		audioManager.setMuted(nextMute);
		isAudioMuted = nextMute;
	}

	function handleStartTraining(mode: 'guided' | 'standard' = 'guided') {
		trainingManager.setTrainingMode(mode);
		trainingManager.setSimulationPaused(false);
		showStartModal = false;
		player?.setPaused(false);
		advanceToStage(0);
	}

	function handleOpenPauseAssess() {
		showPauseAssessModal = true;
		player?.setPaused(true);
		trainingManager.setAssessing(true);
	}

	function handleClosePauseAssess() {
		showPauseAssessModal = false;
		player?.setPaused(false);
		trainingManager.setAssessing(false);
	}

	onMount(() => {
		if (!canvasContainer) return;

		const unsubscribe = trainingManager.subscribe((s) => {
			trainingState = s;
		});

		// 1. Scene & Camera
		const scene = new Scene();
		const daySkyColor = new Color('#94a3b8');
		scene.background = daySkyColor;
		const sceneFog = new FogExp2(daySkyColor, 0.015);
		scene.fog = sceneFog;

		const width = Math.max(canvasContainer.clientWidth, 1);
		const height = Math.max(canvasContainer.clientHeight, 1);
		camera = new PerspectiveCamera(48, width / height, 0.2, 350);
		camera.position.set(-20, 6, 8);

		// 2. Renderer
		renderer = new WebGLRenderer({ antialias: true, alpha: false });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(width, height);
		renderer.shadowMap.enabled = true;
		canvasContainer.appendChild(renderer.domElement);

		// 3. Lighting
		const hemiLight = new HemisphereLight('#f8fafc', '#334155', 0.85);
		scene.add(hemiLight);

		const sun = new DirectionalLight('#fffbeb', 1.5);
		sun.position.set(16, 28, 14);
		sun.castShadow = true;
		scene.add(sun);

		// 4. Base Environment
		environment = createFloodEnvironment();
		scene.add(environment.group);

		// 5. Disaster Props & Visuals
		visualManager = createDisasterVisuals(scene, sun, hemiLight);

		// 5b. Interactive Props
		interactiveProps = createInteractivePropsManager();
		scene.add(interactiveProps.group);
		_registerDisasterProps(interactiveProps, environment);

		// 6. Player & Route
		player = createPlayerController(camera, renderer.domElement, -22, 0);
		scene.add(player.mesh);

		npcManager = createNpcManager();
		scene.add(npcManager.group);

		const evacuationRoute = createEvacuationRoute(environment.getElevation);
		scene.add(evacuationRoute.group);

		// 7. Audio Manager
		audioManager = createAudioManager();
		const vols = audioManager.getVolumes();
		volumeSettings = {
			master: Math.round(vols.master * 100),
			water: Math.round(vols.water * 100),
			alerts: Math.round(vols.alerts * 100),
			ui: Math.round(vols.ui * 100)
		};

		const unsubFeedback = audioManager.onFeedback((label) => {
			audioFeedbackToast = label;
			if (audioToastTimer) clearTimeout(audioToastTimer);
			audioToastTimer = setTimeout(() => {
				audioFeedbackToast = null;
			}, 2600);
		});

		const unsubCaption = audioManager.onCaption((cap) => {
			liveCaption = cap;
			if (captionTimer) clearTimeout(captionTimer);
			captionTimer = setTimeout(() => {
				liveCaption = null;
			}, 3200);
		});

		// Check saved checkpoint from previous run
		const saved = loadSavedDisasterState();
		if (saved && saved.state.checkpointStage > 0) {
			trainingManager.saveCheckpoint(saved.state.checkpointStage, 0);
		}

		// Initial start state: pause player and simulation while intro modal is shown
		trainingManager.setSimulationPaused(true);
		player?.setPaused(true);

		// Animation loop
		let animationId: number;
		let lastTime = performance.now();
		let totalElapsed = 0;
		let frameCount = 0;

		// Non-reactive cache for proximity — only update $state when value actually changes
		let _cachedInteractable: InteractableObject | null = null;
		let _cachedCivilian: CivilianNpc | null = null;

		function tick(time: number) {
			const delta = Math.min((time - lastTime) / 1000, 0.1); // clamp large deltas
			lastTime = time;
			frameCount++;

			// Use already-subscribed trainingState instead of calling getState() every frame
			const isPaused = showStartModal || trainingState.isSimulationPaused || trainingState.isCompleted;

			if (!isPaused) {
				totalElapsed += delta;
				stageElapsedTime += delta;
				trainingManager.updateTime(delta, 0);

				const elev = environment?.getElevation || ((x: number, z: number) => 0);
				environment?.update(delta, totalElapsed);
				player?.update(delta, totalElapsed, elev);
				npcManager?.update(delta, totalElapsed, 0, elev);
				evacuationRoute.update(delta, totalElapsed);
				visualManager?.update(delta, totalElapsed, currentStageIndex + 1);
				interactiveProps?.update(delta, totalElapsed, currentStageIndex + 1);

				if (camera) {
					visualManager?.applyCameraShake(camera, delta);
				}

				// Tick rescued-display grace timers for house indicators
				for (const npcId of Object.keys(rescuedDisplayTimers)) {
					rescuedDisplayTimers[npcId] -= delta;
				}

				// Throttle proximity + objective checks to every 3rd frame (~20Hz) to avoid
				// triggering Svelte reactive re-renders at 60fps
				if (frameCount % 3 === 0 && player) {
					// Check proximity to interactive props — only write $state when changed
					if (interactiveProps) {
						const next = interactiveProps.getNearestInteractable(player.position, currentStageIndex + 1, 3.5);
						if (next !== _cachedInteractable) {
							_cachedInteractable = next;
							promptedInteractable = next;
						}
					}

					// Check proximity to NPCs — only write $state when changed
					if (npcManager) {
						const nextCiv = _cachedInteractable ? null : npcManager.getNearestInteractableNpc(player.position, 3.8);
						if (nextCiv !== _cachedCivilian) {
							_cachedCivilian = nextCiv;
							promptedCivilian = nextCiv;
						}
					}

					// Update house rescue indicators with screen projection
					if (npcManager && environment && camera && canvasContainer) {
						const cWidth = canvasContainer.clientWidth || window.innerWidth || 1280;
						const cHeight = canvasContainer.clientHeight || window.innerHeight || 720;
						const tempProj = new Vector3();
						const nextIndicators: HouseRescueIndicator[] = [];

						for (const reg of HOUSE_NPC_REGISTRY) {
							const npc = npcManager.getNpcById(reg.npcId);
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

							tempProj.set(reg.houseX, houseY + 6.8, reg.houseZ);
							tempProj.project(camera);
							const isFront = tempProj.z > -1 && tempProj.z < 1;
							const screenX = Math.round(((tempProj.x + 1) * 0.5) * cWidth);
							const screenY = Math.round(((-tempProj.y + 1) * 0.5) * cHeight);
							const isOnScreen = isFront && screenX >= -80 && screenX <= cWidth + 80 && screenY >= -80 && screenY <= cHeight + 80;

							nextIndicators.push({
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
						houseRescueIndicators = nextIndicators;
					}

					// Positional / milestone objectives based on player movement
					const cStageNum = currentStageIndex + 1;
					const px = player.position.x;
					const pz = player.position.z;

					if (cStageNum === 1) {
						if (stageElapsedTime >= 1.0) trainingManager.completeStageObjective('d1_experience_quake');
						if (stageElapsedTime >= 4.0) trainingManager.completeStageObjective('d1_wait_shaking_stop');
						if (stageElapsedTime >= 2.0) trainingManager.completeStageObjective('d1_inspect_environment');
						if (px > -20) trainingManager.completeStageObjective('d1_move_safe_open');
						if (px > -17) trainingManager.completeStageObjective('d1_reach_assembly');
					} else if (cStageNum === 2) {
						if (stageElapsedTime >= 1.5) trainingManager.completeStageObjective('d2_inspect_neighborhood');
						if (px > -15) trainingManager.completeStageObjective('d2_find_evac_route');
						if (px > -14) trainingManager.completeStageObjective('d2_avoid_damaged_structures');
						if (px > -12) trainingManager.completeStageObjective('d2_navigate_open_road');
						if (px > -9) trainingManager.completeStageObjective('d2_reach_assembly');
					} else if (cStageNum === 3) {
						if (px > -6) trainingManager.completeStageObjective('d3_identify_danger_zone');
						if (px > -2) trainingManager.completeStageObjective('d3_clear_perimeter');
						if (px > 0) trainingManager.completeStageObjective('d3_find_lit_route');
						if (px > 2) trainingManager.completeStageObjective('d3_guide_civilians_route');
						if (px > 3.5) trainingManager.completeStageObjective('d3_reach_substation');
					} else if (cStageNum === 4) {
						if (stageElapsedTime >= 1.5) trainingManager.completeStageObjective('d4_search_neighborhood');
						const dHouse = Math.hypot(px - (-8), pz - (-12));
						if (dHouse <= 22) trainingManager.completeStageObjective('d4_find_house_civilian');
						if (dHouse <= 18) trainingManager.completeStageObjective('d4_person_inside_shown');
						if (dHouse <= 5.5) trainingManager.completeStageObjective('d4_enter_house');
						if (px > 8) trainingManager.completeStageObjective('d4_escort_safe_corridor');
						if (px > 12) trainingManager.completeStageObjective('d4_reach_assembly_point');
					} else if (cStageNum === 5) {
						if (px > 14) trainingManager.completeStageObjective('d5_reach_evacuation_zone');
						if (px > 16) trainingManager.completeStageObjective('d5_avoid_structures');
						if (px > 17) trainingManager.completeStageObjective('d5_avoid_electrical');
						if (px > 17.5) trainingManager.completeStageObjective('d5_follow_safe_route');
						if (trainingState.civiliansAssisted >= 5) trainingManager.completeStageObjective('d5_assist_5_civilians');
						if (px > 19) trainingManager.completeStageObjective('d5_reach_assembly_entry');
					} else if (cStageNum === 6) {
						if (px > 21) trainingManager.completeStageObjective('d6_leave_assembly');
						if (px > 24) trainingManager.completeStageObjective('d6_travel_response_center');
						if (px > 25) trainingManager.completeStageObjective('d6_avoid_remaining_hazards');
						const dShruti = Math.hypot(px - 22, pz - 3);
						if (dShruti <= 4.5) trainingManager.completeStageObjective('d6_travel_missing_location');
						const shrutiRescued = trainingState.stageObjectives.find((o) => o.id === 'd6_rescue_missing_civilian')?.completed;
						if (shrutiRescued && px > 26) trainingManager.completeStageObjective('d6_return_response_center');
					}

					// Check proximity decision triggers (strictly gated by current level)
					if (trainingManager.canTriggerDecision()) {
						const event = DISASTER_EVENTS.find(
							(e) => (e.stageActive !== undefined ? e.stageActive === cStageNum : e.id.includes(`stage${cStageNum}`))
						);
						if (event && !trainingState.completedEventIds.includes(event.id)) {
							if (event.targetX !== undefined && event.targetZ !== undefined) {
								const dx = px - event.targetX;
								const dz = player.position.z - event.targetZ;
								const dist = Math.sqrt(dx * dx + dz * dz);
								if (dist <= (event.triggerRadius || 5.0)) {
									trainingManager.triggerEvent(event);
									audioManager?.play('radio_click', 'Incoming Emergency Scenario');
								}
							}
						}
					}

					// Stage Progression: Advance or trigger level completion modal
					const stgDef = DISASTER_STAGE_DEFINITIONS[currentStageIndex];
					if (
						stgDef &&
						stageElapsedTime >= Math.max(6.0, stgDef.minActionSeconds || 8.0) &&
						trainingManager.areAllPrimaryObjectivesCompleted()
					) {
						if (currentStageIndex < DISASTER_STAGE_DEFINITIONS.length - 1) {
							if (!completedLevelData) {
								const primaryTotal = stgDef.primaryObjectives?.length || 0;
								const primaryCompleted = trainingState.stageObjectives.filter((o) => !o.isOptional && o.completed).length;
								const optionalTotal = stgDef.optionalObjectives?.length || 0;
								const optionalCompleted = trainingState.stageObjectives.filter((o) => o.isOptional && o.completed).length;

								completedLevelData = {
									levelNumber: currentStageIndex + 1,
									levelName: stgDef.shortTitle,
									primaryCompleted,
									primaryTotal,
									optionalCompleted,
									optionalTotal,
									civiliansHelped: trainingState.civiliansAssisted,
									hazardsIdentified: trainingState.explorationStats.hazardsIdentified,
									safetyLesson: DISASTER_SAFETY_LESSONS[currentStageIndex + 1] || 'Stay alert and follow emergency protocols.',
									nextLevelNumber: currentStageIndex + 2
								};
								audioManager?.play('success_chime', `Level ${currentStageIndex + 1} Complete!`);
								player?.setPaused(true);
							}
						} else {
							// Final level 6 complete!
							if (!trainingState.isCompleted) {
								trainingManager.completeTraining();
								audioManager?.play('training_complete', '🏆 Disaster Storm Completed!');
								saveSimulationResult('disaster', trainingState.safetyScore, 'EMERGENCY READY');
							}
						}
					}
				}

				// Ambient atmospheric event scheduler (full-rate timer is fine, just audio)
				ambientEventTimer -= delta;
				if (ambientEventTimer <= 0) {
					const cStageNum = currentStageIndex + 1;
					ambientEventTimer = 22.0 + Math.random() * 18.0;
					if (cStageNum <= 3) {
						audioManager?.play('structural_crack');
					} else if (cStageNum === 4) {
						audioManager?.play('gas_leak_hiss');
					} else if (cStageNum === 5) {
						audioManager?.play('electrical_buzz');
					} else if (cStageNum >= 7 && cStageNum <= 8) {
						audioManager?.play('wind_gust');
					} else {
						audioManager?.play('radio_static');
					}
				}
			}

			if (renderer && camera) {
				renderer.render(scene, camera);
			}

			animationId = requestAnimationFrame(tick);
		}

		animationId = requestAnimationFrame(tick);

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === 'KeyE') {
				handleInteract();
			}
		};
		window.addEventListener('keydown', handleKeyDown);

		const handleResize = () => {
			if (!canvasContainer || !renderer || !camera) return;
			const w = Math.max(canvasContainer.clientWidth, 1);
			const h = Math.max(canvasContainer.clientHeight, 1);
			camera.aspect = w / h;
			camera.updateProjectionMatrix();
			renderer.setSize(w, h);
		};
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(canvasContainer);

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('keydown', handleKeyDown);
			resizeObserver.disconnect();
			unsubFeedback();
			unsubCaption();
			unsubscribe();
			audioManager?.dispose();
			visualManager?.dispose();
			environment?.dispose();
			player?.dispose();
			npcManager?.dispose();
			evacuationRoute.dispose();
			interactiveProps?.dispose();
			renderer?.dispose();
			if (canvasContainer && renderer && canvasContainer.contains(renderer.domElement)) {
				canvasContainer.removeChild(renderer.domElement);
			}
			scene.clear();
		};
	});

	// ─── Disaster Interactive Props Registration ─────────────────────────────
	function _registerDisasterProps(props: InteractivePropsManager, env: FloodEnvironment) {
		const elev = env.getElevation;

		// ── Level 1: Earthquake Strike ────────────────────────────────────────
		props.addInteractable({
			id: 'd1_drop_cover_hold',
			title: 'Sturdy Desk — Cover Post',
			actionPrompt: 'DROP, COVER & HOLD ON',
			type: 'station',
			x: -21, y: elev(-21, 1) + 0.1, z: 1,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_drop_cover_hold');
				audioManager?.play('radio_click', 'DROP COVER HOLD ON — correct earthquake response!');
				return { message: 'Executed DROP, COVER & HOLD ON. Protected from falling ceiling tiles and debris.' };
			}
		});
		props.addInteractable({
			id: 'd1_identify_damaged_struct',
			title: 'Damaged Building Wall',
			actionPrompt: 'INSPECT CRACKED WALL',
			type: 'hazard',
			x: -18, y: elev(-18, 3) + 0.1, z: 3,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_identify_damaged_struct');
				trainingManager.identifyHazard(6);
				audioManager?.play('structural_crack', 'Hazard identified: Compromised exterior wall');
				return { message: 'Deep shear cracks along masonry wall. Structure compromised — maintain distance.' };
			}
		});
		props.addInteractable({
			id: 'd1_inspect_aftermath',
			title: 'Collapsed Storefront Rubble',
			actionPrompt: 'INSPECT FALLING HAZARD',
			type: 'hazard',
			x: -19, y: elev(-19, -2) + 0.1, z: -2,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_inspect_aftermath');
				trainingManager.identifyHazard(8);
				audioManager?.play('warning_beep', 'Hazard identified: Collapsed brick facade');
				return { message: 'Inspected collapsed facade. Masonry hazard confirmed — keep clear of fall zone.' };
			}
		});
		props.addInteractable({
			id: 'd1_check_panicked_npc',
			title: 'Panicked Resident — Prashant',
			actionPrompt: 'CHECK ON RESIDENT',
			type: 'action_point',
			x: -23, y: elev(-23, 3) + 0.1, z: 3,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_check_panicked_npc');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Resident calmed — advised to take cover');
				return { message: 'Calmed panicked resident Prashant. Instructed to protect head and neck.' };
			}
		});
		props.addInteractable({
			id: 'd1_opt_help_civilian',
			title: 'Disoriented Neighbor — Ankush',
			actionPrompt: 'ASSIST RESIDENT',
			type: 'action_point',
			x: -20, y: elev(-20, -4) + 0.1, z: -4,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_opt_help_civilian');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Neighbor assisted to safe posture');
				return { message: 'Assisted neighbor Ankush to take cover clear of glass windows.' };
			}
		});
		props.addInteractable({
			id: 'd1_opt_locate_flashlight',
			title: 'Emergency Flashlight — Wall Mount',
			actionPrompt: 'LOCATE FLASHLIGHT',
			type: 'item',
			itemReward: 'flashlight',
			x: -22, y: elev(-22, -2) + 0.1, z: -2,
			stageActive: 1,
			onInteract: () => {
				trainingManager.collectItem('flashlight');
				trainingManager.completeStageObjective('d1_opt_locate_flashlight');
				audioManager?.play('checkpoint', 'Acquired Emergency Flashlight');
				return { message: 'Emergency Flashlight acquired. Essential for power outage navigation.', itemCollected: 'flashlight' };
			}
		});
		props.addInteractable({
			id: 'd1_opt_inspect_equipment',
			title: 'Emergency Equipment Cache',
			actionPrompt: 'INSPECT EQUIPMENT',
			type: 'station',
			x: -24, y: elev(-24, 0) + 0.1, z: 0,
			stageActive: 1,
			onInteract: () => {
				trainingManager.completeStageObjective('d1_opt_inspect_equipment');
				trainingManager.identifyHazard(4);
				audioManager?.play('radio_click', 'Emergency supplies verified');
				return { message: 'Inspected emergency station. First-aid packs and water supplies accounted for.' };
			}
		});

		// ── Level 2: Structural Damage & Fire ─────────────────────────────────
		props.addInteractable({
			id: 'd2_inspect_crack_1',
			title: 'Cracked Structural Column 1',
			actionPrompt: 'INSPECT COLUMN',
			type: 'hazard',
			x: -16, y: elev(-16, 1) + 0.1, z: 1,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_inspect_crack_1');
				trainingManager.identifyHazard(6);
				audioManager?.play('structural_crack', 'Column 1 damaged');
				return { message: 'Column 1: Diagonal load-bearing fissure detected. Do NOT enter building.' };
			}
		});
		props.addInteractable({
			id: 'd2_inspect_crack_2',
			title: 'Fractured Facade Wall 2',
			actionPrompt: 'INSPECT FACADE',
			type: 'hazard',
			x: -14, y: elev(-14, -3) + 0.1, z: -3,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_inspect_crack_2');
				trainingManager.identifyHazard(6);
				audioManager?.play('warning_beep', 'Facade 2 unsafe');
				return { message: 'Facade Wall 2: Sagging lintel and shattered window frames. Perimeter unsafe.' };
			}
		});
		props.addInteractable({
			id: 'd2_inspect_crack_3',
			title: 'Buckled Lintel Overhang 3',
			actionPrompt: 'INSPECT OVERHANG',
			type: 'hazard',
			x: -15, y: elev(-15, 4) + 0.1, z: 4,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_inspect_crack_3');
				trainingManager.identifyHazard(6);
				audioManager?.play('structural_crack', 'Lintel 3 buckled');
				return { message: 'Lintel Overhang 3: Parapet masonry separating. High falling hazard.' };
			}
		});
		props.addInteractable({
			id: 'd2_mark_unsafe',
			title: 'Structural Hazard Warning Barrier',
			actionPrompt: 'MARK UNSAFE BUILDING',
			type: 'sign',
			x: -15, y: elev(-15, -1) + 0.1, z: -1,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_mark_unsafe');
				audioManager?.play('radio_click', 'Unsafe building perimeter marked');
				return { message: 'Marked building perimeter with UNSAFE warning barrier to prevent civilian entry.' };
			}
		});
		props.addInteractable({
			id: 'd2_detect_fire',
			title: 'Secondary Fire Outbreak',
			actionPrompt: 'DETECT FIRE SOURCE',
			type: 'hazard',
			x: -11, y: elev(-11, 4) + 0.1, z: 4,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_detect_fire');
				trainingManager.identifyHazard(8);
				audioManager?.play('warning_beep', 'Secondary electrical fire detected');
				return { message: 'Secondary fire outbreak confirmed! Dense smoke billowing downwind.' };
			}
		});
		props.addInteractable({
			id: 'd2_warn_civilians',
			title: 'Nearby Civilians — Manvi & Shivani',
			actionPrompt: 'WARN CIVILIANS',
			type: 'action_point',
			x: -12, y: elev(-12, 0) + 0.1, z: 0,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_warn_civilians');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('radio_click', 'Civilians warned of secondary fire');
				return { message: 'Warned residents Manvi and Shivani about the spreading smoke and fire hazard.' };
			}
		});
		props.addInteractable({
			id: 'd2_move_civilians_fire',
			title: 'Upwind Safety Post',
			actionPrompt: 'MOVE CIVILIANS UPWIND',
			type: 'station',
			x: -9, y: elev(-9, 4) + 0.1, z: 4,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_move_civilians_fire');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Civilians moved upwind away from fire');
				return { message: 'Guided civilians upwind away from toxic smoke. Safe position established.' };
			}
		});
		props.addInteractable({
			id: 'd2_first_aid',
			title: 'First Aid Kit — Lockbox',
			actionPrompt: 'COLLECT FIRST AID',
			type: 'item',
			itemReward: 'firstAid',
			x: -13, y: elev(-13, -4) + 0.1, z: -4,
			stageActive: 2,
			onInteract: () => {
				trainingManager.collectItem('firstAid');
				trainingManager.completeStageObjective('d2_first_aid');
				audioManager?.play('checkpoint', 'Acquired First Aid Kit');
				return { message: 'First Aid Kit acquired. Crucial for treating lacerations and burns.', itemCollected: 'firstAid' };
			}
		});
		props.addInteractable({
			id: 'd2_help_another_npc',
			title: 'Resident Hasan — Near Alley',
			actionPrompt: 'HELP RESIDENT',
			type: 'action_point',
			x: -11, y: elev(-11, -2) + 0.1, z: -2,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_help_another_npc');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Hasan warned to evacuate');
				return { message: 'Helped resident Hasan navigate safely around the smoke plume.' };
			}
		});
		props.addInteractable({
			id: 'd2_inspect_crack_extra',
			title: 'Severed Power Line Post',
			actionPrompt: 'INSPECT HAZARD',
			type: 'hazard',
			x: -13, y: elev(-13, 2) + 0.1, z: 2,
			stageActive: 2,
			onInteract: () => {
				trainingManager.completeStageObjective('d2_inspect_crack_extra');
				trainingManager.identifyHazard(6);
				audioManager?.play('structural_crack', 'Severed line hazard identified');
				return { message: 'Severed line sparking near building eaves. Stayed 10m clear.' };
			}
		});

		// ── Level 3: Gas Leak & Power Failure ─────────────────────────────────
		props.addInteractable({
			id: 'd3_locate_gas_leak',
			title: 'Ruptured Gas Main Distribution Valve',
			actionPrompt: 'LOCATE GAS LEAK',
			type: 'hazard',
			x: -5, y: elev(-5, 0) + 0.1, z: 0,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_locate_gas_leak');
				trainingManager.identifyHazard(10);
				audioManager?.play('gas_leak_hiss', 'Gas valve located — high pressure leak confirmed');
				return { message: 'Gas leak source confirmed! Pungent odor and loud hiss. Evacuate 50m upwind.' };
			}
		});
		props.addInteractable({
			id: 'd3_warn_residents',
			title: 'Residents Near Gas Cloud',
			actionPrompt: 'WARN: NO SPARKS / PHONES',
			type: 'action_point',
			x: -4, y: elev(-4, 2) + 0.1, z: 2,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_warn_residents');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('warning_beep', 'Residents warned: NO sparks, NO phone calls');
				return { message: 'Warned residents: NO sparks, NO lighters, NO mobile phone switches near gas cloud.' };
			}
		});
		props.addInteractable({
			id: 'd3_prevent_approach',
			title: 'Gas Danger Exclusion Barrier',
			actionPrompt: 'PREVENT APPROACH',
			type: 'sign',
			x: -5, y: elev(-5, -2) + 0.1, z: -2,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_prevent_approach');
				audioManager?.play('radio_click', 'Gas barrier set up');
				return { message: 'Positioned exclusion barrier to stop civilians from walking toward the gas cloud.' };
			}
		});
		props.addInteractable({
			id: 'd3_find_flashlight',
			title: 'Emergency Flashlight — Cache Box',
			actionPrompt: 'COLLECT FLASHLIGHT',
			type: 'item',
			itemReward: 'flashlight',
			x: -3, y: elev(-3, -3) + 0.1, z: -3,
			stageActive: 3,
			onInteract: () => {
				trainingManager.collectItem('flashlight');
				trainingManager.completeStageObjective('d3_find_flashlight');
				audioManager?.play('checkpoint', 'Flashlight acquired');
				return { message: 'Flashlight equipped! Corridor illuminated through the blackout.', itemCollected: 'flashlight' };
			}
		});
		props.addInteractable({
			id: 'd3_inspect_downed_wire',
			title: 'Downed Power Cable Hazard',
			actionPrompt: 'AVOID DOWNED CABLE',
			type: 'hazard',
			x: 1, y: elev(1, 3) + 0.1, z: 3,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_inspect_downed_wire');
				trainingManager.identifyHazard(8);
				audioManager?.play('warning_beep', 'Downed live cable — stay 10m back');
				return { message: 'Downed power cable identified in dark street. Maintained 10m safety perimeter.' };
			}
		});
		props.addInteractable({
			id: 'd3_guide_civilians_route',
			title: 'Safe Route Guide Beacon',
			actionPrompt: 'GUIDE CIVILIANS',
			type: 'station',
			x: 2, y: elev(2, -1) + 0.1, z: -1,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_guide_civilians_route');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Civilians guided along safe route');
				return { message: 'Guided civilians along the illuminated route toward the substation safe zone.' };
			}
		});
		props.addInteractable({
			id: 'd3_radio',
			title: 'Emergency Radio — Utility Post',
			actionPrompt: 'COLLECT RADIO',
			type: 'item',
			itemReward: 'radio',
			x: 3, y: elev(3, -1) + 0.1, z: -1,
			stageActive: 3,
			onInteract: () => {
				trainingManager.collectItem('radio');
				trainingManager.completeStageObjective('d3_radio');
				audioManager?.play('checkpoint', 'Emergency Radio acquired');
				return { message: 'Emergency Radio acquired. Tuned to emergency dispatch frequency.', itemCollected: 'radio' };
			}
		});
		props.addInteractable({
			id: 'd3_assist_resident',
			title: 'Stranded Resident — Dark Corner',
			actionPrompt: 'ASSIST STRANDED RESIDENT',
			type: 'action_point',
			x: 0, y: elev(0, 4) + 0.1, z: 4,
			stageActive: 3,
			onInteract: () => {
				trainingManager.completeStageObjective('d3_assist_resident');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Stranded resident guided to safety');
				return { message: 'Assisted resident disoriented in the dark toward the illuminated path.' };
			}
		});

		// ── Level 4: Community Rescue ─────────────────────────────────────────
		props.addInteractable({
			id: 'd4_locate_elderly',
			title: 'Elderly Resident — Prashanthi',
			actionPrompt: 'ASSIST ELDERLY RESIDENT',
			type: 'action_point',
			x: 7, y: elev(7, 2) + 0.1, z: 2,
			stageActive: 4,
			onInteract: () => {
				trainingManager.completeStageObjective('d4_locate_elderly');
				trainingManager.completeStageObjective('d4_assist_elderly');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Elderly resident Prashanthi assisted');
				return { message: 'Assisted elderly resident Prashanthi and guided her along safe corridor.' };
			}
		});
		props.addInteractable({
			id: 'd4_locate_injured',
			title: 'Injured Resident — Anurag',
			actionPrompt: 'AID INJURED RESIDENT',
			type: 'action_point',
			x: 9, y: elev(9, 4) + 0.1, z: 4,
			stageActive: 4,
			onInteract: () => {
				trainingManager.completeStageObjective('d4_locate_injured');
				trainingManager.completeStageObjective('d4_assist_injured');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Injured resident Anurag aided');
				return { message: 'Provided first aid to injured resident Anurag and escorted him toward safety.' };
			}
		});
		props.addInteractable({
			id: 'd4_locate_child',
			title: 'Lost Child — Anuj',
			actionPrompt: 'GUIDE LOST CHILD',
			type: 'action_point',
			x: 8, y: elev(8, -3) + 0.1, z: -3,
			stageActive: 4,
			onInteract: () => {
				trainingManager.completeStageObjective('d4_locate_child');
				trainingManager.completeStageObjective('d4_assist_child');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Child Anuj found and guided');
				return { message: 'Found lost child Anuj and escorted him toward the family assembly group.' };
			}
		});
		props.addInteractable({
			id: 'd4_locate_house_civilian',
			title: 'Trapped Resident Inside — Ankush',
			actionPrompt: 'RESCUE TRAPPED RESIDENT',
			type: 'action_point',
			x: -8, y: elev(-8, -12) + 0.1, z: -12,
			stageActive: 4,
			onInteract: () => {
				trainingManager.completeStageObjective('d4_locate_house_civilian');
				trainingManager.completeStageObjective('d4_rescue_house_civilian');
				trainingManager.recordCivilianAssisted();
				if (npcManager) {
					npcManager.assistNpc('npc_anuj');
					const npc = npcManager.getNpcById('npc_anuj');
					if (npc) npc.state = 'safe';
				}
				audioManager?.play('success_chime', '✓ RESCUED trapped resident Ankush!');
				return { message: '✓ RESCUED! Cleared fallen doorway beams and escorted Ankush outside.' };
			}
		});
		props.addInteractable({
			id: 'd4_drinking_water',
			title: 'Drinking Water Cache',
			actionPrompt: 'DISTRIBUTE WATER',
			type: 'item',
			itemReward: 'water',
			x: 6, y: elev(6, 0) + 0.1, z: 0,
			stageActive: 4,
			onInteract: () => {
				trainingManager.collectItem('water');
				trainingManager.completeStageObjective('d4_drinking_water');
				audioManager?.play('checkpoint', 'Distributed water');
				return { message: 'Distributed clean drinking water to exhausted evacuees.', itemCollected: 'water' };
			}
		});
		props.addInteractable({
			id: 'd4_help_additional',
			title: 'Neighbor Gayatri — Near Terrace',
			actionPrompt: 'ASSIST GAYATRI',
			type: 'action_point',
			x: 6, y: elev(6, 5) + 0.1, z: 5,
			stageActive: 4,
			onInteract: () => {
				trainingManager.completeStageObjective('d4_help_additional');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Gayatri assisted');
				return { message: 'Assisted neighbor Gayatri away from unstable terrace overhangs.' };
			}
		});

		// ── Level 5: Large-Scale Evacuation ───────────────────────────────────
		props.addInteractable({
			id: 'd5_locate_group1',
			title: 'Evacuation Group #1',
			actionPrompt: 'ASSIST GROUP #1',
			type: 'action_point',
			x: 15, y: elev(15, 2) + 0.1, z: 2,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_locate_group1');
				trainingManager.completeStageObjective('d5_assist_group1');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Evacuation Group #1 guided');
				return { message: 'Directed civilian group #1 onto the wide open avenue.' };
			}
		});
		props.addInteractable({
			id: 'd5_locate_group2',
			title: 'Evacuation Group #2',
			actionPrompt: 'ASSIST GROUP #2',
			type: 'action_point',
			x: 16, y: elev(16, -3) + 0.1, z: -3,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_locate_group2');
				trainingManager.completeStageObjective('d5_assist_group2');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Evacuation Group #2 guided');
				return { message: 'Guided civilian group #2 away from congested side alley.' };
			}
		});
		props.addInteractable({
			id: 'd5_locate_elderly',
			title: 'Elderly Community Members',
			actionPrompt: 'ASSIST ELDERLY GROUP',
			type: 'action_point',
			x: 17, y: elev(17, 3) + 0.1, z: 3,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_locate_elderly');
				trainingManager.completeStageObjective('d5_assist_elderly');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Elderly residents assisted');
				return { message: 'Assisted elderly residents and paired them with evacuation marshals.' };
			}
		});
		props.addInteractable({
			id: 'd5_locate_family',
			title: 'Families with Children Group',
			actionPrompt: 'GUIDE FAMILY GROUP',
			type: 'action_point',
			x: 18, y: elev(18, -2) + 0.1, z: -2,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_locate_family');
				trainingManager.completeStageObjective('d5_guide_family');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Family group guided');
				return { message: 'Guided families with young children along the protected pathway.' };
			}
		});
		props.addInteractable({
			id: 'd5_identify_fire_hazard',
			title: 'Spreading Fire Embers Hazard',
			actionPrompt: 'IDENTIFY FIRE HAZARD',
			type: 'hazard',
			x: 16, y: elev(16, 5) + 0.1, z: 5,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_identify_fire_hazard');
				trainingManager.identifyHazard(8);
				audioManager?.play('warning_beep', 'Fire embers hazard marked');
				return { message: 'Marked spreading ember danger. Instructed evacuees to stay on windward side.' };
			}
		});
		props.addInteractable({
			id: 'd5_identify_gas_hazard',
			title: 'Auxiliary Gas Riser Hazard',
			actionPrompt: 'IDENTIFY GAS HAZARD',
			type: 'hazard',
			x: 17, y: elev(17, -4) + 0.1, z: -4,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_identify_gas_hazard');
				trainingManager.identifyHazard(8);
				audioManager?.play('warning_beep', 'Auxiliary gas hazard confirmed');
				return { message: 'Auxiliary gas pipe damaged. Rerouted evacuee column away from building edge.' };
			}
		});
		props.addInteractable({
			id: 'd5_account_civilians',
			title: 'Evacuee Headcount Registration Desk',
			actionPrompt: 'ACCOUNT FOR CIVILIANS',
			type: 'station',
			x: 20, y: elev(20, 1) + 0.1, z: 1,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_account_civilians');
				audioManager?.play('radio_click', 'Evacuees registered at triage desk');
				return { message: 'Checked in at district registration desk. Headcount verified for assisted civilians.' };
			}
		});
		props.addInteractable({
			id: 'd5_extra_civilians',
			title: 'Straggler Resident — Open Corner',
			actionPrompt: 'ASSIST STRAGGLER',
			type: 'action_point',
			x: 15, y: elev(15, -4) + 0.1, z: -4,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_extra_civilians');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Straggler resident assisted');
				return { message: 'Guided straggler resident to join the main evacuation column.' };
			}
		});
		props.addInteractable({
			id: 'd5_extra_equipment',
			title: 'Emergency Megaphone & Beacon Cache',
			actionPrompt: 'COLLECT GEAR',
			type: 'item',
			itemReward: 'whistle',
			x: 19, y: elev(19, 3) + 0.1, z: 3,
			stageActive: 5,
			onInteract: () => {
				trainingManager.collectItem('whistle');
				trainingManager.completeStageObjective('d5_extra_equipment');
				audioManager?.play('checkpoint', 'Acquired emergency gear');
				return { message: 'Acquired emergency signaling gear for crowd direction.', itemCollected: 'whistle' };
			}
		});
		props.addInteractable({
			id: 'd5_report_hazards',
			title: 'Incident Hazard Log Post',
			actionPrompt: 'REPORT HAZARDS',
			type: 'station',
			x: 20, y: elev(20, -2) + 0.1, z: -2,
			stageActive: 5,
			onInteract: () => {
				trainingManager.completeStageObjective('d5_report_hazards');
				trainingManager.identifyHazard(6);
				audioManager?.play('radio_click', 'Hazards reported to marshals');
				return { message: 'Reported ember and gas riser hazards to district marshals.' };
			}
		});

		// ── Level 6: Final Emergency Response ─────────────────────────────────
		props.addInteractable({
			id: 'd6_inspect_status_board',
			title: 'Emergency Status Board',
			actionPrompt: 'INSPECT STATUS BOARD',
			type: 'station',
			x: 26, y: elev(26, 1) + 0.1, z: 1,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_inspect_status_board');
				audioManager?.play('radio_click', 'Status board inspected');
				return { message: 'Inspected Emergency Status Board: District evacuation underway, 1 citizen unaccounted for.' };
			}
		});
		props.addInteractable({
			id: 'd6_check_civilian_count',
			title: 'Civilian Headcount Terminal',
			actionPrompt: 'CHECK CIVILIAN COUNT',
			type: 'station',
			x: 27, y: elev(27, 2) + 0.1, z: 2,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_check_civilian_count');
				audioManager?.play('radio_click', 'Headcount terminal checked');
				return { message: 'Checked civilian count: 7 accounted for at summit. Missing resident logged at perimeter.' };
			}
		});
		props.addInteractable({
			id: 'd6_identify_missing_civilian',
			title: 'Missing Person Alert — Shruti',
			actionPrompt: 'IDENTIFY MISSING CIVILIAN',
			type: 'station',
			x: 26, y: elev(26, -1) + 0.1, z: -1,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_identify_missing_civilian');
				audioManager?.play('warning_beep', 'Missing civilian identified: Shruti near perimeter');
				return { message: 'Identified missing civilian Shruti! Last seen near lower perimeter coordinates (x: 22, z: 3).' };
			}
		});
		props.addInteractable({
			id: 'd6_rescue_missing_civilian',
			title: 'Missing Resident — Shruti',
			actionPrompt: 'RESCUE SHRUTI',
			type: 'action_point',
			x: 22, y: elev(22, 3) + 0.1, z: 3,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_rescue_missing_civilian');
				trainingManager.recordCivilianAssisted();
				audioManager?.play('success_chime', 'Shruti rescued from perimeter!');
				return { message: 'Rescued missing resident Shruti! Escorting her back to the emergency response center.' };
			}
		});
		props.addInteractable({
			id: 'd6_report_remaining_hazards',
			title: 'Hazard Dispatch Terminal',
			actionPrompt: 'REPORT HAZARDS',
			type: 'station',
			x: 28, y: elev(28, -1) + 0.1, z: -1,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_report_remaining_hazards');
				trainingManager.identifyHazard(8);
				audioManager?.play('radio_click', 'Remaining hazards logged');
				return { message: 'Filed report on remaining perimeter gas and wire hazards for municipal repair teams.' };
			}
		});
		props.addInteractable({
			id: 'd6_confirm_accountability',
			title: 'Operations Desk — Civilian Accountability Manifest',
			actionPrompt: 'CONFIRM ACCOUNTABILITY',
			type: 'station',
			x: 29, y: elev(29, 1) + 0.1, z: 1,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_confirm_accountability');
				audioManager?.play('success_chime', '100% civilian accountability confirmed');
				return { message: 'Civilian accountability manifest finalized: 100% of neighborhood residents accounted for!' };
			}
		});
		props.addInteractable({
			id: 'd6_confirm_area_secure',
			title: 'Emergency Operations Security Terminal',
			actionPrompt: 'CONFIRM AREA SECURE',
			type: 'station',
			x: 29, y: elev(29, -2) + 0.1, z: -2,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_confirm_area_secure');
				audioManager?.play('success_chime', 'Emergency area confirmed secure');
				return { message: 'Emergency response operations secured! Training objectives fully accomplished.' };
			}
		});
		props.addInteractable({
			id: 'd6_verify_manifest',
			title: 'District Evacuee Registry Log',
			actionPrompt: 'VERIFY REGISTRY LOG',
			type: 'sign',
			x: 28, y: elev(28, 3) + 0.1, z: 3,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_verify_manifest');
				audioManager?.play('radio_click', 'Evacuee manifest cross-verified');
				return { message: 'Registry log cross-checked with all triage marshals. Zero discrepancies.' };
			}
		});
		props.addInteractable({
			id: 'd6_final_lookout',
			title: 'Summit Lookout — Regional Hazard Map',
			actionPrompt: 'VERIFY HAZARD MAP',
			type: 'sign',
			x: 30, y: elev(30, 0) + 0.1, z: 0,
			stageActive: 6,
			onInteract: () => {
				trainingManager.completeStageObjective('d6_final_lookout');
				trainingManager.identifyHazard(4);
				audioManager?.play('radio_click', 'Regional hazard map verified at Summit Lookout');
				return { message: 'Regional hazard map verified. Confirmed all district hazard zones are isolated.' };
			}
		});
	}
</script>

<div class="disaster-scene-wrapper">
	<!-- WebGL Canvas -->
	<div bind:this={canvasContainer} class="disaster-canvas" role="region" aria-label="3D Disaster Simulation"></div>

	<!-- Floating In-World House Rescue Overlays (Distance-Gated Emergency Badges) -->
	{#if !showStartModal && !trainingState.isCompleted && houseRescueIndicators && houseRescueIndicators.length > 0}
		<div class="house-indicators-layer" aria-hidden="true">
			{#each houseRescueIndicators as ind (ind.npcId)}
				{#if ind.isOnScreen}
					<div
						class="house-marker-anchor"
						style:left="{ind.screenX}px"
						style:top="{ind.screenY}px"
					>
						{#if ind.distance > 22}
							<!-- Distance Tier 1: Far Away Beacon -->
							<div class="beacon-pill far" class:rescued={ind.rescueState === 'rescued'}>
								<span class="beacon-pulse-dot"></span>
								<span class="beacon-icon">{ind.rescueState === 'rescued' ? '✓' : '⚠'}</span>
								<span class="beacon-dist">{Math.round(ind.distance)}m</span>
							</div>
						{:else if ind.distance > 9}
							<!-- Distance Tier 2: Medium Distance Badge -->
							<div
								class="beacon-pill medium"
								class:in-progress={ind.rescueState === 'rescue_in_progress'}
								class:rescued={ind.rescueState === 'rescued'}
							>
								<div class="beacon-badge-row">
									<span class="beacon-pulse-dot"></span>
									<span class="beacon-label">
										{#if ind.rescueState === 'rescued'}✓ RESCUED
										{:else if ind.rescueState === 'rescue_in_progress'}🚨 RESCUE IN PROGRESS
										{:else}⚠ PERSON INSIDE
										{/if}
									</span>
									<span class="beacon-dist">{Math.round(ind.distance)}m</span>
								</div>
								<div class="beacon-house-name">{ind.houseLabel}</div>
							</div>
						{:else}
							<!-- Distance Tier 3: Close to Building Tactical Card -->
							<div
								class="beacon-card close"
								class:in-progress={ind.rescueState === 'rescue_in_progress'}
								class:rescued={ind.rescueState === 'rescued'}
							>
								<div class="bcard-header">
									<span class="bcard-icon">
										{#if ind.rescueState === 'rescued'}✓
										{:else if ind.rescueState === 'rescue_in_progress'}🚨
										{:else}⚠️
										{/if}
									</span>
									<span class="bcard-title">
										{#if ind.rescueState === 'rescued'}PERSON RESCUED
										{:else if ind.rescueState === 'rescue_in_progress'}RESCUE IN PROGRESS
										{:else}PERSON INSIDE
										{/if}
									</span>
								</div>
								{#if ind.rescueState === 'needs_help'}
									<div class="bcard-sub">NEEDS ASSISTANCE</div>
									<div class="bcard-resident">Resident: <strong>{ind.npcName}</strong></div>
									<div class="bcard-action">[ ENTER BUILDING &amp; RESCUE ] <span class="key-tag">(Press E)</span></div>
								{:else if ind.rescueState === 'rescue_in_progress'}
									<div class="bcard-sub in-progress">Escorting <strong>{ind.npcName}</strong></div>
									<div class="bcard-action in-progress">Lead to Safe Corridor!</div>
								{:else}
									<div class="bcard-sub safe"><strong>{ind.npcName}</strong> is safe!</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Disaster Storm Start Screen Modal (Displays First) -->
	{#if showStartModal}
		<DisasterStart onStart={handleStartTraining} onExit={onExitToMenu} />
	{/if}

	{#if !showStartModal}
		<!-- Top Training Command Bar: Clock, Decision Timer, Stage Pill, Pause & Assess -->
		<header class="top-training-bar">
		<button type="button" class="menu-back-btn" onclick={onExitToMenu}>
			◂ Mode Menu
		</button>

		<div class="training-clock-pill">
			<span class="clock-icon">⏱️</span>
			<span class="clock-lbl">TRAINING TIME:</span>
			<span class="clock-time">{formatTime(trainingState.timeSurvived)}</span>
		</div>

		{#if trainingState.isDecisionTimerActive}
			<div class="decision-clock-pill" class:urgent={trainingState.decisionTimeRemaining <= 6}>
				<span>⏳</span>
				<span>DECISION: {trainingState.decisionTimeRemaining}s</span>
			</div>
		{/if}

		<div class="stage-pill-box">
			<span class="stage-tag">DISASTER STORM</span>
			<span class="stage-pill-num">LEVEL {currentStage.stageNumber} / 6</span>
			<span class="stage-pill-title">{currentStage.shortTitle.toUpperCase()}</span>
		</div>

		<button type="button" class="btn-pause-assess" onclick={handleOpenPauseAssess} aria-label="Pause and Assess Situation">
			<span class="pause-icon">⏸️</span>
			<span>PAUSE &amp; ASSESS</span>
		</button>
	</header>

	<!-- Pause & Assess Modal -->
	{#if showPauseAssessModal}
		<PauseAssessModal
			stageNumber={currentStage.stageNumber}
			stageTitle={currentStage.shortTitle}
			immediateDanger={stageAssessments[currentStage.stageNumber]?.danger}
			safestDirection={stageAssessments[currentStage.stageNumber]?.direction}
			whoNeedsHelp={stageAssessments[currentStage.stageNumber]?.help}
			whatToAvoid={stageAssessments[currentStage.stageNumber]?.avoid}
			onContinue={handleClosePauseAssess}
		/>
	{/if}

	<!-- Active Training Decision Modal -->
	{#if trainingState.activeEvent}
		<TrainingDecision
			event={trainingState.activeEvent}
			lastRecord={trainingState.lastDecisionRecord}
			onChoose={handleDecisionChoice}
			onContinue={handleDecisionContinue}
		/>
	{/if}

	<!-- Checkpoint Prompt Modal -->
	{#if showCheckpointModal}
		<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cp-modal-title">
			<div class="checkpoint-modal-card">
				<div class="cp-modal-badge">SAVED DISASTER CHECKPOINT</div>
				<h3 id="cp-modal-title" class="cp-modal-title">Resume Disaster Storm?</h3>
				<p class="cp-modal-desc">
					You previously reached <strong>Checkpoint {trainingState.checkpointStage}</strong> in this scenario.
					Would you like to resume your progress or start fresh from Stage 1?
				</p>
				<div class="cp-modal-actions">
					<button type="button" class="btn-secondary" onclick={executeFullReset}>
						Restart from Beginning
					</button>
					<button type="button" class="btn-primary" onclick={() => handleResumeCheckpoint(trainingState.checkpointStage)}>
						Resume Checkpoint {trainingState.checkpointStage}
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Inter-Level Completion Modal (Levels 1 to 5) -->
	{#if completedLevelData}
		<LevelCompleteModal
			levelNumber={completedLevelData.levelNumber}
			levelName={completedLevelData.levelName}
			primaryCompleted={completedLevelData.primaryCompleted}
			primaryTotal={completedLevelData.primaryTotal}
			optionalCompleted={completedLevelData.optionalCompleted}
			optionalTotal={completedLevelData.optionalTotal}
			civiliansHelped={completedLevelData.civiliansHelped}
			hazardsIdentified={completedLevelData.hazardsIdentified}
			safetyLesson={completedLevelData.safetyLesson}
			nextLevelNumber={completedLevelData.nextLevelNumber}
			onContinue={handleContinueNextLevel}
			onSelectLevel={(lvl) => handleSelectLevel(lvl)}
		/>
	{/if}

	<!-- Disaster Completion Assessment Report -->
	{#if trainingState.isCompleted && !showScenarioReview}
		<DisasterComplete
			trainingResult={trainingState}
			onRestart={handleResetClick}
			onReviewScenarios={() => (showScenarioReview = true)}
		/>
	{/if}


	<!-- Checkpoint Toast -->
	{#if checkpointNotice}
		<div class="checkpoint-toast" role="status">
			<span class="cp-icon">💾</span>
			<span class="cp-text">{checkpointNotice}</span>
		</div>
	{/if}

	<!-- Mission Banner Toast -->
	{#if missionSuccessBanner}
		<div class="banner-toast" role="status">
			<span class="banner-icon">✓</span>
			<span class="banner-text">{missionSuccessBanner}</span>
		</div>
	{/if}

	<!-- Cascading Warning Indicator -->
	{#if trainingState.cascading?.structuralRisk && currentStageIndex === 5}
		<div class="cascading-alert-banner" role="alert">
			<span class="alert-icon">⚠️</span>
			<span><strong>CASCADING HAZARD:</strong> You entered compromised structures earlier. Aftershock collapse risk elevated!</span>
		</div>
	{/if}

	<!-- Left Side Column: Stage Brief, Objectives, Inventory & Cascading Sequence -->
	<aside class="left-hud-column">
		<!-- Unified Left HUD Card -->
		<div class="hud-card stage-brief-card">
			<div class="card-badge">
				<span class="live-dot"></span>
				LEVEL {currentStage.stageNumber} / 6
			</div>
			<h2 class="card-title">{currentStage.title}</h2>
			<p class="mission-desc">{currentStage.instructions}</p>

			<!-- Hazard Badge -->
			<div class="hazard-tag-badge">
				{currentStage.warningBadge}
			</div>

			<!-- Nearby House Rescue Directive Callout -->
			{#if houseRescueIndicators?.some((h) => h.distance < 18 && h.rescueState === 'needs_help')}
				{@const nearHouse = houseRescueIndicators.find((h) => h.distance < 18 && h.rescueState === 'needs_help')}
				{#if nearHouse}
					<div class="house-rescue-directive-box" role="status">
						<div class="hrd-header">
							<span class="hrd-badge">🚨 PERSON INSIDE</span>
							<span class="hrd-dist">{Math.round(nearHouse.distance)}m away</span>
						</div>
						<div class="hrd-title">{nearHouse.houseLabel}</div>
						<div class="hrd-resident">Resident: <strong>{nearHouse.npcName}</strong></div>
						<div class="hrd-desc">Occupant trapped inside damaged structure. Immediate assistance needed!</div>
						<ul class="hrd-steps">
							<li>→ Approach marked building</li>
							<li>→ Locate resident inside</li>
							<li>→ Press <strong>[E]</strong> to assist &amp; escort to safety</li>
						</ul>
					</div>
				{/if}
			{/if}

			<!-- Stage Objectives Checklist Dropdown (Primary & Optional) -->
			{#if trainingState.stageObjectives && trainingState.stageObjectives.length > 0}
				<details class="stage-objectives-card stage-objectives-dropdown" open>
					<summary class="objectives-header objectives-summary">
						<div class="obj-header-left">
							<span class="obj-arrow">▾</span>
							<span class="obj-header-title">📋 STAGE OBJECTIVES</span>
						</div>
						<span class="obj-header-count">
							{trainingState.stageObjectives.filter((o) => !o.isOptional && o.completed).length} / {trainingState.stageObjectives.filter((o) => !o.isOptional).length}
						</span>
					</summary>
					<div class="objectives-list">
						{#each trainingState.stageObjectives as obj}
							<div class="objective-row" class:completed={obj.completed} class:optional={obj.isOptional}>
								<span class="obj-checkbox">{obj.completed ? '✓' : obj.isOptional ? '○' : '□'}</span>
								<span class="obj-label">
									{#if obj.isOptional}
										<span class="optional-tag">[OPTIONAL]</span>
									{/if}
									{obj.text}
								</span>
							</div>
						{/each}
					</div>
				</details>
			{/if}


			<!-- Collapsible Cascading Sequence Flow -->
			<details class="collapsible-section">
				<summary class="collapsible-summary">
					<span class="summary-label">⚡ Cascading Sequence</span>
					<span class="summary-badge">LEVEL {currentStage.stageNumber} / 6</span>
				</summary>
				<div class="stage-milestones-scroll">
					{#each DISASTER_STAGE_DEFINITIONS as stg}
						<button
							type="button"
							class="stage-milestone-item milestone-btn"
							class:done={currentStageIndex + 1 > stg.stageNumber}
							class:active={currentStageIndex + 1 === stg.stageNumber}
							onclick={() => handleSelectLevel(stg.stageNumber)}
							title="Jump to Level {stg.stageNumber}: {stg.shortTitle}"
						>
							<span class="stage-num">{stg.stageNumber}</span>
							<div class="stage-content">
								<div class="stage-top-line">
									<span class="stage-label">{stg.shortTitle}</span>
									{#if stg.checkpointNum}
										<span class="stage-cp-badge">CP {stg.checkpointNum}</span>
									{/if}
								</div>
								<span class="stage-sub">{stg.objective}</span>
							</div>
						</button>
					{/each}
				</div>
			</details>
		</div>
	</aside>

	<!-- Right Side Column: Telemetry & Safety Score -->
	<aside class="right-hud-column">
		<div class="hud-card score-hud-box">
			<div class="score-hud-header">
				<span class="score-hud-title">Safety Score</span>
				<span class="score-hud-val" class:low={trainingState.safetyScore < 70}>{trainingState.safetyScore}/100</span>
			</div>
			<div class="score-hud-track">
				<div
					class="score-hud-fill"
					style:width="{trainingState.safetyScore}%"
					class:low={trainingState.safetyScore < 70}
				></div>
			</div>
			<div class="score-hud-stats">
				<span>Decisions: <strong>{trainingState.decisionsCorrect}/{trainingState.decisionsTotal}</strong></span>
				<span>People Assisted: <strong>{trainingState.civiliansAssisted}</strong></span>
			</div>
		</div>

		<!-- Proximity NPC Prompt -->
		{#if promptedCivilian}
			<div class="hud-card npc-prompt-box">
				<div class="npc-prompt-header">
					<span class="npc-prompt-name">{promptedCivilian.name}</span>
					<span class="npc-prompt-role">{promptedCivilian.role}</span>
				</div>
				<p class="npc-prompt-dialogue">"{promptedCivilian.helpDialogue}"</p>
				<button type="button" class="btn-assist" onclick={() => handleAssistCivilian(promptedCivilian!.id)}>
					[ E ] Assist Evacuation
				</button>
			</div>
		{/if}
	</aside>



	<!-- Live Audio Caption Bar (Accessibility) -->
	{#if liveCaption}
		<div class="live-caption-bar" role="status" aria-live="polite">
			<span class="caption-icon">{liveCaption.icon}</span>
			<span class="caption-label">[{liveCaption.priority}]</span>
			<span class="caption-text">{liveCaption.text}</span>
		</div>
	{/if}

	<!-- Bottom Right: Simulation Controls -->
	<aside class="hud-card bottom-right-card">
		<!-- Compact Settings Toggle Pill -->
		<div class="settings-bar">
			<button
				type="button"
				class="settings-pill"
				class:open={showSettingsPanel}
				onclick={() => (showSettingsPanel = !showSettingsPanel)}
				aria-expanded={showSettingsPanel}
			>
				<span class="settings-gear">⚙</span>
				<span class="settings-label">Controls</span>
				<span class="settings-chevron">{showSettingsPanel ? '▴' : '▾'}</span>
			</button>
		</div>

		<!-- Expandable Settings Panel -->
		{#if showSettingsPanel}
			<div class="settings-panel" role="region" aria-label="Simulation Settings">
				<div class="settings-section">
					<div class="section-label">🎮 Actions</div>
					<div class="action-row">
						<button type="button" class="action-btn" onclick={handleResetClick}>
							↺ Reset
						</button>
						<button
							type="button"
							class="action-btn"
							class:active={!isAudioMuted}
							onclick={handleToggleAudio}
						>
							{isAudioMuted ? '🔇 Muted' : '🔊 Audio'}
						</button>
						<button
							type="button"
							class="action-btn"
							class:active={showVolumePanel}
							onclick={() => (showVolumePanel = !showVolumePanel)}
						>
							🎚 Volume
						</button>
					</div>
				</div>

				<!-- Volume Sliders (inline within panel) -->
				{#if showVolumePanel}
					<div class="settings-divider"></div>
					<div class="settings-section">
						<div class="section-label">🎚 Sound Channels</div>
						<div class="vol-slider-group">
							<div class="vol-row">
								<span class="vol-name">Master</span>
								<span class="vol-num">{volumeSettings.master}%</span>
							</div>
							<input type="range" min="0" max="100" value={volumeSettings.master}
								oninput={(e) => handleVolumeChange('master', +(e.target as HTMLInputElement).value)}
								class="vol-slider" />
						</div>
						<div class="vol-slider-group">
							<div class="vol-row">
								<span class="vol-name">Environment Ambience</span>
								<span class="vol-num">{volumeSettings.water}%</span>
							</div>
							<input type="range" min="0" max="100" value={volumeSettings.water}
								oninput={(e) => handleVolumeChange('water', +(e.target as HTMLInputElement).value)}
								class="vol-slider" />
						</div>
						<div class="vol-slider-group">
							<div class="vol-row">
								<span class="vol-name">Emergency Alerts</span>
								<span class="vol-num">{volumeSettings.alerts}%</span>
							</div>
							<input type="range" min="0" max="100" value={volumeSettings.alerts}
								oninput={(e) => handleVolumeChange('alerts', +(e.target as HTMLInputElement).value)}
								class="vol-slider" />
						</div>
						<div class="vol-slider-group">
							<div class="vol-row">
								<span class="vol-name">UI & Feedback</span>
								<span class="vol-num">{volumeSettings.ui}%</span>
							</div>
							<input type="range" min="0" max="100" value={volumeSettings.ui}
								oninput={(e) => handleVolumeChange('ui', +(e.target as HTMLInputElement).value)}
								class="vol-slider" />
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<div class="movement-hints">
			<span class="key-badge">W</span>
			<span class="key-badge">A</span>
			<span class="key-badge">S</span>
			<span class="key-badge">D</span>
			<span class="key-badge">E</span>
			<span class="hint-text">Move • <strong>E</strong> Assist • <strong>Mouse Drag</strong> Rotate</span>
		</div>
	</aside>
	{/if}
</div>

<style>
	.disaster-scene-wrapper {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #94a3b8;
		user-select: none;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	.disaster-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		outline: none;
	}

	.disaster-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	.top-training-bar {
		position: absolute;
		top: 1.2rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 25;
		display: flex;
		align-items: center;
		gap: 0.8rem;
		background: rgba(255, 255, 255, 0.96);
		backdrop-filter: blur(14px);
		border: 1px solid rgba(245, 158, 11, 0.35);
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
		pointer-events: auto;
	}

	.training-clock-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: #f0f9ff;
		border: 1px solid rgba(2, 132, 199, 0.25);
		border-radius: 999px;
		padding: 0.28rem 0.75rem;
	}

	.clock-icon { font-size: 0.85rem; }
	.clock-lbl {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #64748b;
	}
	.clock-time {
		font-size: 0.88rem;
		font-weight: 800;
		color: #0f172a;
		font-variant-numeric: tabular-nums;
	}

	.decision-clock-pill {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		background: rgba(251, 191, 36, 0.2);
		border: 1.5px solid #f59e0b;
		border-radius: 999px;
		padding: 0.28rem 0.85rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: #fbbf24;
		animation: pulse-border 1s ease-in-out infinite;
	}

	.decision-clock-pill.urgent {
		background: rgba(220, 38, 38, 0.2);
		border-color: #ef4444;
		color: #fca5a5;
	}

	.stage-pill-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-left: auto;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 0.28rem 0.75rem;
	}

	.stage-tag {
		font-size: 0.62rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #b45309;
		text-transform: uppercase;
	}

	.stage-pill-num {
		font-size: 0.72rem;
		font-weight: 700;
		color: #334155;
	}

	.stage-pill-title {
		font-size: 0.72rem;
		font-weight: 600;
		color: #64748b;
	}

	.btn-pause-assess {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.38rem 0.95rem;
		border-radius: 999px;
		background: rgba(239, 68, 68, 0.15);
		border: 1.5px solid rgba(239, 68, 68, 0.5);
		color: #fca5a5;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-pause-assess:hover {
		background: rgba(239, 68, 68, 0.3);
		border-color: #ef4444;
		color: #fff;
	}

	.pause-icon { font-size: 0.85rem; }

	@keyframes pulse-border {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.live-caption-bar {
		position: absolute;
		bottom: 7.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid rgba(2, 132, 199, 0.2);
		border-radius: 8px;
		padding: 0.45rem 1.1rem;
		max-width: 680px;
		animation: fadeInUp 0.25s ease;
		box-shadow: 0 4px 14px rgba(0,0,0,0.08);
	}

	.caption-icon { font-size: 0.9rem; color: #64748b; }
	.caption-label {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #64748b;
		white-space: nowrap;
	}
	.caption-text {
		font-size: 0.8rem;
		color: #1e293b;
		line-height: 1.35;
	}

	@keyframes fadeInUp {
		from { opacity: 0; transform: translateX(-50%) translateY(6px); }
		to { opacity: 1; transform: translateX(-50%) translateY(0); }
	}

	.scene-top-bar {
		position: absolute;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 1.2rem;
		padding: 0.55rem 1.1rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 25px rgba(15, 23, 42, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.8);
	}

	.menu-back-btn {
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		color: #1e293b;
		padding: 0.35rem 0.85rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.menu-back-btn:hover {
		background: #e2e8f0;
		color: #0f172a;
		border-color: #94a3b8;
	}

	.scenario-pill {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8rem;
		font-weight: 800;
		color: #b45309;
		letter-spacing: 0.05em;
	}

	.pill-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #d97706;
		box-shadow: 0 0 6px #d97706;
		animation: pulseDot 2s infinite ease-in-out;
	}

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}

	/* Non-overlapping Column Containers */
	.left-hud-column {
		position: absolute;
		top: 3.6rem;
		left: 1.25rem;
		width: 22.5rem;
		max-height: calc(100vh - 4.6rem);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		overflow-y: auto;
		overflow-x: hidden;
		padding-right: 4px;
		pointer-events: none;
		z-index: 15;
	}

	.right-hud-column {
		position: absolute;
		top: 3.6rem;
		right: 1.25rem;
		width: 17.5rem;
		max-height: calc(100vh - 11rem);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		overflow-y: auto;
		overflow-x: hidden;
		padding-right: 4px;
		pointer-events: none;
		z-index: 15;
	}

	.left-hud-column > *,
	.right-hud-column > * {
		pointer-events: auto;
	}

	.left-hud-column::-webkit-scrollbar,
	.right-hud-column::-webkit-scrollbar {
		width: 4px;
	}

	.left-hud-column::-webkit-scrollbar-thumb,
	.right-hud-column::-webkit-scrollbar-thumb {
		background: rgba(148, 163, 184, 0.5);
		border-radius: 4px;
	}

	.hud-card {
		position: relative;
		z-index: 10;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(15, 30, 45, 0.12);
		color: #1e293b;
		padding: 0.85rem 1.1rem;
		pointer-events: auto;
	}

	.card-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #b45309;
		background: #fef3c7;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		margin-bottom: 0.5rem;
	}

	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #d97706;
		box-shadow: 0 0 6px #d97706;
	}

	.card-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.01em;
	}

	.mission-desc {
		margin: 0.4rem 0 0.6rem;
		font-size: 0.88rem;
		line-height: 1.4;
		color: #475569;
	}

	.hazard-tag-badge {
		display: inline-block;
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		padding: 0.3rem 0.75rem;
		border-radius: 8px;
		background: #fee2e2;
		color: #b91c1c;
		border: 1px solid #fecaca;
		margin-bottom: 0.8rem;
	}

	.stage-milestones-box {
		border-top: 1px solid #e2e8f0;
		padding-top: 0.65rem;
	}

	.stage-milestones-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: #64748b;
		margin-bottom: 0.45rem;
	}

	.stage-progress-count {
		color: #d97706;
	}

	.stage-milestones-scroll {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 185px;
		overflow-y: auto;
		padding-right: 0.25rem;
	}

	.stage-milestones-scroll::-webkit-scrollbar {
		width: 4px;
	}

	.stage-milestones-scroll::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 999px;
	}

	.stage-milestone-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.4rem 0.6rem;
		border-radius: 8px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		transition: all 0.2s ease;
	}

	.stage-milestone-item.active {
		background: #fffbeb;
		border-color: #fde68a;
		box-shadow: 0 0 0 1px #fde68a;
	}

	.stage-milestone-item.done {
		background: #f0fdf4;
		border-color: #bbf7d0;
		opacity: 0.85;
	}

	.stage-num {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #cbd5e1;
		color: #334155;
		font-size: 0.7rem;
		font-weight: 800;
		flex-shrink: 0;
	}

	.stage-milestone-item.active .stage-num {
		background: #d97706;
		color: #fff;
	}

	.stage-milestone-item.done .stage-num {
		background: #16a34a;
		color: #fff;
	}

	.stage-content {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.stage-top-line {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
	}

	.stage-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: #1e293b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.stage-cp-badge {
		font-size: 0.62rem;
		font-weight: 800;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
		background: #fef3c7;
		color: #b45309;
		letter-spacing: 0.05em;
	}

	.stage-sub {
		font-size: 0.68rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Stage Objectives Checklist Dropdown Card */
	.stage-objectives-card {
		margin-top: 0.65rem;
		background: #ffffff;
		border: 1px solid rgba(245, 158, 11, 0.35);
		border-radius: 8px;
		padding: 0.55rem 0.65rem;
		transition: all 0.2s ease;
	}

	.objectives-summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.76rem;
		font-weight: 800;
		color: #d97706;
		letter-spacing: 0.05em;
		cursor: pointer;
		list-style: none;
		user-select: none;
	}

	.objectives-summary::-webkit-details-marker {
		display: none;
	}

	.obj-header-left {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.obj-arrow {
		font-size: 0.7rem;
		transition: transform 0.2s ease;
		display: inline-block;
		color: #d97706;
	}

	details:not([open]) .obj-arrow {
		transform: rotate(-90deg);
	}

	details[open] .objectives-summary {
		margin-bottom: 0.5rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid #f1f5f9;
	}

	.obj-header-count {
		font-size: 0.72rem;
		font-weight: 800;
		color: #c2410c;
		background: #ffedd5;
		padding: 0.12rem 0.45rem;
		border-radius: 999px;
	}

	.objectives-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		max-height: 160px;
		overflow-y: auto;
	}

	.objective-row {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		font-size: 0.76rem;
		color: #334155;
		line-height: 1.35;
	}

	.objective-row.completed {
		color: #16a34a;
	}

	.objective-row.completed .obj-checkbox {
		color: #16a34a;
		font-weight: 900;
	}

	.objective-row.optional {
		color: #94a3b8;
	}

	.optional-tag {
		font-size: 0.68rem;
		color: #fbbf24;
		font-weight: 700;
		margin-right: 0.25rem;
	}

	/* Emergency Kit Panel */
	.emergency-kit-panel {
		margin-top: 0.6rem;
		background: #ffffff;
		border: 1px solid rgba(245, 158, 11, 0.35);
		border-radius: 8px;
		padding: 0.55rem;
	}

	.kit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 800;
		color: #f59e0b;
		margin-bottom: 0.4rem;
	}

	.kit-count {
		font-size: 0.72rem;
		color: #cbd5e1;
	}

	.kit-grid {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 0.3rem;
	}

	.kit-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.35rem 0.2rem;
		background: rgba(30, 41, 59, 0.6);
		border: 1px solid rgba(100, 116, 139, 0.3);
		border-radius: 6px;
		opacity: 0.4;
		transition: all 0.2s ease;
	}

	.kit-item.owned {
		opacity: 1;
		background: rgba(245, 158, 11, 0.15);
		border-color: #f59e0b;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.25);
	}

	.kit-icon {
		font-size: 1.1rem;
	}

	.kit-name {
		font-size: 0.6rem;
		font-weight: 700;
		color: #e2e8f0;
		margin-top: 0.15rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Collapsible Cascading Section */
	.collapsible-section {
		border-top: 1px solid #e2e8f0;
		margin-top: 0.65rem;
		padding: 0.6rem 0.2rem 0.2rem;
	}

	.collapsible-summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 0.78rem;
		font-weight: 800;
		color: #334155;
		list-style: none;
		user-select: none;
		cursor: pointer;
	}

	.collapsible-summary::-webkit-details-marker {
		display: none;
	}

	.summary-label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.summary-badge {
		font-size: 0.65rem;
		font-weight: 800;
		color: #b45309;
		background: #fef3c7;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}

	.score-hud-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.65rem 0.8rem;
	}

	.score-hud-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		font-weight: 700;
		color: #475569;
		margin-bottom: 0.35rem;
	}

	.score-hud-val {
		color: #d97706;
		font-size: 0.82rem;
		font-weight: 800;
	}

	.score-hud-val.low { color: #dc2626; }

	.score-hud-track {
		height: 6px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 0.4rem;
	}

	.score-hud-fill {
		height: 100%;
		background: #d97706;
		border-radius: 999px;
		transition: width 0.3s ease;
	}

	.score-hud-fill.low { background: #dc2626; }

	.score-hud-stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: #64748b;
	}

	.npc-prompt-box {
		margin-top: 0.85rem;
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 10px;
		padding: 0.75rem 0.9rem;
	}

	.npc-prompt-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.npc-prompt-name {
		font-size: 0.85rem;
		font-weight: 800;
		color: #1e3a8a;
	}

	.npc-prompt-role {
		font-size: 0.68rem;
		font-weight: 700;
		color: #64748b;
	}

	.npc-prompt-dialogue {
		margin: 0.2rem 0 0.5rem;
		font-size: 0.8rem;
		color: #334155;
		font-style: italic;
	}

	.btn-assist {
		width: 100%;
		padding: 0.4rem;
		border-radius: 8px;
		border: none;
		background: #0284c7;
		color: #ffffff;
		font-size: 0.78rem;
		font-weight: 800;
		cursor: pointer;
	}


	.bottom-right-card {
		position: absolute;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: 20;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(15, 30, 45, 0.1);
	}

	.controls-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.ctrl-btn {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		padding: 0.35rem 0.7rem;
		border-radius: 8px;
		font-size: 0.78rem;
		font-weight: 700;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s;
	}

	.ctrl-btn:hover { background: #f1f5f9; }
	.ctrl-btn.active { background: #d97706; color: #ffffff; border-color: #d97706; }

	.movement-hints {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.key-badge {
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
		padding: 0.15rem 0.4rem;
		font-size: 0.7rem;
		font-weight: 800;
		color: #0f172a;
	}

	.hint-text {
		font-size: 0.74rem;
		color: #64748b;
		margin-left: 0.2rem;
	}


	.checkpoint-toast {
		position: absolute;
		top: 7.4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 49;
		background: #15803d;
		border: 1px solid #86efac;
		color: #ffffff;
		border-radius: 999px;
		padding: 0.4rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		font-weight: 700;
		animation: toastSlideDown 0.25s ease;
	}

	.banner-toast {
		position: absolute;
		top: 4.8rem;
		left: 1.5rem;
		z-index: 40;
		background: #fef3c7;
		border: 1px solid #fde68a;
		color: #92400e;
		border-radius: 12px;
		padding: 0.5rem 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.82rem;
		font-weight: 700;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
	}

	.cascading-alert-banner {
		position: absolute;
		top: 4.8rem;
		right: 1.5rem;
		z-index: 40;
		background: #fee2e2;
		border: 1px solid #fca5a5;
		color: #991b1b;
		border-radius: 12px;
		padding: 0.55rem 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.82rem;
		font-weight: 700;
		box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
		max-width: 22rem;
	}

	@keyframes toastSlideDown {
		from { opacity: 0; transform: translate(-50%, -10px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	/* Modal Backdrop & Checkpoint Card */
	.modal-backdrop {
		position: absolute;
		inset: 0;
		z-index: 60;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.checkpoint-modal-card {
		background: #ffffff;
		border-radius: 20px;
		max-width: 28rem;
		width: 100%;
		padding: 1.8rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.8);
		display: flex;
		flex-direction: column;
		text-align: center;
	}

	.cp-modal-badge {
		display: inline-flex;
		align-self: center;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #b45309;
		background: #fef3c7;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		margin-bottom: 0.7rem;
	}

	.cp-modal-title {
		margin: 0 0 0.5rem;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
	}

	.cp-modal-desc {
		margin: 0 0 1.4rem;
		font-size: 0.9rem;
		color: #475569;
		line-height: 1.5;
	}

	.cp-modal-actions {
		display: flex;
		justify-content: center;
		gap: 0.8rem;
	}

	.btn-secondary {
		padding: 0.65rem 1.2rem;
		border-radius: 10px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #475569;
		font-size: 0.88rem;
		font-weight: 700;
		cursor: pointer;
	}

	.btn-primary {
		padding: 0.65rem 1.4rem;
		border-radius: 10px;
		border: none;
		background: #d97706;
		color: #ffffff;
		font-size: 0.88rem;
		font-weight: 800;
		cursor: pointer;
	}

	/* Volume Panel */
	.volume-panel {
		position: absolute;
		bottom: 5.5rem;
		right: 1.5rem;
		width: 17rem;
		padding: 1.1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		z-index: 25;
		border: 1.5px solid #cbd5e1;
		box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
	}

	.vol-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid #e2e8f0;
		padding-bottom: 0.4rem;
	}

	.vol-title {
		font-size: 0.82rem;
		font-weight: 800;
		color: #1e293b;
	}

	.close-btn-mini {
		background: none;
		border: none;
		font-size: 0.85rem;
		color: #64748b;
		cursor: pointer;
	}

	.vol-slider-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.vol-row {
		display: flex;
		justify-content: space-between;
		font-size: 0.74rem;
		font-weight: 700;
		color: #475569;
	}

	.vol-num {
		color: #d97706;
		font-weight: 800;
	}

	.vol-slider {
		width: 100%;
		accent-color: #d97706;
		cursor: pointer;
		height: 4px;
	}

	@media (max-width: 768px) {
		.top-left-card {
			max-width: 85vw;
		}
		.top-right-card {
			display: none;
		}
	}

	/* ── House Rescue Floating Indicators (Distance-Gated In-World Badges) ── */
	.house-indicators-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 35;
	}

	.house-marker-anchor {
		position: absolute;
		transform: translate(-50%, -100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		pointer-events: none;
		transition: transform 0.05s ease-out;
	}

	/* Far Distance Beacon */
	.beacon-pill.far {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.55rem;
		background: rgba(15, 23, 42, 0.9);
		border: 1.5px solid #f59e0b;
		border-radius: 9999px;
		color: #fef08a;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		box-shadow: 0 0 14px rgba(245, 158, 11, 0.5), 0 4px 10px rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		animation: beacon-float 2.4s ease-in-out infinite alternate;
	}

	.beacon-pill.far.rescued {
		border-color: #22c55e;
		color: #86efac;
		box-shadow: 0 0 14px rgba(34, 197, 94, 0.5);
	}

	/* Medium Distance Badge */
	.beacon-pill.medium {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.4rem 0.75rem;
		background: rgba(15, 23, 42, 0.92);
		border: 1.5px solid #f59e0b;
		border-radius: 10px;
		box-shadow: 0 0 18px rgba(245, 158, 11, 0.45), 0 6px 16px rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(6px);
		animation: beacon-float 2.4s ease-in-out infinite alternate;
	}

	.beacon-pill.medium.in-progress {
		border-color: #38bdf8;
		box-shadow: 0 0 18px rgba(56, 189, 248, 0.5);
	}

	.beacon-pill.medium.rescued {
		border-color: #22c55e;
		box-shadow: 0 0 18px rgba(34, 197, 94, 0.5);
	}

	.beacon-badge-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.beacon-label {
		font-size: 0.82rem;
		font-weight: 900;
		letter-spacing: 0.04em;
		color: #fef08a;
	}

	.beacon-pill.medium.in-progress .beacon-label {
		color: #7dd3fc;
	}

	.beacon-pill.medium.rescued .beacon-label {
		color: #86efac;
	}

	.beacon-dist {
		font-size: 0.75rem;
		font-weight: 700;
		color: #cbd5e1;
		background: rgba(255, 255, 255, 0.12);
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	.beacon-house-name {
		font-size: 0.72rem;
		font-weight: 600;
		color: #94a3b8;
	}

	/* Close Tactical Rescue Card */
	.beacon-card.close {
		width: 250px;
		padding: 0.75rem 0.9rem;
		background: rgba(15, 23, 42, 0.95);
		border: 2px solid #ea580c;
		border-radius: 12px;
		box-shadow: 0 0 24px rgba(234, 88, 12, 0.6), 0 8px 24px rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(8px);
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		animation: beacon-pulse-border 1.8s ease-in-out infinite;
	}

	.beacon-card.close.in-progress {
		border-color: #0284c7;
		box-shadow: 0 0 24px rgba(2, 132, 199, 0.6);
		animation: none;
	}

	.beacon-card.close.rescued {
		border-color: #16a34a;
		box-shadow: 0 0 24px rgba(22, 163, 74, 0.6);
		animation: none;
	}

	.bcard-header {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.bcard-icon {
		font-size: 1.1rem;
	}

	.bcard-title {
		font-size: 0.88rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: #fed7aa;
	}

	.beacon-card.close.in-progress .bcard-title {
		color: #bae6fd;
	}

	.beacon-card.close.rescued .bcard-title {
		color: #bbf7d0;
	}

	.bcard-sub {
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.06em;
		color: #ea580c;
		background: rgba(234, 88, 12, 0.16);
		padding: 0.2rem 0.45rem;
		border-radius: 4px;
		text-align: center;
	}

	.bcard-sub.in-progress {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.16);
	}

	.bcard-sub.safe {
		color: #4ade80;
		background: rgba(74, 222, 128, 0.16);
	}

	.bcard-resident {
		font-size: 0.82rem;
		color: #e2e8f0;
	}

	.bcard-resident strong {
		color: #ffffff;
	}

	.bcard-action {
		font-size: 0.82rem;
		font-weight: 800;
		color: #fbbf24;
		text-align: center;
		padding: 0.35rem 0.5rem;
		background: rgba(251, 191, 36, 0.15);
		border-radius: 6px;
		border: 1px dashed #fbbf24;
		margin-top: 0.15rem;
	}

	.bcard-action.in-progress {
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		border-color: #38bdf8;
	}

	.key-tag {
		color: #f8fafc;
		font-weight: 900;
	}

	.beacon-pulse-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #f59e0b;
		box-shadow: 0 0 8px #f59e0b;
		animation: beacon-dot-pulse 1.2s ease-in-out infinite;
	}

	.beacon-pill.medium.in-progress .beacon-pulse-dot {
		background: #38bdf8;
		box-shadow: 0 0 8px #38bdf8;
	}

	.beacon-pill.far.rescued .beacon-pulse-dot,
	.beacon-pill.medium.rescued .beacon-pulse-dot {
		background: #22c55e;
		box-shadow: 0 0 8px #22c55e;
	}

	@keyframes beacon-dot-pulse {
		0%, 100% { opacity: 0.4; transform: scale(0.85); }
		50% { opacity: 1.0; transform: scale(1.3); }
	}

	@keyframes beacon-float {
		0% { transform: translateY(0px); }
		100% { transform: translateY(-7px); }
	}

	@keyframes beacon-pulse-border {
		0%, 100% { box-shadow: 0 0 16px rgba(234, 88, 12, 0.4), 0 8px 24px rgba(0, 0, 0, 0.75); }
		50% { box-shadow: 0 0 28px rgba(234, 88, 12, 0.8), 0 8px 24px rgba(0, 0, 0, 0.75); }
	}

	/* Nearby House Rescue Directive Box (In left column) */
	.house-rescue-directive-box {
		margin-top: 0.6rem;
		padding: 0.7rem 0.85rem;
		background: linear-gradient(135deg, rgba(234, 88, 12, 0.22), rgba(15, 23, 42, 0.95));
		border: 1.5px solid #ea580c;
		border-radius: 8px;
		box-shadow: 0 0 14px rgba(234, 88, 12, 0.35);
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.hrd-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.hrd-badge {
		font-size: 0.72rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		color: #ea580c;
		background: rgba(234, 88, 12, 0.2);
		padding: 0.15rem 0.4rem;
		border-radius: 4px;
	}

	.hrd-dist {
		font-size: 0.75rem;
		font-weight: 700;
		color: #fdba74;
	}

	.hrd-title {
		font-size: 0.88rem;
		font-weight: 800;
		color: #f8fafc;
	}

	.hrd-resident {
		font-size: 0.8rem;
		color: #e2e8f0;
	}

	.hrd-desc {
		font-size: 0.75rem;
		color: #cbd5e1;
		line-height: 1.3;
	}

	.hrd-steps {
		list-style: none;
		padding: 0;
		margin: 0.2rem 0 0;
		font-size: 0.74rem;
		color: #fed7aa;
		line-height: 1.4;
	}
</style>

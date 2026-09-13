import type { Vector3 } from 'three';
import type { TrainingMomentType, TrainingStateManager } from './trainingState';

export interface StageObjective {
	id: string;
	text: string;
	completed: boolean;
	isOptional: boolean;
	progress?: string;
}

export interface StageDefinition {
	stageNumber: number;
	id: string;
	title: string;
	shortTitle: string;
	objective: string;
	instructions: string;
	waterRiseSpeed: number; // m/s
	checkpointNum?: number; // 1 to 5

	// Enhanced 7-Phase Stage Pacing Model attributes
	momentType: TrainingMomentType;
	observeDuration: number; // Phase A: observe duration in seconds (3-8s)
	situationBrief: string; // Phase B: briefing text
	avoidHazard: string; // Avoid text for HUD
	dangerLevel: number; // 0.0 to 1.0 for dynamic audio
	minActionSeconds: number; // Minimum action/exploration time before advancing
	audioCue?: string;

	// Multi-Objective Gameplay Expansion
	primaryObjectives: StageObjective[];
	optionalObjectives: StageObjective[];
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
	{
		stageNumber: 1,
		id: 'early_warning',
		title: 'LEVEL 1: EMERGENCY ALERT & HOUSEHOLD READINESS',
		shortTitle: 'Alert & Readiness',
		objective: 'Inspect emergency warnings, calibrate water gauge, secure survival pack, and begin uphill evacuation.',
		instructions: 'Read warning boards, inspect map stand, check river gauge, collect survival gear, and complete Go-Bag decision.',
		waterRiseSpeed: 0.005,
		checkpointNum: 1,
		momentType: 'observe',
		observeDuration: 5.0,
		situationBrief:
			'Emergency alert: Torrential rain upstream has triggered a flash flood warning. Lower basin roads are at immediate risk. Prepare survival gear and start moving uphill.',
		avoidHazard: '🌊 Fast-rising water at the riverbank and low ground',
		dangerLevel: 0.2,
		minActionSeconds: 10.0,
		audioCue: 'heavy_rain',
		primaryObjectives: [
			{ id: 's1_warning_board', text: 'Read Emergency Warning Board [E]', completed: false, isOptional: false },
			{ id: 's1_evac_map', text: 'Inspect Evacuation Map Stand [E]', completed: false, isOptional: false },
			{ id: 's1_water_gauge', text: 'Check River Water-Level Marker [E]', completed: false, isOptional: false },
			{ id: 's1_whistle', text: 'Collect Emergency Whistle & Survival Pack [E]', completed: false, isOptional: false },
			{ id: 'stage1_flood_warning', text: 'Complete Go-Bag evacuation decision', completed: false, isOptional: false },
			{ id: 's1_advance_gate', text: 'Advance past residential perimeter toward town (x > -18)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's1_resident_prashant', text: 'Check on neighbor Prashant at basin edge [E]', completed: false, isOptional: true },
			{ id: 's1_bulletin', text: 'Inspect municipal alert bulletin [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 2,
		id: 'community_triage',
		title: 'LEVEL 2: NEIGHBORHOOD TRIAGE & COMMUNITY EVACUATION',
		shortTitle: 'Community Triage',
		objective: 'Alert lower basin neighbors (Prashant, Manvi, Shivani) and resolve priority evacuation order.',
		instructions: 'Visit lower basin houses, consult community leaders, alert stranded residents, and resolve evacuation priorities.',
		waterRiseSpeed: 0.010,
		checkpointNum: 2,
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'Several residents remain unaware of the flash flood advisory. Check in with neighbors, confirm they are packing essential supplies, and coordinate evacuation priority.',
		avoidHazard: '⏳ Evacuation delays and lingering in low structures',
		dangerLevel: 0.35,
		minActionSeconds: 12.0,
		audioCue: 'radio_chatter',
		primaryObjectives: [
			{ id: 's2_check_prashant', text: 'Alert neighbor Prashant in lower basin [E]', completed: false, isOptional: false },
			{ id: 's2_check_manvi', text: 'Consult Community Guide Manvi [E]', completed: false, isOptional: false },
			{ id: 's2_check_shivani', text: 'Alert resident Shivani near lower road [E]', completed: false, isOptional: false },
			{ id: 's2_bulletin', text: 'Inspect town hall emergency bulletin [E]', completed: false, isOptional: false },
			{ id: 'scenario_a_blocked_route', text: 'Resolve priority evacuation & blocked route decision', completed: false, isOptional: false },
			{ id: 's2_reach_trailhead', text: 'Guide neighborhood column to Hillside Trailhead (x > -13)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's2_check_hasan', text: 'Alert resident Hasan at flooded junction [E]', completed: false, isOptional: true },
			{ id: 's2_check_ankush', text: 'Coordinate with Ankush carrying emergency supplies [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 3,
		id: 'route_selection',
		title: 'LEVEL 3: ROUTE SELECTION & INUNDATION CROSSING',
		shortTitle: 'Route Selection',
		objective: 'Scout both paths at the fork, secure first-aid supplies, and navigate uphill around flood runoff.',
		instructions: 'Inspect Route A underpass hazard and Route B hillside trail, acquire medical gear, and choose the safe elevated path.',
		waterRiseSpeed: 0.016,
		checkpointNum: 3,
		momentType: 'decision',
		observeDuration: 4.0,
		situationBrief:
			'The valley road forks ahead. The paved lower road dips under a low bridge; the elevated trail climbs the hillside. Surface runoff is deepening fast.',
		avoidHazard: '🕳️ Low underpasses and flood collection dips',
		dangerLevel: 0.5,
		minActionSeconds: 12.0,
		audioCue: 'wind_gust',
		primaryObjectives: [
			{ id: 's3_inspect_route_a', text: 'Inspect Route A (Low Underpass Hazard) [E]', completed: false, isOptional: false },
			{ id: 's3_inspect_route_b', text: 'Inspect Route B (Elevated Hillside Trail) [E]', completed: false, isOptional: false },
			{ id: 's3_first_aid', text: 'Collect Emergency First Aid Kit at trail [E]', completed: false, isOptional: false },
			{ id: 's3_submerged_sign', text: 'Inspect flooded road warning marker [E]', completed: false, isOptional: false },
			{ id: 'stage3_route_choice', text: 'Resolve evacuation route selection decision', completed: false, isOptional: false },
			{ id: 's3_reach_elevation', text: 'Ascend hillside trail to elevation checkpoint (x > -6, y >= 1.6m)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's3_runoff_caution', text: 'Navigate around pooling flood runoff without wading deep water', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 4,
		id: 'electrical_hazard',
		title: 'LEVEL 4: HIGH-VOLTAGE GRID & INDUSTRIAL DETOUR',
		shortTitle: 'Power Grid Hazard',
		objective: 'Detect sparking transformer & downed live line. Secure flashlight and detour beyond the 10m danger zone.',
		instructions: 'Maintain 10m standoff from energized equipment, inspect utility lines, equip illumination, and assist resident Shruti.',
		waterRiseSpeed: 0.022,
		checkpointNum: 4,
		momentType: 'decision',
		observeDuration: 5.0,
		situationBrief:
			'A high-voltage transformer pole has partially collapsed into standing water. Ground currents create lethal shock perimeters. Detour uphill and assist stranded residents.',
		avoidHazard: '⚡ Energized ground current & downed power lines',
		dangerLevel: 0.7,
		minActionSeconds: 12.0,
		audioCue: 'electrical_buzz',
		primaryObjectives: [
			{ id: 's4_inspect_junction', text: 'Identify damaged electrical junction box [E]', completed: false, isOptional: false },
			{ id: 's4_inspect_downed_line', text: 'Identify downed live cable hazard [E]', completed: false, isOptional: false },
			{ id: 's4_flashlight', text: 'Find heavy-duty flashlight in utility locker [E]', completed: false, isOptional: false },
			{ id: 's4_assist_shruti', text: 'Assist stranded resident Shruti near power line [E]', completed: false, isOptional: false },
			{ id: 'scenario_b_electrical_hazard', text: 'Resolve live high-voltage line in water decision', completed: false, isOptional: false },
			{ id: 's4_detour_clear', text: 'Clear 10m electrical danger perimeter (x > 3)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's4_inspect_light', text: 'Inspect insulated street light pole [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 5,
		id: 'vulnerable_rescue',
		title: 'LEVEL 5: VULNERABLE RESIDENT RESCUE & SURGE',
		shortTitle: 'Vulnerable Rescue',
		objective: 'Locate elderly resident Prashanthi, comfort separated child Anuj, secure drinking water, and outpace surge.',
		instructions: 'Search hillside terraces for vulnerable community members, secure hydration, and lead evacuees up to the plateau.',
		waterRiseSpeed: 0.030,
		checkpointNum: 5,
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'Vulnerable community members are struggling on the slope. Provide guidance and escort them toward the upper safety plateau before the upstream surge wave catches up.',
		avoidHazard: '⚠️ Uneven hillside terrain and rushing surface mud',
		dangerLevel: 0.8,
		minActionSeconds: 14.0,
		audioCue: 'npc_alert',
		primaryObjectives: [
			{ id: 's5_assist_prashanthi', text: 'Locate & assist elderly resident Prashanthi [E]', completed: false, isOptional: false },
			{ id: 's5_assist_anuj', text: 'Locate & guide separated child Anuj [E]', completed: false, isOptional: false },
			{ id: 's5_drinking_water', text: 'Collect emergency purified drinking water [E]', completed: false, isOptional: false },
			{ id: 'scenario_c_building_inundation', text: 'Resolve building inundation & trapped occupant decision', completed: false, isOptional: false },
			{ id: 's5_reach_plateau', text: 'Escort community column up to the Safety Plateau (x >= 18, y >= 4.8m)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's5_help_anurag', text: 'Warn separated resident Anurag along ridge [E]', completed: false, isOptional: true },
			{ id: 's5_check_gayatri', text: 'Assist Gayatri carrying belongings [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 6,
		id: 'summit_command',
		title: 'LEVEL 6: INCIDENT COMMAND & SUMMIT EXTRACTION',
		shortTitle: 'Summit Extraction',
		objective: 'File command logs, coordinate emergency radio, verify roster, and register all evacuees for airlift at Summit Helipad.',
		instructions: 'Update hydrology and hazard logs at Command Center, tune emergency satellite radio, and complete summit helicopter extraction.',
		waterRiseSpeed: 0.015,
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'Final ascent to the Summit Outpost. The Command Center is processing relief logs and helicopter airlift operations are active at the mountain peak.',
		avoidHazard: '🏔️ Steep summit cliffs and rotor wash perimeters',
		dangerLevel: 0.3,
		minActionSeconds: 12.0,
		audioCue: 'training_complete',
		primaryObjectives: [
			{ id: 's6_report_flood', text: 'Report hydrology status at Command Desk 1 [E]', completed: false, isOptional: false },
			{ id: 's6_report_electrical', text: 'Log electrical hazards at Command Desk 2 [E]', completed: false, isOptional: false },
			{ id: 's6_report_roster', text: 'Submit civilian headcount at Triage Desk [E]', completed: false, isOptional: false },
			{ id: 's6_check_radio', text: 'Verify emergency broadcast on satellite radio [E]', completed: false, isOptional: false },
			{ id: 's6_helipad_triage', text: 'Register community evacuees at Helipad Terminal [E]', completed: false, isOptional: false },
			{ id: 'stage10_final_evacuation', text: 'Complete final emergency operational debrief', completed: false, isOptional: false },
			{ id: 's6_climb_summit', text: 'Assemble community column at Summit Helipad Outpost (x >= 28, z >= 18)', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 's6_inspect_radar', text: 'Inspect regional radar weather board [E]', completed: false, isOptional: true },
			{ id: 's6_assist_final', text: 'Confirm summit lookout security point [E]', completed: false, isOptional: true }
		]
	}
];

export const STAGE_SAFETY_LESSONS: Record<number, string> = {
	1: 'Pre-evacuation readiness saves crucial minutes. Securing survival packs, checking early warning boards, and heading uphill immediately is key to surviving flash floods.',
	2: 'Always look for emergency markers outside flooded houses. Never enter inundated structures without knowing an immediate safe exit, and evacuate residents immediately.',
	3: 'Turn Around, Don\'t Drown! Low-lying underpasses and road dips quickly collect lethal deep water. Always choose elevated routes even if unpaved.',
	4: 'Maintain at least a 10-meter perimeter from fallen power lines. Electrified floodwater conducts lethal ground current over wide distances.',
	5: 'Prioritize vulnerable individuals—elderly residents, children, and those with mobility challenges—and keep evacuee columns moving together toward high ground.',
	6: 'During airlift evacuations, always approach helicopters in the pilot\'s 10-to-2 visual field, keep low under rotor wash, and board priority groups first.'
};

export interface ProgressionResult {
	advanced: boolean;
	newStage?: StageDefinition;
	levelCompleted?: boolean;
	completedLevelNum?: number;
	completedLevelTitle?: string;
	safetyLesson?: string;
	nextLevelName?: string;
	isFinalLevel?: boolean;
	checkpointSaved?: number;
	bannerText?: string;
}

export interface StageManager {
	getCurrentStage: () => StageDefinition;
	getStageByIndex: (idx: number) => StageDefinition;
	getAllStages: () => StageDefinition[];
	advanceStage: () => StageDefinition;
	setStage: (stageNum: number) => StageDefinition;
	checkProgression: (
		playerPos: Vector3,
		playerAlt: number,
		waterLevel: number,
		civiliansAssisted: number,
		stageElapsedTime: number
	) => ProgressionResult;
	getRecommendedWaterSpeed: () => number;
	reset: () => void;
}

export function createStageManager(trainingManager: TrainingStateManager): StageManager {
	let currentStageIndex = 0; // 0-based for STAGE_DEFINITIONS array
	let isWaitingForContinue = false;

	function syncStageObjectives(stageNum: number) {
		const stageDef = STAGE_DEFINITIONS.find((s) => s.stageNumber === stageNum);
		if (stageDef) {
			trainingManager.setStageObjectives(
				stageDef.primaryObjectives,
				stageDef.optionalObjectives
			);
		}
	}

	// Initialize objectives for starting stage
	syncStageObjectives(1);

	function getCurrentStage(): StageDefinition {
		return STAGE_DEFINITIONS[currentStageIndex];
	}

	function getStageByIndex(idx: number): StageDefinition {
		const safeIdx = Math.max(0, Math.min(STAGE_DEFINITIONS.length - 1, idx));
		return STAGE_DEFINITIONS[safeIdx];
	}

	function getAllStages(): StageDefinition[] {
		return STAGE_DEFINITIONS;
	}

	function setStage(stageNum: number): StageDefinition {
		isWaitingForContinue = false;
		currentStageIndex = Math.max(0, Math.min(STAGE_DEFINITIONS.length - 1, stageNum - 1));
		trainingManager.setStage(currentStageIndex + 1);
		syncStageObjectives(currentStageIndex + 1);
		return STAGE_DEFINITIONS[currentStageIndex];
	}

	function advanceStage(): StageDefinition {
		isWaitingForContinue = false;
		if (currentStageIndex < STAGE_DEFINITIONS.length - 1) {
			currentStageIndex += 1;
			trainingManager.setStage(currentStageIndex + 1);
			syncStageObjectives(currentStageIndex + 1);
		}
		return STAGE_DEFINITIONS[currentStageIndex];
	}

	function getRecommendedWaterSpeed(): number {
		return STAGE_DEFINITIONS[currentStageIndex].waterRiseSpeed;
	}

	function reset() {
		currentStageIndex = 0;
		isWaitingForContinue = false;
		trainingManager.setStage(1);
		syncStageObjectives(1);
	}

	function checkProgression(
		playerPos: Vector3,
		playerAlt: number,
		waterLevel: number,
		civiliansAssisted: number,
		stageElapsedTime: number
	): ProgressionResult {
		if (isWaitingForContinue) {
			return { advanced: false };
		}

		const stage = currentStageIndex + 1;
		const def = STAGE_DEFINITIONS[currentStageIndex];
		let shouldAdvance = false;
		let bannerText: string | undefined;

		// Guard: Must spend minimum active time in this level before completing
		const minTime = Math.max(6.0, def.minActionSeconds || 8.0);
		if (stageElapsedTime < minTime) {
			return { advanced: false };
		}

		const allPrimaryDone = trainingManager.areAllPrimaryObjectivesCompleted();
		if (!allPrimaryDone) {
			return { advanced: false };
		}

		switch (stage) {
			case 1:
				// Level 1 -> 2: Primary objectives completed & moved towards town (x > -18)
				if (allPrimaryDone && playerPos.x > -18) {
					shouldAdvance = true;
					bannerText = 'LEVEL 1 COMPLETE: Early alert acknowledged. Community assessment underway.';
				}
				break;

			case 2:
				// Level 2 -> 3: Neighbors assisted & reached trailhead (x > -13)
				if (allPrimaryDone && (civiliansAssisted >= 2 || playerPos.x > -13)) {
					shouldAdvance = true;
					bannerText = 'LEVEL 2 COMPLETE: Lower basin residents alerted. Choose route at valley fork.';
				}
				break;

			case 3:
				// Level 3 -> 4: Hillside route scouted, medical gear secured, elevation reached (x > -6, playerAlt >= 1.6m)
				if (allPrimaryDone && (playerPos.x > -6 || playerAlt >= 1.6)) {
					shouldAdvance = true;
					bannerText = 'LEVEL 3 COMPLETE: Safe hillside trail confirmed. Caution: Industrial power corridor ahead.';
				}
				break;

			case 4:
				// Level 4 -> 5: Electrical hazards identified, Shruti assisted, 10m perimeter cleared (x > 3)
				if (allPrimaryDone && playerPos.x > 3) {
					shouldAdvance = true;
					bannerText = 'LEVEL 4 COMPLETE: Electrical perimeter cleared. Search terraces for vulnerable residents.';
				}
				break;

			case 5:
				// Level 5 -> 6: Vulnerable citizens assisted & reached Safety Plateau (x >= 18, playerAlt >= 4.8m)
				if (allPrimaryDone && (playerPos.x >= 18 || playerAlt >= 4.8)) {
					shouldAdvance = true;
					bannerText = 'LEVEL 5 COMPLETE: Vulnerable citizens safe on plateau. Report to Incident Command Center.';
				}
				break;

			case 6:
				// Level 6 -> Finished: All command logs filed & summit reached (x >= 26)
				if (allPrimaryDone && (playerPos.x >= 26 || (playerPos.x >= 24 && playerPos.z >= 16))) {
					trainingManager.completeTraining();
					isWaitingForContinue = true;
					return {
						advanced: false,
						levelCompleted: true,
						completedLevelNum: 6,
						completedLevelTitle: def.shortTitle,
						isFinalLevel: true,
						bannerText: 'TRAINING COMPLETE: All 6 Flood Survival Missions Mastered! Helicopter extraction inbound.'
					};
				}
				break;
		}

		if (shouldAdvance) {
			const completedStage = STAGE_DEFINITIONS[currentStageIndex];
			isWaitingForContinue = true;
			let cpSaved: number | undefined;

			if (completedStage.checkpointNum) {
				cpSaved = completedStage.checkpointNum;
				trainingManager.saveCheckpoint(cpSaved, waterLevel);
			}

			return {
				advanced: false,
				levelCompleted: true,
				completedLevelNum: completedStage.stageNumber,
				completedLevelTitle: completedStage.shortTitle,
				safetyLesson: STAGE_SAFETY_LESSONS[completedStage.stageNumber],
				nextLevelName: STAGE_DEFINITIONS[currentStageIndex + 1]?.shortTitle,
				isFinalLevel: false,
				checkpointSaved: cpSaved,
				bannerText
			};
		}

		return { advanced: false };
	}

	return {
		getCurrentStage,
		getStageByIndex,
		getAllStages,
		advanceStage,
		setStage,
		checkProgression,
		getRecommendedWaterSpeed,
		reset
	};
}

import type { TrainingEvent } from '../flood/trainingEvents';
import type { StageDefinition } from '../flood/stageManager';

export interface DisasterStageDefinition extends StageDefinition {
	warningBadge: string;
	hazardsDescription: string;
	audioCue?: string;
}

export const DISASTER_SAFETY_LESSONS: Record<number, string> = {
	1: 'During an earthquake, DROP, COVER, and HOLD ON immediately under sturdy furniture. Protect your head and neck, and wait until all shaking stops before moving to an open area away from facade hazards.',
	2: 'After seismic shaking, inspect buildings only from a safe distance. Never enter visibly cracked structures or cross falling debris paths, and move immediately upwind from secondary fires.',
	3: 'Natural gas leaks pose severe explosion hazards. Never use switches, mobile phones, or open flames. Equip battery emergency lighting, avoid downed cables, and guide evacuees along illuminated safe paths.',
	4: 'When conducting community rescue, prioritize vulnerable individuals—the elderly, injured, and children. Check exterior hazard indicators before entering damaged houses and escort survivors safely.',
	5: 'During mass evacuation, stay on wide open roadways away from debris and utility lines. Assist neighboring families, account for community members, and proceed directly to the designated assembly zone.',
	6: 'At the incident response command post, verify civilian counts and report remaining hazard locations. Complete formal check-in and ensure the entire area is secured.'
};

export const DISASTER_STAGE_DEFINITIONS: DisasterStageDefinition[] = [
	{
		stageNumber: 1,
		id: 'earthquake_strike',
		title: 'LEVEL 1 — EARTHQUAKE STRIKE',
		shortTitle: 'Earthquake Strike',
		objective: 'Experience the earthquake, perform Drop Cover & Hold On, check surroundings, identify falling hazards, and reach open ground.',
		instructions: 'DROP, COVER and HOLD ON. Shield your head from falling debris, wait until shaking stops, inspect structural damage, and move to safety.',
		waterRiseSpeed: 0,
		warningBadge: '⚡ SEISMIC SHAKING',
		hazardsDescription: 'Violent ground motion, falling ceiling fixtures, flying objects.',
		momentType: 'observe',
		observeDuration: 4.0,
		situationBrief:
			'A powerful earthquake strikes the area. Shaking causes falling debris and structural instability.',
		avoidHazard: '🏢 Windows, unreinforced brick facades, and hanging signs',
		dangerLevel: 0.85,
		minActionSeconds: 6.0,
		audioCue: 'earthquake_rumble',
		primaryObjectives: [
			{ id: 'd1_experience_quake', text: 'Experience the earthquake event', completed: false, isOptional: false },
			{ id: 'd1_drop_cover_hold', text: 'Perform Drop, Cover and Hold On [E]', completed: false, isOptional: false },
			{ id: 'd1_wait_shaking_stop', text: 'Wait until the shaking stops', completed: false, isOptional: false },
			{ id: 'd1_inspect_environment', text: 'Inspect the surrounding environment', completed: false, isOptional: false },
			{ id: 'd1_identify_damaged_struct', text: 'Identify damaged structures [E]', completed: false, isOptional: false },
			{ id: 'd1_inspect_aftermath', text: 'Identify falling-object hazards [E]', completed: false, isOptional: false },
			{ id: 'd1_check_panicked_npc', text: 'Check nearby civilians [E]', completed: false, isOptional: false },
			{ id: 'd1_move_safe_open', text: 'Move to a safe open area', completed: false, isOptional: false },
			{ id: 'd1_reach_assembly', text: 'Reach the emergency assembly point', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd1_opt_help_civilian', text: 'Help an additional civilian [E]', completed: false, isOptional: true },
			{ id: 'd1_opt_locate_flashlight', text: 'Locate emergency flashlight [E]', completed: false, isOptional: true },
			{ id: 'd1_opt_inspect_equipment', text: 'Inspect emergency equipment [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 2,
		id: 'structural_damage_fire',
		title: 'LEVEL 2 — STRUCTURAL DAMAGE & FIRE',
		shortTitle: 'Damage & Fire',
		objective: 'Inspect neighborhood, identify 3 damaged structures, mark unsafe buildings, detect secondary fire, warn civilians and reach safe area.',
		instructions: 'Inspect the neighborhood, identify damaged buildings, detect fire outbreak, warn civilians away, and navigate around debris.',
		waterRiseSpeed: 0,
		checkpointNum: 1,
		warningBadge: '🔥 STRUCTURAL DAMAGE & FIRE',
		hazardsDescription: 'Cracked masonry, falling facade debris, secondary electrical fire plumes.',
		momentType: 'observe',
		observeDuration: 4.0,
		situationBrief:
			'The earthquake has damaged several buildings. A secondary fire starts nearby.',
		avoidHazard: '🧱 Unstable buildings and toxic smoke plumes',
		dangerLevel: 0.7,
		minActionSeconds: 8.0,
		audioCue: 'structural_crack',
		primaryObjectives: [
			{ id: 'd2_inspect_neighborhood', text: 'Inspect the neighborhood', completed: false, isOptional: false },
			{ id: 'd2_inspect_crack_1', text: 'Identify damaged structure 1 [E]', completed: false, isOptional: false },
			{ id: 'd2_inspect_crack_2', text: 'Identify damaged structure 2 [E]', completed: false, isOptional: false },
			{ id: 'd2_inspect_crack_3', text: 'Identify damaged structure 3 [E]', completed: false, isOptional: false },
			{ id: 'd2_mark_unsafe', text: 'Mark unsafe buildings [E]', completed: false, isOptional: false },
			{ id: 'd2_find_evac_route', text: 'Find the safe evacuation route', completed: false, isOptional: false },
			{ id: 'd2_detect_fire', text: 'Detect the fire [E]', completed: false, isOptional: false },
			{ id: 'd2_warn_civilians', text: 'Warn nearby civilians [E]', completed: false, isOptional: false },
			{ id: 'd2_move_civilians_fire', text: 'Move civilians away from the fire', completed: false, isOptional: false },
			{ id: 'd2_avoid_damaged_structures', text: 'Avoid entering damaged structures', completed: false, isOptional: false },
			{ id: 'd2_navigate_open_road', text: 'Navigate around falling debris', completed: false, isOptional: false },
			{ id: 'd2_reach_assembly', text: 'Reach the safe assembly area', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd2_first_aid', text: 'Find first-aid kit [E]', completed: false, isOptional: true },
			{ id: 'd2_help_another_npc', text: 'Help another civilian [E]', completed: false, isOptional: true },
			{ id: 'd2_inspect_crack_extra', text: 'Identify an additional damaged structure [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 3,
		id: 'gas_leak_power_failure',
		title: 'LEVEL 3 — GAS LEAK & POWER FAILURE',
		shortTitle: 'Gas Leak & Blackout',
		objective: 'Locate ruptured gas main, identify danger zone, warn residents, avoid electrical hazards, guide along illuminated route.',
		instructions: 'Locate hissing gas leak, prevent sparks and phone use, find flashlight, avoid downed wires, and guide civilians to safety.',
		waterRiseSpeed: 0,
		checkpointNum: 2,
		warningBadge: '💨 GAS LEAK & BLACKOUT',
		hazardsDescription: 'Flammable vapor cloud, energized downed power lines, zero visibility blackout.',
		momentType: 'observe',
		observeDuration: 4.0,
		situationBrief:
			'A damaged utility system causes a gas leak and widespread power failure.',
		avoidHazard: '💨 Gas vapor clouds, spark sources, and downed live cables',
		dangerLevel: 0.8,
		minActionSeconds: 8.0,
		audioCue: 'gas_leak_hiss',
		primaryObjectives: [
			{ id: 'd3_locate_gas_leak', text: 'Locate the gas leak [E]', completed: false, isOptional: false },
			{ id: 'd3_identify_danger_zone', text: 'Identify the danger zone', completed: false, isOptional: false },
			{ id: 'd3_warn_residents', text: 'Warn nearby residents [E]', completed: false, isOptional: false },
			{ id: 'd3_prevent_approach', text: 'Prevent civilians from approaching [E]', completed: false, isOptional: false },
			{ id: 'd3_clear_perimeter', text: 'Move away from the gas leak', completed: false, isOptional: false },
			{ id: 'd3_find_flashlight', text: 'Find emergency flashlight [E]', completed: false, isOptional: false },
			{ id: 'd3_find_lit_route', text: 'Find an illuminated safe route', completed: false, isOptional: false },
			{ id: 'd3_inspect_downed_wire', text: 'Avoid damaged electrical equipment [E]', completed: false, isOptional: false },
			{ id: 'd3_guide_civilians_route', text: 'Guide civilians along the safe route', completed: false, isOptional: false },
			{ id: 'd3_reach_substation', text: 'Reach the safe zone', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd3_radio', text: 'Collect Emergency Radio [E]', completed: false, isOptional: true },
			{ id: 'd3_assist_resident', text: 'Assist stranded resident [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 4,
		id: 'community_rescue',
		title: 'LEVEL 4 — COMMUNITY RESCUE',
		shortTitle: 'Community Rescue',
		objective: 'Search neighborhood, locate elderly civilian, injured civilian, child, and trapped resident inside marked house.',
		instructions: 'Locate elderly resident, injured person, child, find house with PERSON INSIDE banner, enter, rescue, and escort to safety.',
		waterRiseSpeed: 0,
		checkpointNum: 3,
		warningBadge: '🤝 COMMUNITY RESCUE',
		hazardsDescription: 'Trapped residents in damaged houses, mobility-impaired citizens, structural debris.',
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'Multiple people are trapped or injured after the disaster. Comprehensive community search and rescue required.',
		avoidHazard: '🏃 Unchecked damaged rooms and leaving vulnerable people behind',
		dangerLevel: 0.65,
		minActionSeconds: 10.0,
		audioCue: 'success_chime',
		primaryObjectives: [
			{ id: 'd4_search_neighborhood', text: 'Search the affected neighborhood', completed: false, isOptional: false },
			{ id: 'd4_locate_elderly', text: 'Locate elderly civilian [E]', completed: false, isOptional: false },
			{ id: 'd4_assist_elderly', text: 'Assist elderly civilian', completed: false, isOptional: false },
			{ id: 'd4_locate_injured', text: 'Locate injured civilian [E]', completed: false, isOptional: false },
			{ id: 'd4_assist_injured', text: 'Assist injured civilian', completed: false, isOptional: false },
			{ id: 'd4_locate_child', text: 'Locate child [E]', completed: false, isOptional: false },
			{ id: 'd4_assist_child', text: 'Assist child', completed: false, isOptional: false },
			{ id: 'd4_find_house_civilian', text: 'Find the house containing another civilian', completed: false, isOptional: false },
			{ id: 'd4_person_inside_shown', text: 'Inspect PERSON INSIDE — NEEDS ASSISTANCE indicator', completed: false, isOptional: false },
			{ id: 'd4_enter_house', text: 'Enter the house', completed: false, isOptional: false },
			{ id: 'd4_locate_house_civilian', text: 'Locate the civilian [E]', completed: false, isOptional: false },
			{ id: 'd4_rescue_house_civilian', text: 'Rescue the civilian', completed: false, isOptional: false },
			{ id: 'd4_escort_safe_corridor', text: 'Escort civilians to the safe area', completed: false, isOptional: false },
			{ id: 'd4_reach_assembly_point', text: 'Reach the assembly point', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd4_drinking_water', text: 'Provide drinking water to evacuees [E]', completed: false, isOptional: true },
			{ id: 'd4_help_additional', text: 'Help an additional civilian [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 5,
		id: 'large_scale_evacuation',
		title: 'LEVEL 5 — LARGE-SCALE EVACUATION',
		shortTitle: 'Large-Scale Evacuation',
		objective: 'Lead community evacuation, avoid fire, gas, structural and electrical hazards, assist 5+ civilians, reach command.',
		instructions: 'Locate multiple civilian groups, identify hazards, guide families along open corridor, assist at least 5 civilians, and reach assembly.',
		waterRiseSpeed: 0,
		checkpointNum: 4,
		warningBadge: '🏃 LARGE-SCALE EVACUATION',
		hazardsDescription: 'Multi-hazard corridor: fire embers, downed lines, unstable overhangs, large crowds.',
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'Emergency authorities order a complete evacuation. Civilians are distributed throughout the environment.',
		avoidHazard: '🚧 Narrow alleys, structural overhangs, and hazardous utility areas',
		dangerLevel: 0.7,
		minActionSeconds: 10.0,
		audioCue: 'emergency_announcement',
		primaryObjectives: [
			{ id: 'd5_reach_evacuation_zone', text: 'Reach the evacuation zone', completed: false, isOptional: false },
			{ id: 'd5_locate_group1', text: 'Locate civilian group #1 [E]', completed: false, isOptional: false },
			{ id: 'd5_assist_group1', text: 'Assist civilian group #1', completed: false, isOptional: false },
			{ id: 'd5_locate_group2', text: 'Locate civilian group #2 [E]', completed: false, isOptional: false },
			{ id: 'd5_assist_group2', text: 'Assist civilian group #2', completed: false, isOptional: false },
			{ id: 'd5_locate_elderly', text: 'Locate elderly residents [E]', completed: false, isOptional: false },
			{ id: 'd5_assist_elderly', text: 'Assist elderly residents', completed: false, isOptional: false },
			{ id: 'd5_locate_family', text: 'Locate families/children [E]', completed: false, isOptional: false },
			{ id: 'd5_guide_family', text: 'Guide families/children to safety', completed: false, isOptional: false },
			{ id: 'd5_identify_fire_hazard', text: 'Identify fire hazards [E]', completed: false, isOptional: false },
			{ id: 'd5_identify_gas_hazard', text: 'Identify gas hazards [E]', completed: false, isOptional: false },
			{ id: 'd5_avoid_structures', text: 'Avoid damaged structures', completed: false, isOptional: false },
			{ id: 'd5_avoid_electrical', text: 'Avoid electrical hazards', completed: false, isOptional: false },
			{ id: 'd5_follow_safe_route', text: 'Select and follow safe evacuation route', completed: false, isOptional: false },
			{ id: 'd5_assist_5_civilians', text: 'Assist at least 5 civilians', completed: false, isOptional: false },
			{ id: 'd5_reach_assembly_entry', text: 'Reach the emergency assembly area', completed: false, isOptional: false },
			{ id: 'd5_account_civilians', text: 'Account for civilians [E]', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd5_extra_civilians', text: 'Rescue additional civilians [E]', completed: false, isOptional: true },
			{ id: 'd5_extra_equipment', text: 'Find emergency equipment [E]', completed: false, isOptional: true },
			{ id: 'd5_report_hazards', text: 'Report additional hazards [E]', completed: false, isOptional: true }
		]
	},
	{
		stageNumber: 6,
		id: 'final_emergency_response',
		title: 'LEVEL 6 — FINAL EMERGENCY RESPONSE',
		shortTitle: 'Final Response',
		objective: 'Inspect status board, check civilian count, find and rescue missing civilian, report hazards, confirm area secure.',
		instructions: 'Leave assembly, travel to response center, inspect status board, locate missing civilian at perimeter, rescue them, report hazards, and confirm area secure.',
		waterRiseSpeed: 0,
		checkpointNum: 5,
		warningBadge: '🏕️ FINAL COMMAND RESPONSE',
		hazardsDescription: 'Residual disaster perimeter hazards, isolated stragglers, final triage verification.',
		momentType: 'action',
		observeDuration: 4.0,
		situationBrief:
			'The player reaches the final emergency response stage. The area must be secured and civilians accounted for.',
		avoidHazard: '⚠️ Re-entering unsecured disaster ruins without authorization',
		dangerLevel: 0.2,
		minActionSeconds: 8.0,
		audioCue: 'training_complete',
		primaryObjectives: [
			{ id: 'd6_leave_assembly', text: 'Leave the assembly area', completed: false, isOptional: false },
			{ id: 'd6_travel_response_center', text: 'Travel toward the emergency response center', completed: false, isOptional: false },
			{ id: 'd6_avoid_remaining_hazards', text: 'Avoid remaining hazards', completed: false, isOptional: false },
			{ id: 'd6_inspect_status_board', text: 'Inspect the emergency status board [E]', completed: false, isOptional: false },
			{ id: 'd6_check_civilian_count', text: 'Check civilian count [E]', completed: false, isOptional: false },
			{ id: 'd6_identify_missing_civilian', text: 'Identify missing civilian [E]', completed: false, isOptional: false },
			{ id: 'd6_travel_missing_location', text: "Travel to the missing civilian's location", completed: false, isOptional: false },
			{ id: 'd6_rescue_missing_civilian', text: 'Rescue the civilian [E]', completed: false, isOptional: false },
			{ id: 'd6_report_remaining_hazards', text: 'Report remaining hazards [E]', completed: false, isOptional: false },
			{ id: 'd6_return_response_center', text: 'Return to the emergency response center', completed: false, isOptional: false },
			{ id: 'd6_confirm_accountability', text: 'Confirm civilian accountability [E]', completed: false, isOptional: false },
			{ id: 'd6_confirm_area_secure', text: 'Confirm the emergency area is secure [E]', completed: false, isOptional: false }
		],
		optionalObjectives: [
			{ id: 'd6_verify_manifest', text: 'Verify district evacuee registry log [E]', completed: false, isOptional: true },
			{ id: 'd6_final_lookout', text: 'Inspect regional hazard status at lookout [E]', completed: false, isOptional: true }
		]
	}
];

export const DISASTER_EVENTS: TrainingEvent[] = [
	{
		id: 'disaster_stage1_earthquake',
		title: 'LEVEL 1: SEISMIC IMPACT PROTOCOL',
		situation: 'Violent shaking suddenly hits the downtown district. Bookshelves rattle and ceiling tiles begin falling.',
		prompt: 'What is your immediate, life-saving action?',
		stageActive: 1,
		choices: [
			{
				id: 'A',
				text: 'Run outside immediately into the street',
				isCorrect: false,
				feedback:
					'Unsafe: Running during shaking causes falls, and exterior building facades (falling glass, brick, signs) are the most lethal hazard.'
			},
			{
				id: 'B',
				text: 'Stand next to the nearest large glass window to monitor the street',
				isCorrect: false,
				feedback:
					'Unsafe: Windows shatter violently under seismic shear forces, causing severe lacerations.'
			},
			{
				id: 'C',
				text: 'Drop, Cover, and Hold On beneath a sturdy desk or table',
				isCorrect: true,
				feedback:
					'GOOD RESPONSE: Protect yourself first! Drop to hands and knees, cover your head and neck under sturdy furniture, and hold on until shaking stops.'
			},
			{
				id: 'D',
				text: 'Enter the building elevator to evacuate to ground floor quickly',
				isCorrect: false,
				feedback:
					'Unsafe: Elevators regularly lose power or deform in guide rails during quakes, trapping occupants.'
			}
		],
		whyItMatters:
			'DROP, COVER, and HOLD ON is the globally recommended response. It prevents you from being thrown to the ground and shields your head and torso from falling debris.',
		triggerType: 'proximity',
		targetX: -21,
		targetZ: 1,
		triggerRadius: 4.5
	},
	{
		id: 'disaster_stage2_structural',
		title: 'LEVEL 2: POST-QUAKE STRUCTURAL DAMAGE',
		situation: 'The shaking stops. A 2-story brick building ahead has deep diagonal wall fissures, sagging lintels, and shattered glass on the sidewalk.',
		prompt: 'How should you navigate past this building?',
		stageActive: 2,
		choices: [
			{
				id: 'A',
				text: 'Enter the building to retrieve personal items before leaving',
				isCorrect: false,
				feedback:
					'Unsafe: Compromised buildings can suffer catastrophic collapse without warning from gravity or minor aftershocks.'
			},
			{
				id: 'B',
				text: 'Stay clear of the building perimeter and take the open detour route',
				isCorrect: true,
				feedback:
					'Correct: Always stay outside the "fall zone" of damaged structures (at least equal to building height). Keep moving in open areas.'
			},
			{
				id: 'C',
				text: 'Climb over the fractured concrete debris pile next to the wall',
				isCorrect: false,
				feedback:
					'Unsafe: Rubble is unstable and can shift under foot, leading to crushing injuries and entrapment.'
			}
		],
		whyItMatters:
			'Earthquake damage makes structures unstable even after primary shaking stops. Never enter or walk closely beneath visibly damaged masonry walls.',
		triggerType: 'proximity',
		targetX: -16,
		targetZ: -3,
		triggerRadius: 5.5
	},
	{
		id: 'disaster_stage3_gas',
		title: 'LEVEL 3: NATURAL GAS LEAK & ELECTRICAL HAZARD',
		situation: 'You smell a strong sulfur/rotten-egg odor and hear a distinct high-pressure hissing sound coming from an underground service valve near a darkened road.',
		prompt: 'What is the critical safety rule in this area?',
		stageActive: 3,
		choices: [
			{
				id: 'A',
				text: 'Turn on nearby electrical light switches or spark lighters to inspect the pipe',
				isCorrect: false,
				feedback:
					'CRITICAL HAZARD: Operating electrical switches or open flames creates micro-arcs that instantly trigger explosive vapor ignition.'
			},
			{
				id: 'B',
				text: 'Move upwind away from the leak immediately, prevent all sparks/phones, and use battery light',
				isCorrect: true,
				feedback:
					'Correct: Prevent all sparks and open flames. Evacuate immediately upwind, maintain 10m from downed wires, and alert responders from a safe distance.'
			},
			{
				id: 'C',
				text: 'Stay directly over the valve to try turning the valve stem with bare hands',
				isCorrect: false,
				feedback:
					'Unsafe: Inhaling concentrated natural gas causes dizziness, asphyxiation, and unconsciousness within minutes.'
			}
		],
		whyItMatters:
			'Never create sparks, flip electrical switches, or use open flames near suspected gas leaks. Gas clouds accumulate in low pockets and ignite easily.',
		triggerType: 'proximity',
		targetX: -5,
		targetZ: 0,
		triggerRadius: 5.5
	},
	{
		id: 'disaster_stage4_triage',
		title: 'LEVEL 4: SEARCH & RESCUE PROTOCOL',
		situation: 'During neighborhood sweep, multiple residents need assistance: an elderly person mobility-impaired, a separated child, and an injured worker.',
		prompt: 'How do you prioritize rescue assistance in compromised zones?',
		stageActive: 4,
		choices: [
			{
				id: 'A',
				text: 'Direct uninjured residents to stay put inside damaged structures while searching alone',
				isCorrect: false,
				feedback:
					'Unsafe: Compromised buildings can collapse during aftershocks. Immediate evacuation to open assembly areas is vital.'
			},
			{
				id: 'B',
				text: 'Triage and escort vulnerable civilians directly along verified safe corridors to the assembly point',
				isCorrect: true,
				feedback:
					'Correct: Prioritize vulnerable civilians (elderly, injured, children) and escort them along designated clear corridors without entering dangerous debris traps.'
			},
			{
				id: 'C',
				text: 'Leave injured residents unattended without reporting their locations to the team',
				isCorrect: false,
				feedback:
					'Unsafe: Accountability and marking locations of injured victims is essential for emergency medical response.'
			}
		],
		whyItMatters:
			'Community search and rescue requires structured escorting and clear communication, keeping evacuees in open assembly areas away from structural hazards.',
		triggerType: 'proximity',
		targetX: -1,
		targetZ: -2,
		triggerRadius: 5.5
	},
	{
		id: 'disaster_stage5_route',
		title: 'LEVEL 5: EVACUATION ROUTE SELECTION',
		situation: 'The route to the safe plateau splits ahead. Route A is a short narrow street passing beneath fractured multi-story masonry walls. Route B is a longer path across open hillside.',
		prompt: 'Which evacuation corridor should you lead the group along?',
		stageActive: 5,
		choices: [
			{
				id: 'A',
				text: 'Route A: The short narrow street under cracked building overhangs to save time',
				isCorrect: false,
				feedback:
					'Unsafe: Narrow streets flanked by cracked buildings are lethal "canyons of debris" during aftershocks. Speed does not compensate for extreme risk.'
			},
			{
				id: 'B',
				text: 'Route B: The longer open hillside route with clear distance from all structures',
				isCorrect: true,
				feedback:
					'Correct: The safest route is the one that minimizes exposure to falling debris, even if it requires extra walking. Distance is safety.'
			},
			{
				id: 'C',
				text: 'Disperse the group and tell everyone to run in different directions',
				isCorrect: false,
				feedback:
					'Unsafe: Disbanding the group leads to panic, loss of vulnerable members, and loss of accountability.'
			}
		],
		whyItMatters:
			'The fastest route on a map is rarely the safest in a disaster. Selecting routes clear of structural collapse perimeters is a foundational survival principle.',
		triggerType: 'proximity',
		targetX: 14,
		targetZ: 2,
		triggerRadius: 6.0
	},
	{
		id: 'disaster_stage6_accountability',
		title: 'LEVEL 6: COMMAND ACCOUNTABILITY & AREA SECURING',
		situation: 'You have arrived at the Incident Operations Outpost. Evacuees are registered, but perimeter verification and unaccounted persons must be checked.',
		prompt: 'What is the standard protocol for closing an emergency operation?',
		stageActive: 6,
		choices: [
			{
				id: 'A',
				text: 'Disband all personnel and assume anyone missing has evacuated on their own',
				isCorrect: false,
				feedback:
					'Unsafe: Unverified missing persons may be trapped or incapacitated. Systematic headcount verification is compulsory.'
			},
			{
				id: 'B',
				text: 'Verify the civilian manifest board, confirm unaccounted individuals, and log remaining hazards with incident command',
				isCorrect: true,
				feedback:
					'Correct: Professional emergency operations require 100% accountability, cross-checking registration logs, and formal debriefing of lingering perimeter hazards.'
			},
			{
				id: 'C',
				text: 'Re-enter damaged structures alone without communication gear to look around',
				isCorrect: false,
				feedback:
					'Unsafe: Never freelance or enter damaged structures without team coordination and authorization.'
			}
		],
		whyItMatters:
			'Accountability verification and formal hazard handover prevent secondary casualties and ensure all survivors receive medical and relief support.',
		triggerType: 'proximity',
		targetX: 23,
		targetZ: 2,
		triggerRadius: 6.0
	}
];

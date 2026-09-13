export interface DecisionChoice {
	id: 'A' | 'B' | 'C' | 'D';
	text: string;
	isCorrect: boolean;
	feedback: string;
}

export interface TrainingEvent {
	id: string;
	title: string;
	situation: string;
	prompt: string;
	choices: DecisionChoice[];
	whyItMatters: string;
	triggerType: 'proximity' | 'water_level' | 'milestone';
	stageActive?: number;
	// Target coordinates or thresholds for detection
	targetX?: number;
	targetZ?: number;
	triggerRadius?: number;
	waterLevelThreshold?: number;
}


export const TRAINING_EVENTS: TrainingEvent[] = [
	{
		id: 'stage1_flood_warning',
		title: 'LEVEL 1: EMERGENCY FLOOD ADVISORY',
		situation: 'An emergency alert sounds on your phone: Severe torrential flooding imminent in the lower river basin.',
		prompt: 'What is your immediate first action?',
		stageActive: 1,
		choices: [
			{
				id: 'A',
				text: 'Ignore the alert and continue daily activities until water is visible',
				isCorrect: false,
				feedback:
					'Unsafe: Flash floods can inundate low-lying ground in under 5 minutes without visual advance warning.'
			},
			{
				id: 'B',
				text: 'Gather essential survival pack, verify evacuation routes, and prepare to move uphill',
				isCorrect: true,
				feedback:
					'Correct: Pre-evacuation readiness saves crucial minutes. Securing medications, documents, and heading uphill immediately is key.'
			},
			{
				id: 'C',
				text: 'Wait inside the lowest room of the building until an official knocks on the door',
				isCorrect: false,
				feedback:
					'Unsafe: Waiting inside ground floors or basements risks rapid entrapment by rapidly rising water.'
			}
		],
		whyItMatters:
			'Early warning adherence is the single largest determinant of flood survival. Waiting until floodwater touches the doorstep leaves no safe escape window.',
		triggerType: 'proximity',
		targetX: -20,
		targetZ: 1,
		triggerRadius: 4.5
	},
	{
		id: 'scenario_a_blocked_route',
		title: 'LEVEL 2: FLOODED ROUTE & PRIORITY EVACUATION',
		situation: 'Floodwater is blocking your current evacuation route across the lower street near neighbor homes.',
		prompt: 'What should you do?',
		stageActive: 2,
		choices: [
			{
				id: 'A',
				text: 'Walk through the water to save time',
				isCorrect: false,
				feedback:
					'Unsafe: Moving floodwater as shallow as 15 cm (6 inches) can knock an adult off their feet, and hidden open manholes are invisible.'
			},
			{
				id: 'B',
				text: 'Find higher ground and go around',
				isCorrect: true,
				feedback: 'Correct: Avoid entering moving or unknown-depth floodwater. Always seek elevated detour routes.'
			},
			{
				id: 'C',
				text: 'Wait near electrical infrastructure until water clears',
				isCorrect: false,
				feedback:
					'Unsafe: Water rising around utility poles and transformers creates extreme shock and electrocution hazards.'
			}
		],
		whyItMatters:
			'Floodwater can hide open drains, swift undercurrents, structural debris, and submerged electrical currents. "Turn Around, Don\'t Drown" is the #1 rule of flood survival.',
		triggerType: 'proximity',
		targetX: -8,
		targetZ: 1,
		triggerRadius: 6.0
	},
	{
		id: 'npc_valuables_belongings',
		title: 'LEVEL 2: RETURNING FOR VALUABLES PROTOCOL',
		situation: 'A resident wants to return to their flooded home to retrieve personal belongings and valuables.',
		prompt: 'What should you do?',
		stageActive: 2,
		choices: [
			{
				id: 'A',
				text: 'Help them enter their home to grab things faster',
				isCorrect: false,
				feedback:
					'Unsafe: Structural collapse, submerged electrical outlets, and rapidly sealing exit doors make re-entering flooded buildings fatal.'
			},
			{
				id: 'B',
				text: 'Tell them to wait until authorities declare it safe',
				isCorrect: true,
				feedback:
					'Correct: Possessions can be replaced; lives cannot. Never re-enter flooded or partially submerged homes.'
			},
			{
				id: 'C',
				text: 'Enter the building with them to keep watch',
				isCorrect: false,
				feedback:
					'Unsafe: Entering multiplies the casualty count. Rescuers should never accompany citizens into hazardous compromised structures for belongings.'
			}
		],
		whyItMatters:
			'Many flood fatalities occur when residents return home to retrieve pets, documents, or valuables. Water can surge without warning and trap occupants inside.',
		triggerType: 'proximity'
	},
	{
		id: 'stage3_route_choice',
		title: 'LEVEL 3: EVACUATION ROUTE SELECTION',
		situation: 'The hillside path splits ahead. The paved lower road passes under a bridge, while the gravel hillside path climbs upward.',
		prompt: 'Which evacuation corridor should you choose?',
		stageActive: 3,
		choices: [
			{
				id: 'A',
				text: 'Take the lower underpass road because it is paved and flat',
				isCorrect: false,
				feedback:
					'Unsafe: Underpasses and dips collect runoff first and become lethal submerged traps within minutes.'
			},
			{
				id: 'B',
				text: 'Take the elevated gravel hillside path marked by orange safety beacons',
				isCorrect: true,
				feedback:
					'Correct: Always choose elevated ground even if the path is unpaved. Height is safety during flood events.'
			},
			{
				id: 'C',
				text: 'Stay in the middle of the valley intersection waiting for a rescue vehicle',
				isCorrect: false,
				feedback:
					'Unsafe: Remaining in the valley floodway exposes you to surging runoff and floating structural debris.'
			}
		],
		whyItMatters:
			'Low-lying intersections and road underpasses are known death traps in floods. Always prioritize routes that steadily gain elevation.',
		triggerType: 'proximity',
		targetX: -14,
		targetZ: 0,
		triggerRadius: 5.5
	},
	{
		id: 'scenario_b_electrical_hazard',
		title: 'LEVEL 4: ELECTRICAL HAZARD & LIVE CABLE',
		situation: 'You see a damaged electrical transformer and a fallen power line near flooded water.',
		prompt: 'What should you do?',
		stageActive: 4,
		choices: [
			{
				id: 'A',
				text: 'Move closer to inspect the line and see if it is live',
				isCorrect: false,
				feedback:
					'Unsafe: Power lines cannot be visually identified as dead or live. Ground voltage gradients can shock you from meters away.'
			},
			{
				id: 'B',
				text: 'Keep distance and report the hazard',
				isCorrect: true,
				feedback:
					'Correct: Keep at least 10 meters (33 feet) away. Water conducts electricity rapidly over long distances.'
			},
			{
				id: 'C',
				text: 'Move the wire away with a stick or pole',
				isCorrect: false,
				feedback:
					'Unsafe: Wet wood or objects can conduct high-voltage electricity and cause fatal electrocution.'
			}
		],
		whyItMatters:
			'Never approach fallen electrical wires in or near water. Downed lines electrify surrounding puddles and wet ground, creating invisible lethal shock perimeters.',
		triggerType: 'proximity',
		targetX: 0,
		targetZ: -2,
		triggerRadius: 7.0
	},
	{
		id: 'scenario_c_building_inundation',
		title: 'LEVEL 5: BUILDING INUNDATION PROTOCOL',
		situation: 'You are evacuating through a residential zone and floodwater is rising rapidly around buildings.',
		prompt: 'What should you do?',
		stageActive: 5,
		choices: [
			{
				id: 'A',
				text: 'Move to the highest safe level',
				isCorrect: true,
				feedback:
					'Correct: Move upward toward upper floors or designated roof access where rescue personnel can reach you.'
			},
			{
				id: 'B',
				text: 'Enter the basement to secure personal belongings',
				isCorrect: false,
				feedback:
					'Unsafe: Basements flood in seconds with zero warning, trapping occupants with blocked stairwells and floating debris.'
			},
			{
				id: 'C',
				text: 'Use the elevator to evacuate quickly',
				isCorrect: false,
				feedback:
					'Unsafe: Floodwater causes electrical failure, jamming elevator shafts below ground or trapping occupants between floors.'
			}
		],
		whyItMatters:
			'During flooding, move upward rather than toward basements or underground areas. Always use stairs instead of elevators during flash flood warnings.',
		triggerType: 'proximity',
		targetX: 5,
		targetZ: 2,
		triggerRadius: 7.0
	},
	{
		id: 'npc_elderly_cross',
		title: 'LEVEL 5: ASSISTING VULNERABLE CITIZEN',
		situation: 'An elderly person with a walking cane is struggling to move through rising water.',
		prompt: 'What should you do?',
		stageActive: 5,
		choices: [
			{
				id: 'A',
				text: 'Tell them to cross the flooded road quickly',
				isCorrect: false,
				feedback:
					'Unsafe: Vulnerable individuals are at extreme risk of loss of balance, hypothermia, and being swept away even in knee-deep water.'
			},
			{
				id: 'B',
				text: 'Help them reach higher ground along the evacuation route',
				isCorrect: true,
				feedback:
					'Correct: Assist vulnerable evacuees directly toward higher elevation away from moving floodwater.'
			},
			{
				id: 'C',
				text: 'Tell them to wait in the flooded area for emergency crews',
				isCorrect: false,
				feedback:
					'Unsafe: Water levels rise rapidly in flash floods. Waiting in inundated zones exposes citizens to hypothermia and drowning.'
			}
		],
		whyItMatters:
			'Elderly citizens and those with mobility challenges require immediate prioritization. Never allow vulnerable persons to navigate fast-moving or rising floodwater alone.',
		triggerType: 'proximity'
	},
	{
		id: 'npc_child_separated',
		title: 'LEVEL 5: UNACCOMPANIED CHILD PROTOCOL',
		situation: 'A child has become separated from their family during the neighborhood evacuation.',
		prompt: 'What should you do?',
		stageActive: 5,
		choices: [
			{
				id: 'A',
				text: 'Leave them and continue your own evacuation',
				isCorrect: false,
				feedback:
					'Unsafe: Unaccompanied children in a disaster zone are in severe danger of disorientation, panic, and falling into open culverts.'
			},
			{
				id: 'B',
				text: 'Move them toward the designated safe assembly area',
				isCorrect: true,
				feedback:
					'Correct: Guide unaccompanied minors directly to the official safe assembly point where family reunification teams operate.'
			},
			{
				id: 'C',
				text: 'Send them alone down the flooded shortcut',
				isCorrect: false,
				feedback:
					'Unsafe: Sending a child toward flooded shortcuts or ditches is life-threatening.'
			}
		],
		whyItMatters:
			'Designated assembly points maintain family reunification protocols and medical triage. Escorting separated minors to the command center is an essential community survival priority.',
		triggerType: 'proximity'
	},
	{
		id: 'stage10_final_evacuation',
		title: 'LEVEL 6: SUMMIT AIRLIFT & EVACUATION PROTOCOL',
		situation: 'Helicopter relief operations have commenced at the Summit Helipad. The community column is assembling for boarding.',
		prompt: 'What is the standard procedure for boarding emergency rescue aircraft?',
		stageActive: 6,
		choices: [
			{
				id: 'A',
				text: 'Rush toward the aircraft as soon as rotors begin spinning to secure a seat',
				isCorrect: false,
				feedback:
					'Unsafe: Approaching an operating helicopter without marshalling direction risks entering rotor arc blind spots and tail rotor danger zones.'
			},
			{
				id: 'B',
				text: 'Approach crouched in the pilot\'s field of vision only when signaled by ground crew, prioritizing vulnerable evacuees',
				isCorrect: true,
				feedback:
					'Correct: Always stay in the 10-to-2 o\'clock visual sector, keep low under rotor wash, follow marshaller instructions, and board priority groups first.'
			},
			{
				id: 'C',
				text: 'Carry long unsecured umbrellas and poles upright over your head to signal the pilot',
				isCorrect: false,
				feedback:
					'Unsafe: Upright long objects can strike rotating blades with catastrophic consequences. Carry all gear horizontally.'
			}
		],
		whyItMatters:
			'Aviation rescue safety requires strict adherence to ground crew signals, maintaining low posture in the pilot\'s eye line, and zero loose or upright items near rotor blades.',
		triggerType: 'proximity',
		targetX: 30,
		targetZ: 22,
		triggerRadius: 7.0
	}
];

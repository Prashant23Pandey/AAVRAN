import { Group, Vector3 } from 'three';
import { buildNpcVisual, type NpcMeshBundle } from './createNpc';
import type { CivilianMemberStatus, CivilianNpc, CommunityStatus, NpcType } from './npcTypes';

export interface NpcManager {
	group: Group;
	npcs: CivilianNpc[];
	update: (delta: number, elapsed: number, waterLevel: number, getElevation: (x: number, z: number) => number) => void;
	getNearestInteractableNpc: (playerPos: Vector3, radius?: number) => CivilianNpc | null;
	assistNpc: (npcId: string) => { npc: CivilianNpc; isFirstTime: boolean } | null;
	getNpcById: (npcId: string) => CivilianNpc | null;
	getCommunityStatus: (waterLevel: number) => CommunityStatus;
	dispose: () => void;
}

export function createNpcManager(): NpcManager {
	const group = new Group();
	group.name = 'CiviliansGroup';

	const bundles: { npc: CivilianNpc; visual: NpcMeshBundle }[] = [];

	// Waypoint milestones along the evacuation corridor
	const WP_ASSEMBLY     = new Vector3(10, 0,  6);
	const WP_SAFE_PLATEAU = new Vector3(18, 0,  4);
	const WP_SUMMIT_RIDGE = new Vector3(26, 0,  8);
	const WP_SUMMIT_OUTPOST = new Vector3(32, 0, 24);

	// ── Personalized Community Roster ──────────────────────────────────────────
	const npcConfigs: {
		id: string;
		name: string;
		role: string;
		situation: string;
		type: NpcType;
		startX: number;
		startZ: number;
		speed: number;
		specialEventId?: string;
		helpDialogue: string;
	}[] = [
		{
			id: 'npc_prashant',
			name: 'Prashant',
			role: 'Adult Resident',
			situation: 'Needs evacuation assistance near the lower basin.',
			type: 'adult',
			startX: -22,
			startZ: 2,
			speed: 3.5, // ~20% increase from 2.9
			helpDialogue: 'The water is rising really fast down here! Can you show me the safest way out?'
		},
		{
			id: 'npc_manvi',
			name: 'Manvi',
			role: 'Community Guide',
			situation: 'Knows the evacuation route — can help direct other residents.',
			type: 'carrying_bag',
			startX: -16,
			startZ: -4,
			speed: 3.7, // ~20% increase from 3.1
			specialEventId: 'scenario_a_blocked_route',
			helpDialogue: 'I know the route to higher ground — follow the hillside road north. Stay with me!'
		},
		{
			id: 'npc_hasan',
			name: 'Hasan',
			role: 'Resident near flooded road',
			situation: 'Standing at the flooded junction — needs redirection to higher ground.',
			type: 'adult',
			startX: -10,
			startZ: 10,
			speed: 3.4, // ~21% increase from 2.8
			specialEventId: 'scenario_a_blocked_route',
			helpDialogue: 'The road ahead is completely under water. Which way should I go now?'
		},
		{
			id: 'npc_shivani',
			name: 'Shivani',
			role: 'Resident near the evacuation shelter',
			situation: 'Trying to reach the shelter but unsure which path is clear.',
			type: 'adult',
			startX: -6,
			startZ: -8,
			speed: 3.6, // ~20% increase from 3.0
			helpDialogue: 'Is the shelter on the hillside still open? Point me in the right direction, please!'
		},
		{
			id: 'npc_ankush',
			name: 'Ankush',
			role: 'Resident with emergency supplies',
			situation: 'Carrying emergency supplies but slowed down and needs guidance.',
			type: 'carrying_bag',
			startX: -18,
			startZ: -10,
			speed: 3.3, // ~22% increase from 2.7
			helpDialogue: 'I have first-aid supplies in this bag. Which command post should I head to?'
		},
		{
			id: 'npc_prashanthi',
			name: 'Prashanthi',
			role: 'Elderly Resident',
			situation: 'Moving slowly due to age — needs extra assistance to reach safety.',
			type: 'elderly',
			startX: -14,
			startZ: 6,
			speed: 2.6, // ~24% increase from 2.1
			specialEventId: 'npc_elderly_cross',
			helpDialogue: 'My legs are not as quick as they used to be. Could you help me get to safety?'
		},
		{
			id: 'npc_anurag',
			name: 'Anurag',
			role: 'Young Adult Resident',
			situation: 'Separated from his family during the evacuation alarm.',
			type: 'adult',
			startX: -20,
			startZ: -6,
			speed: 3.8, // ~19% increase from 3.2
			helpDialogue: 'I got separated from my family near the market. Where is the assembly point?'
		},
		{
			id: 'npc_gayatri',
			name: 'Gayatri',
			role: 'Resident with belongings',
			situation: 'Carrying important documents — conflicted about going back inside.',
			type: 'carrying_bag',
			startX: -4,
			startZ: 12,
			speed: 3.1, // ~24% increase from 2.5
			specialEventId: 'npc_valuables_belongings',
			helpDialogue: 'My land documents are still inside. Should I really leave without them?'
		},
		{
			id: 'npc_anuj',
			name: 'Anuj',
			role: 'Child Resident',
			situation: 'Lost and scared after being separated from parents during the evacuation.',
			type: 'child',
			startX: -8,
			startZ: -14,
			speed: 3.6, // ~20% increase from 3.0
			specialEventId: 'npc_child_separated',
			helpDialogue: 'I cannot find my mum! Everyone ran away when the sirens went off. Help!'
		},
		{
			id: 'npc_shruti',
			name: 'Shruti',
			role: 'Resident near power line hazard',
			situation: 'Stranded near a fallen live cable and a rising flood channel.',
			type: 'adult',
			startX: 2,
			startZ: -6,
			speed: 3.4, // ~21% increase from 2.8
			specialEventId: 'scenario_b_electrical_hazard',
			helpDialogue: 'There is a downed power line across the street ahead! How do we get past?'
		}
	];

	for (let i = 0; i < npcConfigs.length; i++) {
		const cfg = npcConfigs[i];
		const visual = buildNpcVisual(cfg.type, cfg.name);
		const startPos = new Vector3(cfg.startX, 0, cfg.startZ);
		visual.group.position.copy(startPos);
		group.add(visual.group);

		// Individual formation spread so civilians never overlap into a single sprite
		const spreadAngle = (i / npcConfigs.length) * Math.PI * 2;
		const spreadRadius = 1.0 + (i % 3) * 0.9;
		const offsetX = Math.cos(spreadAngle) * spreadRadius;
		const offsetZ = Math.sin(spreadAngle) * spreadRadius;

		const npc: CivilianNpc = {
			id: cfg.id,
			name: cfg.name,
			type: cfg.type,
			role: cfg.role,
			situation: cfg.situation,
			group: visual.group,
			position: visual.group.position,
			state: 'unassisted',
			speed: cfg.speed,
			waypoints: [
				new Vector3(cfg.startX + 2, 0, cfg.startZ + (cfg.startZ > 0 ? -2 : 2)),
				new Vector3(WP_ASSEMBLY.x + offsetX * 0.5, 0, WP_ASSEMBLY.z + offsetZ * 0.5),
				new Vector3(WP_SAFE_PLATEAU.x + offsetX * 0.6, 0, WP_SAFE_PLATEAU.z + offsetZ * 0.6),
				new Vector3(WP_SUMMIT_RIDGE.x + offsetX * 0.7, 0, WP_SUMMIT_RIDGE.z + offsetZ * 0.7),
				new Vector3(WP_SUMMIT_OUTPOST.x + offsetX, 0, WP_SUMMIT_OUTPOST.z + offsetZ)
			],
			currentWaypointIndex: 0,
			specialEventId: cfg.specialEventId,
			helpDialogue: cfg.helpDialogue,
			walkPhase: Math.random() * 10,
			isSubmerged: false,
			hasInteracted: false
		};

		bundles.push({ npc, visual });
	}

	function getNearestInteractableNpc(playerPos: Vector3, radius = 4.8): CivilianNpc | null {
		let bestNpc: CivilianNpc | null = null;
		let bestDist = radius;

		for (const { npc } of bundles) {
			// Civilians who have not yet had their player consultation/assistance are always interactable
			if (!npc.hasInteracted || npc.state === 'unassisted') {
				const dist = playerPos.distanceTo(npc.position);
				if (dist < bestDist) {
					bestDist = dist;
					bestNpc = npc;
				}
			}
		}

		return bestNpc;
	}

	function assistNpc(npcId: string): { npc: CivilianNpc; isFirstTime: boolean } | null {
		const found = bundles.find((b) => b.npc.id === npcId);
		if (!found) return null;

		const isFirstTime = !found.npc.hasInteracted;
		found.npc.hasInteracted = true;
		if (found.npc.state === 'unassisted') {
			found.npc.state = 'assisted';
		}
		found.visual.setAssistedVisual(true);
		// Boost speed once assisted — responsive escort pace keeping up with player
		found.npc.speed = Math.max(found.npc.speed * 1.35, 4.8);

		return { npc: found.npc, isFirstTime };
	}

	function update(
		delta: number,
		elapsed: number,
		waterLevel: number,
		getElevation: (x: number, z: number) => number
	) {
		const dt = Math.min(delta, 0.1);

		for (const { npc, visual } of bundles) {
			// Update ground elevation
			const groundY = getElevation(npc.position.x, npc.position.z);
			npc.position.y = groundY;

			// Submersion check
			const waterDepth = Math.max(0, waterLevel - groundY);
			npc.isSubmerged = waterDepth > 0.25;

			// Check if already reached final safety outpost
			if (npc.position.x >= 30 && npc.position.z >= 20 && npc.position.y >= 5.5) {
				npc.state = 'safe';
				if (npc.hasInteracted) {
					visual.markerGroup.visible = false;
				}
			}

			// Civilians only move when assisted by player, or when emergency water rises significantly
			const isUrgent = waterLevel > 1.4 || npc.state === 'assisted';
			const shouldMove = npc.state === 'assisted' || npc.state === 'evacuating' || (waterLevel > 1.6 && npc.type !== 'elderly');

			let isMoving = false;

			if (shouldMove && npc.state !== 'safe') {
				// Target waypoint
				const target = npc.waypoints[npc.currentWaypointIndex];
				if (target) {
					const dx = target.x - npc.position.x;
					const dz = target.z - npc.position.z;
					const dist = Math.sqrt(dx * dx + dz * dz);

					if (dist > 0.8) {
						isMoving = true;
						const dirX = dx / dist;
						const dirZ = dz / dist;

						const currentSpeed = isUrgent ? npc.speed * 1.3 : npc.speed * 0.85;
						npc.position.x += dirX * currentSpeed * dt;
						npc.position.z += dirZ * currentSpeed * dt;

						// Turn to face direction
						const targetAngle = Math.atan2(dirX, dirZ);
						npc.group.rotation.y = targetAngle;
					} else {
						// Advance to next waypoint
						if (npc.currentWaypointIndex < npc.waypoints.length - 1) {
							npc.currentWaypointIndex += 1;
						} else {
							npc.state = 'safe';
							if (npc.hasInteracted) {
								visual.markerGroup.visible = false;
							}
						}
					}
				}
			}

			visual.animateWalk(elapsed + npc.walkPhase, isMoving);
		}
	}

	function getCommunityStatus(waterLevel: number): CommunityStatus {
		let safeCount = 0;
		let needAssistanceCount = 0;
		let evacuatedCount = 0;
		let delayedCount = 0;

		const roster: CivilianMemberStatus[] = [];

		for (const { npc } of bundles) {
			const isSafe = npc.state === 'safe' || (npc.position.x >= 29 && npc.position.z >= 19 && npc.position.y >= 5.5);
			const isAssisted = npc.state === 'assisted' || npc.state === 'evacuating' || !!npc.hasInteracted;
			const isSubmergedUnassisted = npc.isSubmerged && !isAssisted;

			let displayStatus = 'Needs Assistance';
			let dotColor: 'green' | 'amber' | 'red' = 'amber';

			if (isSafe) {
				safeCount += 1;
				evacuatedCount += 1;
				displayStatus = 'Safe';
				dotColor = 'green';
			} else if (isSubmergedUnassisted) {
				delayedCount += 1;
				needAssistanceCount += 1;
				displayStatus = 'In Danger';
				dotColor = 'red';
			} else if (!isAssisted) {
				needAssistanceCount += 1;
				displayStatus = 'Needs Assistance';
				dotColor = 'amber';
			} else {
				evacuatedCount += 1;
				displayStatus = 'Evacuating';
				dotColor = 'green';
			}

			roster.push({
				id: npc.id,
				name: npc.name,
				role: npc.role,
				displayStatus,
				dotColor,
				isSafe,
				isAssisted: isAssisted || isSafe
			});
		}

		return {
			total: bundles.length,
			safe: safeCount,
			needAssistance: needAssistanceCount,
			evacuated: evacuatedCount,
			delayed: delayedCount,
			roster
		};
	}

	function getNpcById(npcId: string): CivilianNpc | null {
		const found = bundles.find((b) => b.npc.id === npcId);
		return found ? found.npc : null;
	}

	function dispose() {
		for (const { visual } of bundles) {
			visual.dispose();
		}
	}

	return {
		group,
		npcs: bundles.map((b) => b.npc),
		update,
		getNearestInteractableNpc,
		assistNpc,
		getNpcById,
		getCommunityStatus,
		dispose
	};
}

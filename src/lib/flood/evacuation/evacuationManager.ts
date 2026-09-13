import type { Vector3 } from 'three';
import type { NpcManager } from '../npc/npcManager';
import type { CivilianNpc, CommunityStatus } from '../npc/npcTypes';

export interface EvacuationManager {
	npcManager: NpcManager;
	getPromptedNpc: (playerPos: Vector3) => CivilianNpc | null;
	assistNpc: (npcId: string) => { npc: CivilianNpc; isFirstTime: boolean } | null;
	getCommunityStatus: (waterLevel: number) => CommunityStatus;
	checkDelayConditions: (waterLevel: number) => { isDelayed: boolean; warningText: string | null };
	update: (delta: number, elapsed: number, waterLevel: number, getElevation: (x: number, z: number) => number) => void;
	dispose: () => void;
}

export function createEvacuationManager(npcManager: NpcManager): EvacuationManager {
	let delayWarningLogged = false;

	function getPromptedNpc(playerPos: Vector3): CivilianNpc | null {
		return npcManager.getNearestInteractableNpc(playerPos, 3.8);
	}

	function assistNpc(npcId: string) {
		return npcManager.assistNpc(npcId);
	}

	function getCommunityStatus(waterLevel: number): CommunityStatus {
		return npcManager.getCommunityStatus(waterLevel);
	}

	function checkDelayConditions(waterLevel: number): { isDelayed: boolean; warningText: string | null } {
		if (waterLevel > 1.4) {
			const status = npcManager.getCommunityStatus(waterLevel);
			if (status.needAssistance > 0) {
				return {
					isDelayed: true,
					warningText: '⚠ EVACUATION DELAYED: Some civilians have not reached the safe zone. Prioritize helping remaining residents!'
				};
			}
		}
		return { isDelayed: false, warningText: null };
	}

	function update(
		delta: number,
		elapsed: number,
		waterLevel: number,
		getElevation: (x: number, z: number) => number
	) {
		npcManager.update(delta, elapsed, waterLevel, getElevation);
	}

	function dispose() {
		npcManager.dispose();
	}

	return {
		npcManager,
		getPromptedNpc,
		assistNpc,
		getCommunityStatus,
		checkDelayConditions,
		update,
		dispose
	};
}

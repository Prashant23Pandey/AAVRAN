import { Group, Vector3 } from 'three';

export type NpcType = 'adult' | 'elderly' | 'child' | 'carrying_bag';

export type NpcEvacState = 'unassisted' | 'assisted' | 'evacuating' | 'safe' | 'delayed' | 'worried' | 'following';

export interface CivilianNpc {
	id: string;
	name: string;
	type: NpcType;
	role: string;
	situation: string;
	group: Group;
	position: Vector3;
	state: NpcEvacState;
	speed: number;
	waypoints: Vector3[];
	currentWaypointIndex: number;
	specialEventId?: string;
	helpDialogue: string;
	walkPhase: number;
	isSubmerged: boolean;
	markerMesh?: Group;
	followTarget?: Vector3;
	hasInteracted?: boolean;
}

export interface CivilianMemberStatus {
	id: string;
	name: string;
	role: string;
	displayStatus: string;
	dotColor: 'green' | 'amber' | 'red';
	isSafe: boolean;
	isAssisted: boolean;
}

export interface CommunityStatus {
	total: number;
	safe: number;
	needAssistance: number;
	evacuated: number;
	delayed: number;
	roster: CivilianMemberStatus[];
}

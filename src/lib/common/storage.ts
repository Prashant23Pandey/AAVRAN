export interface ModeStats {
	bestScore: number | null;
	grade: string | null;
	completed: boolean;
	lastUpdated?: number;
}

export interface SimulatorOverviewStats {
	flood: ModeStats;
	disaster: ModeStats;
	overallReadiness: number; // 0 to 100
}

const FLOOD_STATS_KEY = 'flood_ready_stats';
const DISASTER_STATS_KEY = 'disaster_storm_stats';

export const FLOOD_STATE_KEY = 'flood_training_state';
export const DISASTER_STATE_KEY = 'disaster_training_state';

export function getModeStats(mode: 'flood' | 'disaster'): ModeStats {
	if (typeof window === 'undefined') {
		return { bestScore: null, grade: null, completed: false };
	}
	try {
		const raw = localStorage.getItem(mode === 'flood' ? FLOOD_STATS_KEY : DISASTER_STATS_KEY);
		if (raw) {
			return JSON.parse(raw);
		}
	} catch {
		// ignore
	}
	return { bestScore: null, grade: null, completed: false };
}

export function saveSimulationResult(mode: 'flood' | 'disaster', score: number, grade: string) {
	if (typeof window === 'undefined') return;
	try {
		const current = getModeStats(mode);
		const bestScore = current.bestScore !== null ? Math.max(current.bestScore, score) : score;
		const updated: ModeStats = {
			bestScore,
			grade,
			completed: true,
			lastUpdated: Date.now()
		};
		localStorage.setItem(
			mode === 'flood' ? FLOOD_STATS_KEY : DISASTER_STATS_KEY,
			JSON.stringify(updated)
		);
	} catch {
		// ignore
	}
}

export function getOverviewStats(): SimulatorOverviewStats {
	const flood = getModeStats('flood');
	const disaster = getModeStats('disaster');

	let overallReadiness = 0;
	if (flood.bestScore !== null && disaster.bestScore !== null) {
		overallReadiness = Math.round((flood.bestScore + disaster.bestScore) / 2);
	} else if (flood.bestScore !== null) {
		overallReadiness = Math.round(flood.bestScore * 0.5);
	} else if (disaster.bestScore !== null) {
		overallReadiness = Math.round(disaster.bestScore * 0.5);
	}

	return {
		flood,
		disaster,
		overallReadiness
	};
}

import type { DecisionChoice, TrainingEvent } from './trainingEvents';

export type StagePhase =
	| 'observe' // Phase A: 3-8s environmental observation
	| 'brief' // Phase B: Situation brief (no choices shown yet)
	| 'think' // Phase C: 15-25s decision countdown
	| 'decision' // Phase D: Choices displayed and selectable
	| 'consequence' // Phase E: Educational micro-feedback & consequence
	| 'action' // Phase F: 30-90s physical objective
	| 'continue'; // Phase G: Transition to next stage

export type TrainingMomentType = 'observe' | 'decision' | 'action';
export type TrainingMode = 'guided' | 'standard';

export interface DecisionRecord {
	eventId: string;
	title: string;
	chosenId: 'A' | 'B' | 'C' | 'D';
	choiceText: string;
	isCorrect: boolean;
	feedback: string;
	whyItMatters: string;
}

export interface CheckpointData {
	stage: number;
	safetyScore: number;
	waterLevel: number;
	timeSurvived: number;
	civiliansAssisted: number;
	completedEventIds: string[];
	inventory?: EmergencyInventory;
	explorationStats?: ExplorationStats;
}

export interface CascadingState {
	gasLeakHandled: boolean;
	gasHazardSeverity: 'NONE' | 'LOW' | 'HIGH';
	structuralRisk: boolean;
	fireEncounter: boolean;
	aftershockPrepared: boolean;
	routeChoice: 'NONE' | 'SHORT_RISKY' | 'LONG_SAFE';
	vulnerablePeopleHelped: number;
	structuralHazardsAvoided: number;
}

export type EmergencyItemType = 'flashlight' | 'firstAid' | 'radio' | 'water' | 'whistle';

export interface EmergencyInventory {
	flashlight: boolean;
	firstAid: boolean;
	radio: boolean;
	water: boolean;
	whistle: boolean;
}

export interface StageObjectiveItem {
	id: string;
	text: string;
	completed: boolean;
	isOptional: boolean;
	progress?: string;
}

export interface ExplorationStats {
	hazardsIdentified: number;
	itemsCollected: number;
	optionalCompleted: number;
	totalReadinessBonus: number;
}

export interface TrainingState {
	safetyScore: number;
	decisionsCorrect: number;
	decisionsTotal: number;
	hazardsEncountered: number;
	timeSurvived: number;
	maxWaterLevel: number;
	completedEventIds: string[];
	activeEvent: TrainingEvent | null;
	lastDecisionRecord: DecisionRecord | null;
	isSimulationPaused: boolean;
	history: DecisionRecord[];
	isCompleted: boolean;
	civiliansTotal: number;
	civiliansAssisted: number;
	civiliansSafe: number;
	evacuationDelays: number;
	currentStage: number; // 1 to 10
	checkpointStage: number; // 0 (none) or 1..5
	stageCheckpoints: Record<number, CheckpointData>;
	cascading: CascadingState;

	// Enhanced Training Simulator additions
	trainingMode: TrainingMode;
	currentPhase: StagePhase;
	momentType: TrainingMomentType;
	phaseTimeRemaining: number;
	decisionTimeRemaining: number;
	isDecisionTimerActive: boolean;
	isAssessing: boolean;
	phasePrompt: string | null;
	decisionTimerNotice: string | null;

	// Gameplay Expansion: Inventory & Multi-Objective Engine
	inventory: EmergencyInventory;
	stageObjectives: StageObjectiveItem[];
	explorationStats: ExplorationStats;

	// Decision pacing cooldown
	lastDecisionCompletedAt: number;
	minGameplayBetweenDecisions: number;
}

export function createInitialTrainingState(): TrainingState {
	return {
		safetyScore: 100,
		decisionsCorrect: 0,
		decisionsTotal: 0,
		hazardsEncountered: 0,
		timeSurvived: 0,
		maxWaterLevel: -0.4,
		completedEventIds: [],
		activeEvent: null,
		lastDecisionRecord: null,
		isSimulationPaused: false,
		history: [],
		isCompleted: false,
		civiliansTotal: 10,
		civiliansAssisted: 0,
		civiliansSafe: 0,
		evacuationDelays: 0,
		currentStage: 1,
		checkpointStage: 0,
		stageCheckpoints: {},
		cascading: {
			gasLeakHandled: false,
			gasHazardSeverity: 'NONE',
			structuralRisk: false,
			fireEncounter: false,
			aftershockPrepared: false,
			routeChoice: 'NONE',
			vulnerablePeopleHelped: 0,
			structuralHazardsAvoided: 0
		},

		// Defaults
		trainingMode: 'guided',
		currentPhase: 'observe',
		momentType: 'observe',
		phaseTimeRemaining: 5.0,
		decisionTimeRemaining: 20,
		isDecisionTimerActive: false,
		isAssessing: false,
		phasePrompt: null,
		decisionTimerNotice: null,

		// Inventory & Multi-Objectives
		inventory: {
			flashlight: false,
			firstAid: false,
			radio: false,
			water: false,
			whistle: false
		},
		stageObjectives: [],
		explorationStats: {
			hazardsIdentified: 0,
			itemsCollected: 0,
			optionalCompleted: 0,
			totalReadinessBonus: 0
		},
		lastDecisionCompletedAt: 0,
		minGameplayBetweenDecisions: 14 // Reduced from 75s to 14s for responsive decision pacing
	};
}

export class TrainingStateManager {
	private state: TrainingState;
	private listeners: ((state: TrainingState) => void)[] = [];

	constructor(initialState?: Partial<TrainingState>) {
		this.state = {
			...createInitialTrainingState(),
			...initialState
		};
	}

	public getState(): TrainingState {
		return { ...this.state };
	}

	public subscribe(listener: (state: TrainingState) => void): () => void {
		this.listeners.push(listener);
		listener(this.getState());
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	private notify() {
		const s = this.getState();
		for (const listener of this.listeners) {
			listener(s);
		}
	}

	public setTrainingMode(mode: TrainingMode) {
		this.state.trainingMode = mode;
		this.notify();
	}

	public setAssessing(active: boolean) {
		this.state.isAssessing = active;
		this.state.isSimulationPaused = active || this.state.activeEvent !== null;
		this.notify();
	}

	public setSimulationPaused(paused: boolean) {
		this.state.isSimulationPaused = paused;
		this.notify();
	}

	public setPhase(
		phase: StagePhase,
		durationSeconds = 0,
		prompt: string | null = null,
		momentType: TrainingMomentType = 'decision'
	) {
		this.state.currentPhase = phase;
		this.state.phaseTimeRemaining = durationSeconds;
		this.state.phasePrompt = prompt;
		this.state.momentType = momentType;

		if (phase === 'think') {
			this.state.isDecisionTimerActive = true;
			this.state.decisionTimeRemaining = durationSeconds > 0 ? durationSeconds : 20;
			this.state.decisionTimerNotice = null;
		} else if (phase === 'decision') {
			this.state.isDecisionTimerActive = false;
		} else if (phase === 'consequence' || phase === 'action' || phase === 'continue') {
			this.state.isDecisionTimerActive = false;
			this.state.decisionTimerNotice = null;
		}

		this.notify();
	}

	public triggerEvent(event: TrainingEvent): boolean {
		if (this.state.completedEventIds.includes(event.id) || this.state.activeEvent !== null) {
			return false;
		}
		// Strict stage enforcement: if event specifies stageActive, it MUST match currentStage
		if (event.stageActive !== undefined && event.stageActive !== this.state.currentStage) {
			return false;
		}
		this.state.activeEvent = event;
		this.state.isSimulationPaused = true;
		// Default decision thinking window: Guided mode gets 25s, Standard mode gets 18s
		const thinkDuration = this.state.trainingMode === 'guided' ? 25 : 18;
		this.setPhase('think', thinkDuration, event.situation, 'decision');
		this.notify();
		return true;
	}

	public updateCascading(partial: Partial<CascadingState>) {
		this.state.cascading = {
			...this.state.cascading,
			...partial
		};
		this.notify();
	}

	public submitDecision(choiceId: 'A' | 'B' | 'C' | 'D'): DecisionRecord | null {
		const event = this.state.activeEvent;
		if (!event) return null;

		const choice = event.choices.find((c) => c.id === choiceId);
		if (!choice) return null;

		const isCorrect = choice.isCorrect;
		if (!isCorrect) {
			// Guided mode gives safe educational correction (-5 score), Standard mode gives realistic -15
			const penalty = this.state.trainingMode === 'guided' ? 5 : 15;
			this.state.safetyScore = Math.max(0, this.state.safetyScore - penalty);
		} else {
			this.state.decisionsCorrect += 1;
		}

		this.state.decisionsTotal += 1;
		this.state.completedEventIds.push(event.id);

		const record: DecisionRecord = {
			eventId: event.id,
			title: event.title,
			chosenId: choice.id,
			choiceText: choice.text,
			isCorrect,
			feedback: choice.feedback,
			whyItMatters: event.whyItMatters
		};

		this.state.lastDecisionRecord = record;
		this.state.history.push(record);
		this.state.currentPhase = 'consequence';
		this.state.isDecisionTimerActive = false;
		this.notify();
		return record;
	}

	public resumeFromDecision() {
		this.state.activeEvent = null;
		this.state.lastDecisionRecord = null;
		this.state.isSimulationPaused = this.state.isAssessing;
		this.state.currentPhase = 'action';
		this.state.isDecisionTimerActive = false;
		this.state.lastDecisionCompletedAt = this.state.timeSurvived;
		this.notify();
	}

	public canTriggerDecision(): boolean {
		if (this.state.activeEvent !== null) return false;
		if (this.state.lastDecisionCompletedAt === 0) return true;
		return (this.state.timeSurvived - this.state.lastDecisionCompletedAt) >= this.state.minGameplayBetweenDecisions;
	}

	public recordHazard(count = 1) {
		this.state.hazardsEncountered += count;
		this.notify();
	}

	public recordCivilianAssisted() {
		this.state.civiliansAssisted += 1;
		this.notify();
	}

	public recordEvacuationDelay(count = 1) {
		this.state.evacuationDelays += count;
		this.notify();
	}

	public setCommunityStats(total: number, safe: number, needAssistance: number, delays: number) {
		this.state.civiliansTotal = total;
		this.state.civiliansSafe = safe;
		this.state.evacuationDelays = delays;
		this.notify();
	}

	public updateTime(delta: number, currentWaterLevel: number) {
		if (!this.state.isSimulationPaused && !this.state.isCompleted) {
			this.state.timeSurvived += delta;
			if (currentWaterLevel > this.state.maxWaterLevel) {
				this.state.maxWaterLevel = currentWaterLevel;
			}

			// Countdown for active phase (observe / brief / action / continue)
			if (this.state.phaseTimeRemaining > 0) {
				this.state.phaseTimeRemaining = Math.max(0, this.state.phaseTimeRemaining - delta);
			}

			// Countdown for decision timer if active
			if (this.state.isDecisionTimerActive) {
				this.state.decisionTimeRemaining = Math.max(0, this.state.decisionTimeRemaining - delta);
				if (this.state.decisionTimeRemaining <= 0) {
					// Spec #7: If timer runs out, do NOT punish a beginner.
					// Show "Take a moment and assess the situation" and allow additional time
					this.state.decisionTimerNotice = 'Take a moment and assess the situation.';
					this.state.decisionTimeRemaining = 15; // Provide extension
				}
			}

			this.notify();
		}
	}

	public setStage(stage: number) {
		this.state.currentStage = Math.max(1, Math.min(10, stage));
		this.notify();
	}

	public advanceStage(): number {
		if (this.state.currentStage < 10) {
			this.state.currentStage += 1;
			this.notify();
		}
		return this.state.currentStage;
	}

	public collectItem(item: EmergencyItemType): { isNew: boolean; item: EmergencyItemType } {
		const isNew = !this.state.inventory[item];
		this.state.inventory[item] = true;
		if (isNew) {
			this.state.explorationStats.itemsCollected += 1;
			this.state.explorationStats.totalReadinessBonus += 3;
			this.state.safetyScore = Math.min(100, this.state.safetyScore + 3);
			this.notify();
		}
		return { isNew, item };
	}

	public setStageObjectives(primaryOrAll: StageObjectiveItem[], optional?: StageObjectiveItem[]) {
		const combined = optional ? [...primaryOrAll, ...optional] : primaryOrAll;
		this.state.stageObjectives = combined.map((obj) => ({ ...obj }));
		this.notify();
	}

	public completeStageObjective(id: string): { completed: boolean; allPrimaryDone: boolean; objective?: StageObjectiveItem } {
		const obj = this.state.stageObjectives.find((o) => o.id === id);
		if (!obj || obj.completed) {
			const allDone = this.areAllPrimaryObjectivesCompleted();
			return { completed: false, allPrimaryDone: allDone, objective: obj };
		}

		obj.completed = true;
		if (obj.isOptional) {
			this.state.explorationStats.optionalCompleted += 1;
			this.state.explorationStats.totalReadinessBonus += 5;
			this.state.safetyScore = Math.min(100, this.state.safetyScore + 5);
		} else {
			this.state.explorationStats.totalReadinessBonus += 5;
			this.state.safetyScore = Math.min(100, this.state.safetyScore + 5);
		}

		const allPrimaryDone = this.areAllPrimaryObjectivesCompleted();
		this.notify();
		return { completed: true, allPrimaryDone, objective: obj };
	}

	public updateObjectiveProgress(id: string, progressText: string) {
		const obj = this.state.stageObjectives.find((o) => o.id === id);
		if (obj) {
			obj.progress = progressText;
			this.notify();
		}
	}

	public areAllPrimaryObjectivesCompleted(): boolean {
		const primary = this.state.stageObjectives.filter((o) => !o.isOptional);
		if (primary.length === 0) return false;
		return primary.every((o) => o.completed);
	}

	public identifyHazard(points = 5) {
		this.state.explorationStats.hazardsIdentified += 1;
		this.state.explorationStats.totalReadinessBonus += points;
		this.state.safetyScore = Math.min(100, this.state.safetyScore + points);
		this.notify();
	}

	public saveCheckpoint(checkpointNum: number, currentWaterLevel?: number) {
		const data: CheckpointData = {
			stage: this.state.currentStage,
			safetyScore: this.state.safetyScore,
			waterLevel: currentWaterLevel ?? this.state.maxWaterLevel,
			timeSurvived: this.state.timeSurvived,
			civiliansAssisted: this.state.civiliansAssisted,
			completedEventIds: [...this.state.completedEventIds],
			inventory: { ...this.state.inventory },
			explorationStats: { ...this.state.explorationStats }
		};
		this.state.stageCheckpoints[checkpointNum] = data;
		if (checkpointNum > this.state.checkpointStage) {
			this.state.checkpointStage = checkpointNum;
		}
		this.notify();
	}

	public restoreCheckpoint(checkpointNum: number): CheckpointData | null {
		const cp = this.state.stageCheckpoints[checkpointNum];
		if (!cp) return null;

		this.state.currentStage = cp.stage;
		this.state.safetyScore = cp.safetyScore;
		this.state.timeSurvived = cp.timeSurvived;
		this.state.civiliansAssisted = cp.civiliansAssisted;
		this.state.completedEventIds = [...cp.completedEventIds];
		if (cp.inventory) {
			this.state.inventory = { ...cp.inventory };
		}
		if (cp.explorationStats) {
			this.state.explorationStats = { ...cp.explorationStats };
		}
		this.state.isCompleted = false;
		this.state.isSimulationPaused = false;
		this.state.activeEvent = null;
		this.state.lastDecisionRecord = null;
		this.state.isAssessing = false;
		this.state.currentPhase = 'observe';
		this.state.phaseTimeRemaining = 4.0;
		this.notify();
		return cp;
	}

	public completeTraining() {
		this.state.isCompleted = true;
		this.state.isSimulationPaused = true;
		this.state.currentPhase = 'continue';
		this.notify();
	}

	public reset() {
		// Retain highest checkpoint achieved for resume option
		const savedCheckpoints = { ...this.state.stageCheckpoints };
		const highestCp = this.state.checkpointStage;
		const currentMode = this.state.trainingMode;
		this.state = createInitialTrainingState();
		this.state.stageCheckpoints = savedCheckpoints;
		this.state.checkpointStage = highestCp;
		this.state.trainingMode = currentMode;
		this.notify();
	}
}

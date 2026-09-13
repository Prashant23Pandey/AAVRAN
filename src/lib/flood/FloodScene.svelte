<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createFloodScene,
		type FloodSceneRuntime,
		type FloodSimulationTelemetry
	} from './createFloodScene';
	import {
		TrainingStateManager,
		type TrainingState,
		createInitialTrainingState
	} from './trainingState';
	import { STAGE_DEFINITIONS, type StageDefinition } from './stageManager';
	import TrainingStart from './TrainingStart.svelte';
	import TrainingDecision from './TrainingDecision.svelte';
	import TrainingComplete from './TrainingComplete.svelte';
	import PauseAssessModal from './PauseAssessModal.svelte';
	import LevelCompleteModal from '../common/LevelCompleteModal.svelte';
	import type { AudioCaption } from './audio/audioManager';

	let { onExitToMenu }: { onExitToMenu?: () => void } = $props();

	let canvasContainer = $state<HTMLDivElement | null>(null);
	let runtime: FloodSceneRuntime | null = null;

	const trainingManager = new TrainingStateManager();
	let trainingState = $state<TrainingState>(trainingManager.getState());

	let showStartModal = $state(true);
	let showScenarioReview = $state(false);
	let showCheckpointModal = $state(false);
	let showPauseAssessModal = $state(false);
	let showVolumePanel = $state(false);
	let audioFeedbackToast = $state<string | null>(null);
	let audioToastTimer: ReturnType<typeof setTimeout> | null = null;
	let liveCaption = $state<AudioCaption | null>(null);
	let captionTimer: ReturnType<typeof setTimeout> | null = null;

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	const stageAssessments: Record<number, { danger: string; direction: string; help: string; avoid: string }> = {
		1: {
			danger: 'Torrential rainfall causing rapid flood wave downstream in the river basin.',
			direction: 'Eastward toward the paved evacuation roadway and higher ground.',
			help: 'Alert nearby neighbors to gather vital supplies and prepare to evacuate.',
			avoid: 'Low riverbank edges, basements, and delay.'
		},
		2: {
			danger: 'Rising water beginning to submerge street gutters and trap unwarned residents.',
			direction: 'Follow safety signs uphill toward the neighborhood intersection.',
			help: 'Prashant, Manvi, and Shivani standing near low-elevation buildings.',
			avoid: 'Lingering inside structures or returning for non-essential belongings.'
		},
		3: {
			danger: 'Low roadway underpass collecting deep, fast-moving runoff.',
			direction: 'The elevated gravel hillside path marked with orange safety beacons.',
			help: 'Direct any walking evacuees away from the submerged underpass.',
			avoid: 'Paved underpasses and road depressions that hide drowning hazards.'
		},
		4: {
			danger: 'Damaged electrical utility transformer sparking in standing water.',
			direction: 'Detour widely uphill around the transformer perimeter (at least 10m).',
			help: 'Shruti stranded near the power line hazard and approaching residents.',
			avoid: 'Within 10 meters of fallen wires, wet soil, or submerged metal poles.'
		},
		5: {
			danger: 'Fast-moving slope runoff, building inundation, and upstream flood surge wave.',
			direction: 'Accelerate pace upward along hillside terraces toward the upper safety plateau (+4.8m).',
			help: 'Elderly resident Prashanthi, separated child Anuj, and ridge residents.',
			avoid: 'Basements, elevators, uneven saturated slopes, and resting in the floodway.'
		},
		6: {
			danger: 'Airlift marshalling safety, helicopter rotor wash, and steep summit switchbacks.',
			direction: 'The Summit Rescue Outpost and Helipad at highest elevation (+8.8m).',
			help: 'Submit evacuee manifest at triage and coordinate helicopter relief boarding.',
			avoid: 'Approaching running helicopters without ground crew signal; long vertical items.'
		}
	};

	let volumeSettings = $state({
		master: 80,
		water: 70,
		alerts: 85,
		ui: 75
	});

	let telemetry = $state<FloodSimulationTelemetry>({
		waterLevel: -0.4,
		playerAltitude: 0.2,
		waterDepthAtPlayer: 0,
		isWadingInWater: false,
		missionStage: 'higher_ground',
		stageNumber: 1,
		stageTitle: 'STAGE 1: FLOOD WARNING',
		stageShortTitle: 'Flood Warning',
		stageObjective: 'Review emergency advisory and evacuate the lower river basin.',
		stageInstructions: 'An official flood advisory is issued. Pack essentials and move away from the river bank.',
		missionTitle: 'STAGE 1: FLOOD WARNING',
		missionInstruction: 'An official flood advisory is issued. Pack essentials and move away from the river bank.',
		missionSuccessMessage: null,
		warningNotice: null,
		pressureStage: 'LOW',
		pressureAlertText: 'Water level stable. Proceed with evacuation.',
		zoneStatus: 'NORMAL',
		communityStatus: { total: 10, safe: 0, needAssistance: 10, evacuated: 0, delayed: 0, roster: [] },
		promptedCivilian: null,
		promptedInteractable: null,
		stageObjectives: [],
		inventory: { flashlight: false, firstAid: false, radio: false, water: false, whistle: false },
		explorationStats: { hazardsIdentified: 0, itemsCollected: 0, optionalCompleted: 0, totalReadinessBonus: 0 },
		sunlightFactor: 1.0,
		avoidHazard: '🌊 Fast-rising water at the riverbank',
		momentType: 'observe',
		dangerLevel: 0.15,
		stageElapsedTime: 0,
		evacuationDelayNotice: null,
		checkpointNotice: null,
		activeCheckpoint: 0,
		houseRescueIndicators: [],
		completedLevelModalData: null
	});

	let speedSetting = $state<'normal' | 'medium' | 'fast' | 'pause'>('normal');
	let isAudioMuted = $state(false);
	let showSettingsPanel = $state(false);

	const speedLabels: Record<string, string> = {
		pause: '⏸ Paused',
		normal: '1x Normal',
		medium: '2x Medium',
		fast: '3x Fast'
	};

	function handleSetSpeed(setting: 'normal' | 'medium' | 'fast' | 'pause') {
		speedSetting = setting;
		if (!runtime) return;
		if (setting === 'pause') runtime.setWaterSpeed(0);
		else if (setting === 'fast') runtime.setWaterSpeed(0.14);
		else if (setting === 'medium') runtime.setWaterSpeed(0.07);
		else runtime.setWaterSpeed(runtime.stageManager.getRecommendedWaterSpeed());
	}

	function handleResetClick() {
		if (trainingState.checkpointStage > 0) {
			showCheckpointModal = true;
		} else {
			executeFullReset();
		}
	}

	function executeFullReset() {
		runtime?.resetSimulation();
		trainingManager.reset();
		handleSetSpeed(speedSetting);
		showScenarioReview = false;
		showCheckpointModal = false;
	}

	function handleResumeCheckpoint(cpNum: number) {
		runtime?.resumeFromCheckpoint(cpNum);
		handleSetSpeed(speedSetting);
		showScenarioReview = false;
		showCheckpointModal = false;
	}

	function handleStartTraining(mode: 'guided' | 'standard' = 'guided') {
		trainingManager.setTrainingMode(mode);
		trainingManager.setSimulationPaused(false);
		showStartModal = false;
		runtime?.player.setPaused(false);
		handleSetSpeed('normal');
		runtime?.audioManager.startWaterAmbience();
	}

	function handleOpenPauseAssess() {
		showPauseAssessModal = true;
		runtime?.player.setPaused(true);
		trainingManager.setAssessing(true);
	}

	function handleClosePauseAssess() {
		showPauseAssessModal = false;
		runtime?.player.setPaused(false);
		trainingManager.setAssessing(false);
	}

	function handleDecisionChoice(choiceId: 'A' | 'B' | 'C' | 'D') {
		const rec = trainingManager.submitDecision(choiceId);
		if (rec && runtime) {
			runtime.audioManager.play(rec.isCorrect ? 'decision_correct' : 'decision_wrong');
			trainingManager.completeStageObjective(rec.eventId);
		}
	}

	function handleDecisionContinue() {
		runtime?.audioManager.play('decision_continue');
		trainingManager.resumeFromDecision();
	}

	function handleAssistCivilian(id: string) {
		runtime?.assistCivilian(id);
	}

	function handleToggleAudio() {
		if (!runtime) return;
		const nextMute = !isAudioMuted;
		runtime.audioManager.setMuted(nextMute);
		isAudioMuted = nextMute;
	}

	function handleVolumeChange(channel: 'master' | 'water' | 'alerts' | 'ui', val: number) {
		volumeSettings[channel] = val;
		runtime?.audioManager.setVolume(channel, val / 100);
	}

	onMount(() => {
		if (!canvasContainer) return;

		const unsubscribe = trainingManager.subscribe((s) => {
			trainingState = s;
		});

		runtime = createFloodScene(
			canvasContainer,
			(data) => {
				telemetry = data;
			},
			trainingManager
		);

		// Freeze simulation and pause player while start screen is showing
		trainingManager.setSimulationPaused(true);
		runtime.player.setPaused(true);
		runtime.setWaterSpeed(0);

		// Load initial audio volumes
		const vols = runtime.audioManager.getVolumes();
		volumeSettings = {
			master: Math.round(vols.master * 100),
			water: Math.round(vols.water * 100),
			alerts: Math.round(vols.alerts * 100),
			ui: Math.round(vols.ui * 100)
		};

		// Subscribe to audio feedback events for HUD toast
		const unsubFeedback = runtime.audioManager.onFeedback((label) => {
			audioFeedbackToast = label;
			if (audioToastTimer) clearTimeout(audioToastTimer);
			audioToastTimer = setTimeout(() => {
				audioFeedbackToast = null;
			}, 2600);
		});

		// Subscribe to live audio captions for accessibility
		const unsubCaption = runtime.audioManager.onCaption((cap) => {
			liveCaption = cap;
			if (captionTimer) clearTimeout(captionTimer);
			captionTimer = setTimeout(() => {
				liveCaption = null;
			}, 3200);
		});

		let animationId: number;
		let lastTime = performance.now();

		function tick(time: number) {
			const delta = Math.min((time - lastTime) / 1000, 0.1); // clamp large deltas
			lastTime = time;

			runtime?.update(delta);
			animationId = requestAnimationFrame(tick);
		}

		animationId = requestAnimationFrame(tick);

		const handleResize = () => {
			if (!canvasContainer || !runtime) return;
			const w = Math.max(canvasContainer.clientWidth, 1);
			const h = Math.max(canvasContainer.clientHeight, 1);
			runtime.camera.aspect = w / h;
			runtime.camera.updateProjectionMatrix();
			runtime.renderer.setSize(w, h);
		};

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === 'KeyE') {
				runtime?.interact();
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(canvasContainer);

		return () => {
			cancelAnimationFrame(animationId);
			window.removeEventListener('keydown', handleKeyDown);
			resizeObserver.disconnect();
			unsubFeedback();
			unsubCaption();
			unsubscribe();
			if (audioToastTimer) clearTimeout(audioToastTimer);
			if (captionTimer) clearTimeout(captionTimer);
			runtime?.dispose();
			runtime = null;
		};
	});
</script>

<div class="flood-scene-wrapper">
	<!-- 3D WebGL Canvas Host -->
	<div bind:this={canvasContainer} class="flood-canvas" role="region" aria-label="3D Flood Simulation"></div>

	<!-- Floating In-World House Rescue Overlays (Distance-Gated Emergency Badges) -->
	{#if !showStartModal && !trainingState.isCompleted && telemetry.houseRescueIndicators && telemetry.houseRescueIndicators.length > 0}
		<div class="house-indicators-layer" aria-hidden="true">
			{#each telemetry.houseRescueIndicators as ind (ind.npcId)}
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
									<div class="bcard-action">[ ENTER HOUSE &amp; RESCUE ] <span class="key-tag">(Press E)</span></div>
								{:else if ind.rescueState === 'rescue_in_progress'}
									<div class="bcard-sub in-progress">Escorting <strong>{ind.npcName}</strong></div>
									<div class="bcard-action in-progress">Lead to Higher Ground!</div>
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

	<!-- Flood Survival Start Screen Modal (Displays First) -->
	{#if showStartModal}
		<TrainingStart onStart={handleStartTraining} onExit={onExitToMenu} />
	{/if}

	{#if !showStartModal}
		<!-- Top Center Command Bar: Clock, Stage Pacing & Pause/Assess (Spec #7, #8, #15) -->
		<header class="top-training-bar">
		{#if onExitToMenu}
			<button type="button" class="menu-back-btn" onclick={onExitToMenu}>
				◂ Mode Menu
			</button>
		{/if}

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
			<span class="stage-tag">FLOOD READY</span>
			<span class="stage-pill-num">LEVEL {telemetry.stageNumber}/6</span>
			<span class="stage-pill-title">{telemetry.stageShortTitle.toUpperCase()}</span>
		</div>

		<button type="button" class="btn-pause-assess" onclick={handleOpenPauseAssess} aria-label="Pause and Assess Situation">
			<span class="pause-icon">⏸️</span>
			<span>PAUSE &amp; ASSESS</span>
		</button>
	</header>

	<!-- Pause & Assess Tactical Modal (Spec #8) -->
	{#if showPauseAssessModal}
		<PauseAssessModal
			stageNumber={telemetry.stageNumber}
			stageTitle={telemetry.stageShortTitle}
			immediateDanger={stageAssessments[telemetry.stageNumber]?.danger}
			safestDirection={stageAssessments[telemetry.stageNumber]?.direction}
			whoNeedsHelp={stageAssessments[telemetry.stageNumber]?.help}
			whatToAvoid={stageAssessments[telemetry.stageNumber]?.avoid}
			onContinue={handleClosePauseAssess}
		/>
	{/if}

	<!-- Active Training Decision Modal -->
	{#if trainingState.activeEvent}
		<TrainingDecision
			event={trainingState.activeEvent}
			lastRecord={trainingState.lastDecisionRecord}
			trainingMode={trainingState.trainingMode}
			onChoose={handleDecisionChoice}
			onContinue={handleDecisionContinue}
		/>
	{/if}

	<!-- Inter-Level Completion Modal (Levels 1 to 5) -->
	{#if telemetry.completedLevelModalData}
		<LevelCompleteModal
			levelNumber={telemetry.completedLevelModalData.levelNumber}
			levelName={telemetry.completedLevelModalData.levelName}
			primaryCompleted={telemetry.completedLevelModalData.primaryCompleted}
			primaryTotal={telemetry.completedLevelModalData.primaryTotal}
			optionalCompleted={telemetry.completedLevelModalData.optionalCompleted}
			optionalTotal={telemetry.completedLevelModalData.optionalTotal}
			civiliansHelped={telemetry.completedLevelModalData.civiliansHelped}
			hazardsIdentified={telemetry.completedLevelModalData.hazardsIdentified}
			safetyLesson={telemetry.completedLevelModalData.safetyLesson}
			nextLevelNumber={telemetry.completedLevelModalData.nextLevelNumber}
			onContinue={() => runtime?.advanceToNextLevel()}
			onSelectLevel={(lvl) => runtime?.jumpToLevel(lvl)}
		/>
	{/if}

	<!-- Training Completion Report -->
	{#if trainingState.isCompleted && !showScenarioReview}
		<TrainingComplete
			state={trainingState}
			onRestart={handleResetClick}
			onReviewScenarios={() => (showScenarioReview = true)}
		/>
	{/if}

	<!-- Checkpoint Prompt Modal -->
	{#if showCheckpointModal}
		<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cp-modal-title">
			<div class="checkpoint-modal-card">
				<div class="cp-modal-badge">SAVED CHECKPOINT AVAILABLE</div>
				<h3 id="cp-modal-title" class="cp-modal-title">Resume Training Run?</h3>
				<p class="cp-modal-desc">
					You previously reached <strong>Checkpoint {trainingState.checkpointStage}</strong> in this simulation.
					Would you like to resume from your checkpoint or start over from the beginning?
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

	<!-- Scenario Review Modal -->
	{#if showScenarioReview}
		<div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-title">
			<div class="review-card">
				<div class="review-header">
					<h2 id="review-title" class="review-title">Decision History & Educational Review</h2>
					<button type="button" class="close-btn" onclick={() => (showScenarioReview = false)}>✕</button>
				</div>
				<p class="review-desc">Review your choices and safety lessons from this evacuation run.</p>

				<div class="history-list">
					{#each trainingState.history as item, idx}
						<div class="history-item" class:correct={item.isCorrect} class:wrong={!item.isCorrect}>
							<div class="item-head">
								<span class="item-num">Scenario {idx + 1}</span>
								<span class="item-title">{item.title}</span>
								<span class="item-status">{item.isCorrect ? '✓ Correct (+0)' : '⚠ Unsafe (-15)'}</span>
							</div>
							<p class="item-choice"><strong>Your Action:</strong> [{item.chosenId}] {item.choiceText}</p>
							<p class="item-feedback">{item.feedback}</p>
							<div class="item-matters">
								<span class="matters-head">Key Lesson:</span>
								<span>{item.whyItMatters}</span>
							</div>
						</div>
					{:else}
						<p class="empty-text">No scenarios encountered yet. Explore the lower town to trigger training scenarios.</p>
					{/each}
				</div>

				<div class="review-footer">
					<button type="button" class="btn-primary" onclick={() => (showScenarioReview = false)}>
						Back to Assessment
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Audio Feedback HUD Toast (Auto-fade) -->
	{#if audioFeedbackToast}
		<div class="audio-feedback-toast" role="status">
			<span class="af-icon">🔊</span>
			<span class="af-text">{audioFeedbackToast}</span>
		</div>
	{/if}

	<!-- Accessible Live Audio Caption Subtitle Toast (Spec #19) -->
	{#if liveCaption}
		<div class="audio-caption-bar" role="status" aria-live="polite">
			<span class="cap-icon">{liveCaption.icon}</span>
			<span class="cap-text">{liveCaption.text}</span>
		</div>
	{/if}

	<!-- Checkpoint Toast -->
	{#if telemetry.checkpointNotice}
		<div class="checkpoint-toast" role="status">
			<span class="cp-icon">💾</span>
			<span class="cp-text">{telemetry.checkpointNotice}</span>
		</div>
	{/if}

	<!-- Top Dynamic Flood Pressure Alert Banner -->
	{#if telemetry.warningNotice}
		<div
			class="hazard-banner"
			role="alert"
			class:danger={telemetry.pressureStage === 'CRITICAL' || telemetry.zoneStatus === 'DANGER' || telemetry.stageNumber === 7}
		>
			<div class="hazard-icon">⚠️</div>
			<div class="hazard-text">
				<strong>{telemetry.zoneStatus === 'DANGER' ? 'ELECTRICAL HAZARD' : telemetry.stageNumber === 7 ? 'FLASH FLOOD SURGE' : telemetry.pressureStage}</strong>: {telemetry.warningNotice}
			</div>
		</div>
	{/if}

	<!-- Mission Success Toast -->
	{#if telemetry.missionSuccessMessage}
		<div class="success-toast" role="status">
			<div class="success-icon">✓</div>
			<div class="success-text">
				{telemetry.missionSuccessMessage}
			</div>
		</div>
	{/if}

	<!-- Left Side Column: Stage Brief, Objectives, Inventory & Milestones -->
	<aside class="left-hud-column">
		<!-- Unified Left HUD Card: Brief, Objectives, Inventory & Guidance -->
		<div class="hud-card stage-brief-card">
			<div class="card-badge">
				<span class="live-dot"></span>
				LEVEL {telemetry.stageNumber} OF 6
			</div>
			<h2 class="card-title">{telemetry.missionTitle}</h2>
			<p class="mission-desc">{telemetry.missionInstruction}</p>

			<!-- Objective & Avoid Guidance (Spec #15) -->
			<div class="objective-avoid-box">
				<div class="obj-line">
					<span class="obj-tag">🎯 OBJECTIVE:</span>
					<span class="obj-text">{telemetry.stageObjective}</span>
				</div>
				{#if telemetry.avoidHazard}
					<div class="avoid-line">
						<span class="avoid-tag">⚠️ AVOID:</span>
						<span class="avoid-text">{telemetry.avoidHazard}</span>
					</div>
				{/if}
			</div>

			<!-- Nearby House Rescue Directive Callout -->
			{#if telemetry.houseRescueIndicators?.some((h) => h.distance < 18 && h.rescueState === 'needs_help')}
				{@const nearHouse = telemetry.houseRescueIndicators.find((h) => h.distance < 18 && h.rescueState === 'needs_help')}
				{#if nearHouse}
					<div class="house-rescue-directive-box" role="status">
						<div class="hrd-header">
							<span class="hrd-badge">🚨 PERSON INSIDE</span>
							<span class="hrd-dist">{Math.round(nearHouse.distance)}m away</span>
						</div>
						<div class="hrd-title">{nearHouse.houseLabel}</div>
						<div class="hrd-resident">Resident: <strong>{nearHouse.npcName}</strong></div>
						<div class="hrd-desc">Someone is inside and requires emergency evacuation assistance!</div>
						<ul class="hrd-steps">
							<li>→ Approach marked building</li>
							<li>→ Locate resident inside</li>
							<li>→ Press <strong>[E]</strong> to assist &amp; escort to safety</li>
						</ul>
					</div>
				{/if}
			{/if}

			<!-- Stage Objectives Checklist Dropdown (Primary & Optional) -->
			{#if telemetry.stageObjectives && telemetry.stageObjectives.length > 0}
				<div class="stage-objectives-card">
					<div class="objectives-header">
						<div class="obj-header-left">
							<span class="obj-header-title">📋 STAGE OBJECTIVES</span>
						</div>
						<span class="obj-header-count">
							{telemetry.stageObjectives.filter((o) => !o.isOptional && o.completed).length} / {telemetry.stageObjectives.filter((o) => !o.isOptional).length}
						</span>
					</div>
					<div class="objectives-list">
						{#each telemetry.stageObjectives as obj}
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
				</div>
			{/if}


			<!-- Collapsible 6-Level Progression Flow -->
			<details class="collapsible-section">
				<summary class="collapsible-summary">
					<span class="summary-label">🗺️ Training Milestones</span>
					<span class="summary-badge">Level {telemetry.stageNumber}/6</span>
				</summary>
				<div class="stage-milestones-scroll">
					{#each STAGE_DEFINITIONS as stg}
						<button
							type="button"
							class="stage-milestone-item milestone-btn"
							class:done={telemetry.stageNumber > stg.stageNumber}
							class:active={telemetry.stageNumber === stg.stageNumber}
							onclick={() => runtime?.jumpToLevel(stg.stageNumber)}
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

			<!-- Collapsible Flood Survival Guidelines -->
			<details class="collapsible-section">
				<summary class="collapsible-summary">
					<span class="summary-label">📖 Flood Survival Guidelines</span>
					<span class="protocol-badge">4 PROTOCOLS</span>
				</summary>
				<ul class="safety-points">
					<li>
						<span class="bullet-tag">1</span>
						<span><strong>Move to higher ground</strong> immediately before roads and bridges flood.</span>
					</li>
					<li>
						<span class="bullet-tag">2</span>
						<span><strong>Turn Around, Don't Drown:</strong> Never walk or drive through moving water. 15 cm (6 in) can knock you down.</span>
					</li>
					<li>
						<span class="bullet-tag">3</span>
						<span><strong>Avoid electrical hazards:</strong> Steer clear of fallen power lines and submerged electrical boxes.</span>
					</li>
					<li>
						<span class="bullet-tag">4</span>
						<span><strong>Follow official routes:</strong> Follow signposts and evacuation directives to marked emergency rescue outposts.</span>
					</li>
				</ul>
			</details>
		</div>
	</aside>

	<!-- Right Side Column: Live Safety Score, Surface Telemetry & Community Status -->
	<aside class="right-hud-column">
		<!-- Live Safety Score Bar -->
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
				<span>Hazards: <strong>{trainingState.hazardsEncountered}</strong></span>
			</div>
		</div>

		<!-- Real-time Surface Telemetry & Zone Indicators -->
		<div class="hud-card telemetry-card">
			<div class="badges-row">
				<span class="zone-badge {telemetry.zoneStatus.toLowerCase()}">
					{telemetry.zoneStatus === 'SAFE' ? '● SAFE ZONE' : telemetry.zoneStatus === 'CAUTION' ? '▲ CAUTION' : telemetry.zoneStatus === 'DANGER' ? '⚠ DANGER ZONE' : 'SECTOR: BASIN'}
				</span>
				<span class="pressure-badge {telemetry.pressureStage.toLowerCase()}">
					{telemetry.pressureStage}
				</span>
			</div>

			<h3 class="telemetry-heading">SURFACE TELEMETRY</h3>

			<div class="telemetry-grid">
				<div class="telemetry-metric">
					<span class="metric-label">Water Level</span>
					<span class="metric-value water-val">{telemetry.waterLevel >= 0 ? `+${telemetry.waterLevel.toFixed(2)}` : telemetry.waterLevel.toFixed(2)} m</span>
				</div>
				<div class="telemetry-metric">
					<span class="metric-label">Player Altitude</span>
					<span class="metric-value alt-val">+{telemetry.playerAltitude.toFixed(2)} m</span>
				</div>
			</div>

			<!-- Clearance Gauge -->
			<div class="gauge-container">
				<div class="gauge-header">
					<span class="gauge-title">Safe Ground Margin</span>
					<span class="gauge-number" class:danger={telemetry.playerAltitude - telemetry.waterLevel < 1.0}>
						{(telemetry.playerAltitude - telemetry.waterLevel).toFixed(2)} m
					</span>
				</div>
				<div class="gauge-track">
					<div
						class="gauge-fill"
						style:width="{Math.min(100, Math.max(5, ((telemetry.playerAltitude - telemetry.waterLevel) / 7.0) * 100))}%"
						class:danger={telemetry.playerAltitude - telemetry.waterLevel < 1.0}
					></div>
				</div>
			</div>
		</div>

		<!-- COMMUNITY STATUS HUD (Feature 7) -->
		<div class="hud-card community-card">
			<div class="comm-header">
				<span class="card-badge comm-badge">COMMUNITY STATUS</span>
				<span class="comm-sub">EVACUATION AUDIT</span>
			</div>
			<div class="community-grid">
				<div class="comm-item">
					<span class="comm-label">Civilians</span>
					<span class="comm-val">{telemetry.communityStatus?.total ?? 8}</span>
				</div>
				<div class="comm-item">
					<span class="comm-label">Safe</span>
					<span class="comm-val safe">{telemetry.communityStatus?.safe ?? 0}</span>
				</div>
				<div class="comm-item">
					<span class="comm-label">Need Help</span>
					<span class="comm-val alert">{telemetry.communityStatus?.needAssistance ?? 8}</span>
				</div>
				<div class="comm-item">
					<span class="comm-label">Evacuated</span>
					<span class="comm-val evac">{telemetry.communityStatus?.evacuated ?? 0}</span>
				</div>
			</div>
		</div>
	</aside>

	<!-- Center Proximity Prompt: Evacuation Assistance (Feature 3) -->
	{#if telemetry.promptedCivilian}
		<div class="assist-prompt-card" role="dialog" aria-label="Evacuation Assistance">
			<div class="assist-header">
				<span class="assist-badge">EVACUATION ASSISTANCE</span>
				<span class="civilian-type">{telemetry.promptedCivilian.type.replace('_', ' ').toUpperCase()}</span>
			</div>
			<h3 class="civilian-name">{telemetry.promptedCivilian.name}</h3>
			<p class="civilian-dialogue">"{telemetry.promptedCivilian.helpDialogue}"</p>
			<button
				type="button"
				class="btn-assist"
				onclick={() => handleAssistCivilian(telemetry.promptedCivilian!.id)}
			>
				[ ASSIST EVACUATION ] <span class="key-hint">(Press E)</span>
			</button>
		</div>
	{/if}

	<!-- Bottom Right: Simulation Controls & Movement Hints -->
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
				<span class="speed-chip">{speedLabels[speedSetting]}</span>
				<span class="settings-chevron">{showSettingsPanel ? '▴' : '▾'}</span>
			</button>
			<button type="button" class="quick-btn" onclick={handleOpenPauseAssess} title="Pause & Assess">
				⏸ Assess
			</button>
			<button type="button" class="quick-btn" onclick={() => (showStartModal = true)} title="Guide">
				ℹ Guide
			</button>
		</div>

		<!-- Expandable Settings Panel -->
		{#if showSettingsPanel}
			<div class="settings-panel" role="region" aria-label="Simulation Settings">
				<!-- Water Rise Speed -->
				<div class="settings-section">
					<div class="section-label">💧 Water Rise Speed</div>
					<div class="speed-option-group">
						<button
							type="button"
							class="speed-option"
							class:active={speedSetting === 'pause'}
							onclick={() => handleSetSpeed('pause')}
						>
							<span class="speed-icon">⏸</span>
							<span class="speed-name">Paused</span>
						</button>
						<button
							type="button"
							class="speed-option"
							class:active={speedSetting === 'normal'}
							onclick={() => handleSetSpeed('normal')}
						>
							<span class="speed-icon">▶</span>
							<span class="speed-name">1x Normal</span>
						</button>
						<button
							type="button"
							class="speed-option recommended"
							class:active={speedSetting === 'medium'}
							onclick={() => handleSetSpeed('medium')}
						>
							<span class="speed-icon">⏩</span>
							<span class="speed-name">2x Medium</span>
							<span class="speed-rec-tag">REC</span>
						</button>
						<button
							type="button"
							class="speed-option"
							class:active={speedSetting === 'fast'}
							onclick={() => handleSetSpeed('fast')}
						>
							<span class="speed-icon">⚡</span>
							<span class="speed-name">3x Fast</span>
						</button>
					</div>
				</div>

				<div class="settings-divider"></div>

				<!-- Actions -->
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
								<span class="vol-name">Water Ambience</span>
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
	.flood-scene-wrapper {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: #b8cbd6;
		user-select: none;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	}

	.flood-canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
		outline: none;
	}

	.flood-canvas :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}

	/* Top Center Training Command Bar */
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
		border: 1px solid rgba(56, 189, 248, 0.35);
		border-radius: 999px;
		padding: 0.4rem 0.9rem;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
		pointer-events: auto;
	}

	.training-clock-pill {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: #0284c7;
		letter-spacing: 0.05em;
	}

	.clock-lbl {
		color: #64748b;
		font-size: 0.7rem;
	}

	.clock-time {
		color: #0f172a;
		font-variant-numeric: tabular-nums;
	}

	.decision-clock-pill {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		background: rgba(234, 88, 12, 0.2);
		border: 1px solid rgba(234, 88, 12, 0.4);
		color: #fb923c;
		font-size: 0.74rem;
		font-weight: 800;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		letter-spacing: 0.05em;
	}

	.decision-clock-pill.urgent {
		background: rgba(220, 38, 38, 0.3);
		border-color: #ef4444;
		color: #fca5a5;
		animation: pulseClock 1s infinite;
	}

	.stage-pill-box {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0 0.5rem;
		border-left: 1px solid rgba(0, 0, 0, 0.1);
		border-right: 1px solid rgba(0, 0, 0, 0.1);
	}

	.stage-tag {
		font-size: 0.68rem;
		font-weight: 800;
		color: #0284c7;
		letter-spacing: 0.08em;
	}

	.stage-pill-num {
		font-size: 0.75rem;
		font-weight: 800;
		color: #334155;
	}

	.stage-pill-title {
		font-size: 0.72rem;
		font-weight: 700;
		color: #38bdf8;
	}

	.btn-pause-assess {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 999px;
		padding: 0.35rem 0.85rem;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		letter-spacing: 0.06em;
	}

	.btn-pause-assess:hover {
		background: #0369a1;
		transform: scale(1.03);
	}

	/* Objective & Avoid Guidance Box in Top Left Card */
	.objective-avoid-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.7rem 0.85rem;
		margin: 0.65rem 0 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.obj-line, .avoid-line {
		display: flex;
		align-items: flex-start;
		gap: 0.45rem;
		font-size: 0.82rem;
		line-height: 1.4;
	}

	.obj-tag {
		font-weight: 800;
		color: #0284c7;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.avoid-tag {
		font-weight: 800;
		color: #dc2626;
		font-size: 0.72rem;
		letter-spacing: 0.04em;
		flex-shrink: 0;
	}

	.obj-text {
		color: #1e293b;
		font-weight: 600;
	}

	.avoid-text {
		color: #991b1b;
		font-weight: 600;
	}

	/* Accessible Live Audio Caption Subtitle Bar */
	.audio-caption-bar {
		position: absolute;
		bottom: 5.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 25;
		background: rgba(255, 255, 255, 0.97);
		border: 1px solid rgba(2, 132, 199, 0.25);
		border-radius: 999px;
		padding: 0.45rem 1.2rem;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		color: #0f172a;
		font-size: 0.84rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.12);
		animation: fadeIn 0.2s ease-out;
		pointer-events: none;
	}

	.cap-icon {
		font-size: 1rem;
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

	/* Non-overlapping Column Containers */
	.left-hud-column {
		position: absolute;
		top: 3.8rem;
		left: 1.25rem;
		width: 22.5rem;
		max-height: calc(100vh - 4.8rem);
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
		top: 3.8rem;
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

	/* HUD Panels */
	.hud-card {
		position: relative;
		background: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(15, 30, 45, 0.1);
		color: #1e293b;
		padding: 0.85rem 1.1rem;
		pointer-events: auto;
	}

	/* Collapsible Sections */
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
		color: #0284c7;
		background: #e0f2fe;
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
	}

	.collapsible-section[open] .collapsible-summary {
		margin-bottom: 0.55rem;
		padding-bottom: 0.45rem;
		border-bottom: 1px solid #e2e8f0;
	}

	.card-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #0284c7;
		background: #e0f2fe;
		padding: 0.25rem 0.65rem;
		border-radius: 999px;
		margin-bottom: 0.5rem;
	}

	.live-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #0284c7;
		box-shadow: 0 0 6px #0284c7;
		animation: pulseDot 2s infinite ease-in-out;
	}

	@keyframes pulseDot {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(0.85); }
	}

	.card-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
		letter-spacing: -0.01em;
	}

	.mission-desc {
		margin: 0.4rem 0 0.8rem;
		font-size: 0.9rem;
		line-height: 1.45;
		color: #475569;
	}

	/* Live Score HUD Box */
	.score-hud-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.65rem 0.8rem;
		margin-bottom: 0.85rem;
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
		color: #0284c7;
		font-size: 0.82rem;
	}

	.score-hud-val.low {
		color: #ea580c;
	}

	.score-hud-track {
		height: 6px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
		margin-bottom: 0.4rem;
	}

	.score-hud-fill {
		height: 100%;
		background: #0284c7;
		border-radius: 999px;
		transition: width 0.3s ease;
	}

	.score-hud-fill.low {
		background: #ea580c;
	}

	.score-hud-stats {
		display: flex;
		justify-content: space-between;
		font-size: 0.72rem;
		color: #64748b;
	}

	/* 10-Stage Milestones Section */
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
		color: #0284c7;
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
		background: #eff6ff;
		border-color: #93c5fd;
		box-shadow: 0 0 0 1px #93c5fd;
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
		background: #0284c7;
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
		background: #dbeafe;
		color: #1d4ed8;
		letter-spacing: 0.05em;
	}

	.stage-sub {
		font-size: 0.68rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Audio Feedback Toast & Checkpoint Toast */
	.audio-feedback-toast {
		position: absolute;
		top: 1.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 50;
		background: rgba(255, 255, 255, 0.97);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(2, 132, 199, 0.2);
		color: #0f172a;
		border-radius: 999px;
		padding: 0.45rem 1.1rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.82rem;
		font-weight: 700;
		box-shadow: 0 4px 18px rgba(0, 0, 0, 0.1);
		animation: toastSlideDown 0.25s ease;
		pointer-events: none;
	}

	.checkpoint-toast {
		position: absolute;
		top: 4.2rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 49;
		background: #166534;
		border: 1px solid #86efac;
		color: #ffffff;
		border-radius: 999px;
		padding: 0.4rem 1rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.82rem;
		font-weight: 700;
		box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
		animation: toastSlideDown 0.25s ease;
		pointer-events: none;
	}

	@keyframes toastSlideDown {
		from { opacity: 0; transform: translate(-50%, -10px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	/* Volume Channels Panel */
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
		animation: fadeIn 0.2s ease;
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
		padding: 0.2rem;
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
		color: #0284c7;
		font-weight: 800;
	}

	.vol-slider {
		width: 100%;
		accent-color: #0284c7;
		cursor: pointer;
		height: 4px;
	}

	/* Bottom Right Controls & Movement Hints Card */
	.bottom-right-card {
		position: absolute;
		bottom: 1.25rem;
		right: 1.25rem;
		z-index: 20;
		padding: 0.6rem 0.75rem;
		background: rgba(255, 255, 255, 0.94);
		backdrop-filter: blur(12px);
		border: 1px solid rgba(255, 255, 255, 0.75);
		border-radius: 14px;
		box-shadow: 0 8px 24px rgba(15, 30, 45, 0.12);
		min-width: 0;
	}

	/* ── Compact Settings Bar ── */
	.settings-bar {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.45rem;
	}

	.settings-pill {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		background: #f1f5f9;
		border: 1.5px solid #cbd5e1;
		border-radius: 999px;
		padding: 0.3rem 0.65rem;
		font-size: 0.72rem;
		font-weight: 700;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s ease;
		white-space: nowrap;
	}

	.settings-pill.open,
	.settings-pill:hover {
		background: #e0f2fe;
		border-color: #0284c7;
		color: #0369a1;
	}

	.settings-gear { font-size: 0.85rem; }
	.settings-label { font-weight: 800; letter-spacing: 0.03em; }
	.settings-chevron { font-size: 0.6rem; opacity: 0.7; }

	.speed-chip {
		background: #0284c7;
		color: #fff;
		border-radius: 999px;
		padding: 0.1rem 0.5rem;
		font-size: 0.68rem;
		font-weight: 800;
	}

	.quick-btn {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		padding: 0.28rem 0.55rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.quick-btn:hover {
		background: #f1f5f9;
		border-color: #94a3b8;
	}

	/* ── Settings Panel ── */
	.settings-panel {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.65rem 0.7rem;
		margin-bottom: 0.45rem;
		animation: fadeSlideDown 0.18s ease;
	}

	@keyframes fadeSlideDown {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.settings-section {
		margin-bottom: 0.5rem;
	}

	.settings-section:last-child { margin-bottom: 0; }

	.section-label {
		font-size: 0.65rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #94a3b8;
		text-transform: uppercase;
		margin-bottom: 0.35rem;
	}

	.settings-divider {
		height: 1px;
		background: #e2e8f0;
		margin: 0.5rem 0;
	}

	/* Speed Options Grid */
	.speed-option-group {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.25rem;
	}

	.speed-option {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.15rem;
		padding: 0.35rem 0.25rem;
		border: 1.5px solid #e2e8f0;
		border-radius: 8px;
		background: #ffffff;
		cursor: pointer;
		transition: all 0.15s;
		position: relative;
	}

	.speed-option:hover {
		background: #f0f9ff;
		border-color: #7dd3fc;
	}

	.speed-option.active {
		background: #0284c7;
		border-color: #0284c7;
		box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
	}

	.speed-option.active .speed-icon,
	.speed-option.active .speed-name {
		color: #ffffff;
	}

	.speed-option.recommended:not(.active) {
		border-color: #86efac;
		background: #f0fdf4;
	}

	.speed-icon { font-size: 0.85rem; }

	.speed-name {
		font-size: 0.62rem;
		font-weight: 700;
		color: #334155;
		white-space: nowrap;
	}

	.speed-rec-tag {
		position: absolute;
		top: -5px;
		right: -4px;
		background: #16a34a;
		color: #fff;
		font-size: 0.5rem;
		font-weight: 900;
		padding: 0.05rem 0.28rem;
		border-radius: 999px;
		letter-spacing: 0.05em;
	}

	/* Actions row */
	.action-row {
		display: flex;
		gap: 0.3rem;
		flex-wrap: wrap;
	}

	.action-btn {
		border: 1px solid #cbd5e1;
		background: #ffffff;
		padding: 0.28rem 0.6rem;
		border-radius: 6px;
		font-size: 0.71rem;
		font-weight: 700;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.action-btn:hover { background: #f1f5f9; }

	.action-btn.active {
		background: #0284c7;
		color: #fff;
		border-color: #0284c7;
	}

	.movement-hints {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.key-badge {
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		border-radius: 4px;
		padding: 0.12rem 0.38rem;
		font-size: 0.68rem;
		font-weight: 800;
		color: #0f172a;
	}

	.hint-text {
		font-size: 0.72rem;
		color: #64748b;
		margin-left: 0.2rem;
	}

	/* Checkpoint Resume Modal */
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
		color: #166534;
		background: #dcfce7;
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

	/* Top Right Telemetry */
	.telemetry-card {
		width: 100%;
	}

	.badges-row {
		display: flex;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}

	.zone-badge {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		background: #f1f5f9;
		color: #475569;
	}

	.zone-badge.safe {
		background: #dcfce7;
		color: #15803d;
	}

	.zone-badge.caution {
		background: #fef3c7;
		color: #b45309;
	}

	.zone-badge.danger {
		background: #fee2e2;
		color: #b91c1c;
		animation: pulseRed 1s infinite;
	}

	@keyframes pulseRed {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.6; }
	}

	.pressure-badge {
		font-size: 0.68rem;
		font-weight: 800;
		padding: 0.2rem 0.55rem;
		border-radius: 6px;
		background: #e0f2fe;
		color: #0369a1;
	}

	.pressure-badge.medium {
		background: #fef3c7;
		color: #b45309;
	}

	.pressure-badge.high {
		background: #ffedd5;
		color: #c2410c;
	}

	.pressure-badge.critical {
		background: #fee2e2;
		color: #b91c1c;
		animation: pulseRed 1s infinite;
	}

	.telemetry-heading {
		margin: 0.4rem 0 0.6rem;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #64748b;
	}

	.telemetry-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
		margin-bottom: 0.8rem;
	}

	.telemetry-metric {
		background: #f8fafc;
		padding: 0.55rem 0.65rem;
		border-radius: 8px;
		border: 1px solid #e2e8f0;
		display: flex;
		flex-direction: column;
	}

	.metric-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		font-weight: 600;
		color: #64748b;
	}

	.metric-value {
		font-size: 1.15rem;
		font-weight: 800;
		margin-top: 0.15rem;
	}

	.water-val {
		color: #0284c7;
	}

	.alt-val {
		color: #16a34a;
	}

	.gauge-container {
		border-top: 1px solid #e2e8f0;
		padding-top: 0.65rem;
	}

	.gauge-header {
		display: flex;
		justify-content: space-between;
		font-size: 0.75rem;
		font-weight: 600;
		color: #475569;
		margin-bottom: 0.35rem;
	}

	.gauge-number.danger {
		color: #dc2626;
		font-weight: 700;
	}

	.gauge-track {
		height: 8px;
		background: #e2e8f0;
		border-radius: 999px;
		overflow: hidden;
	}

	.gauge-fill {
		height: 100%;
		background: linear-gradient(90deg, #10b981, #0284c7);
		border-radius: 999px;
		transition: width 0.3s ease;
	}

	.gauge-fill.danger {
		background: linear-gradient(90deg, #ef4444, #f59e0b);
	}

	/* Community Status Card (Feature 7) */
	.community-card {
		width: 100%;
	}

	.comm-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.65rem;
	}

	.comm-badge {
		margin-bottom: 0;
		font-size: 0.66rem;
	}

	.comm-sub {
		font-size: 0.65rem;
		font-weight: 700;
		color: #64748b;
		letter-spacing: 0.06em;
	}

	.community-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.35rem;
	}

	.comm-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		padding: 0.4rem 0.2rem;
	}

	.comm-label {
		font-size: 0.62rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		white-space: nowrap;
	}

	.comm-val {
		font-size: 1.05rem;
		font-weight: 800;
		color: #0f172a;
		margin-top: 0.1rem;
	}

	.comm-val.safe { color: #16a34a; }
	.comm-val.alert { color: #ea580c; }
	.comm-val.evac { color: #0284c7; }

	/* Center Evacuation Assistance Prompt (Feature 3) */
	.assist-prompt-card {
		position: absolute;
		bottom: 5.5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 35;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(14px);
		border: 2px solid #38bdf8;
		border-radius: 16px;
		box-shadow: 0 12px 35px rgba(2, 132, 199, 0.25);
		padding: 1.1rem 1.4rem;
		max-width: 24rem;
		width: 90vw;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.45rem;
		animation: slideUpPrompt 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slideUpPrompt {
		from { opacity: 0; transform: translate(-50%, 15px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	.assist-header {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}

	.assist-badge {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #0284c7;
		background: #e0f2fe;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
	}

	.civilian-type {
		font-size: 0.65rem;
		font-weight: 700;
		color: #64748b;
	}

	.civilian-name {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 800;
		color: #0f172a;
	}

	.civilian-dialogue {
		margin: 0 0 0.4rem;
		font-size: 0.85rem;
		color: #334155;
		font-style: italic;
		line-height: 1.4;
	}

	.btn-assist {
		padding: 0.65rem 1.4rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
	}

	.btn-assist:hover {
		background: #0369a1;
		transform: translateY(-1px);
	}

	.key-hint {
		font-weight: 600;
		font-size: 0.82rem;
		opacity: 0.85;
		margin-left: 0.2rem;
	}

	.audio-btn.active {
		background: #f0fdf4;
		border-color: #86efac;
		color: #166534;
	}

	/* Hazard Banner */
	.hazard-banner {
		position: absolute;
		top: 4.6rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #ea580c;
		color: #ffffff;
		padding: 0.65rem 1.35rem;
		border-radius: 999px;
		box-shadow: 0 8px 24px rgba(234, 88, 12, 0.45);
		font-size: 0.88rem;
		font-weight: 600;
		animation: slideDown 0.3s ease;
		max-width: 90vw;
	}

	.hazard-banner.danger {
		background: #dc2626;
		box-shadow: 0 8px 24px rgba(220, 38, 38, 0.5);
	}

	@keyframes slideDown {
		from { opacity: 0; transform: translate(-50%, -12px); }
		to { opacity: 1; transform: translate(-50%, 0); }
	}

	.hazard-icon {
		font-size: 1.1rem;
	}

	/* Success Toast */
	.success-toast {
		position: absolute;
		top: 7.4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 30;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: #16a34a;
		color: #ffffff;
		padding: 0.75rem 1.4rem;
		border-radius: 12px;
		box-shadow: 0 10px 30px rgba(22, 163, 74, 0.35);
		font-size: 0.95rem;
		font-weight: 700;
		animation: slideDown 0.3s ease;
	}

	.success-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		color: #16a34a;
		font-weight: 800;
		font-size: 0.9rem;
	}

	/* Safety Guidelines in Collapsible Section */

	.protocol-header {
		margin-bottom: 0.6rem;
	}

	.protocol-badge {
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		color: #ea580c;
		background: #fff7ed;
		padding: 0.18rem 0.5rem;
		border-radius: 4px;
	}

	.protocol-title {
		margin: 0.3rem 0 0;
		font-size: 1.05rem;
		font-weight: 800;
		color: #0f172a;
	}

	.safety-points {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.safety-points li {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		font-size: 0.78rem;
		line-height: 1.4;
		color: #334155;
	}

	.bullet-tag {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border-radius: 4px;
		background: #0284c7;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		margin-top: 1px;
	}

	/* Bottom Right: Controls */
	.bottom-right-card {
		bottom: 1.5rem;
		right: 1.5rem;
		padding: 0.9rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.controls-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.controls-label {
		font-size: 0.75rem;
		font-weight: 700;
		color: #64748b;
	}

	.speed-buttons {
		display: flex;
		gap: 0.25rem;
	}

	.ctrl-btn {
		padding: 0.35rem 0.6rem;
		font-size: 0.75rem;
		font-weight: 600;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #334155;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.ctrl-btn:hover {
		background: #f1f5f9;
		border-color: #94a3b8;
	}

	.ctrl-btn.active {
		background: #0284c7;
		color: #ffffff;
		border-color: #0284c7;
	}

	.reset-btn:hover {
		background: #fee2e2;
		color: #dc2626;
		border-color: #fca5a5;
	}

	.guide-btn {
		background: #f0f9ff;
		color: #0284c7;
		border-color: #bae6fd;
	}

	.guide-btn:hover {
		background: #e0f2fe;
	}

	.movement-hints {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.74rem;
		color: #64748b;
	}

	.key-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 20px;
		height: 20px;
		padding: 0 4px;
		border-radius: 4px;
		background: #f1f5f9;
		border: 1px solid #cbd5e1;
		font-size: 0.7rem;
		font-weight: 700;
		color: #1e293b;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.hint-text {
		margin-left: 0.3rem;
	}

	/* Review Modal */
	.modal-backdrop {
		position: absolute;
		inset: 0;
		z-index: 70;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.review-card {
		background: #ffffff;
		border-radius: 20px;
		max-width: 40rem;
		width: 100%;
		padding: 2rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
		max-height: 85vh;
		display: flex;
		flex-direction: column;
	}

	.review-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.review-title {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 800;
		color: #0f172a;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.2rem;
		color: #64748b;
		cursor: pointer;
	}

	.review-desc {
		margin: 0.3rem 0 1rem;
		font-size: 0.88rem;
		color: #64748b;
	}

	.history-list {
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
		overflow-y: auto;
		padding-right: 0.4rem;
		margin-bottom: 1.2rem;
	}

	.history-item {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 10px;
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.history-item.correct {
		border-left: 4px solid #16a34a;
	}

	.history-item.wrong {
		border-left: 4px solid #ea580c;
	}

	.item-head {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		font-size: 0.78rem;
	}

	.item-num {
		font-weight: 800;
		color: #64748b;
	}

	.item-title {
		font-weight: 700;
		color: #0f172a;
		flex: 1;
	}

	.item-status {
		font-weight: 800;
	}

	.history-item.correct .item-status { color: #16a34a; }
	.history-item.wrong .item-status { color: #ea580c; }

	.item-choice {
		margin: 0;
		font-size: 0.82rem;
		color: #334155;
	}

	.item-feedback {
		margin: 0;
		font-size: 0.8rem;
		color: #475569;
		line-height: 1.4;
	}

	.item-matters {
		background: #ffffff;
		border-radius: 6px;
		padding: 0.45rem 0.65rem;
		font-size: 0.75rem;
		color: #1e3a8a;
		border: 1px solid #dbeafe;
	}

	.matters-head {
		font-weight: 800;
		margin-right: 0.3rem;
	}

	.empty-text {
		font-size: 0.88rem;
		color: #64748b;
		text-align: center;
		padding: 2rem 0;
	}

	.review-footer {
		display: flex;
		justify-content: flex-end;
		border-top: 1px solid #e2e8f0;
		padding-top: 1rem;
	}

	.btn-primary {
		padding: 0.65rem 1.2rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 700;
		cursor: pointer;
	}

	/* Objectives Checklist Dropdown Card */
	.stage-objectives-card {
		margin-top: 0.65rem;
		background: #ffffff;
		border: 1px solid rgba(56, 189, 248, 0.3);
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
		color: #0284c7;
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
		color: #0284c7;
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
		color: #0284c7;
		background: #e0f2fe;
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
		color: #475569;
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
		color: #64748b;
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
		background: #fff7ed;
		border: 1px solid rgba(249, 115, 22, 0.35);
		border-radius: 8px;
		padding: 0.55rem;
	}

	.kit-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.75rem;
		font-weight: 800;
		color: #c2410c;
		margin-bottom: 0.4rem;
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
		background: rgba(249, 115, 22, 0.15);
		border-color: #f97316;
		box-shadow: 0 0 8px rgba(249, 115, 22, 0.25);
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

	/* 3D Interactable Prompt Card */
	.interact-prompt-card {
		position: absolute;
		bottom: 18%;
		left: 50%;
		transform: translateX(-50%);
		background: #ffffff;
		border: 2px solid #0284c7;
		border-radius: 12px;
		padding: 1rem 1.4rem;
		text-align: center;
		z-index: 50;
		box-shadow: 0 0 24px rgba(2, 132, 199, 0.2);
		min-width: 320px;
		animation: pulse-border 1.8s infinite ease-in-out;
	}

	.interact-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.4rem;
	}

	.interact-type-badge {
		font-size: 0.7rem;
		font-weight: 800;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		background: #0284c7;
		color: #ffffff;
	}

	.interact-type-badge.hazard {
		background: #dc2626;
	}

	.interact-type-badge.item {
		background: #ea580c;
	}

	.interact-type-badge.station {
		background: #16a34a;
	}

	.interact-key-badge {
		font-size: 0.72rem;
		font-weight: 800;
		color: #38bdf8;
		background: rgba(56, 189, 248, 0.15);
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
	}

	.interact-title {
		font-size: 1.05rem;
		font-weight: 800;
		color: #f8fafc;
		margin: 0.2rem 0 0.7rem;
	}

	.btn-interact {
		width: 100%;
		padding: 0.65rem 1rem;
		background: linear-gradient(135deg, #0284c7, #0369a1);
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.88rem;
		font-weight: 800;
		cursor: pointer;
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.4rem;
		transition: all 0.2s ease;
	}

	.btn-interact:hover {
		background: linear-gradient(135deg, #0369a1, #075985);
		box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);
	}

	@media (max-width: 900px) {
		.top-left-card,
		.top-right-card,
		.bottom-left-card,
		.bottom-right-card {
			position: static;
			max-width: none;
			width: auto;
		}

		.hud-card {
			margin: 0.6rem;
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

<script lang="ts">
	import type { TrainingState } from '../flood/trainingState';
	import SafetyGuideModal from './SafetyGuideModal.svelte';

	let {
		trainingResult,
		onRestart,
		onReviewScenarios
	}: {
		trainingResult: TrainingState;
		onRestart: () => void;
		onReviewScenarios: () => void;
	} = $props();

	let showSafetyGuide = $state(false);

	function formatDuration(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}

	function getGrade(score: number): { label: string; badgeClass: string; desc: string } {
		if (score >= 90) {
			return {
				label: 'EXCELLENT — EMERGENCY READY',
				badgeClass: 'excellent',
				desc: 'Mastered multi-hazard cascading disaster survival. Optimal earthquake, fire, gas, and evacuation decisions.'
			};
		}
		if (score >= 75) {
			return {
				label: 'GOOD — PREPARED',
				badgeClass: 'good',
				desc: 'Demonstrated solid emergency judgment across cascading hazards. Ready for community response.'
			};
		}
		if (score >= 60) {
			return {
				label: 'NEEDS PRACTICE',
				badgeClass: 'warning',
				desc: 'You reached safety, but exposed yourself or group to secondary disaster hazards along the way.'
			};
		}
		return {
			label: 'RECOMMENDED: REPEAT TRAINING',
			badgeClass: 'critical',
			desc: 'Critical safety violations recorded during seismic and hazard events. Retaking the simulation is recommended.'
		};
	}

	const grade = $derived(getGrade(trainingResult.safetyScore));
	const durationText = $derived(formatDuration(trainingResult.timeSurvived));

	// Personalized feedback generation
	const strengths = $derived.by(() => {
		const list: string[] = [];
		const ids = trainingResult.history.filter((h) => h.isCorrect).map((h) => h.eventId);
		if (ids.includes('disaster_stage1_earthquake')) list.push('Correct initial earthquake response (Drop, Cover & Hold On)');
		if (ids.includes('disaster_stage2_structural')) list.push('Avoided entering structurally compromised buildings');
		if (ids.includes('disaster_stage3_fire')) list.push('Recognized secondary electrical fire danger perimeter');
		if (ids.includes('disaster_stage4_gas')) list.push('Prevented ignition sources near hazardous gas leak');
		if (ids.includes('disaster_stage6_community')) list.push('Prioritized vulnerable and injured residents');
		if (ids.includes('disaster_stage7_aftershock')) list.push('Maintained open-sky awareness during strong aftershock');
		if (ids.includes('disaster_stage8_route')) list.push('Selected safer open evacuation route over risky shortcut');
		if (ids.includes('disaster_stage9_assembly')) list.push('Accurately reported missing member at assembly triage');
		if (list.length === 0) list.push('Demonstrated persistence in completing the emergency corridor');
		return list;
	});

	const weaknesses = $derived.by(() => {
		const list: string[] = [];
		const ids = trainingResult.history.filter((h) => !h.isCorrect).map((h) => h.eventId);
		if (ids.includes('disaster_stage1_earthquake')) list.push('Earthquake response: Running outside or near glass during shaking');
		if (ids.includes('disaster_stage2_structural')) list.push('Structural awareness: Entering unstable buildings for possessions');
		if (ids.includes('disaster_stage3_fire')) list.push('Fire safety: Attempting to fight structural electrical fires unprepared');
		if (ids.includes('disaster_stage4_gas')) list.push('Gas leak: Creating potential spark or ignition sources');
		if (ids.includes('disaster_stage5_power')) list.push('Blackout protocol: Navigating dark unlit corridors or downed lines');
		if (ids.includes('disaster_stage7_aftershock')) list.push('Aftershock awareness: Running into damaged buildings for cover');
		if (ids.includes('disaster_stage8_route')) list.push('Route choice: Prioritizing speed over structural fall zones');
		return list;
	});

	const recommendedTraining = $derived.by(() => {
		const ids = trainingResult.history.filter((h) => !h.isCorrect).map((h) => h.eventId);
		if (ids.includes('disaster_stage4_gas')) return 'Repeat Stage 4 — Gas Leak Safety';
		if (ids.includes('disaster_stage7_aftershock')) return 'Repeat Stage 7 — Aftershock Response';
		if (ids.includes('disaster_stage1_earthquake')) return 'Repeat Stage 1 — Earthquake Drop, Cover, Hold';
		if (ids.includes('disaster_stage8_route')) return 'Repeat Stage 8 — Safe Route Selection';
		if (ids.length > 0) return 'Review Disaster Safety Guide';
		return 'Complete Mastery Achieved — Ready for Field Drills';
	});
</script>

<div class="complete-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
	<div class="complete-card">
		<!-- Header Badge -->
		<div class="complete-badge">
			<span class="badge-icon">🌎</span>
			DISASTER STORM ASSESSMENT REPORT
		</div>

		<h2 id="complete-title" class="complete-title">DISASTER STORM COMPLETE</h2>
		<p class="complete-sub">10-Stage Cascading Multi-Hazard Simulation Finalized.</p>

		<!-- Score & Grade Banner -->
		<div class="score-banner">
			<div class="score-number-box">
				<span class="score-label">SAFETY SCORE</span>
				<div class="score-display">
					<span class="score-val">{trainingResult.safetyScore}</span>
					<span class="score-total">/100</span>
				</div>
			</div>
			<div class="grade-badge {grade.badgeClass}">
				<span class="grade-title">{grade.label}</span>
				<span class="grade-desc">{grade.desc}</span>
			</div>
		</div>

		<!-- Telemetry Metrics Grid -->
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-label">Training Duration</span>
				<span class="stat-val">{durationText}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Decisions Correct</span>
				<span class="stat-val">{trainingResult.decisionsCorrect} / {trainingResult.decisionsTotal}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Hazards Avoided</span>
				<span class="stat-val" class:stat-warning={trainingResult.hazardsEncountered > 0}>
					{trainingResult.hazardsEncountered === 0 ? '100% (0 Contacts)' : `${trainingResult.hazardsEncountered} Contact(s)`}
				</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Civilians Assisted</span>
				<span class="stat-val">{trainingResult.civiliansAssisted} / {trainingResult.civiliansTotal}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Route Choice</span>
				<span class="stat-val route-val">
					{trainingResult.cascading?.routeChoice === 'LONG_SAFE' ? 'Route B (Open Safe)' : trainingResult.cascading?.routeChoice === 'SHORT_RISKY' ? 'Route A (Risky)' : 'Default Corridor'}
				</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Max Risk Level</span>
				<span class="stat-val" class:risk-high={trainingResult.hazardsEncountered > 1}>
					{trainingResult.hazardsEncountered > 1 ? 'HIGH EXPOSURE' : trainingResult.hazardsEncountered === 1 ? 'MODERATE' : 'MINIMAL RISK'}
				</span>
			</div>
		</div>

		<!-- Personalized Feedback -->
		<div class="feedback-columns">
			<div class="feedback-col strengths-col">
				<h4 class="feedback-heading green">✓ STRONG AREAS</h4>
				<ul class="feedback-list">
					{#each strengths as s}
						<li>✓ {s}</li>
					{/each}
				</ul>
			</div>

			<div class="feedback-col weaknesses-col">
				<h4 class="feedback-heading orange">△ AREAS TO PRACTICE</h4>
				<ul class="feedback-list">
					{#each weaknesses as w}
						<li>△ {w}</li>
					{:else}
						<li class="all-good">✓ Zero critical safety errors recorded!</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Recommended Training Advice -->
		<div class="recommended-box">
			<span class="rec-label">RECOMMENDED TRAINING FOCUS:</span>
			<span class="rec-val">{recommendedTraining}</span>
		</div>

		<!-- Six Core Lessons Summary -->
		<div class="lessons-summary-box">
			<h4 class="lessons-summary-title">Core Disaster Safety Lessons Learned</h4>
			<ul class="lessons-detail-list">
				<li>• <strong>DROP, COVER, HOLD ON:</strong> Shield your head and neck under sturdy furniture during tremors; never run into streets while debris is falling.</li>
				<li>• <strong>Stay clear of damaged structures:</strong> Cracked concrete, hanging facades, and shattered glass remain lethal after ground shaking ceases.</li>
				<li>• <strong>Secondary fire awareness:</strong> Arcing power lines rapidly ignite surrounding rubble; evacuate upwind and alert emergency services.</li>
				<li>• <strong>Gas leak protocol:</strong> Ruptured pipes release explosive vapor; extinguish all flames, avoid electronic switches, and retreat immediately.</li>
				<li>• <strong>Blackout & downed lines:</strong> Treat all downed wires as live; maintain at least 10m (30ft) clearance and follow clear illuminated corridors.</li>
				<li>• <strong>Designated evacuation corridors:</strong> Wide open perimeters prevent group entrapment compared to narrow rubble-filled alleyways.</li>
			</ul>
		</div>

		<!-- Action Buttons -->
		<div class="actions-row">
			<button type="button" class="btn-guide" onclick={() => (showSafetyGuide = true)}>
				📖 View Safety Guide
			</button>
			<button type="button" class="btn-secondary" onclick={onReviewScenarios}>
				Review Scenarios ({trainingResult.history.length})
			</button>
			<button type="button" class="btn-primary" onclick={onRestart}>
				Restart Training
			</button>
		</div>
	</div>

	{#if showSafetyGuide}
		<SafetyGuideModal onClose={() => (showSafetyGuide = false)} />
	{/if}
</div>

<style>
	.complete-backdrop {
		position: absolute;
		inset: 0;
		z-index: 60;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.complete-card {
		background: #ffffff;
		border-radius: 24px;
		max-width: 44rem;
		width: 100%;
		padding: 2.2rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4);
		border: 1px solid rgba(255, 255, 255, 0.85);
		display: flex;
		flex-direction: column;
		max-height: 88vh;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.complete-card > * {
		flex-shrink: 0;
	}

	.complete-card::-webkit-scrollbar {
		width: 6px;
	}

	.complete-card::-webkit-scrollbar-thumb {
		background: #94a3b8;
		border-radius: 999px;
	}

	.complete-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #b45309;
		background: #fef3c7;
		border: 1px solid #fde68a;
		padding: 0.28rem 0.75rem;
		border-radius: 999px;
		width: fit-content;
		margin-bottom: 0.5rem;
	}

	.complete-title {
		margin: 0;
		font-size: 1.55rem;
		font-weight: 900;
		color: #0f172a;
	}

	.complete-sub {
		margin: 0.25rem 0 1.2rem;
		font-size: 0.92rem;
		color: #64748b;
	}

	.score-banner {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.3rem;
		background: #f8fafc;
		border: 1.5px solid #e2e8f0;
		border-radius: 16px;
		padding: 1.3rem;
		margin-bottom: 1.2rem;
		align-items: center;
	}

	.score-number-box {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-right: 1.3rem;
		border-right: 1.5px solid #e2e8f0;
	}

	.score-label {
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #64748b;
	}

	.score-display {
		display: flex;
		align-items: baseline;
		gap: 0.2rem;
	}

	.score-val {
		font-size: 2.7rem;
		font-weight: 900;
		color: #d97706;
		line-height: 1;
	}

	.score-total {
		font-size: 1.05rem;
		font-weight: 700;
		color: #94a3b8;
	}

	.grade-badge {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.grade-title {
		font-size: 1.15rem;
		font-weight: 900;
	}

	.grade-badge.excellent .grade-title { color: #16a34a; }
	.grade-badge.good .grade-title { color: #d97706; }
	.grade-badge.warning .grade-title { color: #ea580c; }
	.grade-badge.critical .grade-title { color: #dc2626; }

	.grade-desc {
		font-size: 0.88rem;
		line-height: 1.45;
		color: #475569;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.65rem;
		margin-bottom: 1.2rem;
	}

	.stat-card {
		background: #f1f5f9;
		border-radius: 12px;
		padding: 0.75rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.stat-label {
		font-size: 0.7rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-val {
		font-size: 1.05rem;
		font-weight: 800;
		color: #0f172a;
	}

	.stat-val.route-val {
		font-size: 0.88rem;
		color: #0284c7;
	}

	.stat-val.risk-high {
		color: #dc2626;
	}

	.stat-val.stat-warning {
		color: #d97706;
	}

	.feedback-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.feedback-col {
		border-radius: 14px;
		padding: 1rem 1.15rem;
		border: 1px solid #e2e8f0;
	}

	.strengths-col {
		background: #f0fdf4;
		border-color: #bbf7d0;
	}

	.weaknesses-col {
		background: #fffbeb;
		border-color: #fde68a;
	}

	.feedback-heading {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 800;
		letter-spacing: 0.08em;
	}

	.feedback-heading.green { color: #166534; }
	.feedback-heading.orange { color: #b45309; }

	.feedback-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.8rem;
		line-height: 1.4;
		color: #334155;
	}

	.all-good {
		color: #166534;
		font-weight: 700;
	}

	.recommended-box {
		background: #eff6ff;
		border: 1.5px solid #bfdbfe;
		border-radius: 12px;
		padding: 0.85rem 1.1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1.1rem;
		gap: 0.8rem;
	}

	.rec-label {
		font-size: 0.72rem;
		font-weight: 800;
		color: #1e40af;
		letter-spacing: 0.08em;
	}

	.rec-val {
		font-size: 0.88rem;
		font-weight: 800;
		color: #1d4ed8;
	}

	.lessons-summary-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 0.9rem 1.1rem;
		margin-bottom: 1.3rem;
	}

	.lessons-summary-title {
		margin: 0 0 0.5rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: #475569;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.lessons-detail-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		font-size: 0.78rem;
		line-height: 1.45;
		color: #334155;
	}

	.lessons-detail-list strong {
		color: #0f172a;
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.btn-guide {
		padding: 0.75rem 1.2rem;
		border-radius: 10px;
		border: 1.5px solid #d97706;
		background: #fffbeb;
		color: #b45309;
		font-size: 0.9rem;
		font-weight: 800;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-guide:hover {
		background: #fef3c7;
	}

	.btn-secondary {
		padding: 0.75rem 1.25rem;
		border-radius: 10px;
		border: 1px solid #cbd5e1;
		background: #ffffff;
		color: #475569;
		font-size: 0.9rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-secondary:hover {
		background: #f8fafc;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border-radius: 10px;
		border: none;
		background: #d97706;
		color: #ffffff;
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-primary:hover {
		background: #b45309;
	}

	@media (max-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
		.feedback-columns {
			grid-template-columns: 1fr;
		}
		.lessons-pill-grid {
			grid-template-columns: 1fr;
		}
		.score-banner {
			grid-template-columns: 1fr;
		}
		.score-number-box {
			border-right: none;
			border-bottom: 1px solid #e2e8f0;
			padding-right: 0;
			padding-bottom: 0.8rem;
		}
	}
</style>

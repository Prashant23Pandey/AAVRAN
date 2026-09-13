<script lang="ts">
	import type { TrainingState } from './trainingState';

	let {
		state,
		onRestart,
		onReviewScenarios
	}: {
		state: TrainingState;
		onRestart: () => void;
		onReviewScenarios: () => void;
	} = $props();

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
				desc: 'Outstanding flood safety mastery. You executed optimal protocols, prioritized vulnerable residents, and avoided hazardous floodwaters.'
			};
		}
		if (score >= 75) {
			return {
				label: 'GOOD — PREPARED',
				badgeClass: 'good',
				desc: 'Solid emergency response. You made safe evacuation choices, assisted community members, and safely reached the summit outpost.'
			};
		}
		if (score >= 60) {
			return {
				label: 'NEEDS PRACTICE',
				badgeClass: 'warning',
				desc: 'You reached safety, but exposed yourself or others to preventable hazards along the way. Review the protocols below.'
			};
		}
		return {
			label: 'RECOMMENDED: REPEAT TRAINING',
			badgeClass: 'critical',
			desc: 'Multiple critical safety violations were recorded. Immediate retaking of this training simulation is advised.'
		};
	}

	const grade = $derived(getGrade(state.safetyScore));
	const durationText = $derived(formatDuration(state.timeSurvived));
</script>

<div class="complete-backdrop" role="dialog" aria-modal="true" aria-labelledby="complete-title">
	<div class="complete-card">
		<!-- Header Badge -->
		<div class="complete-badge">
			<span class="badge-icon">🏁</span>
			OFFICIAL FLOOD READINESS REPORT
		</div>

		<h2 id="complete-title" class="complete-title">FLOOD SURVIVAL TRAINING COMPLETE</h2>
		<p class="complete-sub">6-Level Community Evacuation Simulation Finalized.</p>

		<!-- Score & Grade Banner -->
		<div class="score-banner">
			<div class="score-number-box">
				<span class="score-label">SAFETY SCORE</span>
				<div class="score-display">
					<span class="score-val">{state.safetyScore}</span>
					<span class="score-total">/100</span>
				</div>
			</div>
			<div class="grade-badge {grade.badgeClass}">
				<span class="grade-title">{grade.label}</span>
				<span class="grade-desc">{grade.desc}</span>
			</div>
		</div>

		<!-- Comprehensive Telemetry Stats Grid -->
		<div class="stats-grid">
			<div class="stat-card">
				<span class="stat-label">Training Duration</span>
				<span class="stat-val">{durationText}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Decisions Correct</span>
				<span class="stat-val">{state.decisionsCorrect} / {state.decisionsTotal}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Hazards Avoided</span>
				<span class="stat-val" class:stat-warning={state.hazardsEncountered > 0}>
					{state.hazardsEncountered === 0 ? '100% (0 Hits)' : `${state.hazardsEncountered} Contact(s)`}
				</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Civilians Assisted</span>
				<span class="stat-val">{state.civiliansAssisted} / {state.civiliansTotal}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Civilians at Outpost</span>
				<span class="stat-val">{state.civiliansSafe} / {state.civiliansTotal}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Peak Flood Water Level</span>
				<span class="stat-val water-val">
					{state.maxWaterLevel >= 0 ? `+${state.maxWaterLevel.toFixed(2)}` : state.maxWaterLevel.toFixed(2)} m
				</span>
			</div>
		</div>

		<!-- Strong Areas & Areas to Improve (Spec #17) -->
		<div class="assessment-areas-grid">
			<div class="area-box strong-box">
				<div class="area-head">
					<span class="area-icon">✓</span>
					<span class="area-title">Strong Areas</span>
				</div>
				<ul class="area-list">
					<li>✓ Hazard Recognition &amp; Height Prioritization</li>
					<li>✓ Pre-evacuation Alert Compliance</li>
					{#if state.civiliansAssisted >= 3}
						<li>✓ Active Community Assistance &amp; Escort</li>
					{/if}
				</ul>
			</div>

			<div class="area-box improve-box">
				<div class="area-head">
					<span class="area-icon">△</span>
					<span class="area-title">Practice More</span>
				</div>
				<ul class="area-list">
					{#if state.hazardsEncountered > 0}
						<li>△ Electrical Hazard Clearance (Maintain 10m buffer)</li>
					{:else}
						<li>△ Rapid Evacuation Corridor Selection</li>
					{/if}
					{#if state.decisionsCorrect < state.decisionsTotal}
						<li>△ Turn Around Don't Drown Principle Application</li>
					{:else}
						<li>△ Triage Speed under Rapid Surge Conditions</li>
					{/if}
				</ul>
			</div>
		</div>

		<!-- Key Flood Survival Lessons -->
		<div class="lessons-box">
			<h4 class="lessons-title">Core Flood Safety Lessons Learned</h4>
			<ul class="lessons-list">
				<li>• <strong>Early evacuation is decisive:</strong> Pre-emptive action saves lives before floodwater cuts off roadways.</li>
				<li>• <strong>"Turn Around, Don't Drown":</strong> Just 15 cm (6 in) of moving water can sweep an adult away; 30 cm floats cars.</li>
				<li>• <strong>Avoid electrical infrastructure:</strong> Downed lines energize surrounding standing water and puddles over large radii.</li>
				<li>• <strong>Prioritize vulnerable people:</strong> Give immediate focus to the elderly, mobility-impaired, and separated minors.</li>
				<li>• <strong>Never re-enter flooded homes:</strong> Valuables can be replaced; returning for possessions is a primary fatality cause.</li>
				<li>• <strong>Always climb upward:</strong> Gain steady elevation toward designated plateau checkpoints and official shelters.</li>
			</ul>
		</div>

		<!-- Action Buttons -->
		<div class="actions-row">
			<button type="button" class="btn-secondary" onclick={onReviewScenarios}>
				Review Scenarios ({state.history.length})
			</button>
			<button type="button" class="btn-primary" onclick={onRestart}>
				Restart Training
			</button>
		</div>
	</div>
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
		max-width: 42rem;
		width: 100%;
		padding: 2.2rem;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.9);
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
		color: #0284c7;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
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
		letter-spacing: -0.01em;
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
		color: #0284c7;
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
		letter-spacing: 0.02em;
	}

	.grade-badge.excellent .grade-title { color: #16a34a; }
	.grade-badge.good .grade-title { color: #0284c7; }
	.grade-badge.warning .grade-title { color: #d97706; }
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
		font-size: 0.72rem;
		font-weight: 700;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.stat-val {
		font-size: 1.1rem;
		font-weight: 800;
		color: #0f172a;
	}

	.stat-val.water-val {
		color: #0284c7;
	}

	.stat-val.stat-warning {
		color: #d97706;
	}

	.checklist-section {
		margin-bottom: 1.1rem;
	}

	.section-title {
		margin: 0 0 0.5rem;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #475569;
	}

	.audit-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.audit-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 0.85rem;
		border-radius: 10px;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		font-size: 0.85rem;
		color: #334155;
	}

	.audit-item.done {
		background: #f0fdf4;
		border-color: #dcfce7;
		color: #166534;
	}

	.assessment-areas-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1.2rem;
	}

	.area-box {
		border-radius: 12px;
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.strong-box {
		background: #f0fdf4;
		border: 1.5px solid #bbf7d0;
	}

	.improve-box {
		background: #fff7ed;
		border: 1.5px solid #fed7aa;
	}

	.area-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.strong-box .area-icon,
	.strong-box .area-title {
		color: #15803d;
		font-weight: 800;
		font-size: 0.88rem;
	}

	.improve-box .area-icon,
	.improve-box .area-title {
		color: #c2410c;
		font-weight: 800;
		font-size: 0.88rem;
	}

	.area-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		font-size: 0.82rem;
		line-height: 1.4;
		color: #334155;
	}

	.lessons-box {
		background: #eff6ff;
		border: 1.5px solid #bfdbfe;
		border-radius: 14px;
		padding: 1.1rem 1.25rem;
		margin-bottom: 1.3rem;
	}

	.lessons-title {
		margin: 0 0 0.5rem;
		font-size: 0.88rem;
		font-weight: 800;
		color: #1e40af;
		letter-spacing: 0.02em;
	}

	.lessons-list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.83rem;
		line-height: 1.45;
		color: #1e3a8a;
	}

	.actions-row {
		display: flex;
		justify-content: flex-end;
		gap: 0.85rem;
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
		background: #0284c7;
		color: #ffffff;
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.btn-primary:hover {
		background: #0369a1;
	}

	@media (max-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
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

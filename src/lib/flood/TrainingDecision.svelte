<script lang="ts">
	import { onMount } from 'svelte';
	import type { TrainingEvent, DecisionChoice } from './trainingEvents';
	import type { DecisionRecord, TrainingMode } from './trainingState';

	let {
		event,
		lastRecord,
		trainingMode = 'guided',
		onChoose,
		onContinue
	}: {
		event: TrainingEvent;
		lastRecord: DecisionRecord | null;
		trainingMode?: TrainingMode;
		onChoose: (choiceId: 'A' | 'B' | 'C' | 'D') => void;
		onContinue: () => void;
	} = $props();

	// Step flow: 'brief' (situation only) -> 'decide' (choices unlocked) -> 'feedback' (consequence card)
	let step = $state<'brief' | 'decide' | 'feedback'>('brief');
	let selectedChoiceId = $state<'A' | 'B' | 'C' | 'D' | null>(null);

	// Decision countdown timer
	let decisionSeconds = $state(20);
	let timerNotice = $state<string | null>(null);
	let briefCountdown = $state(3); // 3 seconds observation before auto-showing choices

	onMount(() => {
		decisionSeconds = trainingMode === 'guided' ? 25 : 18;

		// If resuming with an existing record, jump to feedback
		if (lastRecord) {
			step = 'feedback';
			return;
		}

		// Phase B -> Phase C transition timer
		const briefInterval = setInterval(() => {
			if (briefCountdown > 1) {
				briefCountdown -= 1;
			} else {
				clearInterval(briefInterval);
				if (step === 'brief') {
					step = 'decide';
				}
			}
		}, 1000);

		// Decision countdown
		const decisionInterval = setInterval(() => {
			if (step === 'decide') {
				if (decisionSeconds > 1) {
					decisionSeconds -= 1;
				} else {
					// In training simulator: do not penalize slow readers, show encouraging prompt
					timerNotice = 'Take a moment and assess the situation.';
					decisionSeconds = 15; // Provide grace period
				}
			}
		}, 1000);

		const handleKeyDown = (e: KeyboardEvent) => {
			if (step === 'decide' && !lastRecord) {
				if (e.key === 'a' || e.key === 'A' || e.key === '1') handleSelectById('A');
				else if (e.key === 'b' || e.key === 'B' || e.key === '2') handleSelectById('B');
				else if (e.key === 'c' || e.key === 'C' || e.key === '3') handleSelectById('C');
				else if (e.key === 'd' || e.key === 'D' || e.key === '4') handleSelectById('D');
			} else if (step === 'feedback' || lastRecord) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					onContinue();
				}
			} else if (step === 'brief') {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					step = 'decide';
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			clearInterval(briefInterval);
			clearInterval(decisionInterval);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	$effect(() => {
		if (lastRecord) {
			step = 'feedback';
		}
	});

	function unlockChoicesNow() {
		step = 'decide';
	}

	function handleSelectById(id: 'A' | 'B' | 'C' | 'D') {
		const choice = event.choices.find((c) => c.id === id);
		if (choice) handleSelect(choice);
	}

	function handleSelect(choice: DecisionChoice) {
		if (lastRecord || selectedChoiceId) return;
		selectedChoiceId = choice.id;
		onChoose(choice.id);
	}
</script>

<div class="decision-backdrop" role="dialog" aria-modal="true" aria-labelledby="decision-title">
	<div class="decision-card">
		<!-- Header Badge & Status -->
		<div class="card-header-bar">
			<div class="decision-badge">
				<span class="badge-icon">⚠️</span>
				<span>EMERGENCY DECISION PROTOCOL</span>
			</div>

			<!-- Non-stressful decision timer -->
			{#if step === 'decide' && !lastRecord}
				<div class="decision-clock" class:warning={decisionSeconds <= 6}>
					<span class="clock-icon">⏱️</span>
					<span>DECISION TIME: {decisionSeconds}s</span>
				</div>
			{/if}
		</div>

		<h2 id="decision-title" class="decision-title">{event.title}</h2>

		<!-- Phase B: Situation Briefing Panel -->
		<div class="briefing-box">
			<div class="briefing-head">
				<span class="pulse-indicator"></span>
				<span class="briefing-label">SITUATION BRIEFING</span>
			</div>
			<p class="decision-situation">{event.situation}</p>
		</div>

		<!-- Phase C & D: Prompt & Choices -->
		{#if step === 'brief'}
			<div class="reading-phase-box">
				<p class="reading-hint">
					Take a moment to read the briefing carefully. Options unlocking in <strong>{briefCountdown}s</strong>...
				</p>
				<button type="button" class="btn-unlock-choices" onclick={unlockChoicesNow}>
					<span>Ready to Decide</span>
					<span>→</span>
				</button>
			</div>
		{:else}
			<div class="prompt-row">
				<p class="decision-prompt">🎯 <strong>Directive:</strong> {event.prompt}</p>
				{#if timerNotice}
					<span class="timer-notice">{timerNotice}</span>
				{/if}
			</div>

			<!-- Choice List -->
			<div class="choices-list" role="group" aria-label="Available safety options">
				{#each event.choices as choice, idx}
					<button
						type="button"
						class="choice-btn"
						class:selected={selectedChoiceId === choice.id}
						class:correct={lastRecord && choice.isCorrect}
						class:incorrect={lastRecord && selectedChoiceId === choice.id && !choice.isCorrect}
						disabled={lastRecord !== null}
						onclick={() => handleSelect(choice)}
					>
						<span class="choice-letter">{choice.id}</span>
						<span class="choice-text">{choice.text}</span>
						{#if lastRecord}
							{#if choice.isCorrect}
								<span class="result-tag safe">✓ Recommended</span>
							{:else if selectedChoiceId === choice.id}
								<span class="result-tag hazard">⚠ Hazardous</span>
							{/if}
						{:else}
							<span class="key-hint">[{idx + 1}]</span>
						{/if}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Phase E: Educational Micro-Feedback & Consequence -->
		{#if lastRecord}
			<div class="feedback-panel" class:safe={lastRecord.isCorrect} class:unsafe={!lastRecord.isCorrect}>
				<div class="feedback-header">
					{#if lastRecord.isCorrect}
						<span class="verdict-icon">✓</span>
						<span class="verdict-title">SAFE DECISION — PROTOCOL VERIFIED</span>
					{:else}
						<span class="verdict-icon">⚠️</span>
						<span class="verdict-title">
							UNSAFE ACTION {trainingMode === 'guided' ? '(Educational Review)' : '(-15 Safety Score)'}
						</span>
					{/if}
				</div>

				<p class="feedback-detail">{lastRecord.feedback}</p>

				<div class="why-it-matters">
					<div class="matters-head-row">
						<span class="matters-tag">💡 WHY THIS MATTERS FOR SURVIVAL</span>
					</div>
					<p class="matters-text">{lastRecord.whyItMatters}</p>
				</div>

				<div class="continue-row">
					<span class="continue-hint">Press <strong>Enter</strong> or click to proceed</span>
					<button type="button" class="continue-btn" onclick={onContinue}>
						<span>Continue Training</span>
						<span class="btn-arrow">→</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.decision-backdrop {
		position: absolute;
		inset: 0;
		z-index: 55;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
		animation: fadeIn 0.2s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.decision-card {
		background: #ffffff;
		border-radius: 18px;
		max-width: 38rem;
		width: 100%;
		padding: 2rem 2.2rem;
		box-shadow: 0 25px 55px rgba(0, 0, 0, 0.35);
		border: 1px solid rgba(255, 255, 255, 0.9);
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
		animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slideUp {
		from { opacity: 0; transform: translateY(18px) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.card-header-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.decision-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.12em;
		color: #ea580c;
		background: #fff7ed;
		border: 1px solid #fed7aa;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
	}

	.decision-clock {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: #0284c7;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		padding: 0.3rem 0.75rem;
		border-radius: 999px;
		letter-spacing: 0.04em;
	}

	.decision-clock.warning {
		color: #dc2626;
		background: #fef2f2;
		border-color: #fecaca;
		animation: pulseClock 1s infinite;
	}

	@keyframes pulseClock {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.65; }
	}

	.decision-title {
		margin: 0;
		font-size: 1.45rem;
		font-weight: 900;
		color: #0f172a;
		letter-spacing: -0.02em;
		line-height: 1.2;
	}

	.briefing-box {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-left: 4px solid #0284c7;
		border-radius: 10px;
		padding: 0.9rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.briefing-head {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.pulse-indicator {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #0284c7;
	}

	.briefing-label {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		color: #0284c7;
		text-transform: uppercase;
	}

	.decision-situation {
		margin: 0;
		font-size: 0.92rem;
		line-height: 1.5;
		color: #334155;
	}

	.reading-phase-box {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		border-radius: 10px;
		padding: 1rem 1.2rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}

	.reading-hint {
		margin: 0;
		font-size: 0.88rem;
		color: #1e40af;
	}

	.btn-unlock-choices {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		background: #0284c7;
		color: #fff;
		border: none;
		border-radius: 8px;
		padding: 0.55rem 1rem;
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
		flex-shrink: 0;
	}

	.btn-unlock-choices:hover {
		background: #0369a1;
	}

	.prompt-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.8rem;
		margin-top: 0.2rem;
	}

	.decision-prompt {
		margin: 0;
		font-size: 0.94rem;
		font-weight: 700;
		color: #0369a1;
	}

	.timer-notice {
		font-size: 0.78rem;
		font-weight: 700;
		color: #b45309;
		background: #fef3c7;
		padding: 0.2rem 0.5rem;
		border-radius: 6px;
	}

	.choices-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.choice-btn {
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.85rem 1.1rem;
		border-radius: 10px;
		border: 1.5px solid #e2e8f0;
		background: #f8fafc;
		color: #1e293b;
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
		font-size: 0.9rem;
		line-height: 1.45;
	}

	.choice-btn:hover:not(:disabled) {
		background: #eff6ff;
		border-color: #38bdf8;
		transform: translateY(-1px);
	}

	.choice-letter {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 7px;
		background: #e2e8f0;
		color: #334155;
		font-weight: 900;
		font-size: 0.88rem;
		flex-shrink: 0;
	}

	.choice-btn:hover:not(:disabled) .choice-letter {
		background: #0284c7;
		color: #ffffff;
	}

	.choice-text {
		flex: 1;
		font-weight: 500;
	}

	.key-hint {
		font-size: 0.75rem;
		color: #94a3b8;
		font-weight: 700;
	}

	.choice-btn.correct {
		background: #f0fdf4;
		border-color: #22c55e;
	}

	.choice-btn.correct .choice-letter {
		background: #16a34a;
		color: #fff;
	}

	.choice-btn.incorrect {
		background: #fef2f2;
		border-color: #ef4444;
	}

	.choice-btn.incorrect .choice-letter {
		background: #dc2626;
		color: #fff;
	}

	.result-tag {
		font-size: 0.72rem;
		font-weight: 800;
		padding: 0.25rem 0.6rem;
		border-radius: 5px;
	}

	.result-tag.safe {
		background: #dcfce7;
		color: #15803d;
	}

	.result-tag.hazard {
		background: #fee2e2;
		color: #b91c1c;
	}

	/* Feedback Panel */
	.feedback-panel {
		border-radius: 12px;
		padding: 1.15rem 1.3rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		animation: fadeIn 0.2s ease;
	}

	.feedback-panel.safe {
		background: #f0fdf4;
		border: 1.5px solid #86efac;
	}

	.feedback-panel.unsafe {
		background: #fff7ed;
		border: 1.5px solid #fdba74;
	}

	.feedback-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.feedback-panel.safe .verdict-title {
		font-size: 0.95rem;
		font-weight: 800;
		color: #15803d;
	}

	.feedback-panel.unsafe .verdict-title {
		font-size: 0.95rem;
		font-weight: 800;
		color: #c2410c;
	}

	.verdict-icon {
		font-size: 1.15rem;
		font-weight: 800;
	}

	.feedback-detail {
		margin: 0;
		font-size: 0.88rem;
		line-height: 1.48;
		color: #334155;
	}

	.why-it-matters {
		background: #ffffff;
		border-radius: 8px;
		padding: 0.85rem 1rem;
		border: 1px solid rgba(0, 0, 0, 0.08);
	}

	.matters-tag {
		display: block;
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		color: #0284c7;
		margin-bottom: 0.3rem;
	}

	.matters-text {
		margin: 0;
		font-size: 0.84rem;
		line-height: 1.45;
		color: #475569;
	}

	.continue-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 0.3rem;
	}

	.continue-hint {
		font-size: 0.8rem;
		color: #64748b;
	}

	.continue-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.4rem;
		background: #0284c7;
		color: #ffffff;
		border: none;
		border-radius: 8px;
		font-size: 0.92rem;
		font-weight: 800;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.continue-btn:hover {
		background: #0369a1;
	}

	.btn-arrow {
		font-size: 0.9rem;
	}
</style>
